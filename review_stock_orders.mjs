import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
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

async function run() {
  console.log("Fetching orders and products...");
  
  const productsSnap = await getDocs(collection(db, "products"));
  let products = [];
  productsSnap.forEach(doc => {
      products.push({id: doc.id, ...doc.data()});
  });

  const ordersSnap = await getDocs(collection(db, "orders"));
  let orders = [];
  ordersSnap.forEach(doc => {
      orders.push({id: doc.id, ...doc.data()});
  });

  let stockSummary = {}; // model -> colors -> qty
  for (let p of products) {
      if (!stockSummary[p.modelNumber]) stockSummary[p.modelNumber] = {};
      if (p.colors && p.colors.length > 0) {
          for (let c of p.colors) {
              if (c.name && c.sizes) {
                let totalColorQty = 0;
                for (let [size, sizeData] of Object.entries(c.sizes)) {
                    totalColorQty += sizeData.quantity || 0;
                }
                stockSummary[p.modelNumber][c.name] = totalColorQty;
              }
          }
      }
  }

  let ordersSummary = {}; // model -> colors -> qty
  for (let o of orders) {
      if (o.items) {
          for (let item of o.items) {
              let model = item.modelNumber || item.model;
              let color = item.color;
              let qty = item.quantity;
              
              if (!ordersSummary[model]) ordersSummary[model] = {};
              if (!ordersSummary[model][color]) ordersSummary[model][color] = 0;
              ordersSummary[model][color] += qty;
          }
      }
  }

  // Print summary
  console.log("=== STOCK MODELS AND COLORS ===");
  for (let model in stockSummary) {
      console.log(`Model: ${model}`);
      for (let color in stockSummary[model]) {
          console.log(`  - ${color}: ${stockSummary[model][color]} items`);
      }
  }

  console.log("\n=== ORDER MODELS AND COLORS ===");
  for (let model in ordersSummary) {
      console.log(`Model: ${model}`);
      for (let color in ordersSummary[model]) {
          console.log(`  - ${color}: ${ordersSummary[model][color]} items ordered`);
      }
  }

  process.exit(0);
}
run().catch(console.error);
