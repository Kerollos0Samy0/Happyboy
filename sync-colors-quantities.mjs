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

// Extract color from string like "ترنج اولادى (انديجو)" or "ترنج اولادى(اسود)"
function extractColor(itemStr) {
  if (!itemStr) return null;
  const match = itemStr.match(/\(([^)]+)\)/);
  if (match) {
    return match[1].trim();
  }
  return null;
}

// Group data: { modelNumber: { totalQty: X, colors: { "انديجو": Y, "اسود": Z } } }
const modelsData = {};

for (const row of excelData) {
  if (row.Code !== undefined && row['عدد القطع'] !== undefined) {
    const modelNumber = String(row.Code).trim();
    const colorName = extractColor(row.items);
    const qty = parseInt(row['عدد القطع'], 10);

    if (!modelsData[modelNumber]) {
      modelsData[modelNumber] = { totalQty: 0, colors: {} };
    }
    
    modelsData[modelNumber].totalQty += qty;
    if (colorName) {
      if (!modelsData[modelNumber].colors[colorName]) {
        modelsData[modelNumber].colors[colorName] = 0;
      }
      modelsData[modelNumber].colors[colorName] += qty;
    }
  }
}

console.log(`Parsed quantities for ${Object.keys(modelsData).length} models in Excel.`);

async function updateQuantities() {
  console.log("Fetching products from Firebase...");
  const snapshot = await getDocs(collection(db, "products"));
  let updated = 0;
  let notFound = 0;

  for (const productDoc of snapshot.docs) {
    const product = productDoc.data();
    const modelNumber = String(product.modelNumber).trim();
    
    if (modelsData[modelNumber] !== undefined) {
      const excelModelData = modelsData[modelNumber];
      const newTotalQty = excelModelData.totalQty;
      
      // Update color quantities in the colors array
      const updatedColors = (product.colors || []).map(colorObj => {
        // Find matching color name in excel data
        // Sometimes names might have slight differences like "رمادى" vs "رمادي", "انديجو" vs "أنديجو", so we could normalize but let's try direct match first
        // Simple normalization: replace "ى" with "ي", "أ" with "ا", "إ" with "ا"
        const normalize = (str) => str.replace(/ى/g, "ي").replace(/[أإآ]/g, "ا").trim();
        
        let matchingQty = 0;
        const normDbColor = normalize(colorObj.name);
        for (const [exColor, exQty] of Object.entries(excelModelData.colors)) {
          if (normalize(exColor) === normDbColor) {
            matchingQty = exQty;
            break;
          }
        }
        
        return {
          ...colorObj,
          quantity: matchingQty
        };
      });

      await updateDoc(doc(db, "products", productDoc.id), {
        quantity: newTotalQty,
        colors: updatedColors
      });
      
      console.log(`Updated model ${modelNumber}: totalQty = ${newTotalQty}, colors = ${updatedColors.map(c => c.name + ':' + c.quantity).join(', ')}`);
      updated++;
    } else {
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
