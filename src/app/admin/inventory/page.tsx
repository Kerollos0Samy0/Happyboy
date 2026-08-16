"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "../../../lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Edit, Trash2, Check, X } from "lucide-react";

interface ColorEntry {
  name: string;
  barcode: string;
  quantity?: number;
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
  const [editForm, setEditForm] = useState<Product | null>(null);
  
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
      
      // Sort products by modelNumber ascending
      prods.sort((a, b) => Number(a.modelNumber) - Number(b.modelNumber));

      // Sort colors inside each product by barcode ascending
      prods.forEach(p => {
        if (Array.isArray(p.colors)) {
          p.colors.sort((c1, c2) => Number(c1.barcode) - Number(c2.barcode));
        }
      });

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
    setEditForm(JSON.parse(JSON.stringify(product)));
  };

  const saveEdit = async (id: string) => {
    if (!editForm) return;
    try {
      const updatedData = {
        modelNumber: editForm.modelNumber,
        name: editForm.name,
        price: Number(editForm.price),
        quantity: Number(editForm.quantity),
        colors: editForm.colors,
      };
      await updateDoc(doc(db, "products", id), updatedData);
      setProducts(products.map(p => p.id === id ? { ...p, ...updatedData } : p));
      setEditingId(null);
      setEditForm(null);
    } catch (err) {
      alert("خطأ أثناء التحديث");
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
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
        { name: "وسط (600 - 680)", filter: (num: number) => num >= 590 && num <= 690 },
        { name: "محير (800 - 880)", filter: (num: number) => num >= 790 && num <= 890 },
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
              <th className="p-3 border-l border-gray-200">الإجمالي</th>
              <th className="p-3 bg-gray-50 text-blue-900">اللون</th>
              <th className="p-3 bg-gray-50 text-blue-900">كمية اللون</th>
              <th className="p-3 bg-gray-50 text-blue-900">الباركود</th>
              <th className="p-3 border-r border-gray-200">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {prods.map((product, pIdx) => {
              const isEditing = editingId === product.id && editForm;
              const displayProduct = isEditing ? editForm : product;
              const hasColors = Array.isArray(displayProduct.colors) && displayProduct.colors.length > 0;
              const rowSpan = hasColors ? displayProduct.colors.length : 1;
              const isLastProduct = pIdx === prods.length - 1;

              const handleEditField = (field: keyof Product, value: any) => {
                if (editForm) setEditForm({ ...editForm, [field]: value });
              };
              const handleEditColor = (index: number, field: keyof ColorEntry, value: any) => {
                if (editForm) {
                  const newColors = [...editForm.colors];
                  newColors[index] = { ...newColors[index], [field]: value };
                  setEditForm({ ...editForm, colors: newColors });
                }
              };

              const topBorder = pIdx > 0 ? "3px solid #94a3b8" : "none";

              return (
                <React.Fragment key={product.id}>
                  <tr>
                    <td className="p-4 font-bold" style={{ verticalAlign: 'middle', borderTop: topBorder }} rowSpan={rowSpan}>
                      {isEditing ? (
                        <input type="text" className="input p-1 text-sm text-center" style={{ minWidth: '80px' }} value={displayProduct.modelNumber} onChange={e => handleEditField('modelNumber', e.target.value)} />
                      ) : (
                        displayProduct.modelNumber
                      )}
                    </td>
                    <td className="p-4 font-bold text-gray-700" style={{ verticalAlign: 'middle', minWidth: '150px', borderTop: topBorder }} rowSpan={rowSpan}>
                      {isEditing ? (
                        <input type="text" className="input p-1 text-sm" value={displayProduct.name} onChange={e => handleEditField('name', e.target.value)} />
                      ) : (
                        displayProduct.name
                      )}
                    </td>
                    <td className="p-4" style={{ verticalAlign: 'middle', whiteSpace: 'nowrap', borderTop: topBorder }} rowSpan={rowSpan}>
                      {isEditing ? (
                        <input type="number" className="input w-24 p-1 text-sm text-center" value={displayProduct.price} onChange={e => handleEditField('price', e.target.value)} />
                      ) : (
                        <span style={{ padding: '0 0.5rem', background: '#f8fafc', borderRadius: '4px' }}>{displayProduct.price} ج.م</span>
                      )}
                    </td>
                    <td className="p-4" style={{ verticalAlign: 'middle', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', borderTop: topBorder }} rowSpan={rowSpan}>
                      {isEditing ? (
                        <input type="number" className="input w-24 p-1 text-sm text-center" value={displayProduct.quantity} onChange={e => handleEditField('quantity', e.target.value)} />
                      ) : (
                        <span className={displayProduct.quantity <= 0 ? 'text-red-500 font-bold' : 'text-blue-600 font-bold'} style={{ fontSize: '1.1rem', padding: '0 0.5rem' }}>
                          {displayProduct.quantity}
                        </span>
                      )}
                    </td>
                    
                    {/* First Color */}
                    <td className="p-3 text-sm font-bold" style={{ background: '#f0f9ff', borderTop: topBorder }}>
                      {isEditing && hasColors ? (
                        <input type="text" className="input p-1 text-sm text-center" value={displayProduct.colors[0].name} onChange={e => handleEditColor(0, 'name', e.target.value)} />
                      ) : (
                        hasColors ? displayProduct.colors[0].name : "بدون"
                      )}
                    </td>
                    <td className="p-3 font-black text-blue-800" style={{ background: '#f0f9ff', borderTop: topBorder }}>
                      {isEditing && hasColors ? (
                        <input type="number" className="input p-1 text-sm text-center" style={{ width: '60px' }} value={displayProduct.colors[0].quantity ?? ""} onChange={e => handleEditColor(0, 'quantity', Number(e.target.value))} />
                      ) : (
                        hasColors ? (displayProduct.colors[0].quantity ?? "-") : "-"
                      )}
                    </td>
                    <td className="p-3 text-xs text-gray-500" style={{ background: '#f0f9ff', borderTop: topBorder }}>
                      {isEditing && hasColors ? (
                        <input type="text" className="input p-1 text-xs text-center" value={displayProduct.colors[0].barcode} onChange={e => handleEditColor(0, 'barcode', e.target.value)} />
                      ) : (
                        hasColors ? displayProduct.colors[0].barcode : "-"
                      )}
                    </td>

                    <td className="p-4 border-r border-gray-200" style={{ verticalAlign: 'middle', borderTop: topBorder }} rowSpan={rowSpan}>
                      <div className="flex gap-2 justify-center">
                        {isEditing ? (
                          <>
                            <button onClick={() => saveEdit(product.id)} className="p-2 bg-green-100 text-green-700 hover:bg-green-200 rounded font-bold transition-colors" title="حفظ"><Check size={18} /></button>
                            <button onClick={cancelEdit} className="p-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded font-bold transition-colors" title="إلغاء"><X size={18} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(product)} className="p-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded font-bold transition-colors" title="تعديل"><Edit size={18} /></button>
                            <button onClick={() => handleDelete(product.id)} className="p-2 bg-red-100 text-red-700 hover:bg-red-200 rounded font-bold transition-colors" title="حذف"><Trash2 size={18} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Additional Colors */}
                  {hasColors && displayProduct.colors.slice(1).map((color, idxOffset) => {
                    const idx = idxOffset + 1;
                    return (
                      <tr key={`${product.id}-c${idx}`}>
                        <td className="p-3 text-sm font-bold border-t border-white" style={{ background: '#f0f9ff' }}>
                          {isEditing ? (
                            <input type="text" className="input p-1 text-sm text-center" value={color.name} onChange={e => handleEditColor(idx, 'name', e.target.value)} />
                          ) : (
                            color.name
                          )}
                        </td>
                        <td className="p-3 font-black text-blue-800 border-t border-white" style={{ background: '#f0f9ff' }}>
                          {isEditing ? (
                            <input type="number" className="input p-1 text-sm text-center" style={{ width: '60px' }} value={color.quantity ?? ""} onChange={e => handleEditColor(idx, 'quantity', Number(e.target.value))} />
                          ) : (
                            color.quantity ?? "-"
                          )}
                        </td>
                        <td className="p-3 text-xs text-gray-500 border-t border-white" style={{ background: '#f0f9ff' }}>
                          {isEditing ? (
                            <input type="text" className="input p-1 text-xs text-center" value={color.barcode} onChange={e => handleEditColor(idx, 'barcode', e.target.value)} />
                          ) : (
                            color.barcode
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
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
          <details key={idx} className="border border-gray-200 rounded-lg bg-gray-50 shadow-sm group overflow-hidden" open={idx === 0}>
            <summary className="text-2xl font-bold p-5 cursor-pointer select-none border-b border-gray-200 bg-white hover:bg-gray-50 transition-colors flex justify-between items-center list-none" style={{ color: "var(--primary)" }}>
              <span>{mainCat.title}</span>
              <span className="transform transition-transform duration-300 group-open:-rotate-90 text-xl">◀</span>
            </summary>
            
            <div className="p-4 flex flex-col gap-4 animate-fade-in bg-gray-50/50">
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
                  <details key={sIdx} className="bg-white rounded-lg shadow-sm border border-gray-200 group/sub overflow-hidden" open={false}>
                    <summary className="text-lg font-bold p-4 text-gray-700 bg-white hover:bg-gray-50 cursor-pointer select-none transition-colors border-b border-transparent group-open/sub:border-gray-200 flex justify-between items-center list-none">
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        {sub.name} <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">({subProds.length} موديلات)</span>
                      </div>
                      <span className="transform transition-transform duration-300 group-open/sub:-rotate-90 text-gray-400 text-sm">◀</span>
                    </summary>
                    <div className="p-4 animate-fade-in bg-gray-50/30">
                      {getProductTable(subProds)}
                    </div>
                  </details>
                );
              })}
            </div>
          </details>
        ))}
        
        {unassignedProducts.length > 0 && (
          <details className="border border-gray-200 rounded-lg bg-gray-50 shadow-sm group overflow-hidden">
            <summary className="text-2xl font-bold p-5 cursor-pointer select-none border-b border-gray-200 bg-white hover:bg-gray-50 transition-colors flex justify-between items-center list-none" style={{ color: "var(--primary)" }}>
              <span>قسم أخرى (أرقام غير مصنفة)</span>
              <span className="transform transition-transform duration-300 group-open:-rotate-90 text-xl">◀</span>
            </summary>
            <div className="p-4 bg-white animate-fade-in">
              <h4 className="text-lg font-bold mb-4 text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                موديلات غير مصنفة <span className="text-sm font-normal bg-gray-200 px-2 py-0.5 rounded-full">({unassignedProducts.length} موديلات)</span>
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
