"use client";

import { useState } from "react";
import { db } from "../../../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

interface ColorEntry {
  name: string;
  barcode: string;
}

export default function InventoryPage() {
  const [modelNumber, setModelNumber] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [sizes, setSizes] = useState("");
  const [quantity, setQuantity] = useState("");
  
  const [colors, setColors] = useState<ColorEntry[]>([{ name: "", barcode: "" }]);
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleColorChange = (index: number, field: "name" | "barcode", value: string) => {
    const newColors = [...colors];
    newColors[index][field] = value;
    setColors(newColors);
  };

  const addColor = () => setColors([...colors, { name: "", barcode: "" }]);
  const removeColor = (index: number) => setColors(colors.filter((_, i) => i !== index));

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    
    // Extract a flat array of barcodes for easy querying later
    const flatBarcodes = colors.map(c => c.barcode).filter(b => b.trim() !== "");

    try {
      await addDoc(collection(db, "products"), {
        modelNumber,
        name,
        price: Number(price),
        sizes: sizes.split(",").map(s => s.trim()),
        colors,
        barcodes: flatBarcodes,
        quantity: Number(quantity),
        createdAt: serverTimestamp()
      });
      
      setSuccess(true);
      // Reset form
      setModelNumber(""); setName(""); setPrice(""); setSizes(""); setQuantity("");
      setColors([{ name: "", barcode: "" }]);
    } catch (error) {
      console.error("Error adding product: ", error);
      alert("حدث خطأ أثناء إضافة الموديل");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col items-center mt-6">
      <div className="card w-full" style={{ maxWidth: '700px' }}>
        <h2 className="mb-6 text-center" style={{ color: 'var(--primary)' }}>📦 إضافة موديل جديد للمخزن</h2>
        
        {success && (
          <div className="p-3 mb-4 text-sm text-center" style={{ background: 'var(--success)', color: 'white', borderRadius: 'var(--radius-sm)' }}>
            تم إضافة الموديل بنجاح!
          </div>
        )}

        <form onSubmit={handleAddProduct} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 font-bold text-sm">اسم الموديل (مثال: ترينج بيبي)</label>
              <input type="text" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="block mb-2 font-bold text-sm">رقم الموديل (مثال: 85)</label>
              <input type="text" className="input" value={modelNumber} onChange={(e) => setModelNumber(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 font-bold text-sm">سعر القطعة الواحدة</label>
              <input type="number" className="input" value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>
            <div>
              <label className="block mb-2 font-bold text-sm">الكمية الإجمالية (ثري)</label>
              <input type="number" className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="block mb-2 font-bold text-sm">المقاسات المتاحة (افصل بينها بفاصلة ,)</label>
            <input type="text" className="input" placeholder="مثال: 2, 3, 4, 5" value={sizes} onChange={(e) => setSizes(e.target.value)} required />
          </div>

          <hr style={{ borderTop: "1px solid var(--border)", margin: "1rem 0" }} />
          
          <h3 className="font-bold text-lg">الألوان والباركودات</h3>
          
          {colors.map((color, index) => (
            <div key={index} className="flex gap-2 items-end p-3" style={{ background: "var(--surface-hover)", borderRadius: "var(--radius-md)" }}>
              <div className="flex-1">
                <label className="block mb-1 text-sm font-bold">اللون</label>
                <input type="text" className="input" placeholder="أحمر" value={color.name} onChange={e => handleColorChange(index, "name", e.target.value)} required />
              </div>
              <div className="flex-1">
                <label className="block mb-1 text-sm font-bold">باركود هذا اللون</label>
                <input type="text" className="input" placeholder="243" value={color.barcode} onChange={e => handleColorChange(index, "barcode", e.target.value)} required />
              </div>
              {colors.length > 1 && (
                <button type="button" onClick={() => removeColor(index)} className="btn btn-outline" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>حذف</button>
              )}
            </div>
          ))}
          
          <button type="button" onClick={addColor} className="btn btn-secondary w-fit">
            + إضافة لون جديد للموديل
          </button>

          <hr style={{ borderTop: "1px solid var(--border)", margin: "1rem 0" }} />

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? "جاري الإضافة..." : "حفظ في المخزن"}
          </button>
        </form>
      </div>
    </div>
  );
}
