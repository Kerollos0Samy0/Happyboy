import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as xlsxImport from 'xlsx';
const xlsx = xlsxImport.default || xlsxImport;

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

// Read excel
const workbook = xlsx.readFile('المخزن.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const excelData = xlsx.utils.sheet_to_json(worksheet);

const excelMap = {};
for (const row of excelData) {
  const modelCode = row['كود الموديل'];
  const barcode = row['الباركود'];
  const qty = row['عدد القطع'];
  
  if (modelCode !== undefined && barcode !== undefined && qty !== undefined) {
    const modelStr = String(modelCode).trim();
    const barcodeStr = String(barcode).trim();
    
    if (!excelMap[modelStr]) {
      excelMap[modelStr] = {};
    }
    excelMap[modelStr][barcodeStr] = parseInt(qty, 10);
  }
}

async function checkMismatch() {
  const snapshot = await getDocs(collection(db, "products"));
  let mismatches = 0;
  
  for (const productDoc of snapshot.docs) {
    const data = productDoc.data();
    const modelStr = String(data.modelNumber).trim();
    const barcodesInExcel = excelMap[modelStr] || {};
    
    let modelMismatch = false;
    for (const color of (data.colors || [])) {
      const barcodeStr = String(color.barcode).trim();
      let expectedQty = barcodesInExcel[barcodeStr] !== undefined ? barcodesInExcel[barcodeStr] : 0;
      if (Number(color.quantity) !== expectedQty) {
        modelMismatch = true;
      }
    }
    if (modelMismatch) mismatches++;
  }

  console.log(`Found ${mismatches} models with mismatched quantities between the website (Firebase) and المخزن.xlsx.`);
  process.exit(0);
}

checkMismatch().catch(console.error);
