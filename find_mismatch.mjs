import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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

async function run() {
  const snapshot = await getDocs(collection(db, "products"));
  const mismatches = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    const modelStr = data.modelNumber;
    const num = parseInt(modelStr, 10);
    
    if (!isNaN(num) && num >= 590 && num <= 789) {
      let bCount = data.barcodes ? data.barcodes.length : 0;
      let cCount = data.colors ? data.colors.length : 0;
      if (bCount !== cCount) {
        mismatches.push({
          modelNumber: data.modelNumber,
          barcodesCount: bCount,
          colorsCount: cCount,
          colors: data.colors.map(c => c.name)
        });
      }
    }
  });

  console.log(JSON.stringify(mismatches, null, 2));
  process.exit(0);
}

run().catch(console.error);
