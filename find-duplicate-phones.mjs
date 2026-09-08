import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

async function findDuplicates() {
  const snap = await getDocs(collection(db, "customers"));
  const phones = {};
  let totalCustomers = 0;
  
  snap.forEach(doc => {
    const data = doc.data();
    let phone = (data.phone || "").trim();
    
    // Normalize phone numbers, optional: 
    // remove spaces, dashes, country code +20 if standardizing
    phone = phone.replace(/\s+/g, '');

    // if (!phone) return; // Un-comment if you want to skip empty phones
    
    totalCustomers++;
    if (!phones[phone]) {
      phones[phone] = [];
    }
    phones[phone].push({ id: doc.id, ...data });
  });

  const duplicates = [];
  for (const [phone, records] of Object.entries(phones)) {
    if (records.length > 1) {
      duplicates.push({ phone, count: records.length, records });
    }
  }

  console.log(`Total customers checked: ${totalCustomers}`);
  console.log(`Total unique phones: ${Object.keys(phones).length}`);
  console.log(`Total duplicated phones found: ${duplicates.length}\n`);

  duplicates.sort((a, b) => b.count - a.count);

  for (const dup of duplicates) {
    const phoneDisplay = dup.phone === "" ? "NO PHONE NUMBER (Empty)" : dup.phone;
    console.log(`- Phone: ${phoneDisplay} : ${dup.count} times`);
    dup.records.forEach((r, idx) => {
      console.log(`    ${idx + 1}. ID: ${r.id}, Name: ${r.name || 'N/A'}, Type: ${r.customerType || 'N/A'}`);
    });
    console.log('');
  }
}

findDuplicates().catch(console.error);
