import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^([^=]+)="?([^"]*)"?$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function findCharcoal() {
  console.log("Checking products...");
  const productsSnap = await getDocs(collection(db, "products"));
  let pCount = 0;
  
  productsSnap.forEach(doc => {
    const data = doc.data();
    if (data.colors && Array.isArray(data.colors)) {
      if (data.colors.some(c => c.name === "شاركويل")) {
        pCount++;
      }
    }
  });

  console.log("Checking orders...");
  const ordersSnap = await getDocs(collection(db, "orders"));
  let oCount = 0;
  ordersSnap.forEach(doc => {
    const data = doc.data();
    if (data.items && Array.isArray(data.items)) {
      if (data.items.some(i => i.selectedColor === "شاركويل")) {
        oCount++;
      }
    }
  });

  console.log(`Found "شاركويل" in ${pCount} products and ${oCount} orders.`);
  process.exit(0);
}

findCharcoal().catch(console.error);
