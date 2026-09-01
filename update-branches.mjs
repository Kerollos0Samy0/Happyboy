import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
process.loadEnvFile('.env.local');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateBranches() {
  const ordersRef = collection(db, 'orders');
  const snapshot = await getDocs(ordersRef);
  let updatedCount = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    let newBranch = data.branch;
    if (newBranch === 'أخرى') {
      newBranch = 'التجمع';
    } else if (newBranch === 'عين شمس') {
      newBranch = 'العبور';
    }

    if (newBranch !== data.branch) {
      await updateDoc(doc(db, 'orders', docSnap.id), {
        branch: newBranch
      });
      updatedCount++;
    }
  }

  console.log('Finished updating ' + updatedCount + ' orders.');
  process.exit(0);
}
updateBranches().catch(console.error);
