import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

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
  const newProduct = {
    modelNumber: "600",
    name: "ترينج وسط بناتي",
    price: 0,
    sizes: ["4", "6", "8", "10"],
    colors: [
      { name: "طوبي", barcode: "600-2" },
      { name: "موف", barcode: "600-3" },
      { name: "كشمير", barcode: "600-4" }
    ],
    barcodes: ["600-2", "600-3", "600-4"],
    quantity: 600,
    createdAt: serverTimestamp()
  };

  await addDoc(collection(db, "products"), newProduct);
  console.log("Model 600 added successfully.");
  process.exit(0);
}
run();
