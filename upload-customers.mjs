import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const xlsx = require('xlsx');

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

const workbook = xlsx.readFile('بيانات_العملاء_.xlsx');
const customersData = [];

for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);
  // Skip the first row which is headers
  const sheetData = data.slice(1);
  customersData.push(...sheetData);
}

console.log(`Found ${customersData.length} customers in the Excel file.`);

let success = 0;
let skipped = 0;
let failed = 0;

for (const row of customersData) {
  try {
    const name = String(row.__EMPTY_1 || row.__EMPTY_2 || '').trim();
    if (!name || name === 'undefined' || name === 'null') {
      skipped++;
      continue; // Skip empty rows
    }

    const brandName = String(row.__EMPTY_2 || row.__EMPTY_3 || '').trim();
    const customerType = String(row.__EMPTY_4 || '').trim();
    const governorate = String(row.__EMPTY_5 || '').trim();
    const address = String(row.__EMPTY_6 || '').trim();
    const region = String(row.__EMPTY_7 || '').trim();
    let phone = String(row.__EMPTY_8 || '').trim();
    const phone2 = String(row.__EMPTY_9 || '').trim();
    const phone3 = String(row.__EMPTY_10 || '').trim();
    const shipping = String(row.__EMPTY_11 || '').trim();
    const notes = String(row.__EMPTY_13 || '').trim();

    if (phone === 'undefined' || phone === 'null') phone = '';

    // Check if customer already exists by phone (if phone exists) or name
    let exists = false;
    
    if (phone) {
      const qPhone = query(collection(db, "customers"), where("phone", "==", phone));
      const snapPhone = await getDocs(qPhone);
      if (!snapPhone.empty) exists = true;
    }
    
    if (!exists) {
      const qName = query(collection(db, "customers"), where("name", "==", name));
      const snapName = await getDocs(qName);
      if (!snapName.empty) exists = true;
    }

    if (exists) {
      console.log(`  - Skipped: ${name} (Already exists)`);
      skipped++;
      continue;
    }

    const docRef = await addDoc(collection(db, "customers"), {
      name,
      brandName: brandName === 'undefined' ? '' : brandName,
      customerType: customerType === 'undefined' ? '' : customerType,
      governorate: governorate === 'undefined' ? '' : governorate,
      address: address === 'undefined' ? '' : address,
      region: region === 'undefined' ? '' : region,
      phone,
      phone2: phone2 === 'undefined' ? '' : phone2,
      phone3: phone3 === 'undefined' ? '' : phone3,
      shipping: shipping === 'undefined' ? '' : shipping,
      notes: notes === 'undefined' ? '' : notes,
      createdAt: serverTimestamp(),
    });
    
    console.log(`  ✓ Uploaded: ${name} → ID: ${docRef.id}`);
    success++;
  } catch (err) {
    console.error(`  ✗ FAILED to upload: ${err.message}`);
    failed++;
  }
}

console.log(`\nDone! ${success} uploaded, ${skipped} skipped (duplicates/empty), ${failed} failed.`);
process.exit(0);
