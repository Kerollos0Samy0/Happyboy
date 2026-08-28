import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load env from .env.local
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

async function updateQuantities() {
  console.log("Fetching products...");
  const snapshot = await getDocs(collection(db, "products"));
  let updated = 0;

  for (const productDoc of snapshot.docs) {
    const data = productDoc.data();
    const colorCount = data.colors ? data.colors.length : 1;
    const newQuantity = colorCount * 200;

    await updateDoc(doc(db, "products", productDoc.id), {
      quantity: newQuantity
    });
    console.log(`Updated model ${data.modelNumber}: colors = ${colorCount}, new qty = ${newQuantity}`);
    updated++;
  }

  console.log(`Successfully updated ${updated} products.`);
  process.exit(0);
}

updateQuantities().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
