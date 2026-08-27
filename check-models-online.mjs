import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^=]+)="?([^"]*)"?$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
});

const db = getFirestore(app);

async function run() {
  console.log("Fetching all products...");
  const snapshot = await getDocs(collection(db, "products"));
  let found = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (String(data.modelNumber) === '570' || String(data.modelNumber) === '575' || 
        String(data.name).includes('570') || String(data.name).includes('575') ||
        (data.barcodes && data.barcodes.some(b => String(b).includes('570') || String(b).includes('575'))) ||
        (data.colors && data.colors.some(c => String(c.barcode).includes('570') || String(c.barcode).includes('575')))
    ) {
      found.push(data);
    }
  });
  
  console.log(JSON.stringify(found, null, 2));
  process.exit(0);
}
run();
