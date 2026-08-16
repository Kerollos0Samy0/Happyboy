import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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

async function run() {
  const snapshot = await getDocs(collection(db, "products"));
  let totalByQuantity = 0;
  let totalByColors = 0;
  let missingColors = 0;

  snapshot.forEach(doc => {
    const p = doc.data();
    const q = Number(p.quantity) || 0;
    totalByQuantity += q;

    let cSum = 0;
    if (Array.isArray(p.colors)) {
      cSum = p.colors.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);
    }
    totalByColors += cSum;

    if (q !== cSum) {
      missingColors++;
      console.log(`Mismatch in Model ${p.modelNumber}: p.quantity=${q}, colors sum=${cSum}`);
    }
  });

  console.log(`Total by p.quantity: ${totalByQuantity}`);
  console.log(`Total by colors.quantity: ${totalByColors}`);
  console.log(`Models with mismatch: ${missingColors}`);
  process.exit(0);
}

run().catch(console.error);
