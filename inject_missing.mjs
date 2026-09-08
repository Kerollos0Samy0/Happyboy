import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';
import XLSX from 'xlsx';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.+)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '').replace(/^`|`$/g, '').replace(/^'|'$/g, '');
});

const app = initializeApp({ apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY, projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
const db = getFirestore(app);

async function run() {
  console.log('Finding missing items...');
  const wb = XLSX.readFile('المخزن.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const storeData = XLSX.utils.sheet_to_json(ws);
  const originalMap = new Map();
  for (const row of storeData) {
      let cb = (row['الباركود'] || row['Code'] || '').toString().trim();
      let model = (row['الكود'] || row['كود الموديل'] || row['الموديل'] || row['Code'] || '').toString().trim();
      const qty = Number(row['القطعة'] || row['عدد القطع'] || row['قطعة'] || 0) || 0;
      if (cb) {
         if (!originalMap.has(cb)) originalMap.set(cb, { qty: 0, model });
         originalMap.get(cb).qty += qty;
      }
  }

  const prodSnap = await getDocs(collection(db, 'products'));
  const dbBarcodes = new Set();
  prodSnap.forEach(d => {
      const p = d.data();
      (p.colors || []).forEach(c => {
         dbBarcodes.add((c.barcode || '').toString().trim());
      });
  });

  let missingQty = 0;
  const missingItems = [];
  for (const [cb, info] of originalMap.entries()) {
      if (!dbBarcodes.has(cb) && info.qty > 0) {
          missingQty += info.qty;
          missingItems.push({ barcode: cb, qty: info.qty, model: info.model });
      }
  }

  console.log('Total Missing Qty:', missingQty);
  if (missingQty > 0) {
      console.log('Injecting missing items into DB...');
      const newDocRef = doc(collection(db, 'products'));
      await setDoc(newDocRef, {
          modelNumber: '99999',
          name: 'موديلات مخفية من الإكسيل وغير مسجلة',
          price: 0,
          quantity: missingQty,
          category: 'other',
          colors: missingItems.map(m => ({
              barcode: m.barcode,
              name: 'باركود ' + m.barcode,
              quantity: m.qty
          }))
      });
      console.log('Injected successfully! Total should now perfectly match 19,689.');
  }
  process.exit(0);
}
run();
