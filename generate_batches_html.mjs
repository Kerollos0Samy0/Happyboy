import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, orderBy, query } from "firebase/firestore";
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
  console.log("Fetching orders...");
  const ordersSnap = await getDocs(query(collection(db, "orders"))); // We can't orderBy easily without knowing index, so we just fetch
  
  const allOrders = [];
  ordersSnap.forEach(doc => {
      const d = doc.data();
      if (d.deleted === true || d.isDeleted === true || d.status === 'shipped' || d.status === 'delivered') return;
      allOrders.push({ id: doc.id, ...d });
  });

  // Sort orders by createdAt if available, or just by orderNumber
  allOrders.sort((a, b) => {
      const numA = parseInt(a.orderNumber) || 0;
      const numB = parseInt(b.orderNumber) || 0;
      return numA - numB;
  });

  const BATCH_SIZE = 10;
  let html = `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
      <meta charset="UTF-8">
      <title>طباعة دفعات الأوردرات</title>
      <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; margin: 0; padding: 20px; }
          .page-break { page-break-after: always; clear: both; margin-bottom: 20px; }
          .batch-header { background-color: #333; color: white; padding: 10px; text-align: center; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
          th { background-color: #f2f2f2; }
          .invoice-header { display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .invoice-title { font-size: 24px; font-weight: bold; }
          .summary { font-size: 16px; font-weight: bold; margin-top: 10px; }
          @media print {
              body { padding: 0; margin: 0; }
              @page { margin: 10mm; }
          }
      </style>
  </head>
  <body>
  `;

  let batchIndex = 1;
  for (let i = 0; i < allOrders.length; i += BATCH_SIZE) {
      const batch = allOrders.slice(i, i + BATCH_SIZE);
      
      // 1. Generate Pick List for the batch
      let pickMap = {}; // model -> color -> { barcode, qty }
      
      batch.forEach(order => {
          if (order.items) {
              order.items.forEach(item => {
                  const m = String(item.modelNumber || item.model).trim();
                  const c = String(item.selectedColor || item.color || "").trim();
                  const b = String(item.colorBarcode || "").trim();
                  const qty = Number(item.quantity) || 0;
                  
                  if (!pickMap[m]) pickMap[m] = {};
                  const key = b ? `${c}__${b}` : `${c}__NOBARCODE`;
                  if (!pickMap[m][key]) {
                      pickMap[m][key] = { colorName: c, barcode: b, qty: 0 };
                  }
                  pickMap[m][key].qty += qty;
              });
          }
      });
      
      html += `
      <div class="batch-header">
          <h2>الدفعة رقم ${batchIndex} (تحتوي على ${batch.length} أوردرات)</h2>
      </div>
      <h3>قائمة التجميع المجمعة (Pick List) - للدفعة رقم ${batchIndex}</h3>
      <p>يتم إعطاء هذه الورقة لأمين المخزن لجمع جميع الأصناف المطلوبة للـ ${batch.length} عملاء مرة واحدة.</p>
      <table>
          <thead>
              <tr>
                  <th>الموديل</th>
                  <th>اللون</th>
                  <th>الباركود</th>
                  <th>الكمية الإجمالية المطلوبة</th>
              </tr>
          </thead>
          <tbody>
      `;
      
      // Sort models logically
      const sortedModels = Object.keys(pickMap).sort((a,b) => parseInt(a) - parseInt(b));
      
      let totalPiecesInBatch = 0;
      for (const m of sortedModels) {
          for (const k in pickMap[m]) {
              const info = pickMap[m][k];
              totalPiecesInBatch += info.qty;
              html += `
              <tr>
                  <td><strong>${m}</strong></td>
                  <td>${info.colorName || '-'}</td>
                  <td>${info.barcode || '-'}</td>
                  <td><strong style="font-size: 16px;">${info.qty}</strong></td>
              </tr>
              `;
          }
      }
      
      html += `
          </tbody>
      </table>
      <div class="summary">إجمالي القطع في هذه الدفعة: ${totalPiecesInBatch}</div>
      <div class="page-break"></div>
      `;
      
      // 2. Generate Invoices for the batch
      batch.forEach(order => {
          html += `
          <div class="invoice-header">
              <div>
                  <div class="invoice-title">فاتورة مبيعات</div>
                  <div>تاريخ الأوردر: ${order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString("ar-EG") : '-'}</div>
                  <div>رقم الأوردر: <strong>${order.orderNumber || order.id}</strong></div>
              </div>
              <div>
                  <div>اسم العميل: <strong>${order.customerName || order.customerBrand || '-'}</strong></div>
                  <div>رقم الهاتف: ${order.customerPhone || '-'}</div>
                  <div>المحافظة/العنوان: ${order.customerGovernorate || ''} - ${order.customerAddress || ''}</div>
              </div>
          </div>
          <table>
              <thead>
                  <tr>
                      <th>الموديل</th>
                      <th>الصنف</th>
                      <th>اللون</th>
                      <th>المقاسات</th>
                      <th>الكمية</th>
                      <th>السعر</th>
                      <th>الإجمالي</th>
                  </tr>
              </thead>
              <tbody>
          `;
          
          let orderTotalQty = 0;
          if (order.items) {
              order.items.forEach(item => {
                  const m = item.modelNumber || item.model || '';
                  const n = item.name || '';
                  const c = item.selectedColor || item.color || '';
                  const s = (item.sizes && Array.isArray(item.sizes)) ? item.sizes.join("، ") : '';
                  const qty = Number(item.quantity) || 0;
                  const price = Number(item.price) || 0;
                  const total = qty * price;
                  orderTotalQty += qty;
                  
                  html += `
                  <tr>
                      <td>${m}</td>
                      <td>${n}</td>
                      <td>${c}</td>
                      <td>${s}</td>
                      <td>${qty}</td>
                      <td>${price}</td>
                      <td>${total}</td>
                  </tr>
                  `;
              });
          }
          
          html += `
              </tbody>
          </table>
          <div style="display:flex; justify-content:space-between;">
              <div class="summary">إجمالي عدد القطع للأوردر: ${orderTotalQty}</div>
              <div class="summary">إجمالي الفاتورة: ${order.total || 0} جنيه</div>
          </div>
          <div class="page-break"></div>
          `;
      });
      
      batchIndex++;
  }
  
  html += `
  </body>
  </html>
  `;
  
  writeFileSync("print_batches.html", html, "utf-8");
  console.log(`Generated HTML with ${batchIndex - 1} batches.`);
  process.exit(0);
}

run().catch(console.error);
