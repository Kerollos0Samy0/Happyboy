"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "../../../lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Edit, Trash2, Check, X, Search, Package, Plus, Layers, ChevronDown, Tag } from "lucide-react";

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
        const isPrivileged = user.email && (
          user.email.toLowerCase().includes('ahmed001') || 
          user.email.toLowerCase().includes('hossam001') || 
          user.email.toLowerCase().includes('ayat') || 
          user.email.toLowerCase().includes('accounting') || 
          user.email.toLowerCase().includes('kerollos')
        );
        if (!isPrivileged) {
          router.push("/admin/dashboard");
        } else {
          setLoading(false);
          fetchProducts();
        }
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
        { name: "بيبي مقاس 2-3-4-5 (5 - 90)", filter: (num: number) => num >= 5 && num <= 90 },
        { name: "وسط مقاس 6-8-10-12 (100 - 150)", filter: (num: number) => num >= 100 && num <= 150 },
        { name: "محير مقاس 14-16-18-20 (300 - 350)", filter: (num: number) => num >= 300 && num <= 350 },
      ]
    },
    {
      title: "قسم البناتي",
      sections: [
        { name: "بيبي مقاس 2-3-4-5 (500 - 545)", filter: (num: number) => num >= 500 && num <= 545 },
        { name: "وسط مقاس 6-8-10-12 (600 - 680)", filter: (num: number) => num >= 590 && num <= 690 },
        { name: "محير مقاس 14-16-18-20 (800 - 880)", filter: (num: number) => num >= 790 && num <= 890 },
      ]
    }
  ];

    const getProductTable = (prods: Product[]) => {
    if (prods.length === 0) return null;
    return (
      <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200 mt-2">
        <table className="w-full text-right border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 text-xs font-bold uppercase tracking-wider">
              <th className="p-4 font-bold">الموديل</th>
              <th className="p-4 font-bold">الاسم</th>
              <th className="p-4 font-bold">السعر</th>
              <th className="p-4 font-bold border-l border-gray-100">الإجمالي</th>
              <th className="p-4 font-bold bg-blue-50/30 text-blue-700">اللون</th>
              <th className="p-4 font-bold bg-blue-50/30 text-blue-700">كمية اللون</th>
              <th className="p-4 font-bold bg-blue-50/30 text-blue-700">الباركود</th>
              <th className="p-4 font-bold text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {prods.map((product, pIdx) => {
              const isEditing = editingId === product.id && editForm;
              const displayProduct = isEditing ? editForm : product;
              const hasColors = Array.isArray(displayProduct.colors) && displayProduct.colors.length > 0;
              const rowSpan = hasColors ? displayProduct.colors.length : 1;

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

              const trClass = "hover:bg-gray-50/50 transition-colors group";

              return (
                <React.Fragment key={product.id}>
                  <tr className={trClass}>
                    <td className="p-4 font-black text-gray-900" style={{ verticalAlign: 'middle' }} rowSpan={rowSpan}>
                      {isEditing ? (
                        <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded p-1.5 text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none" style={{ minWidth: '80px' }} value={displayProduct.modelNumber} onChange={e => handleEditField('modelNumber', e.target.value)} />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Tag size={14} className="text-gray-400" />
                          {displayProduct.modelNumber}
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-bold text-gray-800" style={{ verticalAlign: 'middle', minWidth: '150px' }} rowSpan={rowSpan}>
                      {isEditing ? (
                        <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded p-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={displayProduct.name} onChange={e => handleEditField('name', e.target.value)} />
                      ) : (
                        displayProduct.name
                      )}
                    </td>
                    <td className="p-4" style={{ verticalAlign: 'middle' }} rowSpan={rowSpan}>
                      {isEditing ? (
                        <input type="number" className="w-24 bg-gray-50 border border-gray-200 rounded p-1.5 text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none" value={displayProduct.price} onChange={e => handleEditField('price', e.target.value)} />
                      ) : (
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-sm font-bold bg-green-50 text-green-700 border border-green-100">
                          {displayProduct.price} ج.م
                        </span>
                      )}
                    </td>
                    <td className="p-4 border-l border-gray-100" style={{ verticalAlign: 'middle' }} rowSpan={rowSpan}>
                      {isEditing ? (
                        <input type="number" className="w-24 bg-gray-50 border border-gray-200 rounded p-1.5 text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none" value={displayProduct.quantity} onChange={e => handleEditField('quantity', e.target.value)} />
                      ) : (
                        <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-black ${displayProduct.quantity <= 0 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                          {displayProduct.quantity}
                        </span>
                      )}
                    </td>
                    
                    {/* First Color */}
                    <td className="p-3 text-sm font-bold bg-blue-50/10">
                      {isEditing && hasColors ? (
                        <input type="text" className="w-full bg-white border border-gray-200 rounded p-1 text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none" value={displayProduct.colors[0].name} onChange={e => handleEditColor(0, 'name', e.target.value)} />
                      ) : (
                        hasColors ? displayProduct.colors[0].name : <span className="text-gray-400 font-normal">بدون</span>
                      )}
                    </td>
                    <td className="p-3 font-black text-gray-700 bg-blue-50/10">
                      {isEditing && hasColors ? (
                        <input type="number" className="w-16 mx-auto block bg-white border border-gray-200 rounded p-1 text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none" value={displayProduct.colors[0].quantity ?? ""} onChange={e => handleEditColor(0, 'quantity', Number(e.target.value))} />
                      ) : (
                        hasColors ? (displayProduct.colors[0].quantity ?? "-") : "-"
                      )}
                    </td>
                    <td className="p-3 text-xs text-gray-500 font-mono bg-blue-50/10">
                      {isEditing && hasColors ? (
                        <input type="text" className="w-full bg-white border border-gray-200 rounded p-1 text-xs text-center focus:ring-2 focus:ring-blue-500 outline-none" value={displayProduct.colors[0].barcode} onChange={e => handleEditColor(0, 'barcode', e.target.value)} />
                      ) : (
                        hasColors ? displayProduct.colors[0].barcode : "-"
                      )}
                    </td>

                    <td className="p-4 text-center" style={{ verticalAlign: 'middle' }} rowSpan={rowSpan}>
                      <div className="flex gap-1.5 justify-center transition-opacity">
                        {isEditing ? (
                          <>
                            <button onClick={() => saveEdit(product.id)} className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg transition-colors border border-emerald-100" title="حفظ"><Check size={16} strokeWidth={2.5} /></button>
                            <button onClick={cancelEdit} className="p-2 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors border border-gray-200" title="إلغاء"><X size={16} strokeWidth={2.5} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(product)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-colors border border-blue-100" title="تعديل"><Edit size={16} strokeWidth={2.5} /></button>
                            <button onClick={() => handleDelete(product.id)} className="p-2 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 rounded-lg transition-colors border border-red-100" title="حذف"><Trash2 size={16} strokeWidth={2.5} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Additional Colors */}
                  {hasColors && displayProduct.colors.slice(1).map((color, idxOffset) => {
                    const idx = idxOffset + 1;
                    return (
                      <tr key={`${product.id}-c${idx}`} className="hover:bg-gray-50/50 transition-colors border-t border-gray-50">
                        <td className="p-3 text-sm font-bold bg-blue-50/10">
                          {isEditing ? (
                            <input type="text" className="w-full bg-white border border-gray-200 rounded p-1 text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none" value={color.name} onChange={e => handleEditColor(idx, 'name', e.target.value)} />
                          ) : (
                            color.name
                          )}
                        </td>
                        <td className="p-3 font-black text-gray-700 bg-blue-50/10">
                          {isEditing ? (
                            <input type="number" className="w-16 mx-auto block bg-white border border-gray-200 rounded p-1 text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none" value={color.quantity ?? ""} onChange={e => handleEditColor(idx, 'quantity', Number(e.target.value))} />
                          ) : (
                            color.quantity ?? "-"
                          )}
                        </td>
                        <td className="p-3 text-xs text-gray-500 font-mono bg-blue-50/10">
                          {isEditing ? (
                            <input type="text" className="w-full bg-white border border-gray-200 rounded p-1 text-xs text-center focus:ring-2 focus:ring-blue-500 outline-none" value={color.barcode} onChange={e => handleEditColor(idx, 'barcode', e.target.value)} />
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
      <div className="flex flex-col gap-6">
        {categories.map((mainCat, idx) => (
          <details key={idx} className="bg-white border border-gray-200 rounded-2xl shadow-sm group overflow-hidden" open={idx === 0}>
            <summary className="text-xl font-bold p-5 cursor-pointer select-none bg-gray-50 hover:bg-gray-100 transition-colors flex justify-between items-center list-none border-b border-gray-100 text-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-blue-600 border border-gray-200">
                  <Layers size={18} />
                </div>
                {mainCat.title}
              </div>
              <ChevronDown className="transform transition-transform duration-300 group-open:rotate-180 text-gray-400" size={20} />
            </summary>
            
            <div className="p-5 flex flex-col gap-5 animate-fade-in bg-white">
              {mainCat.sections.map((sub, sIdx) => {
                const subProds = unassignedProducts.filter(p => {
                  const num = parseInt(p.modelNumber, 10);
                  if (isNaN(num)) return false;
                  return sub.filter(num);
                });
                
                unassignedProducts = unassignedProducts.filter(p => !subProds.includes(p));

                if (subProds.length === 0) return null;

                return (
                  <details key={sIdx} className="bg-white rounded-xl shadow-sm border border-gray-100 group/sub overflow-hidden" open={true}>
                    <summary className="text-base font-bold p-4 text-gray-700 bg-gray-50/50 hover:bg-gray-50 cursor-pointer select-none transition-colors border-b border-gray-100 flex justify-between items-center list-none">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        {sub.name} 
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 ml-2">
                          {subProds.length} موديلات
                        </span>
                      </div>
                      <ChevronDown className="transform transition-transform duration-300 group-open/sub:rotate-180 text-gray-400" size={16} />
                    </summary>
                    <div className="p-4 animate-fade-in bg-white">
                      {getProductTable(subProds)}
                    </div>
                  </details>
                );
              })}
            </div>
          </details>
        ))}
        
        {unassignedProducts.length > 0 && (
          <details className="bg-white border border-gray-200 rounded-2xl shadow-sm group overflow-hidden" open={true}>
            <summary className="text-xl font-bold p-5 cursor-pointer select-none bg-gray-50 hover:bg-gray-100 transition-colors flex justify-between items-center list-none border-b border-gray-100 text-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-500 border border-gray-200">
                  <Package size={18} />
                </div>
                أخرى (غير مصنفة)
              </div>
              <ChevronDown className="transform transition-transform duration-300 group-open:rotate-180 text-gray-400" size={20} />
            </summary>
            <div className="p-5 animate-fade-in bg-white">
              <div className="mb-4 inline-flex items-center gap-2 text-sm font-bold bg-gray-100 px-3 py-1.5 rounded-lg text-gray-600">
                <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                موديلات غير مصنفة 
                <span className="bg-white px-2 py-0.5 rounded-md shadow-sm ml-1">{unassignedProducts.length} موديلات</span>
              </div>
              {getProductTable(unassignedProducts)}
            </div>
          </details>
        )}
      </div>
    );
  };

  return (
    <div className="animate-fade-in flex flex-col items-center mt-8 mb-16 px-4">
      <div className="w-full max-w-[1200px]">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 mb-1">إدارة المخزن</h1>
            <p className="text-gray-500 text-sm">نظرة عامة على الموديلات والكميات</p>
          </div>
          <button onClick={() => router.push("/admin/dashboard")} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm flex items-center gap-2">
            لوحة التحكم
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.08)] flex items-center gap-6 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] group">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
              <Layers size={28} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-500 mb-1">عدد الموديلات</p>
              <h3 className="text-3xl font-black text-gray-900">{totalModels}</h3>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.08)] flex items-center gap-6 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] group">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
              <Package size={28} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-500 mb-1">إجمالي القطع</p>
              <h3 className="text-3xl font-black text-gray-900">{totalPieces}</h3>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100/80 p-1.5 rounded-xl w-fit mb-8 border border-gray-200/50">
          <button 
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 ${activeTab === 'manage' ? 'bg-white text-blue-700 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`} 
            onClick={() => setActiveTab('manage')}
          >
            <Layers size={18} strokeWidth={2.5} />
            عرض الموديلات
          </button>
          <button 
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 ${activeTab === 'add' ? 'bg-white text-blue-700 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`} 
            onClick={() => setActiveTab('add')}
          >
            <Plus size={18} strokeWidth={2.5} />
            إضافة موديل
          </button>
        </div>

        {activeTab === 'manage' && (
          <div className="w-full">
            <div className="relative w-full md:w-[400px] mb-8">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input 
                type="text" 
                className="w-full bg-white border border-gray-200 text-gray-900 text-sm font-bold rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent block pr-12 p-4 transition-all shadow-sm hover:border-gray-300 outline-none" 
                placeholder="بحث برقم الموديل أو الاسم..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            
            {filteredProducts.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-gray-200 border-dashed">
                <Package size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 font-bold text-lg">لا توجد منتجات مطابقة للبحث.</p>
              </div>
            ) : (
              renderCategorizedProducts()
            )}
          </div>
        )}

        {activeTab === 'add' && (
          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-[0_2px_20px_-3px_rgba(6,81,237,0.05)] w-full mx-auto max-w-[800px]">
            <div className="mb-6">
              <h2 className="text-2xl font-black text-gray-900 mb-2">إضافة موديل جديد</h2>
              <p className="text-gray-500 text-sm">قم بتعبئة بيانات الموديل والألوان المتاحة.</p>
            </div>

            {success && (
              <div className="p-4 mb-8 text-sm font-bold flex items-center gap-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <Check size={18} strokeWidth={3} />
                </div>
                تم إضافة الموديل بنجاح!
              </div>
            )}

            <form onSubmit={handleAddProduct} className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block mb-2 font-bold text-sm text-gray-700">الاسم</label>
                  <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all hover:bg-gray-100 focus:bg-white" value={name} onChange={(e) => setName(e.target.value)} required placeholder="مثال: سوت بيبي كابيشو" />
                </div>
                <div>
                  <label className="block mb-2 font-bold text-sm text-gray-700">رقم الموديل</label>
                  <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all hover:bg-gray-100 focus:bg-white" value={modelNumber} onChange={(e) => setModelNumber(e.target.value)} required placeholder="مثال: 5" />
                </div>
                <div>
                  <label className="block mb-2 font-bold text-sm text-gray-700">السعر (ج.م)</label>
                  <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all hover:bg-gray-100 focus:bg-white" value={price} onChange={(e) => setPrice(e.target.value)} required placeholder="مثال: 150" />
                </div>
                <div>
                  <label className="block mb-2 font-bold text-sm text-gray-700">الكمية الإجمالية</label>
                  <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all hover:bg-gray-100 focus:bg-white" value={quantity} onChange={(e) => setQuantity(e.target.value)} required placeholder="مثال: 595" />
                </div>
              </div>
              
              <div>
                <label className="block mb-2 font-bold text-sm text-gray-700">المقاسات</label>
                <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all hover:bg-gray-100 focus:bg-white" value={sizes} onChange={(e) => setSizes(e.target.value)} required placeholder="مثال: 2, 3, 4, 5" />
              </div>
              
              <div className="h-px bg-gray-100 my-2"></div>
              
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-gray-900">الألوان والباركود</h3>
                  <button type="button" onClick={addColor} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors">
                    <Plus size={16} strokeWidth={2.5} /> إضافة لون
                  </button>
                </div>
                
                <div className="flex flex-col gap-3">
                  {colors.map((color, index) => (
                    <div key={index} className="flex gap-3 items-end p-4 bg-gray-50 border border-gray-100 rounded-xl relative group/color transition-all hover:border-gray-200">
                      <div className="flex-1">
                        <label className="block mb-1.5 text-xs font-bold text-gray-500">اللون</label>
                        <input type="text" className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={color.name} onChange={e => handleColorChange(index, "name", e.target.value)} required placeholder="مثال: أسود" />
                      </div>
                      <div className="flex-1">
                        <label className="block mb-1.5 text-xs font-bold text-gray-500">الباركود</label>
                        <input type="text" className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono" value={color.barcode} onChange={e => handleColorChange(index, "barcode", e.target.value)} required placeholder="مثال: 123456789" />
                      </div>
                      {colors.length > 1 && (
                        <button type="button" onClick={() => removeColor(index)} className="p-2.5 bg-white border border-gray-200 text-red-500 rounded-lg hover:bg-red-50 hover:border-red-100 transition-colors" title="حذف اللون">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" className="w-full mt-6 bg-blue-600 text-white font-bold py-4 rounded-xl shadow-sm hover:bg-blue-700 transition-colors flex justify-center items-center gap-2 text-lg disabled:opacity-70 disabled:cursor-not-allowed" disabled={actionLoading}>
                {actionLoading ? (
                  <>جاري الإضافة...</>
                ) : (
                  <>
                    <Check size={20} strokeWidth={2.5} />
                    حفظ الموديل
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
