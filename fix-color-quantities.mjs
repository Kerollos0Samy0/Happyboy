import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { readFileSync } from "fs";
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

console.log("Initializing firebase...");
const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
});
const db = getFirestore(app);

async function run() {
  console.log("Fetching products...");
  const snap = await getDocs(collection(db, "products"));
  let updated = 0;
  for (const productDoc of snap.docs) {
    const data = productDoc.data();
    
    // Check if colors have quantities
    let totalComputed = 0;
    const newColors = (data.colors || []).map(color => {
      let q = Number(color.quantity);
      if (isNaN(q)) {
        q = 0;
      }
      totalComputed += q;
      return { ...color, quantity: q };
    });

    if (data.quantity !== totalComputed) {
      await updateDoc(doc(db, "products", productDoc.id), {
        colors: newColors,
        quantity: totalComputed
      });
      console.log(`Updated model ${data.modelNumber}: oldTotal=${data.quantity}, newTotal=${totalComputed}`);
      updated++;
    }
  }
  console.log(`Updated ${updated} products.`);
  process.exit(0);
}
run().catch(console.error);
