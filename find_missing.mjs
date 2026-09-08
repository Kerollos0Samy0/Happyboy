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
  const models = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    const modelStr = data.modelNumber;
    const num = parseInt(modelStr, 10);
    
    // وسط بناتي: 590 to 789
    if (!isNaN(num) && num >= 590 && num <= 789) {
      let barcodeCount = 0;
      let colorsList = [];
      if (data.colors && Array.isArray(data.colors)) {
        barcodeCount = data.colors.filter(c => c.barcode && c.barcode.trim() !== "").length;
        colorsList = data.colors.map(c => c.name);
      }
      models.push({
        modelNumber: data.modelNumber,
        barcodeCount,
        colors: colorsList.join(" - ")
      });
    }
  });

  // Sort by model number
  models.sort((a, b) => parseInt(a.modelNumber) - parseInt(b.modelNumber));

  console.log(JSON.stringify(models, null, 2));
  process.exit(0);
}

run().catch(console.error);
