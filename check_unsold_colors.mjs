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

async function checkUnsoldColors() {
  console.log("Fetching orders...");
  const ordersSnap = await getDocs(collection(db, "orders"));
  const soldMap = new Map(); // model -> Map<color, quantity>
  
  let totalOrders = 0;
  ordersSnap.forEach(doc => {
    const data = doc.data();
    if (!data.isDeleted) {
      totalOrders++;
      if (data.items && Array.isArray(data.items)) {
        data.items.forEach(item => {
          const mNum = (item.modelNumber || "").toString().trim();
          const color = (item.selectedColor || "").toString().trim();
          const qty = Number(item.quantity) || 0;
          
          if (mNum) {
            if (!soldMap.has(mNum)) {
              soldMap.set(mNum, new Map());
            }
            const colorMap = soldMap.get(mNum);
            colorMap.set(color, (colorMap.get(color) || 0) + qty);
          }
        });
      }
    }
  });

  console.log(`Processed ${totalOrders} valid orders.`);
  
  console.log("Fetching products...");
  const productsSnap = await getDocs(collection(db, "products"));
  
  const unsold = []; // Array of { model, name, colors: [] }

  productsSnap.forEach(doc => {
    const data = doc.data();
    const modelNumber = (data.modelNumber || data.id || "").toString().trim();
    
    if (data.colors && Array.isArray(data.colors) && data.colors.length > 0) {
      const modelSoldMap = soldMap.get(modelNumber) || new Map();
      const unsoldColors = [];
      
      data.colors.forEach(c => {
        const cName = (c.name || "").toString().trim();
        const qtySold = modelSoldMap.get(cName) || 0;
        if (qtySold === 0) {
          unsoldColors.push(cName);
        }
      });
      
      if (unsoldColors.length > 0) {
        unsold.push({
          model: modelNumber,
          name: data.name || "",
          unsoldColors
        });
      }
    }
  });

  if (unsold.length === 0) {
    console.log("Excellent, all colors in all models have been sold at least once!");
  } else {
    console.log(`\nFound ${unsold.length} models with unsold colors:`);
    unsold.forEach(item => {
      console.log(`- Model ${item.model} (${item.name}): Unsold colors -> ${item.unsoldColors.join(", ")}`);
    });
  }

  process.exit(0);
}

checkUnsoldColors().catch(console.error);
