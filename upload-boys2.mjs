import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
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

const modelsPath = join(__dirname, "boys2_models.json");
const products = JSON.parse(readFileSync(modelsPath, "utf-8"));

console.log("Uploading ${products.length} models to Firebase...");

let success = 0;
let failed = 0;

async function run() {
  for (const product of products) {
    try {
      const docRef = await addDoc(collection(db, "products"), {
        ...product,
        createdAt: serverTimestamp(),
      });
      console.log("  \u2713 Model ${product.modelNumber} () -> ID: ${docRef.id}");
      success++;
    } catch (err) {
      console.error("  \u2717 Model ${product.modelNumber} FAILED: ${err.message}");
      failed++;
    }
  }
  console.log("\nDone! ${success} uploaded, ${failed} failed.");
  process.exit(0);
}
run();
