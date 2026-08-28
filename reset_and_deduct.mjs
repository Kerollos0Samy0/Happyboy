import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as xlsxImport from 'xlsx';
const xlsx = xlsxImport.default || xlsxImport;

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, ".env.local");
const envContent = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^([^=]+)="?([^"]*)"?$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
});
const db = getFirestore(app);

const getSizesCount = (name, modelNumber, sizes) => {
  const category = modelNumber ? parseInt(modelNumber.replace(/\\D/g, ''), 10) : NaN;
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

async function runResetAndDeduct() {
  console.log("Reading المخزن.xlsx...");
  const workbook = xlsx.readFile('المخزن.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const excelData = xlsx.utils.sheet_to_json(worksheet);

  // Map: modelNumber -> { barcode -> quantity }
  const originalInventoryMap = {};
  for (const row of excelData) {
    const modelCode = row['كود الموديل'];
    const barcode = row['الباركود'];
    const qty = row['عدد القطع'];
    
    if (modelCode !== undefined && barcode !== undefined && qty !== undefined) {
      const modelStr = String(modelCode).trim();
      const barcodeStr = String(barcode).trim();
      
      if (!originalInventoryMap[modelStr]) {
        originalInventoryMap[modelStr] = {};
      }
      originalInventoryMap[modelStr][barcodeStr] = parseInt(qty, 10);
    }
  }
  
  console.log("Fetching all orders...");
  const ordersSnap = await getDocs(collection(db, "orders"));
  const orders = ordersSnap.docs.map(d => d.data());
  console.log(`Found ${orders.length} total orders.`);

  // Calculate sold items
  const deductions = {}; // productId -> colorName -> piecesToDeduct
  for (const order of orders) {
    if (order.isDeleted || order.status === "cancelled") continue;
    
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
  
  console.log("Fetching products from Firebase...");
  const snapshot = await getDocs(collection(db, "products"));
  let updated = 0;
  
  for (const productDoc of snapshot.docs) {
    const data = productDoc.data();
    const modelStr = String(data.modelNumber).trim();
    const pId = productDoc.id;
    
    const barcodesInExcel = originalInventoryMap[modelStr] || {};
    const productDeductions = deductions[pId] || {};
    
    let totalComputed = 0;
    
    const newColors = (data.colors || []).map(color => {
      const barcodeStr = String(color.barcode).trim();
      let originalQty = barcodesInExcel[barcodeStr];
      
      if (originalQty === undefined) {
        // Not in Excel sheet -> quantity 0
        originalQty = 0;
      }
      
      const deductQty = productDeductions[color.name] || 0;
      let finalQty = originalQty - deductQty;
      
      totalComputed += finalQty;
      return { ...color, quantity: finalQty };
    });

    await updateDoc(doc(db, "products", pId), {
      colors: newColors,
      quantity: totalComputed
    });
    
    updated++;
  }

  console.log(`Successfully reset and updated ${updated} products.`);
  process.exit(0);
}

runResetAndDeduct().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
