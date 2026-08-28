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

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkAll() {
  console.log("Fetching products from Firebase...");
  const snapshot = await getDocs(collection(db, "products"));
  
  const barcodeMap = new Map(); // barcode -> [{model, color}]
  let totalModels = 0;
  let modelsWithoutBarcodes = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const modelNum = String(data.modelNumber).trim();
    totalModels++;
    
    let hasBarcode = false;
    
    if (data.colors && Array.isArray(data.colors)) {
      data.colors.forEach(c => {
        if (c.barcode && String(c.barcode).trim() !== "") {
          hasBarcode = true;
          const bc = String(c.barcode).trim();
          if (!barcodeMap.has(bc)) barcodeMap.set(bc, []);
          barcodeMap.get(bc).push({ model: modelNum, color: c.name });
        }
      });
    }
    
    if (data.barcodes && Array.isArray(data.barcodes)) {
      data.barcodes.forEach(bc => {
        if (String(bc).trim() !== "") {
          hasBarcode = true;
          const strBc = String(bc).trim();
          if (!barcodeMap.has(strBc)) barcodeMap.set(strBc, []);
          // only add if not already added by color
          const existing = barcodeMap.get(strBc);
          if (!existing.some(e => e.model === modelNum)) {
            existing.push({ model: modelNum, color: "unspecified/general" });
          }
        }
      });
    }
    
    if (!hasBarcode) {
      modelsWithoutBarcodes.push(modelNum);
    }
  });
  
  let duplicateBarcodes = 0;
  console.log("\n--- Duplicate Barcodes Analysis ---");
  for (const [bc, uses] of barcodeMap.entries()) {
    if (uses.length > 1) {
      // Check if they are the exact same model & color (which is fine, just a data structure artifact)
      const uniqueUses = [...new Set(uses.map(u => u.model))];
      if (uniqueUses.length > 1) {
        duplicateBarcodes++;
        console.log(`Barcode ${bc} is used in multiple models: ${uniqueUses.join(", ")}`);
      }
    }
  }
  if (duplicateBarcodes === 0) console.log("No duplicate barcodes across different models found! ✅");
  
  console.log(`\n--- Summary ---`);
  console.log(`Total Models: ${totalModels}`);
  console.log(`Total Unique Barcodes: ${barcodeMap.size}`);
  
  if (modelsWithoutBarcodes.length > 0) {
    console.log(`⚠️ Models without any barcodes: ${modelsWithoutBarcodes.join(", ")}`);
  } else {
    console.log(`All models have barcodes assigned! ✅`);
  }
  
  process.exit(0);
}

checkAll().catch(console.error);
