import { NextResponse } from "next/server";
import { adminDb } from "../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function GET() {
  const colors = [
    { name: "شاركول", prefix: "CHAR" },
    { name: "اسود", prefix: "BLK" },
    { name: "مسطردة", prefix: "MUS" },
    { name: "زيتي", prefix: "OLV" },
    { name: "بيج", prefix: "BEG" },
    { name: "رمادي", prefix: "GRY" }
  ];

  try {
    let count = 0;
    for (const c of colors) {
      for (let i = 1; i <= 10; i++) {
        const paddedNum = i.toString().padStart(2, '0');
        await adminDb.collection('factory_fabric_rolls').add({
          code: `${c.prefix}-${paddedNum}`,
          color: c.name,
          type: 'قطن',
          amount: 25,
          unit: 'كجم',
          supplier: 'Test Data',
          createdAt: FieldValue.serverTimestamp()
        });
        count++;
      }
    }
    return NextResponse.json({ success: true, count });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
