import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query } from "firebase/firestore";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, ".env.local");
const envContent = readFileSync(envPath, "utf-8");
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

async function run() {
  const s = await getDocs(query(collection(db, "orders")));
  let count = 0;
  s.forEach(doc => {
      const d = doc.data();
      if (count < 10) {
        console.log(doc.id, "status:", d.status, "deleted:", d.deleted, "state:", d.state);
      }
      count++;
  });
  console.log("Total docs:", count);
  process.exit(0);
}
run().catch(console.error);
