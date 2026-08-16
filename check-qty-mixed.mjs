import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";

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
  let totalMixed = 0;

  snapshot.forEach(doc => {
    const p = doc.data();
    const q = Number(p.quantity) || 0;

    let cSum = 0;
    let hasColorsWithQuantity = false;
    if (Array.isArray(p.colors)) {
      cSum = p.colors.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);
      if (cSum > 0) {
        hasColorsWithQuantity = true;
      }
    }
    
    // if the user specified colors quantities, trust that. Otherwise trust the main quantity.
    if (hasColorsWithQuantity) {
      totalMixed += cSum;
    } else {
      totalMixed += q;
    }
  });

  console.log(`Mixed Total: ${totalMixed}`);
  process.exit(0);
}

run().catch(console.error);
