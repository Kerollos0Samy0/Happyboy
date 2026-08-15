import { initializeApp } from "firebase/app";
import { getFirestore, collection, getCountFromServer, getDocs } from "firebase/firestore";


const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  try {
    const coll = collection(db, "products");
    const snapshot = await getCountFromServer(coll);
    console.log("Total products:", snapshot.data().count);
    
    // Check if any product has an insane number of colors
    const docs = await getDocs(coll);
    let maxColors = 0;
    docs.forEach(d => {
      const data = d.data();
      if (data.colors && Array.isArray(data.colors)) {
         maxColors = Math.max(maxColors, data.colors.length);
      }
    });
    console.log("Max colors in a product:", maxColors);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
