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
  const productsSnap = await getDocs(collection(db, "products"));
  const fbMap = {}; 
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

  const workbook = xlsx.readFile('المخزن.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const excelData = xlsx.utils.sheet_to_json(worksheet);

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

  const ordersSnap = await getDocs(collection(db, "orders"));
  const allOrders = [];
  ordersSnap.forEach(doc => {
      const d = doc.data();
      if (d.deleted === true || d.isDeleted === true || d.status === 'shipped' || d.status === 'delivered') return;
      allOrders.push({ id: doc.id, ...d });
  });

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
              shortages.push(`موديل ${m} (لون: ${c}) - المطلوب: ${qty}، المتاح: ${trulyAvailable}`);
          }
      }
      
      if (canFulfill) {
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

  // Generate HTML Report
  let html = `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
      <meta charset="UTF-8">
      <title>تقرير حالة الأوردرات</title>
      <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; background: #f9f9f9; }
          .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 900px; margin: 0 auto; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
          th { background-color: #f2f2f2; }
          h1, h2, h3 { color: #333; }
          h2 { border-bottom: 2px solid #ddd; padding-bottom: 5px; margin-top: 30px; }
          .shortage-item { color: #e74c3c; font-weight: bold; margin: 5px 0; }
          .success { color: #27ae60; font-weight: bold; }
          .danger { color: #e74c3c; font-weight: bold; }
      </style>
  </head>
  <body>
      <div class="container">
          <h1>تقرير حالة الأوردرات والنواقص</h1>
          <p><strong>إجمالي الأوردرات النشطة:</strong> ${allOrders.length}</p>
          <p class="success"><strong>أوردرات مكتملة وجاهزة للتجهيز:</strong> ${readyOrders.length}</p>
          <p class="danger"><strong>أوردرات بها نواقص:</strong> ${shortageOrders.length}</p>
          
          <h2>✅ الأوردرات الجاهزة للتجهيز فوراً (مكتملة 100%)</h2>
          <p>هذه الأوردرات متوفرة بالكامل في المخزن، وتم حجز كمياتها لضمان عدم حدوث عجز.</p>
          <table>
              <thead>
                  <tr>
                      <th>رقم الأوردر</th>
                      <th>اسم العميل</th>
                      <th>إجمالي الفاتورة</th>
                      <th>عدد القطع</th>
                  </tr>
              </thead>
              <tbody>
  `;
  
  readyOrders.forEach(o => {
      let q = 0;
      (o.items||[]).forEach(i => q += (Number(i.quantity)||0));
      html += `<tr><td>${o.orderNumber || o.id}</td><td>${o.customerName || o.customerBrand || '-'}</td><td>${o.total || 0} ج.م</td><td>${q}</td></tr>`;
  });
  
  html += `
              </tbody>
          </table>
          
          <h2>❌ الأوردرات التي بها نواقص</h2>
          <p>هذه الأوردرات بها صنف أو أكثر غير متوفر بالكمية المطلوبة (أو غير مسجل في شيت الإكسيل إطلاقاً مثل موديلات 150, 165, 700, 900 وغيرها)، وبالتالي لا يمكن تجهيزها بالكامل حالياً.</p>
  `;
  
  shortageOrders.forEach(o => {
      html += `<h3>أوردر رقم: ${o.orderNumber || o.id} (العميل: ${o.customerName || o.customerBrand || '-'})</h3><ul>`;
      o._shortages.forEach(s => {
          html += `<li class="shortage-item">عجز في: ${s}</li>`;
      });
      html += `</ul>`;
  });
  
  html += `
      </div>
  </body>
  </html>
  `;
  
  writeFileSync("public/orders_status_report.html", html, "utf-8");
  console.log("HTML Report written to public/orders_status_report.html");
  process.exit(0);
}

run().catch(console.error);
