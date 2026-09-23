import { NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const dumpPath = path.join(process.cwd(), 'public', 'master_barcodes_dump.json');
    const masterBarcodes = JSON.parse(fs.readFileSync(dumpPath, 'utf-8'));

    const snapshot = await getDocs(collection(db, 'products'));
    let updated = 0;
    
    function normalizeColor(str) {
      if (!str) return "";
      let norm = str.replace(/ي/g, "ي").replace(/[أإآ]/g, "ا").trim();
      return norm;
    }

    for (const productDoc of snapshot.docs) {
      const p = productDoc.data();
      if (p.isDeleted) continue;
      
      const m = String(p.modelNumber).trim();
      if (masterBarcodes[m]) {
        let changed = false;
        const updatedColors = (p.colors || []).map(c => {
           const normC = normalizeColor(c.name);
           if (!c.barcode || c.barcode.trim() === "") {
               const exBarcode = masterBarcodes[m][normC];
               if (exBarcode) {
                   changed = true;
                   return { ...c, barcode: exBarcode };
               }
           }
           return c;
        });

        if (changed) {
           const newBarcodes = updatedColors.map(c => c.barcode).filter(Boolean);
           await updateDoc(doc(db, "products", productDoc.id), {
               colors: updatedColors,
               barcodes: newBarcodes
           });
           updated++;
        }
      }
    }

    return NextResponse.json({ success: true, updated, message: `تم استرجاع باركودات لـ ${updated} موديل بنجاح` });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
