import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";

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
  const q = query(collection(db, "inventory_logs"), orderBy("createdAt", "desc"), limit(20));
  const snapshot = await getDocs(q);
  
  const logs = [];
  snapshot.forEach(doc => {
    logs.push(doc.data());
  });

  console.log(JSON.stringify(logs, null, 2));
  process.exit(0);
}

run().catch(console.error);
