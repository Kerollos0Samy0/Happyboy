const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
const { readFileSync } = require("fs");

const envContent = readFileSync(".env.local", "utf-8");
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

const getSizesCount = (name, modelNumber, sizes) => {
  const category = modelNumber ? parseInt(String(modelNumber).replace(/\D/g, ''), 10) : NaN;
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

async function verify() {
  console.log("Fetching orders and products...");
  const [ordersSnap, productsSnap] = await Promise.all([
    getDocs(collection(db, "orders")),
    getDocs(collection(db, "products"))
  ]);

  const orders = ordersSnap.docs.map(d => d.data());
  const products = productsSnap.docs.map(d => ({id: d.id, ...d.data()}));

  // Calculate what has been sold
  const soldMap = {}; // pId -> color -> pieces
  let totalSoldPieces = 0;
  for (const order of orders) {
    if (order.isDeleted || order.status === "cancelled") continue;
    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        const pId = item.id || item.productId;
        if (!pId) continue;
        
        const sizesCount = item.isSeri ? getSizesCount(item.name, item.modelNumber, item.sizes) : 1;
        const qtyToDeduct = (item.quantity || 1) * sizesCount;
        const color = item.selectedColor;
        
        if (!soldMap[pId]) soldMap[pId] = {};
        if (!soldMap[pId][color]) soldMap[pId][color] = 0;
        soldMap[pId][color] += qtyToDeduct;
        totalSoldPieces += qtyToDeduct;
      }
    }
  }

  // Calculate current inventory
  let currentInventoryPieces = 0;
  let totalNegativeColors = 0;
  let negativeModels = [];
  
  for (const p of products) {
    if (p.isDeleted) continue;
    currentInventoryPieces += Number(p.quantity) || 0;
    
    if (p.colors) {
      p.colors.forEach(c => {
        if (Number(c.quantity) < 0) {
          totalNegativeColors++;
          negativeModels.push(`Model ${p.modelNumber} Color ${c.name} has ${c.quantity} pieces`);
        }
      });
    }
  }

  console.log(`Total Orders Active: ${orders.filter(o => !o.isDeleted && o.status !== 'cancelled').length}`);
  console.log(`Total Pieces Sold: ${totalSoldPieces}`);
  console.log(`Current Total Pieces in DB: ${currentInventoryPieces}`);
  console.log(`Total Colors with Negative Quantities: ${totalNegativeColors}`);
  if (totalNegativeColors > 0) {
    console.log("Samples of negatives:\n", negativeModels.slice(0, 10).join("\n"));
  }
  
  process.exit(0);
}

verify().catch(console.error);
