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
  const snapshot = await getDocs(collection(db, 'orders'));

  let totalSalesSeries = 0;
  
  snapshot.forEach(doc => {
    const order = doc.data();
    if (order.status === 'cancelled' || order.isDeleted) return;
    
    if (Array.isArray(order.items)) {
      order.items.forEach(item => {
        const qty = Number(item.quantity) || 1;
        const series = item.isSeri ? qty : 0;
        totalSalesSeries += series;
      });
    }
  });
  
  console.log('Total Sales Series:', totalSalesSeries);
  process.exit(0);
}
test().catch(console.error);
