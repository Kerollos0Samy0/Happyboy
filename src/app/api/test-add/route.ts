import { NextResponse } from "next/server";
import { db } from "../../../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function GET() {
  try {
    const docRef = await addDoc(collection(db, "products"), {
      modelNumber: "85",
      name: "ترينج بيبي كابيشو",
      price: 150,
      sizes: ["2", "3", "4", "5"],
      colors: [
        { name: "احمر", barcode: "243" },
        { name: "منت", barcode: "244" }
      ],
      barcodes: ["243", "244"],
      quantity: 100,
      createdAt: serverTimestamp()
    });
    
    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error("Error adding document: ", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
