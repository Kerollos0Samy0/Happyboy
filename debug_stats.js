const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
const firebaseConfig = {
  apiKey: "AIzaSyAtoF-UHbC5MKXf7k-cYWFNtusnL9FNzaw",
  authDomain: "happyboy01-39e92.firebaseapp.com",
  projectId: "happyboy01-39e92",
  storageBucket: "happyboy01-39e92.firebasestorage.app",
  messagingSenderId: "928550881158",
  appId: "1:928550881158:web:f9e071d97867cfb1ba8e07"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const getCategoryName = (modelNumber) => {
  const num = parseInt(modelNumber, 10);
  if (isNaN(num)) return "أخرى";
  if (num >= 5 && num <= 90) return "بيبي ولادي";
  if (num >= 100 && num <= 299) return "وسط ولادي";
  if (num >= 300 && num <= 499) return "محير ولادي";
  if (num >= 500 && num <= 589) return "بيبي بناتي";
  if (num >= 590 && num <= 789) return "وسط بناتي";
  if (num >= 790 && num <= 999) return "محير بناتي";
  if (num >= 1000 && num <= 2999) return "رياضي";
  if (num >= 3000 && num <= 4999) return "سمر ولادي";
  if (num >= 5000 && num <= 6999) return "سمر بناتي";
  return "أخرى";
};
const getSizesCount = (name, modelNumber, sizes) => {
  const category = getCategoryName(modelNumber);
  if (category.includes('بيبي') || category.includes('وسط') || category.includes('محير') || category.includes('رياضي') || (name||'').includes('بيبي') || (name||'').includes('وسط') || (name||'').includes('محير')) return 4;
  return sizes && sizes.length > 0 ? sizes.length : 1;
};
async function run() {
  const pSnap = await getDocs(collection(db, "products"));
  const products = pSnap.docs.map(d => ({id: d.id, ...d.data()})).filter(p => !p.isDeleted);
  const oSnap = await getDocs(collection(db, "orders"));
  const orders = oSnap.docs.map(d => ({id: d.id, ...d.data()})).filter(o => !o.isDeleted && o.status !== 'cancelled');
  let totalBoysSales = 0; let totalGirlsSales = 0;
  orders.forEach(order => {
    if (order.items) {
      order.items.forEach(item => {
        const qty = item.quantity || 1;
        const totalPieces = item.isSeri ? getSizesCount(item.name || '', item.modelNumber, item.sizes) * qty : qty;
        const category = getCategoryName(item.modelNumber);
        if (category.includes("ولادي") && !category.includes("سمر")) totalBoysSales += totalPieces;
        else if (category.includes("بناتي") && !category.includes("سمر")) totalGirlsSales += totalPieces;
      });
    }
  });
  let negBoys = 0; let negGirls = 0; let posBoys = 0; let posGirls = 0;
  products.forEach(p => {
    let qty = Number(p.quantity) || 0;
    let posQty = Math.max(0, qty);
    const cat = getCategoryName(p.modelNumber);
    if (posQty > 0) {
      if (cat.includes("ولادي") && !cat.includes("سمر")) posBoys += posQty;
      else if (cat.includes("بناتي") && !cat.includes("سمر")) posGirls += posQty;
    }
    if (qty < 0) {
      const absQty = Math.abs(qty);
      if (cat.includes("ولادي") && !cat.includes("سمر")) negBoys += absQty;
      else if (cat.includes("بناتي") && !cat.includes("سمر")) negGirls += absQty;
    }
  });
  const deductedBoys = Math.max(0, totalBoysSales - negBoys);
  const deductedGirls = Math.max(0, totalGirlsSales - negGirls);
  const deductedOriginalExcelTotal = deductedBoys + deductedGirls;
  const totalInventoryPieces = posBoys + posGirls;
  console.log({
    posBoys, posGirls, totalInventoryPieces,
    negBoys, negGirls, totalNeg: negBoys + negGirls,
    totalBoysSales, totalGirlsSales, totalSales: totalBoysSales + totalGirlsSales,
    deductedBoys, deductedGirls, deductedOriginalExcelTotal,
    Sum: totalInventoryPieces + deductedOriginalExcelTotal
  });
  process.exit(0);
}
run().catch(console.error);
