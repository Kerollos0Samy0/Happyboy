import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs/promises";
import path from "path";
import { google } from "googleapis";

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

// إعدادات Google Drive
const KEYFILEPATH = path.join(process.cwd(), "google-drive-key.json");
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const FOLDER_ID = "1OzdCrgTygKcfN3w1iHtZi8pj_khAEuKt";

const INTERVAL_MS = 60 * 60 * 1000; // النسخ كل ساعة (يمكنك تعديلها)

async function uploadToDrive(filePath, fileName) {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: SCOPES,
  });
  const driveService = google.drive({ version: "v3", auth });

  const fileMetadata = {
    name: fileName,
    parents: [FOLDER_ID],
  };
  
  // استيراد fs العادي للـ ReadStream
  const fsSync = await import("fs");
  const media = {
    mimeType: "application/json",
    body: fsSync.createReadStream(filePath),
  };

  try {
    const response = await driveService.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id",
    });
    console.log(`✅ تم رفع النسخة بنجاح إلى درايف! ID الملف: ${response.data.id}`);
  } catch (error) {
    console.error("❌ حدث خطأ أثناء الرفع إلى درايف:", error.message);
  }
}

async function performBackup() {
  console.log(`\n[${new Date().toLocaleString('ar-EG')}] جاري بدء عملية النسخ الاحتياطي...`);
  try {
    const backupData = {};
    const collectionsToBackup = ["products", "orders", "customers"];

    for (const collName of collectionsToBackup) {
      const snapshot = await getDocs(collection(db, collName));
      backupData[collName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`- تم جلب ${backupData[collName].length} عنصر من ${collName}`);
    }

    // اسم الملف يحتوي على التاريخ والوقت
    const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `firebase-backup-${dateStr}.json`;
    const tempFilePath = path.join(process.cwd(), fileName);

    // 1. حفظ الملف محلياً بشكل مؤقت
    await fs.writeFile(tempFilePath, JSON.stringify(backupData, null, 2), "utf-8");
    console.log(`تم حفظ النسخة محلياً: ${fileName} ... جاري الرفع لجوجل درايف...`);

    // 2. رفع الملف لجوجل درايف
    await uploadToDrive(tempFilePath, fileName);

    // 3. حذف الملف المحلي لتوفير المساحة
    await fs.unlink(tempFilePath);
    console.log(`تم حذف الملف المؤقت من الكمبيوتر لتوفير المساحة.`);

  } catch (err) {
    console.error(`❌ حدث خطأ أثناء النسخ الاحتياطي:`, err);
  }
}

console.log("🚀 تم تشغيل سكربت النسخ الاحتياطي السحابي (يعمل كل ساعة)...");
performBackup().then(() => {
  setInterval(performBackup, INTERVAL_MS);
});
