import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as xlsxImport from 'xlsx';
const xlsx = xlsxImport.default || xlsxImport;

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, ".env.local");
const envContent = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^([^=]+)="?([^"]*)"?$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
});
const db = getFirestore(app);

// Simple normalization just in case
function normalize(str) {
  if (!str) return "";
  return str.trim()
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ي$/g, 'ى')
    .replace(/[يى]/g, 'ي')
    .replace(/\s+/g, '')
    .replace(/شاركول/g, 'شاركويل')
    .replace(/اوفوايت/g, 'اوفوايت')
    .replace(/بسستاج/g, 'بستاج'); 
}

async function run() {
  console.log("Fetching products to build name -> barcode map...");
  const productsSnap = await getDocs(collection(db, "products"));
  const fbMap = {}; // model -> normColor -> barcode
  productsSnap.forEach(doc => {
      const data = doc.data();
      const m = String(data.modelNumber).trim();
      fbMap[m] = {};
      (data.colors || []).forEach(c => {
          const b = String(c.barcode || "").trim();
          const n = normalize(c.name);
          if (b && n) fbMap[m][n] = b;
      });
  });

  console.log("Reading initial stock from المخزن.xlsx...");
  const workbook = xlsx.readFile('المخزن.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const excelData = xlsx.utils.sheet_to_json(worksheet);

  // stockMap: model -> barcode -> qty
  const stockMap = {};
  for (const row of excelData) {
      const modelCode = row['كود الموديل'];
      const barcode = row['الباركود'];
      const qty = row['عدد القطع'];
      
      if (modelCode !== undefined && barcode !== undefined && qty !== undefined) {
          const m = String(modelCode).trim();
          const b = String(barcode).trim();
          const parsedQty = parseInt(qty, 10) || 0;
          if (!stockMap[m]) stockMap[m] = {};
          stockMap[m][b] = (stockMap[m][b] || 0) + parsedQty;
      }
  }

  console.log("Fetching orders...");
  const ordersSnap = await getDocs(collection(db, "orders"));
  const allOrders = [];
  ordersSnap.forEach(doc => {
      const d = doc.data();
      if (d.deleted === true || d.isDeleted === true || d.status === 'shipped' || d.status === 'delivered') return;
      allOrders.push({ id: doc.id, ...d });
  });

  // Sort orders by orderNumber ascending to process them fairly
  allOrders.sort((a, b) => {
      const numA = parseInt(a.orderNumber) || 0;
      const numB = parseInt(b.orderNumber) || 0;
      return numA - numB;
  });

  const readyOrders = [];
  const shortageOrders = [];

  for (const order of allOrders) {
      if (!order.items || order.items.length === 0) continue;
      
      let canFulfill = true;
      const deductions = [];
      const shortages = [];
      
      for (const item of order.items) {
          const m = String(item.modelNumber || item.model).trim();
          let b = String(item.colorBarcode || "").trim();
          const c = String(item.selectedColor || item.color || "").trim();
          const nc = normalize(c);
          const qty = Number(item.quantity) || 0;
          
          if (qty <= 0) continue;

          // If no barcode, try to lookup from Firebase map
          if (!b && fbMap[m] && fbMap[m][nc]) {
              b = fbMap[m][nc];
          }

          let available = 0;
          if (b && stockMap[m] && stockMap[m][b] !== undefined) {
              available = stockMap[m][b];
          }
          
          let alreadyDeductedThisOrder = 0;
          for (const d of deductions) {
              if (d.model === m && d.barcode === b) {
                  alreadyDeductedThisOrder += d.qty;
              }
          }
          
          const trulyAvailable = Math.max(0, available - alreadyDeductedThisOrder);
          
          if (trulyAvailable >= qty) {
              deductions.push({ model: m, barcode: b, qty: qty });
          } else {
              canFulfill = false;
              shortages.push(`موديل ${m} (لون: ${c}) - المطلوب: ${qty}, المتاح: ${trulyAvailable}`);
          }
      }
      
      if (canFulfill) {
          // Deduct physically
          for (const d of deductions) {
              if (d.barcode && stockMap[d.model] && stockMap[d.model][d.barcode] !== undefined) {
                  stockMap[d.model][d.barcode] -= d.qty;
              }
          }
          readyOrders.push(order);
      } else {
          order._shortages = shortages;
          shortageOrders.push(order);
      }
  }

  // Generate Report
  let md = `# تقرير حالة الأوردرات والتجهيز\n\n`;
  md += `**إجمالي الأوردرات:** ${allOrders.length}\n`;
  md += `**أوردرات مكتملة وجاهزة للتجهيز:** ${readyOrders.length}\n`;
  md += `**أوردرات بها نواقص:** ${shortageOrders.length}\n\n`;
  
  md += `---\n\n`;
  md += `## ✅ الأوردرات الجاهزة للتجهيز فوراً (مكتملة 100%)\n\n`;
  md += `هذه الأوردرات متوفرة بالكامل في المخزن، وتم حجز كمياتها لضمان عدم حدوث عجز:\n\n`;
  md += `| رقم الأوردر | اسم العميل | إجمالي الفاتورة | عدد القطع |\n`;
  md += `|-------------|------------|-----------------|-----------|\n`;
  readyOrders.forEach(o => {
      let q = 0;
      (o.items||[]).forEach(i => q += (Number(i.quantity)||0));
      md += `| ${o.orderNumber || o.id} | ${o.customerName || o.customerBrand || '-'} | ${o.total || 0} | ${q} |\n`;
  });
  
  md += `\n---\n\n`;
  md += `## ❌ الأوردرات التي بها نواقص (تحتاج تدخل أو إلغاء عناصر)\n\n`;
  md += `هذه الأوردرات بها صنف أو أكثر غير متوفر بالكمية المطلوبة، وبالتالي لا يمكن تجهيزها بالكامل حالياً:\n\n`;
  shortageOrders.forEach(o => {
      md += `### أوردر رقم: ${o.orderNumber || o.id} (العميل: ${o.customerName || o.customerBrand || '-'})\n`;
      o._shortages.forEach(s => {
          md += `- ⚠️ **عجز في:** ${s}\n`;
      });
      md += `\n`;
  });
  
  writeFileSync("orders_status_report2.md", md, "utf-8");
  console.log(`Report written. Ready: ${readyOrders.length}, Shortages: ${shortageOrders.length}`);
  process.exit(0);
}

run().catch(console.error);
