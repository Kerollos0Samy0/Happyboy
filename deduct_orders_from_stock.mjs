import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
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
  const ordersSnap = await getDocs(collection(db, "orders"));
  
  // Accumulate ordered quantities per model and color barcode
  const orderedQty = {}; // modelNumber -> colorBarcode -> qty
  ordersSnap.forEach(doc => {
      const order = doc.data();
      if (order.items) {
          for (const item of order.items) {
              const modelNum = String(item.modelNumber || item.model).trim();
              const colorBarcode = String(item.colorBarcode).trim();
              const qty = Number(item.quantity) || 0;
              
              if (!orderedQty[modelNum]) orderedQty[modelNum] = {};
              if (!orderedQty[modelNum][colorBarcode]) orderedQty[modelNum][colorBarcode] = 0;
              orderedQty[modelNum][colorBarcode] += qty;
          }
      }
  });
  
  console.log("Fetching products to update stock...");
  const productsSnap = await getDocs(collection(db, "products"));
  let updatedCount = 0;
  
  let reportLog = "تقرير خصم الأوردرات من المخزن:\n\n";

  for (const productDoc of productsSnap.docs) {
      const data = productDoc.data();
      const modelNum = String(data.modelNumber).trim();
      
      if (orderedQty[modelNum]) {
          let modelChanged = false;
          let newTotalQty = 0;
          const newColors = (data.colors || []).map(color => {
              const cb = String(color.barcode).trim();
              let currentQty = Number(color.quantity) || 0;
              
              if (orderedQty[modelNum][cb]) {
                  const qtyToDeduct = orderedQty[modelNum][cb];
                  const newQty = Math.max(0, currentQty - qtyToDeduct);
                  
                  if (currentQty !== newQty) {
                      modelChanged = true;
                      reportLog += `- موديل ${modelNum} (لون: ${color.name}, باركود: ${cb}): تم الخصم ${qtyToDeduct} (الكمية السابقة: ${currentQty} -> الجديدة: ${newQty})\n`;
                      currentQty = newQty;
                  }
                  // We consume it so we don't deduct twice if something is weird
                  orderedQty[modelNum][cb] = 0; 
              }
              newTotalQty += currentQty;
              return { ...color, quantity: currentQty };
          });
          
          if (modelChanged || data.quantity !== newTotalQty) {
              await updateDoc(doc(db, "products", productDoc.id), {
                  colors: newColors,
                  quantity: newTotalQty
              });
              updatedCount++;
          }
      }
  }
  
  console.log(`Updated ${updatedCount} products in the database.`);
  writeFileSync("deduction_report.txt", reportLog, "utf-8");
  console.log("Deduction report saved to deduction_report.txt");
  
  // Optionally, if they want to clear orders, we shouldn't do it unless asked.
  process.exit(0);
}

run().catch(console.error);
