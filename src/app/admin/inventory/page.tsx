"use client";

import { useState } from "react";
import { db } from "../../../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function InventoryPage() {
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [colors, setColors] = useState("");
  const [sizes, setSizes] = useState("");
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      await addDoc(collection(db, "products"), {
        barcode,
        name,
        price: Number(price),
        colors: colors.split(",").map(c => c.trim()),
        sizes: sizes.split(",").map(s => s.trim()),
        quantity: Number(quantity),
        createdAt: serverTimestamp()
      });
      
      setSuccess(true);
      // Reset form
      setBarcode(""); setName(""); setPrice(""); setColors(""); setSizes(""); setQuantity("");
    } catch (error) {
      console.error("Error adding product: ", error);
      alert("حدث خطأ أثناء إضافة المنتج");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col items-center mt-6">
      <div className="card w-full" style={{ maxWidth: '600px' }}>
        <h2 className="mb-6 text-center" style={{ color: 'var(--primary)' }}>📦 إضافة موديل جديد للمخزن</h2>
        
        {success && (
          <div className="p-3 mb-4 text-sm text-center" style={{ background: 'var(--success)', color: 'white', borderRadius: 'var(--radius-sm)' }}>
            تم إضافة الموديل بنجاح!
          </div>
        )}

        <form onSubmit={handleAddProduct} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 font-bold text-sm">اسم الموديل</label>
              <input type="text" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="block mb-2 font-bold text-sm">رقم الباركود</label>
              <input type="text" className="input" value={barcode} onChange={(e) => setBarcode(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 font-bold text-sm">السعر</label>
              <input type="number" className="input" value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>
            <div>
              <label className="block mb-2 font-bold text-sm">الكمية الإجمالية (قطعة)</label>
              <input type="number" className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="block mb-2 font-bold text-sm">الألوان المتاحة (افصل بينها بفاصلة ,)</label>
            <input type="text" className="input" placeholder="مثال: أحمر, أزرق, أسود" value={colors} onChange={(e) => setColors(e.target.value)} required />
          </div>

          <div>
            <label className="block mb-2 font-bold text-sm">المقاسات المتاحة (افصل بينها بفاصلة ,)</label>
            <input type="text" className="input" placeholder="مثال: S, M, L, XL" value={sizes} onChange={(e) => setSizes(e.target.value)} required />
          </div>

          <button type="submit" className="btn btn-primary w-full mt-4" disabled={loading}>
            {loading ? "جاري الإضافة..." : "حفظ في المخزن"}
          </button>
        </form>
      </div>
    </div>
  );
}
