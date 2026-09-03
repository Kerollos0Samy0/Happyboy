
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
  const snap = await getDocs(collection(db, 'products'));
  let totalPositive = 0;
  let totalNegative = 0;
  
  snap.forEach(doc => {
    const data = doc.data();
    if (data.colors && Array.isArray(data.colors)) {
      data.colors.forEach(color => {
        let colorQty = 0;
        if (color.quantity !== undefined) {
          colorQty = Number(color.quantity);
        } else if (color.sizes && !Array.isArray(color.sizes)) {
          Object.values(color.sizes).forEach(sz => {
             colorQty += Number(sz.quantity || 0);
          });
        }
        
        if (colorQty > 0) totalPositive += colorQty;
        else if (colorQty < 0) totalNegative += colorQty;
      });
    }
  });
  
  console.log('Total Positive Stock:', totalPositive);
  console.log('Total Negative Stock:', totalNegative);
  process.exit(0);
}
run().catch(console.error);

