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

const catsPath = join(__dirname, "model_categories.json");
const modelCats = JSON.parse(readFileSync(catsPath, "utf-8"));

async function updateCategories() {
  console.log("Fetching products from Firebase...");
  const snapshot = await getDocs(collection(db, "products"));
  let updated = 0;

  for (const productDoc of snapshot.docs) {
    const data = productDoc.data();
    const modelNum = String(data.modelNumber).trim();
    
    if (modelCats[modelNum]) {
      const catData = modelCats[modelNum];
      await updateDoc(doc(db, "products", productDoc.id), {
        mainCategory: catData.mainCategory,
        subCategory: catData.subCategory,
        gender: catData.gender || ""
      });
      updated++;
    }
  }
  
  console.log(`Successfully updated categories for ${updated} models in Firebase.`);
  process.exit(0);
}

updateCategories().catch(err => {
  console.error(err);
  process.exit(1);
});
