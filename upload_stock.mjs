import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import fs from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

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

async function run() {
  console.log("Reading تقرير_المخزن_النهائي_محدث.xlsx...");
  const wb = XLSX.readFile(join("e:/Files/Stock HappyBoy", "تقرير_المخزن_النهائي_محدث.xlsx"));
  
  const remainingMap = new Map(); // barcode -> remainingQty
  for (const sheetName of wb.SheetNames) {
    if (sheetName === "الكل") continue; // We only read the category sheets to avoid double counting
    const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
    for (const row of data) {
      const cb = (row["الباركود"] || "").toString().trim();
      if (cb) {
        remainingMap.set(cb, Number(row["باقي"]) || 0);
      }
    }
  }

  console.log("Fetching products from Firebase...");
  const snap = await getDocs(collection(db, "products"));
  let updatedCount = 0;
  
  const localModels = JSON.parse(fs.readFileSync(join("e:/Files/Stock HappyBoy", "models_data.json"), "utf-8"));

  for (const document of snap.docs) {
    const data = document.data();
    let hasChanges = false;
    let newTotalQuantity = 0;
    
    let newColors = [];
    if (data.colors && Array.isArray(data.colors)) {
      newColors = data.colors.map(color => {
        const cb = (color.barcode || "").toString().trim();
        let qty = 0;
        if (cb && remainingMap.has(cb)) {
          qty = remainingMap.get(cb);
        }
        newTotalQuantity += qty;
        
        if (color.quantity !== qty) {
          hasChanges = true;
        }
        return { ...color, quantity: qty };
      });
    }

    if (data.quantity !== newTotalQuantity) {
      hasChanges = true;
    }

    if (hasChanges) {
      // Update Firebase
      await updateDoc(doc(db, "products", document.id), {
        colors: newColors,
        quantity: newTotalQuantity
      });
      
      // Update local models_data.json
      const localProd = localModels.find(p => p.modelNumber === data.modelNumber);
      if (localProd) {
        localProd.colors = newColors;
        localProd.quantity = newTotalQuantity;
      }
      
      updatedCount++;
    }
  }

  fs.writeFileSync(join("e:/Files/Stock HappyBoy", "models_data.json"), JSON.stringify(localModels, null, 2), "utf-8");
  console.log(`Successfully updated ${updatedCount} products in Firebase and local DB.`);
  process.exit(0);
}

run().catch(console.error);
