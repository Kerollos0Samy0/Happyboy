import { NextResponse } from "next/server";
import { db } from "../../../lib/firebase";
import { collection, getDocs, deleteDoc, doc, addDoc } from "firebase/firestore";
import * as xlsx from "xlsx";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "customers.xlsx");
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    // Filter valid rows (where __EMPTY is a number -> customer code)
    const validCustomers = data.filter((row: any) => {
      const code = row["__EMPTY"];
      return typeof code === 'number' || (typeof code === 'string' && !isNaN(parseInt(code, 10)));
    });

    const formattedCustomers = validCustomers.map((row: any) => ({
      code: String(row["__EMPTY"] || ""),
      name: String(row["__EMPTY_1"] || ""),
      storeName: String(row["__EMPTY_2"] || ""),
      category: String(row["__EMPTY_3"] || ""),
      governorate: String(row["__EMPTY_4"] || ""),
      address: String(row["__EMPTY_5"] || ""),
      region: String(row["__EMPTY_6"] || ""),
      phone: String(row["__EMPTY_7"] || ""),
      landline: String(row["__EMPTY_8"] || ""),
      extraPhone: String(row["__EMPTY_9"] || ""),
      shipping: String(row["__EMPTY_10"] || ""),
      discount: String(row["__EMPTY_11"] || ""),
      notes: String(row["__EMPTY_12"] || ""),
      createdAt: new Date().toISOString()
    }));

    // Delete existing customers
    const customersRef = collection(db, "customers");
    const snapshot = await getDocs(customersRef);
    
    for (const docSnap of snapshot.docs) {
      await deleteDoc(doc(db, "customers", docSnap.id));
    }

    // Add new customers
    for (const customer of formattedCustomers) {
      await addDoc(customersRef, customer);
    }

    return NextResponse.json({ success: true, count: formattedCustomers.length, sample: formattedCustomers[0] });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message });
  }
}
