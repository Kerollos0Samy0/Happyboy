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
  const names = {};
  let totalCustomers = 0;
  
  snap.forEach(doc => {
    const data = doc.data();
    const name = (data.name || "").trim();
    if (!name) return;
    
    totalCustomers++;
    if (!names[name]) {
      names[name] = [];
    }
    names[name].push({ id: doc.id, ...data });
  });

  const duplicates = [];
  for (const [name, records] of Object.entries(names)) {
    if (records.length > 1) {
      duplicates.push({ name, count: records.length, records });
    }
  }

  console.log(`Total customers checked: ${totalCustomers}`);
  console.log(`Total unique names: ${Object.keys(names).length}`);
  console.log(`Total duplicated names found: ${duplicates.length}\n`);

  duplicates.sort((a, b) => b.count - a.count);

  for (const dup of duplicates) {
    console.log(`- ${dup.name}: ${dup.count} times`);
    dup.records.forEach((r, idx) => {
      console.log(`    ${idx + 1}. ID: ${r.id}, Phone: ${r.phone || 'N/A'}, Type: ${r.customerType || 'N/A'}`);
    });
  }
}

findDuplicates().catch(console.error);
