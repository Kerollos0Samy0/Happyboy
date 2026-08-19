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
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
const db = getFirestore(app);

const workbook = xlsx.readFile('المخزن.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const excelData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

const excelModels = new Set();
for (const row of excelData) {
  if (row.length >= 5 && row[0] !== undefined && row[4] !== undefined) {
    const modelNumber = String(row[0]).trim();
    if (modelNumber.toLowerCase() !== 'code' && !isNaN(parseInt(modelNumber))) {
      excelModels.add(modelNumber);
    }
  }
}

async function run() {
  const snapshot = await getDocs(collection(db, "products"));
  const dbModels = new Set();
  snapshot.forEach(doc => {
    if (doc.data().modelNumber) dbModels.add(String(doc.data().modelNumber).trim());
  });

  const missingInDb = [];
  for (const model of excelModels) {
    if (!dbModels.has(model)) missingInDb.push(model);
  }
  
  console.log("Models in Excel but missing in DB:", missingInDb);
  process.exit(0);
}
run();
