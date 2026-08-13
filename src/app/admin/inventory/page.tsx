"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "../../../lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Trash2, Edit2, Check, X } from "lucide-react";

interface ColorEntry {
  name: string;
  barcode: string;
}

interface Product {
  id: string;
  modelNumber: string;
  name: string;
  price: number;
  quantity: number;
  sizes: string[];
  colors: ColorEntry[];
}

export default function InventoryPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"add" | "manage">("manage");
  
  // Add Form State
  const [modelNumber, setModelNumber] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [sizes, setSizes] = useState("");
  const [quantity, setQuantity] = useState("");
  const [colors, setColors] = useState<ColorEntry[]>([{ name: "", barcode: "" }]);
  
  // Manage State
  const [products, setProducts] = useState<Product[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/admin/login");
      } else {
        setLoading(false);
        fetchProducts();
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchProducts = async () => {
    try {
      const snapshot = await getDocs(collection(db, "products"));
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setProducts(prods);
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا الموديل؟")) return;
    try {
      await deleteDoc(doc(db, "products", id));
      setProducts(products.filter(p => p.id !== id));
    } catch (err) {
      console.error("Error deleting:", err);
      alert("حدث خطأ أثناء الحذف");
    }
  };

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setEditPrice(product.price.toString());
    setEditQuantity(product.quantity.toString());
  };

  const saveEdit = async (id: string) => {
    try {
      await updateDoc(doc(db, "products", id), {
        price: Number(editPrice),
        quantity: Number(editQuantity)
      });
      setProducts(products.map(p => p.id === id ? { ...p, price: Number(editPrice), quantity: Number(editQuantity) } : p));
      setEditingId(null);
    } catch (err) {
      console.error("Error updating:", err);
      alert("حدث خطأ أثناء التحديث");
    }
  };

  if (loading) return <div className="p-10 text-center">جاري التحقق من الصلاحيات...</div>;

  const handleColorChange = (index: number, field: "name" | "barcode", value: string) => {
    const newColors = [...colors];
    newColors[index][field] = value;
    setColors(newColors);
  };

  const addColor = () => setColors([...colors, { name: "", barcode: "" }]);
  const removeColor = (index: number) => setColors(colors.filter((_, i) => i !== index));

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setSuccess(false);
    
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
      setModelNumber(""); setName(""); setPrice(""); setSizes(""); setQuantity("");
      setColors([{ name: "", barcode: "" }]);
      fetchProducts(); // Refresh list
    } catch (error) {
      console.error("Error adding product: ", error);
      alert("حدث خطأ أثناء إضافة الموديل");
    } finally {
      setActionLoading(false);
    }
  };

  const [searchTerm, setSearchTerm] = useState("");

  const totalModels = products.length;
  const totalPieces = products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
  const totalCapital = products.reduce((sum, p) => sum + ((Number(p.quantity) || 0) * (Number(p.price) || 0)), 0);

  const filteredProducts = products.filter(p => {
    const nameStr = p.name ? String(p.name).toLowerCase() : "";
    const modelStr = p.modelNumber ? String(p.modelNumber).toLowerCase() : "";
    const term = searchTerm.toLowerCase();
    return nameStr.includes(term) || modelStr.includes(term);
  });

  return (
    <div className="animate-fade-in flex flex-col items-center mt-6">
      <div className="w-full" style={{ maxWidth: '1000px' }}>
        <div className="flex justify-between items-center mb-6">
          <h2 style={{ color: 'var(--primary)' }}>📦 إدارة المخزن الشاملة</h2>
          <button onClick={() => router.push("/admin/dashboard")} className="btn btn-outline">عودة للوحة التحكم</button>
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card text-center p-4">
            <p className="text-sm text-gray-500">إجمالي الموديلات</p>
            <h3 className="text-2xl font-bold mt-1">{totalModels}</h3>
          </div>
          <div className="card text-center p-4">
            <p className="text-sm text-gray-500">إجمالي القطع بالمخزن</p>
            <h3 className="text-2xl font-bold mt-1 text-blue-600">{totalPieces}</h3>
          </div>
          <div className="card text-center p-4">
            <p className="text-sm text-gray-500">رأس المال (قيمة المخزن)</p>
            <h3 className="text-2xl font-bold mt-1 text-green-600">
              {new Intl.NumberFormat('ar-EG').format(totalCapital)} ج.م
            </h3>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <button 
            className={`btn ${activeTab === 'manage' ? 'btn-primary' : 'btn-outline'} flex-1`}
            onClick={() => setActiveTab('manage')}
          >
            الموديلات الحالية
          </button>
          <button 
            className={`btn ${activeTab === 'add' ? 'btn-primary' : 'btn-outline'} flex-1`}
            onClick={() => setActiveTab('add')}
          >
            إضافة موديل جديد
          </button>
        </div>

        {activeTab === 'manage' && (
          <div className="card w-full overflow-x-auto">
            <div className="mb-4">
              <input 
                type="text" 
                className="input w-full md:w-1/2" 
                placeholder="بحث برقم أو اسم الموديل..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            
            {filteredProducts.length === 0 ? (
              <p className="text-center py-4">المخزن فارغ حالياً.</p>
            ) : (
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr style={{ background: "var(--surface-hover)", borderBottom: "2px solid var(--border)" }}>
                    <th className="p-3">الموديل</th>
                    <th className="p-3">الاسم</th>
                    <th className="p-3">السعر</th>
                    <th className="p-3">الكمية</th>
                    <th className="p-3">الإجمالي</th>
                    <th className="p-3">الألوان</th>
                    <th className="p-3">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(product => (
                    <tr key={product.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="p-3">{product.modelNumber}</td>
                      <td className="p-3">{product.name}</td>
                      <td className="p-3">
                        {editingId === product.id ? (
                          <input type="number" className="input w-24 p-1 text-sm" value={editPrice} onChange={e => setEditPrice(e.target.value)} />
                        ) : (
                          `${product.price} ج.م`
                        )}
                      </td>
                      <td className="p-3">
                        {editingId === product.id ? (
                          <input type="number" className="input w-24 p-1 text-sm" value={editQuantity} onChange={e => setEditQuantity(e.target.value)} />
                        ) : (
                          <span className={product.quantity <= 0 ? 'text-red-500 font-bold' : ''}>
                            {product.quantity}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-bold text-gray-700">
                        {new Intl.NumberFormat('ar-EG').format((Number(product.price) || 0) * (Number(product.quantity) || 0))} ج.م
                      </td>
                      <td className="p-3 text-sm">
                        {product.colors?.map(c => c.name).join('، ')}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          {editingId === product.id ? (
                            <>
                              <button onClick={() => saveEdit(product.id)} className="text-green-600 p-1 hover:bg-green-50 rounded" title="حفظ"><Check size={18} /></button>
                              <button onClick={() => setEditingId(null)} className="text-gray-500 p-1 hover:bg-gray-100 rounded" title="إلغاء"><X size={18} /></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(product)} className="text-blue-600 p-1 hover:bg-blue-50 rounded" title="تعديل"><Edit2 size={18} /></button>
                              <button onClick={() => handleDelete(product.id)} className="text-red-600 p-1 hover:bg-red-50 rounded" title="حذف"><Trash2 size={18} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'add' && (
          <div className="card w-full mx-auto" style={{ maxWidth: '700px' }}>
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

              <button type="submit" className="btn btn-primary w-full" disabled={actionLoading}>
                {actionLoading ? "جاري الإضافة..." : "حفظ في المخزن"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
