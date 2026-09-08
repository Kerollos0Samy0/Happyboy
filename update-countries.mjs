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

const countryMappings = [
  { country: 'ليبيا', keywords: ['طرابلس', 'بنغازي', 'مصراتة', 'مصراته', 'سبها', 'الزاوية', 'ليبيا'] },
  { country: 'السعودية', keywords: ['الرياض', 'جدة', 'مكة', 'المدينة', 'الدمام', 'الطائف', 'تبوك', 'السعودية'] },
  { country: 'الإمارات', keywords: ['دبي', 'أبوظبي', 'ابوظبي', 'الشارقة', 'عجمان', 'الامارات', 'الإمارات'] },
  { country: 'الكويت', keywords: ['الكويت', 'حولي', 'الأحمدي', 'الاحمدي'] },
  { country: 'قطر', keywords: ['الدوحة', 'الدوحه', 'الريان', 'قطر'] },
  { country: 'البحرين', keywords: ['المنامة', 'المنامه', 'المحرق', 'البحرين'] },
  { country: 'عمان', keywords: ['مسقط', 'صلالة', 'عمان'] },
  { country: 'الأردن', keywords: ['عمان', 'إربد', 'اربد', 'الزرقاء', 'العقبة', 'العقبه', 'الاردن', 'الأردن'] },
  { country: 'العراق', keywords: ['بغداد', 'البصرة', 'البصره', 'الموصل', 'أربيل', 'اربيل', 'النجف', 'العراق'] },
  { country: 'السودان', keywords: ['الخرطوم', 'أم درمان', 'ام درمان', 'بورتسودان', 'السودان'] },
  { country: 'فلسطين', keywords: ['غزة', 'غزه', 'رام الله', 'القدس', 'نابلس', 'الخليل', 'فلسطين'] },
  { country: 'سوريا', keywords: ['دمشق', 'حلب', 'حمص', 'اللاذقية', 'سوريا'] },
  { country: 'لبنان', keywords: ['بيروت', 'طرابلس الشام', 'صيدا', 'لبنان'] },
  { country: 'اليمن', keywords: ['صنعاء', 'عدن', 'تعز', 'اليمن'] }
];

async function updateCountries() {
  const ordersRef = collection(db, 'orders');
  const snapshot = await getDocs(ordersRef);
  let updatedCount = 0;
  let logMessages = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    let currentCountry = data.customerCountry;
    const gov = (data.customerGovernorate || '').trim();
    const address = (data.customerAddress || '').trim();
    
    // Combine text to search
    const searchText = `${gov} ${address}`.toLowerCase();
    
    let suggestedCountry = null;

    for (const mapping of countryMappings) {
      if (mapping.keywords.some(kw => searchText.includes(kw))) {
        suggestedCountry = mapping.country;
        break;
      }
    }

    if (suggestedCountry && (!currentCountry || currentCountry === 'مصر' || currentCountry !== suggestedCountry)) {
      await updateDoc(doc(db, 'orders', docSnap.id), {
        customerCountry: suggestedCountry
      });
      logMessages.push(`Order ${data.orderNumber || docSnap.id}: Changed country to '${suggestedCountry}' (Matched in: '${searchText}')`);
      updatedCount++;
    }
  }

  logMessages.forEach(msg => console.log(msg));
  console.log(`Finished updating ${updatedCount} orders.`);
  process.exit(0);
}

updateCountries().catch(console.error);
