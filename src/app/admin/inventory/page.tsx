"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "../../../lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

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
  const [activeTab, setActiveTab] = useState<"manage" | "add">("manage");
  
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
  const [searchTerm, setSearchTerm] = useState("");

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
    if (!window.confirm("هل أنت متأكد من الحذف؟")) return;
    try {
      await deleteDoc(doc(db, "products", id));
      setProducts(products.filter(p => p.id !== id));
    } catch (err) {
      alert("خطأ أثناء الحذف");
    }
  };

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setEditPrice(String(product.price || 0));
    setEditQuantity(String(product.quantity || 0));
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
      alert("خطأ أثناء التحديث");
    }
  };

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
      fetchProducts();
    } catch (error) {
      alert("خطأ أثناء الإضافة");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="p-10 text-center">جاري التحميل...</div>;

  const filteredProducts = products.filter(p => {
    const nameStr = p.name ? String(p.name).toLowerCase() : "";
    const modelStr = p.modelNumber ? String(p.modelNumber).toLowerCase() : "";
    const term = searchTerm.toLowerCase();
    const colorMatch = Array.isArray(p.colors) && p.colors.some(c => 
      (c.name && c.name.toLowerCase().includes(term)) || 
      (c.barcode && String(c.barcode).toLowerCase().includes(term))
    );
    return nameStr.includes(term) || modelStr.includes(term) || colorMatch;
  });

  // Calculate totals
  const totalModels = products.length;
  const totalPieces = products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
  const totalCapital = products.reduce((sum, p) => sum + ((Number(p.quantity) || 0) * (Number(p.price) || 0)), 0);

  // Grouping Logic
  const categories = [
    {
      title: "قسم الأولادي",
      sections: [
        { name: "بيبي (5 - 90)", filter: (num: number) => num >= 5 && num <= 90 },
        { name: "وسط (100 - 150)", filter: (num: number) => num >= 100 && num <= 150 },
        { name: "محير (300 - 350)", filter: (num: number) => num >= 300 && num <= 350 },
      ]
    },
    {
      title: "قسم البناتي",
      sections: [
        { name: "بيبي (500 - 545)", filter: (num: number) => num >= 500 && num <= 545 },
        { name: "وسط (605 - 680)", filter: (num: number) => num >= 605 && num <= 680 },
        { name: "محير (800 - 880)", filter: (num: number) => num >= 800 && num <= 880 },
      ]
    }
  ];

  const getProductTable = (prods: Product[]) => {
    if (prods.length === 0) return null;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse mb-4">
          <thead>
            <tr style={{ background: "var(--surface-hover)", borderBottom: "2px solid var(--border)" }}>
              <th className="p-3">الموديل</th>
              <th className="p-3">الاسم</th>
              <th className="p-3">السعر</th>
              <th className="p-3">الكمية</th>
              <th className="p-3">الألوان</th>
              <th className="p-3">تعديل</th>
            </tr>
          </thead>
          <tbody>
            {prods.map(product => (
              <tr key={product.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="p-3 font-bold">{product.modelNumber}</td>
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
                <td className="p-3 text-sm">
                  {Array.isArray(product.colors) ? product.colors.map(c => `${c.name} (${c.barcode})`).join('، ') : ''}
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    {editingId === product.id ? (
                      <>
                        <button onClick={() => saveEdit(product.id)} className="p-2 bg-green-100 text-green-700 hover:bg-green-200 rounded font-bold" title="حفظ">حفظ</button>
                        <button onClick={() => setEditingId(null)} className="p-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded font-bold" title="إلغاء">إلغاء</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(product)} className="p-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded font-bold" title="تعديل">تعديل</button>
                        <button onClick={() => handleDelete(product.id)} className="p-2 bg-red-100 text-red-700 hover:bg-red-200 rounded font-bold" title="حذف">حذف</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderCategorizedProducts = () => {
    let unassignedProducts = [...filteredProducts];
    
    return (
      <div className="flex flex-col gap-4">
        {categories.map((mainCat, idx) => (
          <details key={idx} className="border border-gray-200 rounded-lg bg-gray-50 shadow-sm group" open={idx === 0}>
            <summary className="text-2xl font-bold p-4 cursor-pointer select-none border-b border-gray-200 group-open:bg-gray-100 transition-colors" style={{ color: "var(--primary)" }}>
              {mainCat.title}
            </summary>
            
            <div className="p-4 flex flex-col gap-6 animate-fade-in">
              {mainCat.sections.map((sub, sIdx) => {
                const subProds = unassignedProducts.filter(p => {
                  const num = parseInt(p.modelNumber, 10);
                  if (isNaN(num)) return false;
                  return sub.filter(num);
                });
                
                // Remove found from unassigned
                unassignedProducts = unassignedProducts.filter(p => !subProds.includes(p));

                if (subProds.length === 0) return null;

                return (
                  <div key={sIdx} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <h4 className="text-lg font-bold mb-3 text-gray-700 bg-gray-100 p-2 rounded">
                      {sub.name} <span className="text-sm font-normal">({subProds.length} موديلات)</span>
                    </h4>
                    {getProductTable(subProds)}
                  </div>
                );
              })}
            </div>
          </details>
        ))}
        
        {unassignedProducts.length > 0 && (
          <details className="border border-gray-200 rounded-lg bg-gray-50 shadow-sm group">
            <summary className="text-2xl font-bold p-4 cursor-pointer select-none border-b border-gray-200 group-open:bg-gray-100 transition-colors" style={{ color: "var(--primary)" }}>
              قسم أخرى (أرقام غير مصنفة)
            </summary>
            <div className="p-4 bg-white rounded-b-lg shadow-sm animate-fade-in">
              <h4 className="text-lg font-bold mb-3 text-gray-700 bg-gray-100 p-2 rounded">
                موديلات غير مصنفة <span className="text-sm font-normal">({unassignedProducts.length} موديلات)</span>
              </h4>
              {getProductTable(unassignedProducts)}
            </div>
          </details>
        )}
      </div>
    );
  };

  return (
    <div className="animate-fade-in flex flex-col items-center mt-6 mb-12">
      <div className="w-full" style={{ maxWidth: '1200px' }}>
        
        <div className="flex justify-between items-center mb-6">
          <h2 style={{ color: 'var(--primary)' }}>المخزن</h2>
          <button onClick={() => router.push("/admin/dashboard")} className="btn btn-outline">لوحة التحكم</button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="card text-center p-4">
            <p className="text-sm text-gray-500">عدد الموديلات</p>
            <h3 className="text-2xl font-bold mt-1">{totalModels}</h3>
          </div>
          <div className="card text-center p-4">
            <p className="text-sm text-gray-500">إجمالي القطع</p>
            <h3 className="text-2xl font-bold mt-1 text-blue-600">{totalPieces}</h3>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <button className={`btn ${activeTab === 'manage' ? 'btn-primary' : 'btn-outline'} flex-1`} onClick={() => setActiveTab('manage')}>
            عرض الموديلات
          </button>
          <button className={`btn ${activeTab === 'add' ? 'btn-primary' : 'btn-outline'} flex-1`} onClick={() => setActiveTab('add')}>
            إضافة موديل
          </button>
        </div>

        {activeTab === 'manage' && (
          <div className="card w-full">
            <input 
              type="text" 
              className="input w-full md:w-1/2 mb-6" 
              placeholder="بحث برقم الموديل أو الاسم..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            
            {filteredProducts.length === 0 ? (
              <p className="text-center py-4">لا توجد منتجات.</p>
            ) : (
              renderCategorizedProducts()
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
                  <label className="block mb-2 font-bold text-sm">الاسم</label>
                  <input type="text" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                  <label className="block mb-2 font-bold text-sm">رقم الموديل</label>
                  <input type="text" className="input" value={modelNumber} onChange={(e) => setModelNumber(e.target.value)} required />
                </div>
                <div>
                  <label className="block mb-2 font-bold text-sm">السعر</label>
                  <input type="number" className="input" value={price} onChange={(e) => setPrice(e.target.value)} required />
                </div>
                <div>
                  <label className="block mb-2 font-bold text-sm">الكمية</label>
                  <input type="number" className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
                </div>
              </div>
              <div>
                <label className="block mb-2 font-bold text-sm">المقاسات (مثال: 2, 3, 4)</label>
                <input type="text" className="input" value={sizes} onChange={(e) => setSizes(e.target.value)} required />
              </div>
              <hr />
              <h3 className="font-bold text-lg">الألوان والباركود</h3>
              {colors.map((color, index) => (
                <div key={index} className="flex gap-2 items-end p-3 bg-gray-50 rounded">
                  <div className="flex-1">
                    <label className="block mb-1 text-sm font-bold">اللون</label>
                    <input type="text" className="input" value={color.name} onChange={e => handleColorChange(index, "name", e.target.value)} required />
                  </div>
                  <div className="flex-1">
                    <label className="block mb-1 text-sm font-bold">الباركود</label>
                    <input type="text" className="input" value={color.barcode} onChange={e => handleColorChange(index, "barcode", e.target.value)} required />
                  </div>
                  {colors.length > 1 && (
                    <button type="button" onClick={() => removeColor(index)} className="btn btn-outline text-red-500 border-red-200">حذف</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addColor} className="btn btn-secondary w-fit">+ إضافة لون</button>
              <button type="submit" className="btn btn-primary w-full mt-4" disabled={actionLoading}>
                {actionLoading ? "جاري الإضافة..." : "حفظ"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
