import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

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

async function run() {
  const ordersSnap = await getDocs(collection(db, "orders"));
  const productsSnap = await getDocs(collection(db, "products"));
  
  const productsDict = {};
  productsSnap.forEach(doc => {
      const data = doc.data();
      productsDict[String(data.modelNumber).trim()] = data;
  });

  const orderedItems = [];
  ordersSnap.forEach(doc => {
      const order = doc.data();
      if (order.items) {
          for (const item of order.items) {
              orderedItems.push({
                  modelNum: String(item.modelNumber || item.model).trim(),
                  colorBarcode: String(item.colorBarcode || "").trim(),
                  colorName: String(item.selectedColor || item.color || "").trim(),
                  qty: Number(item.quantity) || 0,
                  orderId: order.orderNumber || doc.id
              });
          }
      }
  });
  
  let md = "# تقرير الموديلات التي لم يتم خصمها\n\n";
  md += "بعض المنتجات في الأوردرات لم يتم خصمها من المخزن نظراً لعدم تطابق اسم اللون أو الباركود المسجل في الأوردر مع المسجل في المخزن. إليك التفاصيل للرجوع إليها:\n\n";
  md += "| رقم الأوردر | الموديل | اللون في الأوردر | الباركود في الأوردر | الكمية | الألوان المتاحة في المخزن للموديل |\n";
  md += "|-------------|---------|------------------|---------------------|--------|-----------------------------------|\n";

  let totalMissed = 0;
  
  // Notice: The previous script deducted items if they matched EXACTLY. So we only need to report the ones that do NOT match EXACTLY.
  for (const item of orderedItems) {
      if (item.qty <= 0) continue;
      
      const prod = productsDict[item.modelNum];
      if (!prod) {
          md += `| ${item.orderId} | ${item.modelNum} | ${item.colorName || '-'} | ${item.colorBarcode || '-'} | ${item.qty} | *الموديل غير موجود* |\n`;
          totalMissed++;
          continue;
      }
      
      let matched = false;
      let availableColors = [];
      for (const color of (prod.colors || [])) {
          const cb = String(color.barcode || "").trim();
          const cn = String(color.name || "").trim();
          availableColors.push(`${cn} (${cb})`);
          
          if (item.colorBarcode && cb && item.colorBarcode === cb) {
              matched = true;
          } else if (item.colorName && cn && item.colorName === cn) {
              matched = true;
          }
      }
      
      if (!matched) {
          md += `| ${item.orderId} | ${item.modelNum} | ${item.colorName || '-'} | ${item.colorBarcode || '-'} | ${item.qty} | ${availableColors.join("، ")} |\n`;
          totalMissed++;
      }
  }

  writeFileSync("missing_deductions.md", md, "utf-8");
  console.log(`Wrote ${totalMissed} missing items to missing_deductions.md`);
  process.exit(0);
}

run().catch(console.error);
