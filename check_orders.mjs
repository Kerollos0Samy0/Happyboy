import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";
import { join } from "path";

const envPath = join("e:/Files/Stock HappyBoy", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^([^=]+)="?([^"]*)"?$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
});
const db = getFirestore(app);

async function check() {
  const o1 = await getDoc(doc(db, "orders", "2XPnwi6BOHOnTPebctT8"));
  const o2 = await getDoc(doc(db, "orders", "6DYhMHm1K0zTSr8RWcKY"));
  console.log("Order 1:", o1.data().orderNumber, o1.data().customerName, o1.data().createdAt?.toDate ? o1.data().createdAt.toDate() : "No date");
  console.log("Order 2:", o2.data().orderNumber, o2.data().customerName, o2.data().createdAt?.toDate ? o2.data().createdAt.toDate() : "No date");
  process.exit(0);
}
check();
