import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, ".env.local");
const envContent = readFileSync(envPath, "utf-8");
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

const newParsedPath = join(__dirname, "new_parsed.json");
const newParsed = JSON.parse(readFileSync(newParsedPath, "utf-8"));

async function checkAndUpload() {
  console.log("Fetching existing products...");
  const snapshot = await getDocs(collection(db, "products"));
  const existingBarcodes = new Set();
  const existingModelsMap = new Map(); // modelNum -> docId
  
  snapshot.forEach(d => {
    const data = d.data();
    if (data.modelNumber) {
      existingModelsMap.set(String(data.modelNumber).trim(), d.id);
    }
    if (data.barcodes && Array.isArray(data.barcodes)) {
      data.barcodes.forEach(b => existingBarcodes.add(String(b)));
    }
    // Check colors array too if available
    if (data.colors && Array.isArray(data.colors)) {
      data.colors.forEach(c => {
        if (c.barcode) existingBarcodes.add(String(c.barcode));
      });
    }
  });

  console.log(`Found ${existingBarcodes.size} barcodes in DB.`);
  
  let newModelsAdded = 0;
  
  // Go through new parsed
  for (const [modelNum, data] of Object.entries(newParsed)) {
    const allNewBarcodes = data.barcodes;
    const barcodesToUpload = allNewBarcodes.filter(b => !existingBarcodes.has(b));
    
    if (barcodesToUpload.length === 0) {
      console.log(`Model ${modelNum}: All ${allNewBarcodes.length} barcodes already exist in DB. Skipping.`);
      continue;
    }
    
    if (barcodesToUpload.length < allNewBarcodes.length) {
      console.log(`Model ${modelNum}: Some barcodes already exist! Only uploading ${barcodesToUpload.length} out of ${allNewBarcodes.length}.`);
    } else {
      console.log(`Model ${modelNum}: All ${allNewBarcodes.length} barcodes are NEW.`);
    }

    // Format for DB
    const product = {
      modelNumber: modelNum,
      name: data.name,
      sizes: data.sizes,
      // only keep colors for new barcodes
      colors: Object.entries(data.colors)
                .filter(([c, b]) => barcodesToUpload.includes(b))
                .map(([c, b]) => ({ name: c, barcode: b })),
      barcodes: barcodesToUpload,
      price: 0,
      quantity: 0
    };
    
    // We only add completely new product docs for now, or you can update if the model exists.
    if (existingModelsMap.has(modelNum)) {
      console.log(`Model ${modelNum} exists in DB, but has new barcodes. Skipping update for safety. Let user know.`);
    } else {
      console.log(`Adding NEW model: ${modelNum}`);
      await addDoc(collection(db, "products"), {
        ...product,
        createdAt: serverTimestamp(),
      });
      newModelsAdded++;
    }
  }
  
  console.log(`\nAdded ${newModelsAdded} new models.`);
  process.exit(0);
}

checkAndUpload().catch(err => {
  console.error(err);
  process.exit(1);
});
