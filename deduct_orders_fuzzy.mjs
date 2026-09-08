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

function normalizeArabic(text) {
  if (!text) return "";
  return text.trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ي$/g, 'ى') // only at the end might be risky, but let's just do it globally or just replace all ى/ي
    .replace(/[يى]/g, 'ي')
    .replace(/\s+/g, ' '); // remove multiple spaces
}

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

  // Read previous deduction report so we don't deduct again if not needed
  // ACTUALLY, deduct_orders_robust.mjs already deducted the ones that perfectly matched.
  // We should ONLY process the 86 left overs.
  // Wait, if we fetch products again, we will re-deduct if we run over all orders. We need to filter orderedItems to only those we haven't deducted!
  // BUT HOW? I can't know which specific order items were deducted because I mutated total quantities.
  // Ah! This is dangerous! If I run it again on ALL orders, I will DOUBLE deduct everything!
  
  // To avoid double deduct, I will just list the mismatches and output a fuzzy-match list for the user to manually verify, or I can just print them.
  console.log("WAIT! Double deduction danger.");
  process.exit(1);
}

run().catch(console.error);
