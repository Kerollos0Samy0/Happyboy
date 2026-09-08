import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { readFileSync, writeFileSync } from "fs";
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
  console.log("Fetching products...");
  const productsSnap = await getDocs(collection(db, "products"));
  let products = [];
  productsSnap.forEach(doc => {
      products.push({id: doc.id, ...doc.data()});
  });

  console.log("Fetching orders...");
  const ordersSnap = await getDocs(collection(db, "orders"));
  let orders = [];
  ordersSnap.forEach(doc => {
      orders.push({id: doc.id, ...doc.data()});
  });

  let stockSummary = {}; // model -> colors -> qty
  for (let p of products) {
      const model = p.modelNumber;
      if (!stockSummary[model]) stockSummary[model] = {};
      if (p.colors && p.colors.length > 0) {
          for (let c of p.colors) {
              const colorName = c.name;
              // Check if sizes is a map or just an array
              let qty = 0;
              if (c.quantity !== undefined) {
                  qty = c.quantity;
              } else if (c.sizes && !Array.isArray(c.sizes)) {
                  for (let [size, sizeData] of Object.entries(c.sizes)) {
                      qty += sizeData.quantity || 0;
                  }
              }
              stockSummary[model][colorName] = qty;
          }
      }
  }

  let ordersSummary = {}; // model -> colors -> qty
  for (let o of orders) {
      if (o.items) {
          for (let item of o.items) {
              let model = item.modelNumber || item.model;
              let color = item.selectedColor || item.color;
              let qty = item.quantity || 0;
              let numSizes = (item.sizes && Array.isArray(item.sizes)) ? item.sizes.length : 1;
              if (item.isSeri && item.sizes && item.sizes[0] == "0") {
                 // Seri 0 means sizes are like [2,3,4,5], maybe. But let's just count quantity of item ordered (which could be number of seris)
                 // or just use item.quantity directly.
              }
              // It seems item.quantity is the number of sets/pieces ordered. Let's multiply by sizes length if seri, maybe? 
              // Usually item.quantity * item.sizes.length is total pieces, or just item.quantity sets. 
              // For simplicity, let's just report the item.quantity as pieces/seris.
              let totalPieces = qty; // or qty * numSizes, but let's stick to qty.
              
              if (!ordersSummary[model]) ordersSummary[model] = {};
              if (!ordersSummary[model][color]) ordersSummary[model][color] = 0;
              ordersSummary[model][color] += totalPieces;
          }
      }
  }

  // Generate markdown report
  let md = "# تقرير الموديلات والألوان\n\n";
  
  md += "## الموديلات والألوان في المخزن\n";
  md += "| الموديل | اللون | الكمية |\n";
  md += "|---------|-------|--------|\n";
  for (let model in stockSummary) {
      for (let color in stockSummary[model]) {
          md += `| ${model} | ${color} | ${stockSummary[model][color]} |\n`;
      }
  }

  md += "\n## الموديلات والألوان المطلوبة في الأوردرات\n";
  md += "| الموديل | اللون | الكمية المطلوبة |\n";
  md += "|---------|-------|-----------------|\n";
  for (let model in ordersSummary) {
      for (let color in ordersSummary[model]) {
          md += `| ${model} | ${color} | ${ordersSummary[model][color]} |\n`;
      }
  }

  writeFileSync("report.md", md, "utf-8");
  console.log("Report generated at report.md");
  process.exit(0);
}
run().catch(console.error);
