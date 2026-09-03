
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

const db = getFirestore(app);
const snapshot = await getDocs(collection(db, 'orders'));

let totalPiecesAll = 0;
let totalPiecesValid = 0;
let cancelledPieces = 0;

snapshot.forEach(doc => {
  const order = doc.data();
  if (order.isDeleted) return; 
  
  let orderPieces = 0;
  if (Array.isArray(order.items)) {
    order.items.forEach(item => {
      const qty = Number(item.quantity) || 1;
      const totalP = item.isSeri ? getSizesCount(item.name || '', item.modelNumber || '', item.sizes) * qty : qty;
      orderPieces += totalP;
    });
  }

  totalPiecesAll += orderPieces;
  
  if (order.status === 'cancelled' || order.status === '?????' || order.status === '?????') {
    cancelledPieces += orderPieces;
  } else {
    totalPiecesValid += orderPieces;
  }
});

console.log('Total Pieces (All active non-deleted):', totalPiecesAll);
console.log('Total Valid Pieces (Sales, no cancelled):', totalPiecesValid);
console.log('Cancelled/Rejected Pieces:', cancelledPieces);
process.exit(0);

