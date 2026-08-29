const { initializeApp } = require("firebase/app");
const { getFirestore, doc, updateDoc, writeBatch } = require("firebase/firestore");
const { readFileSync } = require("fs");

const envContent = readFileSync(".env.local", "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^([^=]+)="?([^"]*)"?$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const backup = JSON.parse(readFileSync("products_backup.json", "utf-8"));
  
  let batch = writeBatch(db);
  let count = 0;
  let total = 0;

  for (const product of backup) {
    const pId = product.id;
    const pRef = doc(db, "products", pId);
    
    // don't overwrite everything, just quantity, colors, barcodes
    batch.update(pRef, {
      quantity: product.quantity,
      colors: product.colors,
      barcodes: product.barcodes
    });
    
    count++;
    total++;
    
    if (count === 400) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  }
  
  if (count > 0) {
    await batch.commit();
  }
  
  console.log(`Successfully restored ${total} products from products_backup.json`);
  process.exit(0);
}

run().catch(console.error);
