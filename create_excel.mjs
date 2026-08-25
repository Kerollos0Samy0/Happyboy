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
  // Read المخزن.xlsx to get the order
  let orderMap = new Map();
  try {
    const wbStore = XLSX.readFile("المخزن.xlsx");
    const wsStore = wbStore.Sheets[wbStore.SheetNames[0]];
    const storeData = XLSX.utils.sheet_to_json(wsStore);
    
    let orderIndex = 0;
    for (const row of storeData) {
      let code = row["كود الموديل"] || row["الموديل"];
      if (code != null) {
        code = code.toString().trim();
        if (!orderMap.has(code)) {
          orderMap.set(code, orderIndex++);
        }
      }
    }
  } catch(e) {
    console.error("Could not read المخزن.xlsx, proceeding without ordering", e);
  }

  const productsSnap = await getDocs(collection(db, "products"));
  const rows = [];
  
  productsSnap.forEach(doc => {
    const data = doc.data();
    
    let modelName = data.name || "";
    let modelNumber = data.modelNumber || data.id || "";
    let price = data.price || 0;
    let category = data.category || "";
    
    let colorsStr = "";
    if (data.colors && Array.isArray(data.colors)) {
      colorsStr = data.colors.map(c => c.name).join(" - ");
    }
    
    let barcodesStr = "";
    if (data.barcodes && Array.isArray(data.barcodes)) {
      barcodesStr = data.barcodes.join(" - ");
    } else if (data.colors && Array.isArray(data.colors)) {
        barcodesStr = data.colors.map(c => c.barcode).join(" - ");
    }
    
    let stringModel = modelNumber.toString().trim();
    
    let order = orderMap.has(stringModel) 
      ? orderMap.get(stringModel) 
      : 999999;

    rows.push({
      "رقم الموديل": modelNumber,
      "اسم الموديل": modelName,
      "التصنيف": category,
      "الالوان": colorsStr,
      "الباركود": barcodesStr,
      "السعر (للتعديل)": price,
      "_order": order
    });
  });

  // Sort by the order found in المخزن.xlsx
  rows.sort((a, b) => {
    if (a._order !== b._order) {
      return a._order - b._order;
    }
    // If both are 999999 or same, sort by model number
    return a["رقم الموديل"].toString().localeCompare(b["رقم الموديل"].toString(), 'ar', { numeric: true });
  });

  // Remove the temporary _order field
  for (const row of rows) {
    delete row._order;
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "الاسعار");
  
  XLSX.writeFile(wb, "تحديث_الاسعار_مرتب.xlsx");
  console.log("Created تحديث_الاسعار_مرتب.xlsx with " + rows.length + " products, sorted by المخزن.xlsx.");
  process.exit(0);
}

main().catch(console.error);
