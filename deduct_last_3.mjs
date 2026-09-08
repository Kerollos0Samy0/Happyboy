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
  console.log("Fetching orders to find quantities...");
  const ordersSnap = await getDocs(collection(db, "orders"));
  
  let qty121 = 0;
  let qty178 = 0;
  let qty258 = 0;

  ordersSnap.forEach(doc => {
      const order = doc.data();
      const orderNum = order.orderNumber || doc.id;
      if (order.items) {
          for (const item of order.items) {
              const m = String(item.modelNumber || item.model).trim();
              if (orderNum === "00121" && m === "200") qty121 += Number(item.quantity) || 0;
              if (orderNum === "00178" && m === "200") qty178 += Number(item.quantity) || 0;
              if (orderNum === "00258" && m === "635") qty258 += Number(item.quantity) || 0;
          }
      }
  });

  console.log(`Quantities to deduct - Order 121 (mod 200): ${qty121}, Order 178 (mod 200): ${qty178}, Order 258 (mod 635): ${qty258}`);

  const productsSnap = await getDocs(collection(db, "products"));
  let updatedCount = 0;

  for (const productDoc of productsSnap.docs) {
      const data = productDoc.data();
      const modelNum = String(data.modelNumber).trim();
      
      let modelChanged = false;
      let newTotalQty = 0;

      if (modelNum === "200") {
          const newColors = (data.colors || []).map(color => {
              let currentQty = Number(color.quantity) || 0;
              if (color.name === "زيتي" && qty121 > 0) {
                  currentQty = Math.max(0, currentQty - qty121);
                  qty121 = 0;
                  modelChanged = true;
              } else if (color.name === "برجاندي" && qty178 > 0) {
                  currentQty = Math.max(0, currentQty - qty178);
                  qty178 = 0;
                  modelChanged = true;
              }
              newTotalQty += currentQty;
              return { ...color, quantity: currentQty };
          });
          if (modelChanged) {
              await updateDoc(doc(db, "products", productDoc.id), {
                  colors: newColors,
                  quantity: newTotalQty
              });
              updatedCount++;
          }
      } else if (modelNum === "635") {
          const newColors = (data.colors || []).map(color => {
              let currentQty = Number(color.quantity) || 0;
              if (color.name === "بستاج" && qty258 > 0) {
                  currentQty = Math.max(0, currentQty - qty258);
                  qty258 = 0;
                  modelChanged = true;
              }
              newTotalQty += currentQty;
              return { ...color, quantity: currentQty };
          });
          if (modelChanged) {
              await updateDoc(doc(db, "products", productDoc.id), {
                  colors: newColors,
                  quantity: newTotalQty
              });
              updatedCount++;
          }
      }
  }

  console.log(`Updated ${updatedCount} products.`);
  process.exit(0);
}

run().catch(console.error);
