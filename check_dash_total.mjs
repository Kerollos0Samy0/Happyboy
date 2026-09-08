import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";
import { join } from "path";

const envPath = join("e:/Files/Stock HappyBoy", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
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

const getCategoryName = (modelNumber) => {
  const num = parseInt(modelNumber, 10);
  if (isNaN(num)) return 'أخرى';
  if (num >= 5 && num <= 90) return 'بيبي ولادي';
  if (num >= 100 && num <= 299) return 'وسط ولادي';
  if (num >= 300 && num <= 499) return 'محير ولادي';
  if (num >= 500 && num <= 589) return 'بيبي بناتي';
  if (num >= 590 && num <= 789) return 'وسط بناتي';
  if (num >= 790 && num <= 999) return 'محير بناتي';
  if (num >= 1000 && num <= 2999) return 'رياضي';
  if (num >= 3000 && num <= 4999) return 'سمر ولادي';
  if (num >= 5000 && num <= 6999) return 'سمر بناتي';
  return 'أخرى';
};

const getSizesCount = (name, modelNumber, sizes) => {
  const category = getCategoryName(modelNumber);
  if (category.includes('بيبي') || category.includes('وسط') || category.includes('محير') || category.includes('رياضي') || (name || '').includes('بيبي') || (name || '').includes('وسط') || (name || '').includes('محير')) return 4;
  return sizes && sizes.length > 0 ? sizes.length : 1;
};

async function check() {
  const snap = await getDocs(collection(db, "orders"));
  let total = 0;
  snap.forEach(doc => {
    const o = doc.data();
    if (!o.isDeleted && o.items) {
      o.items.forEach(i => {
        const qty = i.quantity || 1;
        total += i.isSeri ? getSizesCount(i.name || '', i.modelNumber || '', i.sizes) * qty : qty;
      });
    }
  });
  console.log('Dashboard Total:', total);
  process.exit(0);
}
check();
