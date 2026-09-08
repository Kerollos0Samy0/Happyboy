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
  console.log("Reading Firestore products (for categories, models, colors)...");
  const productsSnap = await getDocs(collection(db, "products"));
  const productsMap = new Map(); // barcode -> info
  
  productsSnap.forEach(doc => {
    const data = doc.data();
    const modelNumber = (data.modelNumber || data.id || "").toString().trim();
    const category = data.category || "بدون تصنيف";
    const name = data.name || "";
    
    if (data.colors && Array.isArray(data.colors)) {
      data.colors.forEach(color => {
        const cb = (color.barcode || "").toString().trim();
        if (cb) {
          productsMap.set(cb, {
            modelNumber,
            category,
            name,
            colorName: color.name || ""
          });
        }
      });
    }
  });

  console.log("Reading Firestore orders...");
  const ordersSnap = await getDocs(collection(db, "orders"));
  const soldMap = new Map(); // barcode -> qty
  
  ordersSnap.forEach(doc => {
    const data = doc.data();
    if (!data.isDeleted && data.items) {
      data.items.forEach(item => {
        const cb = (item.colorBarcode || "").toString().trim();
        if (cb) {
          const qty = (Number(item.quantity) || 0) * 4; // 1 series = 4 pieces
          soldMap.set(cb, (soldMap.get(cb) || 0) + qty);
        }
      });
    }
  });

  console.log("Reading المخزن.xlsx...");
  const wbStore = XLSX.readFile("المخزن.xlsx");
  const wsStore = wbStore.Sheets[wbStore.SheetNames[0]];
  const storeData = XLSX.utils.sheet_to_json(wsStore);

  const originalStockMap = new Map(); // barcode -> qty, model, cat
  
  for (const row of storeData) {
    let cb = (row["الباركود"] || "").toString().trim();
    if (cb) {
      const qty = Number(row["عدد القطع"]) || 0;
      const cat = (row["التصنيف2"] || row["التصنيف"] || "").toString().trim();
      const model = (row["كود الموديل"] || row["الموديل"] || "").toString().trim();
      const colorName = (row["اللون"] || "").toString().trim(); // If they have color name in excel
      
      if (!originalStockMap.has(cb)) {
        originalStockMap.set(cb, { originalQty: 0, categoryExcel: cat, model, colorName });
      }
      originalStockMap.get(cb).originalQty += qty;
    }
  }

  // Combine all barcodes
  const allBarcodes = new Set([...productsMap.keys(), ...originalStockMap.keys(), ...soldMap.keys()]);
  const categoriesMap = new Map();

  for (const cb of allBarcodes) {
    if (!cb) continue; // Skip empty barcodes
    
    const pData = productsMap.get(cb) || { modelNumber: "", category: "", name: "", colorName: "" };
    const oData = originalStockMap.get(cb) || { originalQty: 0, categoryExcel: "", model: "", colorName: "" };
    
    const category = pData.category || oData.categoryExcel || "بدون تصنيف";
    const model = pData.modelNumber || oData.model;
    const name = pData.name;
    const colorName = pData.colorName || oData.colorName;
    
    const originalQty = oData.originalQty || 0;
    const requestedQty = soldMap.get(cb) || 0;
    const remainingQty = originalQty - requestedQty;
    
    if (originalQty === 0 && requestedQty === 0) continue;
    
    const row = {
      "الموديل": model,
      "اسم الموديل": name,
      "اللون": colorName,
      "الباركود": cb,
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
    
    // Sort by model then barcode
    rows.sort((a, b) => {
      const modelCmp = a["الموديل"].localeCompare(b["الموديل"], 'ar', { numeric: true });
      if (modelCmp !== 0) return modelCmp;
      return a["الباركود"].localeCompare(b["الباركود"], 'ar', { numeric: true });
    });
    
    const ws = XLSX.utils.json_to_sheet(rows);
    
    ws['!cols'] = [
      { wch: 15 }, // الموديل
      { wch: 30 }, // اسم الموديل
      { wch: 15 }, // اللون
      { wch: 15 }, // الباركود
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
  
  const outFile = "تقرير_المبيعات_التفصيلي_بالباركود.xlsx";
  XLSX.writeFile(wbOut, outFile);
  console.log(`Successfully generated ${outFile}`);
  process.exit(0);
}

main().catch(console.error);
