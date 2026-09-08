import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^([^=]+)="?([^"]*)"?$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const ordersSnap = await getDocs(collection(db, "orders"));
  let found = false;
  ordersSnap.forEach(doc => {
    if (!found && doc.data().items && doc.data().items.length > 0) {
      console.log("Order item schema:", JSON.stringify(doc.data().items[0], null, 2));
      found = true;
    }
  });
  process.exit(0);
}
run();
