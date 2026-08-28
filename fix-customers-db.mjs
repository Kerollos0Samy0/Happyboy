import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const xlsx = require('xlsx');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
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

const workbook = xlsx.readFile('customers.xlsx');
const customersData = [];
for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);
  const sheetData = data.slice(1); // skip headers
  customersData.push(...sheetData);
}

async function fix() {
  console.log("Fetching customers from Firestore...");
  const snap = await getDocs(collection(db, "customers"));
  let updated = 0;
  
  for (const docSnap of snap.docs) {
    const docData = docSnap.data();
    const docName = docData.name;
    const docPhone = docData.phone;
    
    // Find matching row in excel
    let matchedRow = customersData.find(r => {
      const rName = String(r.__EMPTY_1 || r.__EMPTY_2 || '').trim();
      const rPhone = String(r.__EMPTY_7 || '').trim(); // Phone is __EMPTY_7
      return (rName && docName && rName === docName) || (rPhone && docPhone && rPhone === docPhone);
    });
    
    if (matchedRow) {
        const correctBrandName = String(matchedRow.__EMPTY_2 || '').trim();
        const correctCustomerType = String(matchedRow.__EMPTY_3 || '').trim();
        const correctGov = String(matchedRow.__EMPTY_4 || '').trim();
        const correctAddress = String(matchedRow.__EMPTY_5 || '').trim();
        const correctRegion = String(matchedRow.__EMPTY_6 || '').trim();
        const correctPhone = String(matchedRow.__EMPTY_7 || '').trim();
        
        await updateDoc(doc(db, "customers", docSnap.id), {
            brandName: correctBrandName === 'undefined' ? '' : correctBrandName,
            customerType: correctCustomerType === 'undefined' ? '' : correctCustomerType,
            governorate: correctGov === 'undefined' ? '' : correctGov,
            address: correctAddress === 'undefined' ? '' : correctAddress,
            region: correctRegion === 'undefined' ? '' : correctRegion,
            phone: correctPhone === 'undefined' ? '' : correctPhone,
        });
        updated++;
        console.log(`Updated ${docName} - Type: ${correctCustomerType}`);
    }
  }
  console.log('Total updated:', updated);
  process.exit(0);
}

fix().catch(console.error);
