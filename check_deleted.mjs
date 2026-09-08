import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

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
  const q = query(collection(db, "orders"), where("isDeleted", "==", true));
  const snapshot = await getDocs(q);
  
  const recentDeletions = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    recentDeletions.push({
      id: doc.id,
      orderNumber: data.orderNumber,
      customerName: data.customerName,
      items: data.items,
      createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null
    });
  });

  // Sort by created at descending
  recentDeletions.sort((a, b) => {
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  console.log(JSON.stringify(recentDeletions.slice(0, 10), null, 2));
  process.exit(0);
}

run().catch(console.error);
