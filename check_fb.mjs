import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

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
  const snap = await getDocs(collection(db, 'products'));
  const allModels = new Set();
  snap.forEach(d => allModels.add(d.data().modelNumber));
  console.log("Firebase Total Models:", allModels.size);
  
  // Also check which models are missing barcodes
  snap.forEach(d => {
    const data = d.data();
    let hasBarcode = false;
    if (data.colors && Array.isArray(data.colors)) {
      for (const c of data.colors) {
        if (c.barcode) hasBarcode = true;
      }
    }
    if (!hasBarcode) console.log("Missing barcode:", data.modelNumber);
  });
  process.exit(0);
}
check();
