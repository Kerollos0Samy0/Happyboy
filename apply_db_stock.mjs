import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import XLSX from 'xlsx';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^=]+)=(.+)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '').replace(/^`|`$/g, '');
}

const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
});
const db = getFirestore(app);

const getCategoryName = (modelNumber) => {
  const num = parseInt(modelNumber, 10);
  if (isNaN(num)) return 'other';
  if (num >= 5 && num <= 90) return 'baby boys';
  if (num >= 100 && num <= 299) return 'mid boys';
  if (num >= 300 && num <= 499) return 'teen boys';
  if (num >= 500 && num <= 589) return 'baby girls';
  if (num >= 590 && num <= 789) return 'mid girls';
  if (num >= 790 && num <= 999) return 'teen girls';
  if (num >= 1000 && num <= 2999) return 'sport';
  if (num >= 3000 && num <= 4999) return 'summer boys';
  if (num >= 5000 && num <= 6999) return 'summer girls';
  return 'other';
};

const getSizesCount = (name, modelNumber, sizes) => {
  const category = getCategoryName(modelNumber);
  if (category.includes('baby') || category.includes('mid') || category.includes('teen') || category.includes('sport') || (name || '').includes('بيبي') || (name || '').includes('وسط') || (name || '').includes('محير')) return 4;
  return sizes && sizes.length > 0 ? sizes.length : 1;
};

async function run() {
  console.log('Fetching orders...');
  const snap = await getDocs(collection(db, 'orders'));
  const soldMap = new Map();
  snap.forEach(doc => {
    const data = doc.data();
    if (data.isDeleted) return;
    if (data.status === 'cancelled' || data.status === 'مرفوض' || data.status === 'مرتجع') return;
    if (data.items) {
      data.items.forEach(item => {
         let cb = (item.colorBarcode || '').toString().trim();
         if (!cb) return;
         const qty = Number(item.quantity) || 1;
         const p = item.isSeri ? getSizesCount(item.name, item.modelNumber, item.sizes) * qty : qty;
         if (!soldMap.has(cb)) soldMap.set(cb, 0);
         soldMap.set(cb, soldMap.get(cb) + p);
      });
    }
  });

  console.log('Reading Excel...');
  const wb = XLSX.readFile('المخزن.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const storeData = XLSX.utils.sheet_to_json(ws);
  const originalMap = new Map();
  for (const row of storeData) {
      let rawBarcode = (row['الباركود'] || row['Code'] || '').toString().trim();
      let cb = rawBarcode;
      
      const qty = Number(row['القطعة'] || row['عدد القطع'] || row['قطعة'] || 0) || 0;
      if (cb) {
         if (!originalMap.has(cb)) originalMap.set(cb, 0);
         originalMap.set(cb, originalMap.get(cb) + qty);
      }
  }

  console.log('Updating DB Products...');
  const prodSnap = await getDocs(collection(db, 'products'));
  const batches = [];
  let batch = writeBatch(db);
  let count = 0;
  
  let totalCurrentStock = 0;

  prodSnap.forEach(d => {
      const p = d.data();
      let hasChanges = false;
      let newTotalQty = 0;
      
      const newColors = (p.colors || []).map(c => {
         const cb = (c.barcode || '').toString().trim();
         const orig = originalMap.get(cb) || 0;
         const sold = soldMap.get(cb) || 0;
         const finalQty = orig - sold; 
         
         if (Number(c.quantity) !== finalQty) hasChanges = true;
         newTotalQty += finalQty;
         
         return { ...c, quantity: finalQty };
      });
      
      if (Number(p.quantity) !== newTotalQty) hasChanges = true;
      totalCurrentStock += Math.max(0, newTotalQty);

      if (hasChanges) {
          batch.update(d.ref, { colors: newColors, quantity: newTotalQty });
          count++;
          if (count === 400) {
              batches.push(batch);
              batch = writeBatch(db);
              count = 0;
          }
      }
  });
  if (count > 0) batches.push(batch);

  for (const b of batches) {
      await b.commit();
  }
  
  console.log('DONE! Updated Database Products to exactly match Original Stock - Sales.');
  console.log('Total Current Stock (Positive) in DB will now be:', totalCurrentStock);
  process.exit(0);
}
run().catch(console.error);
