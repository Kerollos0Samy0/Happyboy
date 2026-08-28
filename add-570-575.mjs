import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

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

const models = [
  {
    modelNumber: "570",
    name: "سوت بيبي كابيشو",
    sizes: ["0"],
    colors: [
      { name: "اسود", barcode: "555" },
      { name: "لبني", barcode: "554" },
      { name: "بني", barcode: "553" }
    ],
    barcodes: ["553", "554", "555"],
    price: 0,
    quantity: 0
  },
  {
    modelNumber: "575",
    name: "سوت بيبي كابيشو",
    sizes: ["0"],
    colors: [
      { name: "لبني", barcode: "556" },
      { name: "اسود", barcode: "558" },
      { name: "روز", barcode: "557" }
    ],
    barcodes: ["556", "557", "558"],
    price: 0,
    quantity: 0
  }
];

async function run() {
  console.log("Uploading models 570 and 575 to Firebase...");
  for (const model of models) {
    try {
      const docRef = await addDoc(collection(db, "products"), model);
      console.log(`Added model ${model.modelNumber} with ID: ${docRef.id}`);
    } catch (e) {
      console.error(`Error adding model ${model.modelNumber}:`, e);
    }
  }
  process.exit(0);
}

run();
