import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
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

const modelsPath = join(__dirname, "models_data.json");
const productsList = JSON.parse(readFileSync(modelsPath, "utf-8"));

async function updateExistingModels() {
  console.log("Fetching existing products...");
  const snapshot = await getDocs(collection(db, "products"));
  const existingModels = new Map();
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.modelNumber) {
      existingModels.set(String(data.modelNumber).trim(), { id: doc.id, data });
    }
  });

  let updated = 0;
  for (const product of productsList) {
    const modelNum = String(product.modelNumber).trim();
    if (existingModels.has(modelNum)) {
      const dbDoc = existingModels.get(modelNum);
      const dbData = dbDoc.data;
      
      let changed = false;
      
      // Merge sizes
      const dbSizes = new Set(dbData.sizes || []);
      const newSizes = [...dbData.sizes || []];
      for (const size of product.sizes) {
        if (!dbSizes.has(size)) {
          newSizes.push(size);
          changed = true;
        }
      }
      
      // Merge barcodes
      const dbBarcodes = new Set(dbData.barcodes || []);
      const newBarcodes = [...dbData.barcodes || []];
      for (const bc of product.barcodes) {
        if (!dbBarcodes.has(bc)) {
          newBarcodes.push(bc);
          changed = true;
        }
      }

      // Merge colors
      const dbColorNames = new Set((dbData.colors || []).map(c => c.name));
      const newColors = [...dbData.colors || []];
      for (const color of product.colors) {
        if (!dbColorNames.has(color.name)) {
          // If color has quantity in JSON, use it, else 0
          newColors.push({ ...color, quantity: color.quantity || 0 });
          changed = true;
        }
      }

      if (changed) {
        console.log(`Updating existing model: ${modelNum} with new sizes/colors/barcodes`);
        await updateDoc(doc(db, "products", dbDoc.id), {
          sizes: newSizes.sort((a, b) => isNaN(a) ? a.localeCompare(b) : Number(a) - Number(b)),
          barcodes: newBarcodes.sort((a, b) => isNaN(a) ? a.localeCompare(b) : Number(a) - Number(b)),
          colors: newColors
        });
        updated++;
      }
    }
  }
  
  console.log(`Updated ${updated} existing models.`);
  process.exit(0);
}

updateExistingModels().catch(err => {
  console.error(err);
  process.exit(1);
});
