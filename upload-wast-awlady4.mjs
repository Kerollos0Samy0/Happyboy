import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';

// read .env.local
const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^=]+)=\"?([^\r\n\"]*)\"?/);
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

const products = JSON.parse(readFileSync('parsed_wast_awlady.json', 'utf-8'));
(async () => {
  for (const product of products) {
    const q = query(collection(db, 'products'), where('modelNumber', '==', product.modelNumber));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      console.log('Model ' + product.modelNumber + ' already exists. Updating...');
      const docId = snapshot.docs[0].id;
      const existing = snapshot.docs[0].data();
      const newSizes = Array.from(new Set([...(existing.sizes || []), ...product.sizes]));
      const newBarcodes = Array.from(new Set([...(existing.barcodes || []), ...product.barcodes]));
      const newColors = existing.colors || [];
      for (const c of product.colors) {
        if (!newColors.find(ec => ec.name === c.name && ec.barcode === c.barcode)) {
          newColors.push(c);
        }
      }
      await updateDoc(snapshot.docs[0].ref, {
        sizes: newSizes,
        barcodes: newBarcodes,
        colors: newColors,
        updatedAt: serverTimestamp()
      });
      console.log('Updated doc ' + docId);
    } else {
      console.log('Creating new model ' + product.modelNumber);
      const docRef = await addDoc(collection(db, 'products'), {
        ...product,
        createdAt: serverTimestamp(),
      });
      console.log('Created doc ' + docRef.id);
    }
  }
  process.exit(0);
})();
