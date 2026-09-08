import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import fs from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

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

const catData = JSON.parse(fs.readFileSync(join("e:/Files/Stock HappyBoy", "model_categories.json"), "utf-8"));
const localModels = JSON.parse(fs.readFileSync(join("e:/Files/Stock HappyBoy", "models_data.json"), "utf-8"));

async function updateSizes() {
  const snap = await getDocs(collection(db, "products"));
  let updatedCount = 0;

  for (const document of snap.docs) {
    const data = document.data();
    const m = data.modelNumber;
    const cat = catData[m];
    
    if (cat && (cat.mainCategory === 'رياضي' || cat.mainCategory === 'سمر ميلتون')) {
      let newSizes = [];
      if (cat.subCategory === 'وسط' || (data.name && data.name.includes('وسط'))) {
        newSizes = ['6', '8', '10', '12'];
      } else if (cat.subCategory === 'محير' || (data.name && data.name.includes('محير'))) {
        newSizes = ['14', '16', '18', '20'];
      }

      if (newSizes.length > 0) {
        // Update Firebase
        await updateDoc(doc(db, "products", document.id), { sizes: newSizes });
        
        // Update local JSON
        const localProd = localModels.find(p => p.modelNumber === m);
        if (localProd) {
          localProd.sizes = newSizes;
        }
        updatedCount++;
        console.log(`Updated model ${m} (${data.name}) to sizes: ${newSizes.join(',')}`);
      }
    }
  }

  // Save local JSON
  fs.writeFileSync(join("e:/Files/Stock HappyBoy", "models_data.json"), JSON.stringify(localModels, null, 2), "utf-8");
  
  console.log(`Finished updating ${updatedCount} models.`);
  process.exit(0);
}

updateSizes().catch(console.error);
