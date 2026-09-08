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

const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
});
const db = getFirestore(app);

async function run() {
  const ordersSnap = await getDocs(collection(db, "orders"));
  const productsSnap = await getDocs(collection(db, "products"));
  
  const productsDict = {};
  productsSnap.forEach(doc => {
      const data = doc.data();
      productsDict[String(data.modelNumber).trim()] = data;
  });

  let examples = [];
  ordersSnap.forEach(doc => {
      const order = doc.data();
      if (order.items) {
          for (const item of order.items) {
              if (!item.colorBarcode || item.colorBarcode.trim() === "") {
                  const m = String(item.modelNumber || item.model).trim();
                  const c = String(item.selectedColor || item.color).trim();
                  const prod = productsDict[m];
                  if (prod) {
                      const avail = (prod.colors || []).map(x => x.name).join("، ");
                      examples.push(`موديل ${m} طلب لون "${c}" - المتاح في المخزن: [${avail}]`);
                  }
              }
          }
      }
  });
  
  writeFileSync("examples.txt", examples.slice(0, 10).join("\n"));
  process.exit(0);
}

run().catch(console.error);
