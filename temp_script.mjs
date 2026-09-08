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
  const dbCurrentStockMap = new Map(); // barcode -> current qty in DB

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

          // Calculate current quantity in DB
          let colorQty = 0;
          if (color.quantity !== undefined) {
            colorQty = Number(color.quantity);
          } else if (color.sizes && !Array.isArray(color.sizes)) {
            Object.values(color.sizes).forEach(sz => {
               colorQty += Number(sz.quantity || 0);
            });
          }
          dbCurrentStockMap.set(cb, (dbCurrentStockMap.get(cb) || 0) + colorQty);
        }
      });
    }
  });

  console.log("Reading Firestore orders...");
  const ordersSnap = await getDocs(collection(db, "orders"));
  const soldMap = new Map(); // barcode -> qty
  
  const getCategoryName = (modelNumber) => {
    const num = parseInt(modelNumber, 10);
    if (isNaN(num)) return "أخرى";
    if (num >= 5 && num <= 90) return "بيبي ولادي";
    if (num >= 100 && num <= 299) return "وسط ولادي";
    if (num >= 300 && num <= 499) return "محير ولادي";
    if (num >= 500 && num <= 589) return "بيبي بناتي";
    if (num >= 590 && num <= 789) return "وسط بناتي";
    if (num >= 790 && num <= 999) return "محير بناتي";
    if (num >= 1000 && num <= 2999) return "رياضي";
    if (num >= 3000 && num <= 4999) return "سمر ولادي";
    if (num >= 5000 && num <= 6999) return "سمر بناتي";
    return "أخرى";
  };

  const getSizesCount = (name, modelNumber, sizes) => {
    const category = getCategoryName(modelNumber);
    if (category.includes('بيبي') || category.includes('وسط') || category.includes('محير') || category.includes('رياضي') || (name || "").includes('بيبي') || (name || "").includes('وسط') || (name || "").includes('محير')) return 4;
    return sizes && sizes.length > 0 ? sizes.length : 1;
  };

  ordersSnap.forEach(doc => {
    const data = doc.data();
    if (!data.isDeleted && data.status !== 'cancelled' && data.status !== 'مرفوض' && data.status !== 'مرتجع' && data.items) {
      data.items.forEach(item => {
        const cb = (item.colorBarcode || "").toString().trim();
        if (cb) {
          const qty = Number(item.quantity) || 1;
          const totalPieces = item.isSeri ? getSizesCount(item.name || '', item.modelNumber || '', item.sizes) * qty : qty;
          soldMap.set(cb, (soldMap.get(cb) || 0) + totalPieces);
        }
      });
    }
  });

  console.log("Reading المخزن.xlsx for Original Stock...");
  const wbStore = XLSX.readFile("المخزن.xlsx");
  const wsStore = wbStore.Sheets[wbStore.SheetNames[0]];
  const storeData = XLSX.utils.sheet_to_json(wsStore);

  const originalStockMap = new Map(); // barcode -> info
  
  for (const row of storeData) {
    let rawBarcode = (row["الباركود"] || row["Code"] || "").toString().trim();
    let cb = rawBarcode;
    let model = (row["الكود"] || row["كود الموديل"] || row["الموديل"] || row["Code"] || "").toString().trim();

    if (cb) {
      const qty = Number(row["القطعة"] || row["عدد القطع"] || row["قطعة"]) || 0;
      const cat = (row["التصنيف"] || row["التصنيف2"] || "").toString().trim();
      const colorName = (row["اللون"] || row["Column1"] || "").toString().trim();
      
      if (!originalStockMap.has(cb)) {
        originalStockMap.set(cb, { originalQty: 0, categoryExcel: cat, model, colorName });
      }
      originalStockMap.get(cb).originalQty += qty;
    }
  }

  const categoryJsonStr = readFileSync(join(__dirname, "model_categories.json"), "utf-8");
  const modelCategories = JSON.parse(categoryJsonStr);

  // Combine barcodes from original stock and sales
  const allBarcodes = new Set([...originalStockMap.keys(), ...soldMap.keys()]);
  const categoriesMap = new Map();
  // Initialize the 4 specific categories
  categoriesMap.set("الكل", []);
  categoriesMap.set("اولادي", []);
  categoriesMap.set("بناتي", []);
  categoriesMap.set("رياضي", []);
  categoriesMap.set("سمر ميلتون", []);
  categoriesMap.set("اخرى", []); // for any unmapped

  for (const cb of allBarcodes) {
    if (!cb) continue; // Skip empty barcodes
    
    const oData = originalStockMap.get(cb) || { originalQty: 0, categoryExcel: "", model: "", colorName: "" };
    const pData = productsMap.get(cb) || { modelNumber: "", name: "", colorName: "" };
    
    const model = pData.modelNumber || oData.model;
    const name = pData.name || ""; 
    const colorName = pData.colorName || oData.colorName;
    
    const originalQty = oData.originalQty || 0;
    const sales = soldMap.get(cb) || 0;
    
    // User logic:
    // النواقص = الموديلات اللي كميتها اقل من 0 (Sales exceed Original)
    const nawakes = sales > originalQty ? sales - originalQty : 0;
    
    // المخزن الحالي = الباقي الموجب
    const makhzanHaly = originalQty > sales ? originalQty - sales : 0;
    
    // المسحوب = المبيعات - النواقص (أو الأقل بين المبيعات والأصلي)
    const mas7oob = sales - nawakes;
    
    // Skip if there's no data for this barcode at all
    if (originalQty === 0 && sales === 0) continue;
    
    let category = "اخرى";
    if (modelCategories[model]) {
      const mainCat = modelCategories[model].mainCategory;
      if (mainCat === "ولادي" || mainCat === "اولادي") category = "اولادي";
      else if (mainCat === "بناتي") category = "بناتي";
      else if (mainCat === "رياضي") category = "رياضي";
      else if (mainCat === "سمر ميلتون") category = "سمر ميلتون";
    }

    const row = {
      "الموديل": model,
      "اسم الموديل": name,
      "اللون": colorName,
      "الباركود": cb,
      "المخزن الاصلي": originalQty,
      "المبيعات": sales,
      "النواقص": nawakes,
      "المسحوب": mas7oob,
      "المخزن الحالي": makhzanHaly
    };
    
    if (!categoriesMap.has(category)) {
      categoriesMap.set(category, []);
    }
    categoriesMap.get(category).push(row);
    categoriesMap.get("الكل").push(row);
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
      { wch: 15 }, // المبيعات
      { wch: 15 }, // النواقص
      { wch: 15 }, // المسحوب
      { wch: 15 }  // المخزن الحالي
    ];
    
    try {
      XLSX.utils.book_append_sheet(wbOut, ws, sheetName);
    } catch (e) {
      console.warn(`Could not add sheet ${sheetName}, creating alternative name.`, e);
      let randName = "Cat_" + Math.floor(Math.random()*10000);
      try { XLSX.utils.book_append_sheet(wbOut, ws, randName); } catch(ex) {}
    }
  }
  
  const outFile = "تقرير_المبيعات_والمخزن_مقسم_معدل.xlsx";
  XLSX.writeFile(wbOut, outFile);
  console.log(`Successfully generated ${outFile}`);
  process.exit(0);
}

main().catch(console.error);
