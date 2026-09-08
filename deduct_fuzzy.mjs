import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
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

// Simple Arabic text normalization
function normalize(str) {
  if (!str) return "";
  return str.trim()
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ي$/g, 'ى')
    .replace(/[يى]/g, 'ي')
    .replace(/\s+/g, '') // remove spaces for better matching
    .replace(/شاركول/g, 'شاركويل')
    .replace(/اوفوايت/g, 'اوفوايت'); 
}

async function run() {
  console.log("Fetching orders...");
  const ordersSnap = await getDocs(collection(db, "orders"));
  
  const missingTxt = readFileSync("C:\\Users\\kokos\\.gemini\\antigravity\\brain\\c0623a2d-ced8-41ec-a5da-c4e33c3fc085\\missing_deductions.md", "utf-8").split("\n");
  const missingToProcess = [];
  // Parse table rows
  for (const line of missingTxt) {
      if (line.startsWith("|") && !line.includes("رقم الأوردر") && !line.includes("---")) {
          const parts = line.split("|").map(s => s.trim());
          if (parts.length >= 6) {
              const orderId = parts[1];
              const modelNum = parts[2];
              const colorName = parts[3] === "-" ? "" : parts[3];
              const cb = parts[4] === "-" ? "" : parts[4];
              const qty = parseInt(parts[5], 10);
              
              if (qty > 0) {
                 missingToProcess.push({ orderId, modelNum, colorName, colorBarcode: cb, qty });
              }
          }
      }
  }
  
  console.log(`Found ${missingToProcess.length} items to fuzzy match and deduct.`);
  const productsSnap = await getDocs(collection(db, "products"));
  let updatedCount = 0;
  
  let reportLog = "تقرير الخصم الذكي (Fuzzy Matching):\n\n";

  for (const productDoc of productsSnap.docs) {
      const data = productDoc.data();
      const modelNum = String(data.modelNumber).trim();
      
      const itemsForThisModel = missingToProcess.filter(i => i.modelNum === modelNum && i.qty > 0);
      
      if (itemsForThisModel.length > 0) {
          let modelChanged = false;
          let newTotalQty = 0;
          
          const newColors = (data.colors || []).map(color => {
              const cn = String(color.name || "").trim();
              const normStockColor = normalize(cn);
              
              let currentQty = Number(color.quantity) || 0;
              
              for (const item of itemsForThisModel) {
                  if (item.qty <= 0) continue;
                  
                  const normOrderColor = normalize(item.colorName);
                  
                  let matches = false;
                  if (normOrderColor && normStockColor && normOrderColor === normStockColor) {
                      matches = true;
                  }
                  
                  if (matches) {
                      const qtyToDeduct = item.qty;
                      const newQty = Math.max(0, currentQty - qtyToDeduct);
                      
                      if (currentQty !== newQty) {
                          modelChanged = true;
                          reportLog += `- الأوردر ${item.orderId} | موديل ${modelNum}: تمت مطابقة '${item.colorName}' مع '${cn}'. الخصم: ${qtyToDeduct} (الرصيد: ${currentQty} -> ${newQty})\n`;
                          currentQty = newQty;
                      }
                      item.qty = 0; 
                  }
              }
              newTotalQty += currentQty;
              return { ...color, quantity: currentQty };
          });
          
          if (modelChanged || data.quantity !== newTotalQty) {
              await updateDoc(doc(db, "products", productDoc.id), {
                  colors: newColors,
                  quantity: newTotalQty
              });
              updatedCount++;
          }
      }
  }
  
  const stillMissed = missingToProcess.filter(i => i.qty > 0);
  if (stillMissed.length > 0) {
      reportLog += "\n---\nأصناف فشل التعرف عليها حتى بعد المطابقة الذكية:\n";
      stillMissed.forEach(i => {
          reportLog += `- أوردر ${i.orderId} | موديل ${i.modelNum} | لون: ${i.colorName || '(فارغ)'}\n`;
      });
  }
  
  console.log(`Updated ${updatedCount} products using fuzzy match.`);
  writeFileSync("fuzzy_deduction_report.md", reportLog, "utf-8");
  process.exit(0);
}

run().catch(console.error);
