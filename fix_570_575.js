const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, where } = require('firebase/firestore');
const fs = require('fs');

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

async function fix() {
  // Delete the bad ones
  const q1 = query(collection(db, 'products'), where('modelNumber', '==', '570'));
  const snap1 = await getDocs(q1);
  for (const d of snap1.docs) {
    await deleteDoc(doc(db, 'products', d.id));
    console.log('Deleted 570', d.id);
  }
  const q2 = query(collection(db, 'products'), where('modelNumber', '==', '575'));
  const snap2 = await getDocs(q2);
  for (const d of snap2.docs) {
    await deleteDoc(doc(db, 'products', d.id));
    console.log('Deleted 575', d.id);
  }

  // Add correct ones from models_data.json
  const data = JSON.parse(fs.readFileSync('models_data.json', 'utf8'));
  const correct570 = data.find(d => d.modelNumber === '570');
  const correct575 = data.find(d => d.modelNumber === '575');

  if(correct570) {
    const r1 = await addDoc(collection(db, 'products'), correct570);
    console.log('Added correct 570', r1.id);
  }
  if(correct575) {
    const r2 = await addDoc(collection(db, 'products'), correct575);
    console.log('Added correct 575', r2.id);
  }
  process.exit(0);
}
fix();
