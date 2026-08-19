import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
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

const modelsPath = join(__dirname, "models_data.json");
const productsList = JSON.parse(readFileSync(modelsPath, "utf-8"));

async function syncNewModels() {
  console.log("Fetching existing products...");
  const snapshot = await getDocs(collection(db, "products"));
  const existingModels = new Set();
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.modelNumber) {
      existingModels.add(String(data.modelNumber).trim());
    }
  });

  let added = 0;
  for (const product of productsList) {
    const modelNum = String(product.modelNumber).trim();
    if (!existingModels.has(modelNum)) {
      console.log(`Adding new model: ${modelNum} (${product.name})`);
      await addDoc(collection(db, "products"), {
        ...product,
        createdAt: serverTimestamp(),
      });
      added++;
    }
  }
  
  console.log(`Added ${added} new models.`);
  process.exit(0);
}

syncNewModels().catch(err => {
  console.error(err);
  process.exit(1);
});
