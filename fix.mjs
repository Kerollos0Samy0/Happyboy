
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^=]+)=\"?([^\"]*)\"?$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
});
const db = getFirestore(app);

async function fix() {
  const snap = await getDocs(collection(db, 'products'));
  let updated = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (data.colors && data.colors.length > 0) {
      const sum = data.colors.reduce((acc, c) => acc + (Number(c.quantity) || 0), 0);
      if (sum !== (Number(data.quantity) || 0)) {
        console.log('Fixing model', data.modelNumber, 'from', data.quantity, 'to', sum);
        await updateDoc(doc(db, 'products', d.id), { quantity: sum });
        updated++;
      }
    }
  }
  console.log('Updated', updated);
  process.exit(0);
}
fix();

