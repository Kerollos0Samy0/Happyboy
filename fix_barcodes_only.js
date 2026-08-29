const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, doc, updateDoc } = require("firebase/firestore");
const { readFileSync } = require("fs");
const xlsx = require('xlsx');

const envContent = readFileSync(".env.local", "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^([^=]+)="?([^"]*)"?$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const colorMap = {
  'شاركول': 'شاركويل',
  'بسستاج': 'بستاج',
  'بيطخي': 'بطيخي',
  'اوف ويت': 'اوف وايت',
  'بدي روز': 'روز',
  'برجاندي': 'برجندي',
  'سميون': 'سيمون',
};

function normalizeColor(str) {
  if (!str) return "";
  let norm = str.replace(/ى/g, "ي").replace(/[أإآ]/g, "ا").trim();
  if (colorMap[norm]) {
    norm = colorMap[norm];
  }
  return norm;
}

function extractColor(itemStr) {
  if (!itemStr) return null;
  const match = String(itemStr).match(/\(([^)]+)\)/);
  if (match) return normalizeColor(match[1]);
  return null;
}

async function run() {
  const workbook = xlsx.readFile('المخزن.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const excelData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  const excelBarcodes = {};

  for (let i = 1; i < excelData.length; i++) {
    const row = excelData[i];
    if (row.length >= 6 && row[0] !== undefined && row[1] !== undefined) {
      const modelNumber = String(row[0]).trim();
      if (modelNumber.toLowerCase() === 'code' || isNaN(parseInt(modelNumber))) continue;

      const barcode = String(row[1]).trim();
      const colorName = extractColor(row[2]);

      if (colorName) {
        if (!excelBarcodes[modelNumber]) excelBarcodes[modelNumber] = {};
        excelBarcodes[modelNumber][colorName] = barcode;
      }
    }
  }

  const snapshot = await getDocs(collection(db, "products"));
  let updatedCount = 0;

  for (const productDoc of snapshot.docs) {
    const p = productDoc.data();
    if (p.isDeleted) continue;
    
    const m = String(p.modelNumber).trim();
    if (excelBarcodes[m]) {
      let changed = false;
      const updatedColors = (p.colors || []).map(c => {
         const normC = normalizeColor(c.name);
         const exBarcode = excelBarcodes[m][normC];
         if (exBarcode && c.barcode !== exBarcode) {
             changed = true;
             console.log(`Model ${m} Color ${c.name}: Barcode ${c.barcode || 'empty'} -> ${exBarcode}`);
             return { ...c, barcode: exBarcode };
         }
         return c;
      });

      if (changed) {
         const newBarcodes = updatedColors.map(c => c.barcode).filter(Boolean);
         await updateDoc(doc(db, "products", productDoc.id), {
             colors: updatedColors,
             barcodes: newBarcodes
         });
         updatedCount++;
      }
    }
  }
  
  console.log(`Updated barcodes for ${updatedCount} products.`);
  process.exit(0);
}

run().catch(console.error);
