import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
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
  const s = await getDocs(collection(db, "orders"));
  const statuses = {};
  const trash = {};
  s.forEach(doc => {
      const d = doc.data();
      const stat = d.status || 'none';
      const isD = d.isDeleted || d.deleted || false;
      statuses[stat] = (statuses[stat] || 0) + 1;
      trash[isD] = (trash[isD] || 0) + 1;
  });
  console.log("Statuses:", statuses);
  console.log("Deleted:", trash);
  process.exit(0);
}
run().catch(console.error);
