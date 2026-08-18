import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs/promises";
import path from "path";

const firebaseConfig = {
  apiKey: "AIzaSyAtoF-UHbC5MKXf7k-cYWFNtusnL9FNzaw",
  authDomain: "happyboy01-39e92.firebaseapp.com",
  projectId: "happyboy01-39e92",
  storageBucket: "happyboy01-39e92.firebasestorage.app",
  messagingSenderId: "928550881158",
  appId: "1:928550881158:web:f9e071d97867cfb1ba8e07"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const BACKUP_FILE = path.join(process.cwd(), "firebase-backup.json");
const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function performBackup() {
  console.log(`[${new Date().toLocaleString('ar-EG')}] جاري بدء عملية النسخ الاحتياطي...`);
  try {
    const backupData = {};
    const collectionsToBackup = ["products", "orders", "customers"];

    for (const collName of collectionsToBackup) {
      const snapshot = await getDocs(collection(db, collName));
      backupData[collName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`- تم جلب ${backupData[collName].length} عنصر من ${collName}`);
    }

    await fs.writeFile(BACKUP_FILE, JSON.stringify(backupData, null, 2), "utf-8");
    console.log(`[${new Date().toLocaleString('ar-EG')}] تم حفظ النسخة الاحتياطية بنجاح في ملف: ${BACKUP_FILE}`);
  } catch (err) {
    console.error(`[${new Date().toLocaleString('ar-EG')}] حدث خطأ أثناء النسخ الاحتياطي:`, err);
  }
}

console.log("تم تشغيل سكربت النسخ الاحتياطي التلقائي (يعمل كل ساعة)...");
// Run immediately on start
performBackup().then(() => {
  // Schedule to run every hour
  setInterval(performBackup, INTERVAL_MS);
});
