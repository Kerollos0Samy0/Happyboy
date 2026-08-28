const xlsx = require('xlsx');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc, addDoc } = require('firebase/firestore');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.+)$/);
  if (match) {
    env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
  }
});

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const customersRef = collection(db, 'customers');
  const snapshot = await getDocs(customersRef);
  
  if (snapshot.docs.length > 0) {
    console.log('Deleting ' + snapshot.docs.length + ' existing customers in parallel...');
    const chunks = [];
    for (let i = 0; i < snapshot.docs.length; i += 50) {
      chunks.push(snapshot.docs.slice(i, i + 50));
    }
    
    for (let i = 0; i < chunks.length; i++) {
      await Promise.all(chunks[i].map(d => deleteDoc(doc(db, 'customers', d.id))));
      console.log('Deleted chunk ' + (i+1) + '/' + chunks.length);
    }
  }

  const workbook = xlsx.readFile('customers.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  const validCustomers = data.filter(row => {
    const code = row['__EMPTY'];
    return typeof code === 'number' || (typeof code === 'string' && !isNaN(parseInt(code, 10)));
  });

  const formattedCustomers = validCustomers.map(row => ({
    code: String(row['__EMPTY'] || ''),
    name: String(row['__EMPTY_1'] || ''),
    storeName: String(row['__EMPTY_2'] || ''),
    category: String(row['__EMPTY_3'] || ''),
    governorate: String(row['__EMPTY_4'] || ''),
    address: String(row['__EMPTY_5'] || ''),
    region: String(row['__EMPTY_6'] || ''),
    phone: String(row['__EMPTY_7'] || ''),
    landline: String(row['__EMPTY_8'] || ''),
    extraPhone: String(row['__EMPTY_9'] || ''),
    shipping: String(row['__EMPTY_10'] || ''),
    discount: String(row['__EMPTY_11'] || ''),
    notes: String(row['__EMPTY_12'] || ''),
    createdAt: new Date().toISOString()
  }));

  console.log('Uploading ' + formattedCustomers.length + ' new customers in parallel...');
  const addChunks = [];
  for (let i = 0; i < formattedCustomers.length; i += 50) {
    addChunks.push(formattedCustomers.slice(i, i + 50));
  }
  
  for (let i = 0; i < addChunks.length; i++) {
    await Promise.all(addChunks[i].map(c => addDoc(customersRef, c)));
    console.log('Uploaded chunk ' + (i+1) + '/' + addChunks.length);
  }

  console.log('Done!');
  process.exit(0);
}

run().catch(console.error);
