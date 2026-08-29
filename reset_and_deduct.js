const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, updateDoc, doc } = require("firebase/firestore");
const { readFileSync } = require("fs");
const { join } = require("path");
const xlsx = require('xlsx');

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
        const normalize = (str) => {
          if (!str) return "";
          let n = str.trim();
          n = n.replace(/ى/g, "ي").replace(/[أإآ]/g, "ا");
          n = n.replace(/ة/g, "ه"); // كافية -> كافيه, مسطردة -> مسطرده
          if (n === 'شاركول') return 'شاركويل';
          if (n === 'بسستاج' || n === 'بسستاج') return 'بستاج';
          return n;
        };
        const color = normalize(item.selectedColor);
        
        if (!deductions[pId]) deductions[pId] = {};
        if (!deductions[pId][color]) deductions[pId][color] = 0;
        deductions[pId][color] += qtyToDeduct;
      }
    }
  }
  
  console.log("Fetching products from Firebase...");
  const snapshot = await getDocs(collection(db, "products"));
  let updated = 0;
  
  const batchSize = 20;
  for (let i = 0; i < snapshot.docs.length; i += batchSize) {
    const batch = snapshot.docs.slice(i, i + batchSize);
    await Promise.all(batch.map(async (productDoc) => {
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
          originalQty = 0;
        }
        
        const normalize = (str) => {
          if (!str) return "";
          let n = str.trim();
          n = n.replace(/ى/g, "ي").replace(/[أإآ]/g, "ا");
          n = n.replace(/ة/g, "ه"); 
          if (n === 'شاركول') return 'شاركويل';
          if (n === 'بسستاج' || n === 'بسستاج') return 'بستاج';
          return n;
        };
        const deductQty = productDeductions[normalize(color.name)] || 0;
        let finalQty = originalQty - deductQty;
        
        totalComputed += finalQty;
        return { ...color, quantity: finalQty };
      });

      await updateDoc(doc(db, "products", pId), {
        colors: newColors,
        quantity: totalComputed
      });
      
      updated++;
    }));
    console.log(`Updated ${updated}/${snapshot.docs.length} products...`);
  }

  console.log(`Successfully reset and updated ${updated} products.`);
  process.exit(0);
}

runResetAndDeduct().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
