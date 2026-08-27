import { NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import * as xlsxImport from 'xlsx';
import path from 'path';

const xlsx = xlsxImport.default || xlsxImport;

export async function GET() {
  try {
    const excelPath = path.join(process.cwd(), 'المخزن.xlsx');
    const workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const excelData = xlsx.utils.sheet_to_json(worksheet);

    const excelMap = {};
    for (const row of excelData) {
      const modelCode = row['كود الموديل'];
      const barcode = row['الباركود'];
      const qty = row['عدد القطع'];
      
      if (modelCode !== undefined && barcode !== undefined && qty !== undefined) {
        const modelStr = String(modelCode).trim();
        const barcodeStr = String(barcode).trim();
        
        if (!excelMap[modelStr]) {
          excelMap[modelStr] = {};
        }
        excelMap[modelStr][barcodeStr] = parseInt(qty, 10);
      }
    }

    const snapshot = await getDocs(collection(db, 'products'));
    let updated = 0;
    
    for (const productDoc of snapshot.docs) {
      const data = productDoc.data();
      const modelStr = String(data.modelNumber).trim();
      
      const barcodesInExcel = excelMap[modelStr] || {};
      
      let totalComputed = 0;
      let changed = false;
      
      const newColors = (data.colors || []).map((color) => {
        const barcodeStr = String(color.barcode).trim();
        let expectedQty = barcodesInExcel[barcodeStr];
        
        if (expectedQty === undefined) {
          expectedQty = 0;
        }
        
        if (Number(color.quantity) !== expectedQty) {
          changed = true;
        }
        totalComputed += expectedQty;
        return { ...color, quantity: expectedQty };
      });

      if (changed || data.quantity !== totalComputed) {
        await updateDoc(doc(db, 'products', productDoc.id), {
          colors: newColors,
          quantity: totalComputed
        });
        updated++;
      }
    }

    return NextResponse.json({ success: true, updated, message: 'Sync completed from المخزن.xlsx. Total rows: ' + excelData.length });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

