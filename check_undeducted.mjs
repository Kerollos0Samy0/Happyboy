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
  console.log("Fetching orders...");
  const ordersSnap = await getDocs(collection(db, "orders"));
  
  const ordered = [];
  ordersSnap.forEach(doc => {
      const order = doc.data();
      if (order.items) {
          for (const item of order.items) {
              ordered.push({
                 modelNum: String(item.modelNumber || item.model).trim(),
                 colorBarcode: String(item.colorBarcode || "").trim(),
                 colorName: String(item.selectedColor || item.color || "").trim(),
                 qty: Number(item.quantity) || 0,
                 orderId: doc.id
              });
          }
      }
  });
  
  const productsSnap = await getDocs(collection(db, "products"));
  const productsDict = {}; // modelNum -> product document data
  
  productsSnap.docs.forEach(doc => {
      const data = doc.data();
      productsDict[String(data.modelNumber).trim()] = data;
  });
  
  let notFound = [];
  
  for (const item of ordered) {
      const prod = productsDict[item.modelNum];
      if (!prod) {
          notFound.push(`Model ${item.modelNum} not found in products for order ${item.orderId}`);
          continue;
      }
      
      // Find matching color
      let matched = false;
      for (const color of (prod.colors || [])) {
          const cb = String(color.barcode).trim();
          if (cb === item.colorBarcode || (!item.colorBarcode && color.name === item.colorName)) {
              matched = true;
              break;
          }
      }
      if (!matched) {
          notFound.push(`Model ${item.modelNum} exists, but color (barcode: ${item.colorBarcode}, name: ${item.colorName}) not found in product for order ${item.orderId}`);
      }
  }
  
  console.log(`Found ${notFound.length} problematic order items.`);
  writeFileSync("problematic_orders.txt", notFound.join("\n"), "utf-8");
  process.exit(0);
}

run().catch(console.error);
