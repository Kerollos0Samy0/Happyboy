import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { readFileSync } from "fs";
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
  const orderedQty = {}; 

  for (const doc of ordersSnap.docs) {
    const order = doc.data();
    if (order.isDeleted) continue;
    
    for (const item of (order.items || [])) {
      const pId = item.id || item.productId;
      if (!pId) continue;
      const color = item.selectedColor;
      const qty = item.quantity || 1;
      
      if (!orderedQty[pId]) orderedQty[pId] = {};
      if (!orderedQty[pId][color]) orderedQty[pId][color] = 0;
      orderedQty[pId][color] += qty;
    }
  }

  const productsSnap = await getDocs(collection(db, "products"));
  let grandTotal = 0;
  let currentGrandTotal = 0;
  let zeros = 0;
  
  for (const productDoc of productsSnap.docs) {
    const data = productDoc.data();
    let updatedColors = data.colors ? [...data.colors] : [];
    const pId = productDoc.id;
    
    let originalProductTotal = 0;
    
    for (const c of updatedColors) {
      const currentQty = Number(c.quantity) || 0;
      const ordered = orderedQty[pId] && orderedQty[pId][c.name] ? orderedQty[pId][c.name] : 0;
      const originalQty = currentQty + ordered;
      
      originalProductTotal += originalQty;
      currentGrandTotal += currentQty;
      grandTotal += originalQty;
    }
    
    if (data.quantity === 0) {
       zeros++;
    }
  }

  console.log("Current Inventory Total:", currentGrandTotal);
  console.log("Original Inventory Total (Current + Orders):", grandTotal);
  console.log("Models that are currently 0:", zeros);
}

run().catch(console.error);
