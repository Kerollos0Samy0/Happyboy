import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = {
  apiKey: "AIzaSyAtoF-UHbC5MKXf7k-cYWFNtusnL9FNzaw",
  authDomain: "happyboy01-39e92.firebaseapp.com",
  projectId: "happyboy01-39e92",
  storageBucket: "happyboy01-39e92.firebasestorage.app",
  messagingSenderId: "928550881158",
  appId: "1:928550881158:web:f9e071d97867cfb1ba8e07",
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

async function run() {
  console.log("Fetching products from Firebase...");
  const snapshot = await getDocs(collection(db, "products"));
  const products = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    
    // Flatten the product into a list of barcodes
    if (data.colors && Array.isArray(data.colors)) {
      data.colors.forEach(color => {
        if (color.barcode && color.barcode.trim() !== "") {
          products.push({
            modelNumber: data.modelNumber,
            name: data.name,
            color: color.name,
            barcode: color.barcode,
            category: getCategoryName(data.modelNumber)
          });
        }
      });
    }
  });

  // Sort by category then model
  products.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return parseInt(a.modelNumber || "0") - parseInt(b.modelNumber || "0");
  });

  fs.writeFileSync("all_db_barcodes.json", JSON.stringify(products, null, 2));
  console.log(`Saved ${products.length} barcodes to all_db_barcodes.json`);
  process.exit(0);
}

run().catch(console.error);
