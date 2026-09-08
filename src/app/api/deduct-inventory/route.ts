import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

interface CartItem {
  id: string;
  name?: string;
  modelNumber?: string;
  selectedColor: string;
  isSeri?: boolean;
  sizes?: string[];
  quantity?: number;
}

function getSizesCount(category: number, itemSizes: string[] | undefined, dataName: string | undefined): number {
  const isBaby =
    (category >= 5 && category <= 90) ||
    (category >= 500 && category <= 589) ||
    (category >= 3000 && category <= 3099) ||
    (category >= 4000 && category <= 4099) ||
    (dataName && (dataName.includes("بيبي") || dataName.includes("سمر")));

  if (isBaby) return 4;
  if (itemSizes && itemSizes.length > 0) return itemSizes.length;
  return 1;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, orderNumber, employeeName, orderDocId } = body as {
      items: CartItem[];
      orderNumber?: string;
      employeeName?: string;
      orderDocId?: string; // Firestore document ID of the order — used to mark inventoryDeducted
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    // Group items by product ID
    const grouped: Record<string, CartItem[]> = {};
    for (const item of items) {
      if (!grouped[item.id]) grouped[item.id] = [];
      grouped[item.id].push(item);
    }

    const errors: string[] = [];

    await Promise.all(
      Object.keys(grouped).map(async (productId) => {
        try {
          const prodRef = adminDb.collection("products").doc(productId);
          const snap = await prodRef.get();
          if (!snap.exists) {
            errors.push(`Product ${productId} not found`);
            return;
          }

          const data = snap.data()!;
          let updatedColors: any[] = data.colors ? [...data.colors] : [];

          const logPromises: Promise<any>[] = [];

          for (const item of grouped[productId]) {
            let qtyToDeduct = item.quantity || 1;

            if (item.isSeri) {
              const rawModel = data.modelNumber ?? "";
              const category = parseInt(rawModel.replace(/\D/g, ""), 10);
              if (!isNaN(category)) {
                qtyToDeduct = qtyToDeduct * getSizesCount(category, item.sizes, data.name);
              }
            }

            const cIndex = updatedColors.findIndex((c: any) => c.name === item.selectedColor);
            if (cIndex !== -1) {
              const currentQty = Number(updatedColors[cIndex].quantity) || 0;
              updatedColors[cIndex] = {
                ...updatedColors[cIndex],
                quantity: currentQty - qtyToDeduct,
              };

              logPromises.push(
                adminDb.collection("inventory_logs").add({
                  productId,
                  modelNumber: data.modelNumber ?? null,
                  productName: data.name ?? null,
                  colorName: item.selectedColor,
                  change: -qtyToDeduct,
                  newQuantity: updatedColors[cIndex].quantity,
                  reason: orderNumber ? `فاتورة رقم ${orderNumber}` : "فاتورة مبيعات",
                  employeeName: employeeName || "Unknown",
                  createdAt: FieldValue.serverTimestamp(),
                })
              );
            } else {
              errors.push(
                `Color "${item.selectedColor}" not found for product ${productId}`
              );
            }
          }

          const newTotalQty = updatedColors.reduce(
            (sum: number, c: any) => sum + (Number(c.quantity) || 0),
            0
          );

          await Promise.all([
            prodRef.update({ colors: updatedColors, quantity: newTotalQty }),
            ...logPromises,
          ]);
        } catch (err: any) {
          errors.push(`Product ${productId}: ${err?.message || err}`);
        }
      })
    );

    if (errors.length > 0) {
      // Partial success — order is already saved, log the errors
      console.error("[deduct-inventory] Partial errors:", errors);
      return NextResponse.json({ success: false, errors }, { status: 207 });
    }

    // Mark the order as having its inventory deducted so delete can restore safely
    if (orderDocId) {
      try {
        await adminDb.collection("orders").doc(orderDocId).update({
          inventoryDeducted: true,
        });
      } catch (e) {
        console.warn("[deduct-inventory] Could not stamp inventoryDeducted on order:", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[deduct-inventory] Fatal error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
