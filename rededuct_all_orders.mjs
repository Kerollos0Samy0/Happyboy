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

const getSizesCount = (name, modelNumber, sizes) => {
  const category = modelNumber ? parseInt(modelNumber.replace(/\D/g, ''), 10) : NaN;
  let sizesCount = 1;
  if (!isNaN(category)) {
    if ((category >= 5 && category <= 90) || (category >= 500 && category <= 589) || (category >= 3000 && category <= 3099) || (category >= 4000 && category <= 4099) || (name && (name.includes('بيبي') || name.includes('سمر')))) {
      sizesCount = 4;
    } else if (sizes && sizes.length > 0) {
      sizesCount = sizes.length;
    }
  }
  return sizesCount;
};

async function rededuct() {
  console.log("Fetching all orders...");
  const ordersSnap = await getDocs(collection(db, "orders"));
  const orders = ordersSnap.docs.map(d => d.data());
  console.log(`Found ${orders.length} total orders.`);

  const deductions = {}; 
  let validOrders = 0;

  for (const order of orders) {
    if (order.isDeleted || order.status === "cancelled") continue;
    validOrders++;
    
    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        const pId = item.id || item.productId;
        if (!pId) continue;
        
        const sizesCount = item.isSeri ? getSizesCount(item.name, item.modelNumber, item.sizes) : 1;
        const qtyToDeduct = (item.quantity || 1) * sizesCount;
        const color = item.selectedColor;
        
        if (!deductions[pId]) deductions[pId] = {};
        if (!deductions[pId][color]) deductions[pId][color] = 0;
        deductions[pId][color] += qtyToDeduct;
      }
    }
  }

  console.log(`Calculated deductions from ${validOrders} valid orders.`);
  
  const productsSnap = await getDocs(collection(db, "products"));
  let updatedCount = 0;

  for (const productDoc of productsSnap.docs) {
    const pId = productDoc.id;
    if (deductions[pId]) {
      const data = productDoc.data();
      let updatedColors = data.colors ? [...data.colors] : [];
      let changed = false;

      for (const [colorName, deductQty] of Object.entries(deductions[pId])) {
        const cIndex = updatedColors.findIndex(c => c.name === colorName);
        if (cIndex !== -1) {
          const currentQty = Number(updatedColors[cIndex].quantity) || 0;
          updatedColors[cIndex].quantity = currentQty - deductQty;
          changed = true;
        }
      }

      if (changed) {
        const newTotalQty = updatedColors.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);
        await updateDoc(doc(db, "products", pId), {
          colors: updatedColors,
          quantity: newTotalQty
        });
        updatedCount++;
        console.log(`Updated product ${pId} (${data.name}) - deducted items.`);
      }
    }
  }

  console.log(`Done! Updated ${updatedCount} products.`);
  process.exit(0);
}

rededuct().catch(console.error);
