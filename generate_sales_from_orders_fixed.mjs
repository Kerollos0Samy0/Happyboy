import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

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

async function main() {
  console.log("Reading Firestore products (for categories and names)...");
  const productsSnap = await getDocs(collection(db, "products"));
  const productsMap = new Map();
  
  productsSnap.forEach(doc => {
    const data = doc.data();
    const modelNumber = (data.modelNumber || data.id || "").toString().trim();
    productsMap.set(modelNumber, {
      category: data.category || "بدون تصنيف",
      name: data.name || ""
    });
  });

  console.log("Reading Firestore orders...");
  const ordersSnap = await getDocs(collection(db, "orders"));
  const soldMap = new Map();
  let validOrdersCount = 0;
  
  ordersSnap.forEach(doc => {
    const data = doc.data();
    if (!data.isDeleted) {
      validOrdersCount++;
      if (data.items && Array.isArray(data.items)) {
        data.items.forEach(item => {
          const mNum = (item.modelNumber || "").toString().trim();
          if (mNum) {
            const qty = (Number(item.quantity) || 0) * 4;
            soldMap.set(mNum, (soldMap.get(mNum) || 0) + qty);
          }
        });
      }
    }
  });
  console.log(`Processed ${validOrdersCount} valid orders.`);

  console.log("Reading المخزن.xlsx...");
  const wbStore = XLSX.readFile("المخزن.xlsx");
  const wsStore = wbStore.Sheets[wbStore.SheetNames[0]];
  const storeData = XLSX.utils.sheet_to_json(wsStore);

  const originalStockMap = new Map();
  
  for (const row of storeData) {
    let code = (row["كود الموديل"] || row["الموديل"] || "").toString().trim();
    if (code) {
      const qty = Number(row["عدد القطع"]) || 0;
      const cat = (row["التصنيف2"] || row["التصنيف"] || "").toString().trim();
      
      if (!originalStockMap.has(code)) {
        originalStockMap.set(code, { originalQty: 0, categoryExcel: cat });
      }
      originalStockMap.get(code).originalQty += qty;
    }
  }

  // Combine data
  const allModels = new Set([...productsMap.keys(), ...originalStockMap.keys(), ...soldMap.keys()]);
  const categoriesMap = new Map(); // Category -> Array of rows

  for (const model of allModels) {
    const pData = productsMap.get(model) || { category: "", name: "" };
    const oData = originalStockMap.get(model) || { originalQty: 0, categoryExcel: "" };
    
    const category = pData.category || oData.categoryExcel || "بدون تصنيف";
    const originalQty = oData.originalQty;
    const requestedQty = soldMap.get(model) || 0;
    const remainingQty = originalQty - requestedQty;
    
    // Skip if it doesn't exist in original stock and hasn't been requested?
    // Let's include everything that has original stock or requested stock.
    if (originalQty === 0 && requestedQty === 0) continue;
    
    const row = {
      "الموديل": model,
      "اسم الموديل": pData.name,
      "المخزن الاصلي": originalQty,
      "مطلوب (مباع)": requestedQty,
      "باقي": remainingQty
    };
    
    if (!categoriesMap.has(category)) {
      categoriesMap.set(category, []);
    }
    categoriesMap.get(category).push(row);
  }

  // Create Workbook
  const wbOut = XLSX.utils.book_new();
  
  for (const [category, rows] of categoriesMap.entries()) {
    let sheetName = category.replace(/[\\/?*\[\]:]/g, '').substring(0, 31);
    if (!sheetName) sheetName = "Sheet";
    
    rows.sort((a, b) => a["الموديل"].localeCompare(b["الموديل"], 'ar', { numeric: true }));
    
    const ws = XLSX.utils.json_to_sheet(rows);
    
    ws['!cols'] = [
      { wch: 15 }, // الموديل
      { wch: 30 }, // اسم الموديل
      { wch: 15 }, // المخزن الاصلي
      { wch: 15 }, // مطلوب (مباع)
      { wch: 15 }  // باقي
    ];
    
    try {
      XLSX.utils.book_append_sheet(wbOut, ws, sheetName);
    } catch (e) {
      console.warn(`Could not add sheet ${sheetName}, creating alternative name.`, e);
      let randName = "Cat_" + Math.floor(Math.random()*10000);
      try { XLSX.utils.book_append_sheet(wbOut, ws, randName); } catch(ex) {}
    }
  }
  
  const outFile = "تقرير_المبيعات_النهائي.xlsx";
  XLSX.writeFile(wbOut, outFile);
  console.log(`Successfully generated ${outFile}`);
  process.exit(0);
}

main().catch(console.error);
