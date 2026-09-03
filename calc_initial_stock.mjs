
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
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
  if (isNaN(num)) return '????';
  if (num >= 5 && num <= 90) return '???? ?????';
  if (num >= 100 && num <= 299) return '??? ?????';
  if (num >= 300 && num <= 499) return '???? ?????';
  if (num >= 500 && num <= 589) return '???? ?????';
  if (num >= 590 && num <= 789) return '??? ?????';
  if (num >= 790 && num <= 999) return '???? ?????';
  if (num >= 1000 && num <= 2999) return '?????';
  if (num >= 3000 && num <= 4999) return '??? ?????';
  if (num >= 5000 && num <= 6999) return '??? ?????';
  return '????';
};

const getSizesCount = (name, modelNumber, sizes) => {
  const category = getCategoryName(modelNumber);
  if (category.includes('????') || category.includes('???') || category.includes('????') || category.includes('?????') || (name || '').includes('????') || (name || '').includes('???') || (name || '').includes('????')) return 4;
  return sizes && sizes.length > 0 ? sizes.length : 1;
};

async function run() {
  const productsSnap = await getDocs(collection(db, 'products'));
  const currentStockByBarcode = {};
  
  productsSnap.forEach(doc => {
    const data = doc.data();
    if (data.colors && Array.isArray(data.colors)) {
      data.colors.forEach(color => {
         const cb = (color.barcode || '').toString().trim();
         if (!cb) return;
         
         let colorQty = 0;
         if (color.quantity !== undefined) {
           colorQty = Number(color.quantity);
         } else if (color.sizes && !Array.isArray(color.sizes)) {
           Object.values(color.sizes).forEach(sz => {
              colorQty += Number(sz.quantity || 0);
           });
         }
         currentStockByBarcode[cb] = (currentStockByBarcode[cb] || 0) + colorQty;
      });
    }
  });
  
  const ordersSnap = await getDocs(collection(db, 'orders'));
  const salesByBarcode = {};
  
  ordersSnap.forEach(doc => {
    const order = doc.data();
    if (order.isDeleted || order.status === 'cancelled' || order.status === '?????' || order.status === '?????') return;
    
    if (Array.isArray(order.items)) {
      order.items.forEach(item => {
        const cb = (item.colorBarcode || '').toString().trim();
        const qty = Number(item.quantity) || 1;
        const totalP = item.isSeri ? getSizesCount(item.name || '', item.modelNumber || '', item.sizes) * qty : qty;
        if (cb) {
           salesByBarcode[cb] = (salesByBarcode[cb] || 0) + totalP;
        }
      });
    }
  });
  
  let totalInitialStock = 0;
  const allBarcodes = new Set([...Object.keys(currentStockByBarcode), ...Object.keys(salesByBarcode)]);
  
  allBarcodes.forEach(cb => {
      const current = currentStockByBarcode[cb] || 0;
      const sales = salesByBarcode[cb] || 0;
      totalInitialStock += (current + sales);
  });
  
  console.log('Total Initial Stock in DB:', totalInitialStock);
  process.exit(0);
}
run().catch(console.error);

