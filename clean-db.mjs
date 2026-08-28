import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAtoF-UHbC5MKXf7k-cYWFNtusnL9FNzaw",
  authDomain: "happyboy01-39e92.firebaseapp.com",
  projectId: "happyboy01-39e92",
  storageBucket: "happyboy01-39e92.firebasestorage.app",
  messagingSenderId: "928550881158",
  appId: "1:928550881158:web:f9e071d97867cfb1ba8e07",
  measurementId: "G-CDRFXXJ040"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("Fetching products...");
  const snapshot = await getDocs(collection(db, "products"));
  const products = [];
  snapshot.forEach(doc => {
    products.push({ id: doc.id, ...doc.data() });
  });

  console.log(`Total products found: ${products.length}`);

  // Find duplicates by modelNumber
  const modelMap = new Map();
  const duplicates = [];
  const uniqueProducts = [];

  for (const p of products) {
    if (!p.modelNumber) continue;
    const model = String(p.modelNumber).trim();
    if (modelMap.has(model)) {
      duplicates.push(p);
    } else {
      modelMap.set(model, p);
      uniqueProducts.push(p);
    }
  }

  console.log(`Found ${duplicates.length} duplicate models.`);

  // Delete duplicates
  for (const dup of duplicates) {
    console.log(`Deleting duplicate model: ${dup.modelNumber} (ID: ${dup.id})`);
    await deleteDoc(doc(db, "products", dup.id));
  }
  console.log("Duplicates deleted.");

  // Categorize unique products
  let boysBaby = 0;
  let boysMiddle = 0;
  let boysJunior = 0;
  
  let girlsBaby = 0;
  let girlsMiddle = 0;
  let girlsJunior = 0;

  let others = 0;

  for (const p of uniqueProducts) {
    const num = parseInt(p.modelNumber, 10);
    if (isNaN(num)) {
      others++;
      continue;
    }

    if (num >= 5 && num <= 90) boysBaby++;
    else if (num >= 100 && num <= 150) boysMiddle++;
    else if (num >= 300 && num <= 350) boysJunior++;
    else if (num >= 500 && num <= 565) girlsBaby++;
    else if (num >= 590 && num <= 690) girlsMiddle++;
    else if (num >= 790 && num <= 890) girlsJunior++;
    else others++;
  }

  console.log("\n=== إحصائيات الموديلات ===");
  console.log(`قسم الأولادي:`);
  console.log(`- بيبي (5 - 90): ${boysBaby} موديل`);
  console.log(`- وسط (100 - 150): ${boysMiddle} موديل`);
  console.log(`- محير (300 - 350): ${boysJunior} موديل`);
  
  console.log(`\nقسم البناتي:`);
  console.log(`- بيبي (500 - 565): ${girlsBaby} موديل`);
  console.log(`- وسط (590 - 690): ${girlsMiddle} موديل`);
  console.log(`- محير (790 - 890): ${girlsJunior} موديل`);
  
  console.log(`\nموديلات غير مصنفة: ${others} موديل`);
  process.exit(0);
}

run().catch(console.error);
