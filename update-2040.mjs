import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc, query, where } from "firebase/firestore";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.local", "utf-8");
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
  const q = query(collection(db, "products"), where("modelNumber", "==", "2040"));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    console.log("Model 2040 not found.");
    process.exit(1);
  }
  
  for (const d of snapshot.docs) {
    const data = d.data();
    console.log("Before:", JSON.stringify(data, null, 2));
    
    // Add new color
    const newColor = { name: "اسود", barcode: "409" };
    
    let colors = data.colors || [];
    // Check if exists
    if (!colors.some(c => c.barcode === "409")) {
        colors.push(newColor);
    }
    
    let barcodes = data.barcodes || [];
    if (!barcodes.includes("409")) {
        barcodes.push("409");
    }
    
    await updateDoc(doc(db, "products", d.id), {
        colors: colors,
        barcodes: barcodes
    });
    console.log("Successfully updated 2040!");
  }
  process.exit(0);
}
run();
