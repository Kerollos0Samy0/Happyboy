import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import XLSX from 'xlsx';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.+)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '').replace(/^`|`$/g, '').replace(/^'|'$/g, '');
});

const app = initializeApp({ apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY, projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
const db = getFirestore(app);

const getCategoryName = (modelNumber) => {
  const num = parseInt(modelNumber, 10);
  if (isNaN(num)) return null;
  if (num >= 5   && num <= 90)  return 'بيبي أولادي';
  if (num >= 100 && num <= 299) return 'وسط أولادي';
  if (num >= 300 && num <= 499) return 'محير أولادي';
  if (num >= 500 && num <= 589) return 'بيبي بناتي';
  if (num >= 590 && num <= 789) return 'وسط بناتي';
  if (num >= 790 && num <= 999) return 'محير بناتي';
  return null;
};

async function run() {
  console.log('Fetching products from DB...');
  const prodsSnap = await getDocs(collection(db, 'products'));

  const sections = {
    'بيبي أولادي': [],
    'وسط أولادي':  [],
    'محير أولادي': [],
    'بيبي بناتي':  [],
    'وسط بناتي':   [],
    'محير بناتي':  [],
  };

  prodsSnap.forEach(doc => {
    const p = doc.data();
    if (p.isDeleted) return;
    const model = (p.modelNumber || '').toString().trim();
    const cat = getCategoryName(model);
    if (!cat || !(cat in sections)) return;

    (p.colors || []).forEach(c => {
      const qty = Number(c.quantity) || 0;
      if (qty >= 0) return; // only negative = shortage
      const shortage = Math.abs(qty);

      sections[cat].push({
        'كود الموديل': model,
        'اسم الموديل': (p.name || '').toString().trim(),
        'الباركود':    (c.barcode || '').toString().trim(),
        'اللون':       (c.name || '').toString().trim(),
        'القسم':       cat,
        'المخزن الأصلي': 0, // will be filled below
        'المبيعات':    0,
        'النقص (عجز)': shortage,
      });
    });
  });

  // Fill original stock from Excel for reference
  const wb = XLSX.readFile('المخزن.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const storeData = XLSX.utils.sheet_to_json(ws);
  const originalMap = new Map();
  for (const row of storeData) {
    const cb = (row['الباركود'] || '').toString().trim();
    const qty = Number(row['القطعة'] || 0) || 0;
    if (cb) originalMap.set(cb, (originalMap.get(cb) || 0) + qty);
  }

  // ---- Write Excel ----
  const wbOut = XLSX.utils.book_new();
  let totalBoys = 0;
  let totalGirls = 0;

  for (const [cat, rows] of Object.entries(sections)) {
    // Enrich with original stock
    rows.forEach(r => {
      r['المخزن الأصلي'] = originalMap.get(r['الباركود']) || 0;
      r['المبيعات'] = r['المخزن الأصلي'] + r['النقص (عجز)'];
    });

    rows.sort((a, b) => b['النقص (عجز)'] - a['النقص (عجز)']);
    const total = rows.reduce((s, r) => s + r['النقص (عجز)'], 0);

    if (cat.includes('أولادي')) totalBoys += total;
    if (cat.includes('بناتي')) totalGirls += total;

    // Total summary row
    rows.push({
      'كود الموديل': '',
      'اسم الموديل': 'الإجمالي',
      'الباركود': '',
      'اللون': '',
      'القسم': '',
      'المخزن الأصلي': rows.reduce((s, r) => s + (Number(r['المخزن الأصلي']) || 0), 0),
      'المبيعات': rows.reduce((s, r) => s + (Number(r['المبيعات']) || 0), 0),
      'النقص (عجز)': total,
    });

    console.log(`${cat}: ${rows.length - 1} باركود ناقص، إجمالي النقص: ${total}`);

    const wsData = [
      [`نواقص ${cat}`],
      ['كود الموديل', 'اسم الموديل', 'الباركود', 'اللون', 'القسم', 'المخزن الأصلي', 'المبيعات', 'النقص (عجز)'],
      ...rows.map(r => [
        r['كود الموديل'], r['اسم الموديل'], r['الباركود'], r['اللون'],
        r['القسم'], r['المخزن الأصلي'], r['المبيعات'], r['النقص (عجز)'],
      ]),
    ];
    const wsSheet = XLSX.utils.aoa_to_sheet(wsData);
    wsSheet['!cols'] = [
      { wch: 14 }, { wch: 22 }, { wch: 10 }, { wch: 18 },
      { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wbOut, wsSheet, cat);
  }

  console.log(`\nإجمالي نواقص الأولادي: ${totalBoys}`);
  console.log(`إجمالي نواقص البناتي: ${totalGirls}`);

  const outFile = 'نواقص_الأولادي_والبناتي.xlsx';
  XLSX.writeFile(wbOut, outFile);
  console.log('Done! File saved:', outFile);
  process.exit(0);
}

run().catch(console.error);
