import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^=]+)=\"?([^\"]*)\"?$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
});

const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, 'products'));
  let found = false;
  snap.docs.forEach(doc => {
    const d = doc.data();
    if (d.modelNumber === '600' || d.modelNumber == 600) {
      console.log('FOUND:', doc.id, JSON.stringify(d, null, 2));
      found = true;
    }
  });
  if (!found) console.log('NOT_FOUND');
  process.exit(0);
}
run();
