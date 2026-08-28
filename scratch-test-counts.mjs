import fs from 'fs';

async function test() {
  const { initializeApp } = await import('firebase/app');
  const { getFirestore, collection, getDocs } = await import('firebase/firestore');

  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const env = {};
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([^=]+)="?([^"]*)"?$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }

  const app = initializeApp({
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });

  const db = getFirestore(app);
  const snapshot = await getDocs(collection(db, 'products'));

  const getCategoryName = (modelStr) => {
    const m = parseInt(String(modelStr).replace(/\D/g, ''), 10);
    if (isNaN(m)) return 'غير معروف';
    if (m >= 1000 && m <= 1040) return 'أولادي صيفي';
    if (m >= 2000 && m <= 2040) return 'بناتي صيفي';
    if (m >= 3000 && m <= 3040) return 'بيبي أولادي صيفي';
    if (m >= 4000 && m <= 4040) return 'بيبي بناتي صيفي';
    if (m >= 1041 && m <= 1099) return 'أولادي شتوي';
    if (m >= 2041 && m <= 2099) return 'بناتي شتوي';
    if (m >= 3041 && m <= 3099) return 'بيبي أولادي شتوي';
    if (m >= 4041 && m <= 4099) return 'بيبي بناتي شتوي';
    if (m >= 5000 && m <= 5100) return 'سمر ميلتون';
    return 'غير معروف';
  };

  const getSizesCount = (name, modelNumber, sizes) => {
    const category = getCategoryName(modelNumber);
    name = String(name || '');
    if (category.includes('بيبي') || category.includes('سمر') || category.includes('شتوي') || category.includes('صيفي') || name.includes('بيبي') || name.includes('سوت') || name.includes('موديل')) return 4;
    return sizes && sizes.length > 0 ? sizes.length : 1;
  };

  let totalPieces = 0;
  let totalThrehas = 0;
  snapshot.forEach(doc => {
    const p = doc.data();
    const threhas = Math.max(0, Number(p.quantity) || 0);
    const piecesPerThreha = getSizesCount(p.name, p.modelNumber, p.sizes);
    totalThrehas += threhas;
    totalPieces += (threhas * piecesPerThreha);
  });
  
  console.log('Total Threhas:', totalThrehas, 'Total Pieces:', totalPieces);
  process.exit(0);
}
test().catch(console.error);
