import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as xlsxImport from 'xlsx';
const xlsx = xlsxImport.default || xlsxImport;

// Load env from .env.local
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

// Read excel
console.log("Reading المخزن.xlsx...");
const workbook = xlsx.readFile('المخزن.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const excelData = xlsx.utils.sheet_to_json(worksheet);

// Calculate total quantity per model
const modelQuantities = {};
for (const row of excelData) {
  if (row.Code && row['عدد القطع'] !== undefined) {
    const codeStr = String(row.Code);
    const modelNumber = codeStr.split('&')[0];
    if (!modelQuantities[modelNumber]) {
      modelQuantities[modelNumber] = 0;
    }
    modelQuantities[modelNumber] += parseInt(row['عدد القطع'], 10);
  }
}

console.log(`Found quantities for ${Object.keys(modelQuantities).length} models in Excel.`);

async function updateQuantities() {
  console.log("Fetching products from Firebase...");
  const snapshot = await getDocs(collection(db, "products"));
  let updated = 0;
  let notFound = 0;

  for (const productDoc of snapshot.docs) {
    const data = productDoc.data();
    const modelNumber = String(data.modelNumber);
    
    if (modelQuantities[modelNumber] !== undefined) {
      const newQuantity = modelQuantities[modelNumber];
      await updateDoc(doc(db, "products", productDoc.id), {
        quantity: newQuantity
      });
      console.log(`Updated model ${modelNumber}: new qty = ${newQuantity}`);
      updated++;
    } else {
      console.log(`Model ${modelNumber} not found in Excel data.`);
      notFound++;
    }
  }

  console.log(`\nSuccessfully updated ${updated} products. ${notFound} products were not found in Excel.`);
  process.exit(0);
}

updateQuantities().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
