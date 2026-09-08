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
  const productsSnap = await getDocs(collection(db, "products"));
  const rows = [];
  
  productsSnap.forEach(doc => {
    const data = doc.data();
    
    // Check if category is "رياضي"
    if (data.mainCategory === "رياضي" || data.category === "رياضي") {
      if (data.colors && Array.isArray(data.colors)) {
        for (const color of data.colors) {
          const qty = Number(color.quantity) || 0;
          if (qty <= 0) {
            rows.push({
              "رقم موديل": data.modelNumber || data.id || "",
              "رقم الباركود": color.barcode || "",
              "اللون": color.name || "",
              "الكمية الحالية": qty,
              "الكمية المطلوبة": qty < 0 ? Math.abs(qty) : ""
            });
          }
        }
      }
    }
  });

  // Sort by model number
  rows.sort((a, b) => {
    return a["رقم موديل"].toString().localeCompare(b["رقم موديل"].toString(), 'ar', { numeric: true });
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "النواقص");
  
  XLSX.writeFile(wb, "نواقص_الرياضي.xlsx");
  console.log("Created نواقص_الرياضي.xlsx with " + rows.length + " missing items.");
  process.exit(0);
}

main().catch(console.error);
