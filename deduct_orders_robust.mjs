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
                  orderId: doc.id
              });
          }
      }
  });

  console.log("Fetching products to update stock...");
  const productsSnap = await getDocs(collection(db, "products"));
  let updatedCount = 0;
  
  let reportLog = "تقرير خصم الأوردرات من المخزن (الإصدار المحسن):\n\n";
  let missedItems = [...orderedItems];

  for (const productDoc of productsSnap.docs) {
      const data = productDoc.data();
      const modelNum = String(data.modelNumber).trim();
      
      // Find all ordered items for this model
      const itemsForThisModel = missedItems.filter(i => i.modelNum === modelNum && i.qty > 0);
      
      if (itemsForThisModel.length > 0) {
          let modelChanged = false;
          let newTotalQty = 0;
          
          const newColors = (data.colors || []).map(color => {
              const cb = String(color.barcode || "").trim();
              const cn = String(color.name || "").trim();
              let currentQty = Number(color.quantity) || 0;
              
              for (const item of itemsForThisModel) {
                  if (item.qty <= 0) continue;
                  
                  // Match by barcode if both exist and match, OR if barcode doesn't exist/match, try color name
                  let matches = false;
                  if (item.colorBarcode && cb && item.colorBarcode === cb) {
                      matches = true;
                  } else if (item.colorName && cn && item.colorName === cn) {
                      matches = true;
                  }
                  
                  if (matches) {
                      const qtyToDeduct = item.qty;
                      const newQty = Math.max(0, currentQty - qtyToDeduct);
                      
                      if (currentQty !== newQty) {
                          modelChanged = true;
                          reportLog += `- موديل ${modelNum} (لون: ${cn}, باركود: ${cb}): تم الخصم ${currentQty - newQty} (الكمية السابقة: ${currentQty} -> الجديدة: ${newQty})\n`;
                          currentQty = newQty;
                      }
                      
                      // if we deducted, mark this item as processed
                      item.qty = 0; 
                  }
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
  
  const stillMissed = missedItems.filter(i => i.qty > 0);
  if (stillMissed.length > 0) {
      reportLog += "\n---\nموديلات لم يتم العثور عليها في المخزن:\n";
      stillMissed.forEach(i => {
          reportLog += `- موديل ${i.modelNum} (لون: ${i.colorName}, باركود: ${i.colorBarcode}) بكمية ${i.qty}\n`;
      });
  }
  
  console.log(`Updated ${updatedCount} products in the database.`);
  writeFileSync("deduction_report2.txt", reportLog, "utf-8");
  console.log(`Leftover missing: ${stillMissed.length}`);
  
  process.exit(0);
}

run().catch(console.error);
