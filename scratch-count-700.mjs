import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
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

async function countModel() {
  const ordersSnap = await getDocs(collection(db, "orders"));
  const productsSnap = await getDocs(collection(db, "products"));
  
  const productCats = {};
  productsSnap.forEach(doc => {
    const data = doc.data();
    productCats[String(data.modelNumber).trim()] = (data.mainCategory || data.category || "").toString();
  });

  let pieces = 0;
  let series = 0;
  
  ordersSnap.forEach(doc => {
    const data = doc.data();
    if (!data.isDeleted && data.status !== "cancelled") {
      if (data.items && Array.isArray(data.items)) {
        data.items.forEach(item => {
          const mNum = (item.modelNumber || "").toString().trim();
          if (mNum === "700") {
            const qty = Number(item.quantity) || 1;
            
            const category = productCats[mNum] || "";
            const name = item.name || "";
            let sizesCount = item.sizes ? item.sizes.length : 1;
            if (category.includes("بناتي") || category.includes("ولادي") || category.includes("رياضي") || category.includes("صيفي") || name.includes("بناتي") || name.includes("ولادي")) {
              sizesCount = 4; // Dashboard logic
            }
            
            const totalPieces = item.isSeri ? sizesCount * qty : qty;
            pieces += totalPieces;
            series += item.isSeri ? qty : 0;
          }
        });
      }
    }
  });

  console.log(`Model 700 -> Series: ${series}, Pieces: ${pieces}`);
  process.exit(0);
}

countModel().catch(console.error);
