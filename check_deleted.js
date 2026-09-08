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

async function checkDeleted() {
  console.log("Fetching products...");
  const pSnap = await getDocs(collection(db, "products"));
  const deletedProducts = pSnap.docs.map(d => ({id: d.id, ...d.data()})).filter(p => p.isDeleted);
  console.log("Deleted products count:", deletedProducts.length);
  
  if (deletedProducts.length > 0) {
    deletedProducts.forEach(p => console.log(`- ${p.modelNumber} (${p.name})`));
  }
  
  console.log("\nFetching orders to calculate sales of deleted products...");
  const oSnap = await getDocs(collection(db, "orders"));
  const orders = oSnap.docs.map(d => ({id: d.id, ...d.data()})).filter(o => !o.isDeleted && o.status !== 'cancelled');
  
  let deletedSales = 0;
  
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
    if (category.includes('بيبي') || category.includes('وسط') || category.includes('محير') || category.includes('رياضي') || name.includes('بيبي') || name.includes('وسط') || name.includes('محير')) return 4;
    return sizes && sizes.length > 0 ? sizes.length : 1;
  };
  
  const deletedModelNumbers = new Set(deletedProducts.map(p => p.modelNumber));

  orders.forEach(order => {
    if (order.items) {
      order.items.forEach(item => {
        if (deletedModelNumbers.has(item.modelNumber)) {
          const qty = item.quantity || 1;
          const pieces = item.isSeri ? getSizesCount(item.name || '', item.modelNumber, item.sizes) * qty : qty;
          deletedSales += pieces;
        }
      });
    }
  });

  console.log("Total sales (pieces) from deleted products:", deletedSales);
  process.exit(0);
}

checkDeleted().catch(console.error);
