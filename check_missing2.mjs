import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";
import { join } from "path";

const envPath = join("e:/Files/Stock HappyBoy", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
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

async function check() {
  const snap = await getDocs(collection(db, "orders"));
  snap.forEach(doc => {
    const o = doc.data();
    if (!o.isDeleted && o.items) {
      o.items.forEach(i => {
        if (!(i.colorBarcode || '').toString().trim()) {
          console.log(`Order #${o.orderNumber} - Customer: ${o.customerName} - Model: ${i.modelNumber}`);
        }
      });
    }
  });
  process.exit(0);
}
check();
