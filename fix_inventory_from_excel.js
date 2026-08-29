const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, updateDoc, doc, addDoc, serverTimestamp } = require("firebase/firestore");
const { readFileSync } = require("fs");
const xlsx = require('xlsx');

const envContent = readFileSync(".env.local", "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^([^=]+)="?([^"]*)"?$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const colorMap = {
  'شاركول': 'شاركويل',
  'بسستاج': 'بستاج',
  'بيطخي': 'بطيخي',
  'اوف ويت': 'اوف وايت',
  'بدي روز': 'روز',
  'برجاندي': 'برجندي',
  'سميون': 'سيمون',
};

function normalizeColor(str) {
  if (!str) return "";
  let norm = str.replace(/ى/g, "ي").replace(/[أإآ]/g, "ا").trim();
  if (colorMap[norm]) {
    norm = colorMap[norm];
  }
  return norm;
}

function extractColor(itemStr) {
  if (!itemStr) return null;
  const match = String(itemStr).match(/\(([^)]+)\)/);
  if (match) return normalizeColor(match[1]);
  return null;
}

async function run() {
  console.log("Reading المخزن.xlsx...");
  const workbook = xlsx.readFile('المخزن.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const excelData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  const excelModels = {};

  // Row 5 is 'عدد القطع', Row 2 is 'التصنيف'
  for (let i = 1; i < excelData.length; i++) {
    const row = excelData[i];
    if (row.length >= 6 && row[0] !== undefined && row[5] !== undefined) {
      const modelNumber = String(row[0]).trim();
      if (modelNumber.toLowerCase() === 'code' || isNaN(parseInt(modelNumber))) continue;

      const colorName = extractColor(row[2]);
      const qty = parseInt(row[5], 10);

      if (isNaN(qty)) continue;

      if (!excelModels[modelNumber]) {
        excelModels[modelNumber] = { totalQty: 0, colors: {} };
      }
      
      excelModels[modelNumber].totalQty += qty;

      if (colorName) {
        if (!excelModels[modelNumber].colors[colorName]) {
          excelModels[modelNumber].colors[colorName] = 0;
        }
        excelModels[modelNumber].colors[colorName] += qty;
      }
    }
  }

  console.log(`Parsed ${Object.keys(excelModels).length} models from Excel.`);
  console.log("Fetching products from Firebase...");
  const snapshot = await getDocs(collection(db, "products"));
  
  let updatedCount = 0;

  for (const productDoc of snapshot.docs) {
    const product = productDoc.data();
    if (product.isDeleted) continue;
    
    const m = String(product.modelNumber).trim();
    if (excelModels[m]) {
      const ex = excelModels[m];
      let needsUpdate = false;
      const updatedColors = [];
      const dbColors = product.colors || [];

      // Create a map of existing db colors to their barcodes
      const dbColorsMap = {};
      dbColors.forEach(c => {
        dbColorsMap[normalizeColor(c.name)] = c;
      });

      // Update matching colors from Excel
      for (const [exColor, exQty] of Object.entries(ex.colors)) {
        if (dbColorsMap[exColor]) {
           updatedColors.push({
             ...dbColorsMap[exColor],
             quantity: exQty
           });
           delete dbColorsMap[exColor]; // Handled
        } else {
           // Color in excel but not in DB
           updatedColors.push({
             name: exColor,
             barcode: "", // Don't know barcode
             quantity: exQty
           });
        }
      }

      // Remaining db colors not in excel gets 0
      for (const [dbColor, cData] of Object.entries(dbColorsMap)) {
         updatedColors.push({
             ...cData,
             quantity: 0
         });
      }

      // Check if total qty or colors changed
      const currentTotal = Number(product.quantity) || 0;
      if (currentTotal !== ex.totalQty) {
          needsUpdate = true;
      } else {
          // Compare colors
          const currentColorsStr = JSON.stringify(dbColors.map(c => ({n: normalizeColor(c.name), q: Number(c.quantity)||0})).sort((a,b)=>a.n.localeCompare(b.n)));
          const updatedColorsStr = JSON.stringify(updatedColors.map(c => ({n: normalizeColor(c.name), q: Number(c.quantity)||0})).sort((a,b)=>a.n.localeCompare(b.n)));
          if (currentColorsStr !== updatedColorsStr) {
             needsUpdate = true;
          }
      }

      if (needsUpdate) {
        await updateDoc(doc(db, "products", productDoc.id), {
          quantity: ex.totalQty,
          colors: updatedColors
        });

        await addDoc(collection(db, "inventory_logs"), {
            productId: productDoc.id,
            modelNumber: m,
            productName: product.name,
            reason: "تصحيح كميات الإكسيل (عدد القطع)",
            oldQuantity: currentTotal,
            newQuantity: ex.totalQty,
            employeeName: "System_Bot",
            createdAt: serverTimestamp()
        });

        updatedCount++;
        console.log(`Updated model ${m}: Total Qty ${currentTotal} -> ${ex.totalQty}`);
      }
    }
  }

  console.log(`\nSuccessfully updated ${updatedCount} products.`);
  process.exit(0);
}

run().catch(console.error);
