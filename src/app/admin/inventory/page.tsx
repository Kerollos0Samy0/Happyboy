"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "../../../lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, deleteDoc, doc, updateDoc, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Edit, Trash2, Check, X, Search, Package, Plus, Layers, ChevronDown, Tag, AlertTriangle, FileText, Printer } from "lucide-react";

const getCategoryName = (modelStr: string) => {
  const m = parseInt(modelStr.replace(/\D/g, ''), 10);
  if (isNaN(m)) return "غير معروف";
  if (m >= 1000 && m <= 1040) return "أولادي صيفي";
  if (m >= 2000 && m <= 2040) return "بناتي صيفي";
  if (m >= 3000 && m <= 3040) return "بيبي أولادي صيفي";
  if (m >= 4000 && m <= 4040) return "بيبي بناتي صيفي";
  if (m >= 1041 && m <= 1099) return "أولادي شتوي";
  if (m >= 2041 && m <= 2099) return "بناتي شتوي";
  if (m >= 3041 && m <= 3099) return "بيبي أولادي شتوي";
  if (m >= 4041 && m <= 4099) return "بيبي بناتي شتوي";
  if (m >= 5000 && m <= 5100) return "سمر ميلتون";
  return "غير معروف";
};

const getSizesCount = (name: string, modelNumber: string, sizes: string[] | undefined) => {
  const category = getCategoryName(modelNumber);
  if (category.includes('بيبي') || category.includes('سمر') || category.includes('شتوي') || category.includes('صيفي') || name.includes('بيبي') || name.includes('سوت') || name.includes('موديل')) return 4;
  return sizes && sizes.length > 0 ? sizes.length : 1;
};

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
  isDeleted?: boolean;
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
  const [filterOutofStock, setFilterOutofStock] = useState(false);

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

  const fetchProducts = async (forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        const cached = localStorage.getItem('inventory_products_cache');
        const cachedTime = localStorage.getItem('inventory_products_time');
        if (cached && cachedTime && (Date.now() - Number(cachedTime) < 3600000)) { // 1 hour cache
          setProducts(JSON.parse(cached));
          return;
        }
      }

      const snapshot = await getDocs(collection(db, "products"));
      const prods = snapshot.docs
        .filter(doc => !doc.data().isDeleted)
        .map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      
      // Sort products by modelNumber ascending
      prods.sort((a, b) => Number(a.modelNumber) - Number(b.modelNumber));

      // Sort colors inside each product by barcode ascending
      prods.forEach(p => {
        if (Array.isArray(p.colors)) {
          p.colors.sort((c1, c2) => Number(c1.barcode) - Number(c2.barcode));
        }
      });
      
      localStorage.setItem('inventory_products_cache', JSON.stringify(prods));
      localStorage.setItem('inventory_products_time', Date.now().toString());

      setProducts(prods);
    } catch (error) {
      console.error("Error fetching products", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من الحذف؟")) return;
    try {
      await updateDoc(doc(db, "products", id), { isDeleted: true });
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

      const oldProduct = products.find(p => p.id === id);
      const empName = auth.currentUser?.displayName || auth.currentUser?.email || "Unknown";

      if (oldProduct && editForm.colors) {
        for (const newColor of editForm.colors) {
          const oldColor = oldProduct.colors?.find(c => c.name === newColor.name);
          const oldQty = Number(oldColor?.quantity) || 0;
          const newQty = Number(newColor.quantity) || 0;
          const change = newQty - oldQty;
          
          if (change !== 0) {
            await addDoc(collection(db, "inventory_logs"), {
              productId: id,
              modelNumber: editForm.modelNumber,
              productName: editForm.name,
              colorName: newColor.name,
              change: change,
              newQuantity: newQty,
              reason: "تعديل يدوي",
              employeeName: empName,
              createdAt: serverTimestamp()
            });
          }
        }
      }

      await updateDoc(doc(db, "products", id), updatedData);

      // Check if price changed to update pending orders
      if (oldProduct && Number(oldProduct.price) !== Number(editForm.price)) {
        const newPrice = Number(editForm.price);
        
        const getCatName = (modelNumber: string) => {
          const num = parseInt(modelNumber, 10);
          if (isNaN(num)) return "أخرى";
          if (num >= 5 && num <= 90) return "بيبي ولادي";
          if (num >= 100 && num <= 299) return "وسط ولادي";
          if (num >= 300 && num <= 499) return "محير ولادي";
          if (num >= 500 && num <= 589) return "بيبي بناتي";
          if (num >= 590 && num <= 789) return "وسط بناتي";
          if (num >= 790 && num <= 999) return "محير بناتي";
          if (num >= 1000 && num <= 2999) return "رياضي";
          if (num >= 3000 && num <= 4999) return "سمر ولادي";
          if (num >= 5000 && num <= 6999) return "سمر بناتي";
          return "أخرى";
        };
        
        const getSizesCnt = (name: string, modelNumber: string, sizes: string[] | undefined) => {
          const category = getCatName(modelNumber);
          if (category.includes('بيبي') || category.includes('وسط') || category.includes('محير') || category.includes('رياضي') || (name || "").includes('بيبي') || (name || "").includes('وسط') || (name || "").includes('محير')) return 4;
          return sizes && sizes.length > 0 ? sizes.length : 1;
        };

        const pendingQuery = query(collection(db, "orders"), where("status", "==", "pending"));
        const pendingSnapshot = await getDocs(pendingQuery);

        for (const orderDoc of pendingSnapshot.docs) {
          const orderData = orderDoc.data();
          if (!orderData.items) continue;
          
          let needsUpdate = false;
          let newTotal = 0;

          const updatedItems = orderData.items.map((item: any) => {
            if (String(item.modelNumber).trim() === String(editForm.modelNumber).trim()) {
              item.price = newPrice;
              needsUpdate = true;
            }
            
            const qty = item.quantity || 1;
            const sizesCount = getSizesCnt(item.name, item.modelNumber, item.sizes);
            
            if (item.isSeri) {
              newTotal += item.price * sizesCount * qty;
            } else {
              newTotal += item.price * qty;
            }
            return item;
          });

          if (needsUpdate) {
            await updateDoc(doc(db, "orders", orderDoc.id), {
              items: updatedItems,
              total: newTotal
            });
          }
        }
      }

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

  const handleColorChange = (index: number, field: keyof ColorEntry, value: any) => {
    const newColors = [...colors];
    newColors[index] = { ...newColors[index], [field]: value };
    setColors(newColors);
  };

  const addColor = () => setColors([...colors, { name: "", barcode: "" }]);
  const removeColor = (index: number) => setColors(colors.filter((_, i) => i !== index));

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setSuccess(false);
    
    const flatBarcodes = colors.map(c => c.barcode).filter(b => b.trim() !== "");
    const totalQty = colors.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);

    try {
      const docRef = await addDoc(collection(db, "products"), {
        modelNumber,
        name,
        price: Number(price),
        sizes: sizes.split(",").map(s => s.trim()),
        colors,
        barcodes: flatBarcodes,
        quantity: totalQty,
        createdAt: serverTimestamp()
      });

      const empName = auth.currentUser?.displayName || auth.currentUser?.email || "Unknown";
      for (const color of colors) {
        const qty = Number(color.quantity) || 0;
        if (qty !== 0) {
          await addDoc(collection(db, "inventory_logs"), {
            productId: docRef.id,
            modelNumber,
            productName: name,
            colorName: color.name,
            change: qty,
            newQuantity: qty,
            reason: "إضافة موديل جديد",
            employeeName: empName,
            createdAt: serverTimestamp()
          });
        }
      }
      
      setSuccess(true);
      setModelNumber(""); setName(""); setPrice(""); setSizes(""); setQuantity("");
      setColors([{ name: "", barcode: "" }]);
      fetchProducts(true);
    } catch (error) {
      alert("خطأ أثناء الإضافة");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="p-10 text-center">جاري التحميل...</div>;

  const filteredProducts = products.filter(p => {
    if (filterOutofStock && (Number(p.quantity) || 0) > 0) return false;
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
  const totalCapital = products.reduce((sum, p) => sum + (Math.max(0, Number(p.quantity) || 0) * (Number(p.price) || 0)), 0);

  // Grouping Logic
  const categories = [
    {
      title: "قسم الأولادي",
      sections: [
        { name: "بيبي مقاس 2-3-4-5 (5 - 90)", filter: (num: number) => num >= 5 && num <= 90 },
        { name: "وسط مقاس 6-8-10-12 (100 - 299)", filter: (num: number) => num >= 100 && num <= 299 },
        { name: "محير مقاس 14-16-18-20 (300 - 499)", filter: (num: number) => num >= 300 && num <= 499 },
      ]
    },
    {
      title: "قسم البناتي",
      sections: [
        { name: "بيبي مقاس 2-3-4-5 (500 - 589)", filter: (num: number) => num >= 500 && num <= 589 },
        { name: "وسط مقاس 6-8-10-12 (600 - 789)", filter: (num: number) => num >= 590 && num <= 789 },
        { name: "محير مقاس 14-16-18-20 (800 - 999)", filter: (num: number) => num >= 790 && num <= 999 },
      ]
    },
    {
      title: "رياضي",
      sections: [
        { name: "وسط رياضي", filter: (num: number) => num >= 1000 && num <= 1999 },
        { name: "محير رياضي", filter: (num: number) => num >= 2000 && num <= 2999 },
      ]
    },
    {
      title: "Summer Melton",
      sections: [
        { name: "وسط أولادي", filter: (num: number) => num >= 3000 && num <= 3999 },
        { name: "محير أولادي", filter: (num: number) => num >= 4000 && num <= 4999 },
        { name: "وسط بناتي", filter: (num: number) => num >= 5000 && num <= 5999 },
        { name: "محير بناتي", filter: (num: number) => num >= 6000 && num <= 6999 },
      ]
    }
  ];

  const sectionStats = categories.map(cat => ({
    title: cat.title,
    totalPieces: cat.sections.reduce((sum, sec) => {
      const prods = products.filter(p => sec.filter(Number(p.modelNumber)));
      return sum + prods.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0);
    }, 0),
    totalSeries: cat.sections.reduce((sum, sec) => {
      const prods = products.filter(p => sec.filter(Number(p.modelNumber)));
      return sum + prods.reduce((acc, p) => acc + ((Number(p.quantity) || 0) / getSizesCount(p.name, p.modelNumber, p.sizes)), 0);
    }, 0),
    totalShortagesPieces: cat.sections.reduce((sum, sec) => {
      const prods = products.filter(p => sec.filter(Number(p.modelNumber)));
      return sum + prods.reduce((acc, p) => acc + Math.abs(Math.min(0, Number(p.quantity) || 0)), 0);
    }, 0),
    totalShortagesSeries: cat.sections.reduce((sum, sec) => {
      const prods = products.filter(p => sec.filter(Number(p.modelNumber)));
      return sum + prods.reduce((acc, p) => acc + (Math.abs(Math.min(0, Number(p.quantity) || 0)) / getSizesCount(p.name, p.modelNumber, p.sizes)), 0);
    }, 0),
    sections: cat.sections.map(sec => {
      const prods = products.filter(p => sec.filter(Number(p.modelNumber)));
      const pieces = prods.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
      const series = prods.reduce((sum, p) => sum + ((Number(p.quantity) || 0) / getSizesCount(p.name, p.modelNumber, p.sizes)), 0);
      const shortagesPieces = prods.reduce((sum, p) => sum + Math.abs(Math.min(0, Number(p.quantity) || 0)), 0);
      const shortagesSeries = prods.reduce((sum, p) => sum + (Math.abs(Math.min(0, Number(p.quantity) || 0)) / getSizesCount(p.name, p.modelNumber, p.sizes)), 0);
      return { name: sec.name, pieces, series, shortagesPieces, shortagesSeries };
    })
  }));

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
          <tbody>
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
                  const newTotal = newColors.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);
                  setEditForm({ ...editForm, colors: newColors, quantity: newTotal });
                }
              };

              const trClass = "hover:bg-gray-50/50 transition-colors group border-t-[3px] border-gray-200";

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
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-gray-500 font-bold">المجموع</span>
                          <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-full text-sm font-black bg-blue-50 text-blue-700 border border-blue-100">
                            {displayProduct.quantity}
                          </span>
                        </div>
                      ) : (
                        <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-black ${displayProduct.quantity <= 0 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                          {Number(displayProduct.quantity) < 0 ? `(${Math.abs(Number(displayProduct.quantity))})` : displayProduct.quantity}
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
                        hasColors ? (
                          Number(displayProduct.colors[0].quantity) < 0 
                            ? `(${Math.abs(Number(displayProduct.colors[0].quantity))})` 
                            : (displayProduct.colors[0].quantity ?? "-")
                        ) : "-"
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
                      <tr key={`${product.id}-c${idx}`} className="hover:bg-gray-50/50 transition-colors border-t border-gray-100">
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
                            Number(color.quantity) < 0 ? `(${Math.abs(Number(color.quantity))})` : (color.quantity ?? "-")
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
          <details key={idx} className="bg-white border border-gray-200 rounded-2xl shadow-sm group overflow-hidden">
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
                  <details key={sIdx} className="bg-white rounded-xl shadow-sm border border-gray-100 group/sub overflow-hidden">
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
          <details className="bg-white border border-gray-200 rounded-2xl shadow-sm group overflow-hidden">
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

  const handlePrintZeroQty = () => {
    const zeroQtyProducts = products.filter(p => (Number(p.quantity) || 0) < 0);
    
    const grouped: Record<string, typeof zeroQtyProducts> = {};
    zeroQtyProducts.forEach(p => {
      const cat = getCategoryName(String(p.modelNumber));
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });

    Object.keys(grouped).forEach(cat => {
      grouped[cat].sort((a, b) => {
        const numA = parseInt(String(a.modelNumber).replace(/\\D/g, ''), 10) || 0;
        const numB = parseInt(String(b.modelNumber).replace(/\\D/g, ''), 10) || 0;
        return numA - numB;
      });
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('الرجاء السماح بالنوافذ المنبثقة (Pop-ups) للطباعة');

    let tablesHtml = '';
    let grandTotalShortages = 0;

    Object.keys(grouped).sort().forEach(cat => {
      let catTotalShortages = 0;
      
      const rowsHtml = grouped[cat].map(p => {
        const totalReq = Number(p.quantity) < 0 ? Math.abs(Number(p.quantity)) : 0;
        catTotalShortages += totalReq;
        
        return '<tr><td style="font-weight: bold; text-align: center;">' + p.modelNumber + '</td><td class="model-name">' + (p.name || 'غير محدد') + '</td><td style="text-align: center; font-weight: bold; color: ' + (totalReq > 0 ? '#dc2626' : '#6b7280') + ';">' + (totalReq > 0 ? totalReq : 'صفر') + '</td><td>' + (p.colors && p.colors.length > 0 ? p.colors.filter(c => (Number(c.quantity) || 0) < 0).map(c => {
              const cQty = Number(c.quantity) || 0;
              const statusHtml = cQty < 0 ? '<span class="req-qty">(عجز: ' + Math.abs(cQty) + ')</span>' : '<span class="zero-qty">(رصيد 0)</span>';
              return '<div style="margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px dashed #eee;">' + c.name + ': <span class="barcode">' + c.barcode + '</span> ' + statusHtml + '</div>';
            }).join('') : '<span style="color: #999;">لا يوجد ألوان مسجلة</span>') + '</td></tr>';
      }).join('');
      
      grandTotalShortages += catTotalShortages;

      tablesHtml += `
        <h2 style="margin-top: 30px; border-bottom: 2px solid #2563eb; padding-bottom: 5px; color: #1e3a8a;">
          تصنيف: ${cat} 
          <span style="float: left; font-size: 16px; color: #dc2626; background: #fee2e2; padding: 4px 12px; border-radius: 12px;">إجمالي العجز: ${catTotalShortages} قطعة</span>
        </h2>
        <table>
          <thead>
            <tr>
              <th style="width: 80px;">الموديل</th>
              <th>اسم الموديل</th>
              <th style="width: 100px;">العجز</th>
              <th>تفاصيل الألوان (عجز فقط)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;
    });

    const html = `
      <html dir="rtl">
        <head>
          <title>تقرير النواقص - الموديلات المطلوبة</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; }
            h1 { text-align: center; color: #111; margin-bottom: 5px; }
            p.subtitle { text-align: center; color: #666; margin-top: 0; margin-bottom: 10px; font-size: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
            th, td { border: 1px solid #ddd; padding: 12px 8px; text-align: right; }
            th { background-color: #f8f9fa; font-weight: bold; color: #000; }
            tr:nth-child(even) { background-color: #fcfcfc; }
            .model-name { font-weight: bold; color: #2563eb; }
            .barcode { display: inline-block; background: #eee; padding: 2px 6px; border-radius: 4px; margin: 2px; font-family: monospace; }
            .req-qty { color: #dc2626; font-weight: bold; font-size: 13px; margin-right: 5px; }
            .zero-qty { color: #6b7280; font-size: 13px; margin-right: 5px; }
            .summary-box { background: #fef2f2; border: 1px solid #fca5a5; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 20px; font-size: 18px; font-weight: bold; color: #991b1b; }
            @media print {
              button { display: none; }
              body { padding: 0; }
              table { font-size: 12px; }
              h2 { font-size: 16px; margin-top: 20px; }
            }
          </style>
        </head>
        <body>
          <h1>تقرير النواقص والمطلوب (عجز المخزن)</h1>
          <p class="subtitle">إجمالي الموديلات اللي فيها عجز: ${zeroQtyProducts.length}</p>
          
          <div class="summary-box">
            إجمالي العجز الكلي في المخزن: ${grandTotalShortages} قطعة
          </div>

          <div style="text-align: center; margin-bottom: 20px;">
            <button onclick="window.print()" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; font-weight: bold;">طباعة التقرير</button>
          </div>

          ${tablesHtml}
          
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
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
          
            <div className="flex gap-3">
              <button onClick={handlePrintZeroQty} className="px-6 py-3.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full font-bold text-base hover:bg-blue-100 transition-all shadow-sm flex items-center gap-2">
                <Printer size={20} />
                <span className="hidden sm:inline">طباعة النواقص</span>
              </button>
              <button onClick={() => router.push("/admin/dashboard")} className="px-8 py-3.5 bg-white border border-gray-200 text-gray-700 rounded-full font-bold text-base hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm flex items-center gap-2">
                لوحة التحكم
              </button>
            </div>

        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.08)] flex items-center gap-6 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] group">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
              <Layers size={28} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-500 mb-1">الموديلات المتاحة</p>
              <h3 className="text-3xl font-black text-gray-900">
                {products.filter(p => (Number(p.quantity) || 0) > 0).length} 
                <span className="text-lg text-gray-400 font-normal ml-2">/ {totalModels}</span>
              </h3>
            </div>
          </div>
          <div 
            className={`bg-white rounded-2xl border p-6 flex items-center gap-6 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] group cursor-pointer select-none ${filterOutofStock ? 'border-red-500 shadow-[0_2px_15px_-3px_rgba(239,68,68,0.3)] bg-red-50/30' : 'border-red-100 shadow-[0_2px_10px_-3px_rgba(239,68,68,0.08)]'}`}
            onClick={() => {
              setFilterOutofStock(!filterOutofStock);
              setActiveTab('manage');
            }}
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 ${filterOutofStock ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600'}`}>
              <AlertTriangle size={28} strokeWidth={2.5} />
            </div>
            <div>
              <p className={`text-sm font-bold mb-1 ${filterOutofStock ? 'text-red-700' : 'text-gray-500'}`}>نواقص (كمية 0) {filterOutofStock && '(نشط)'}</p>
              <h3 className="text-3xl font-black text-red-600">
                {products.filter(p => (Number(p.quantity) || 0) <= 0).length}
              </h3>
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

        {/* Detailed Stats */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mb-8">
          <h4 className="font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">تفاصيل القطع بالمخزن</h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {sectionStats.map((cat, idx) => (
              <div key={idx}>
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2 border-b border-gray-100 pb-2">
                    <h5 className="font-black text-gray-900 text-base">{cat.title}</h5>
                    <div className="flex gap-2 text-xs">
                      <span className="text-emerald-700 bg-emerald-100 px-2 py-1 rounded font-bold">{(cat.totalPieces || 0).toLocaleString()} قطعة</span>
                      <span className="text-red-700 bg-red-100 px-2 py-1 rounded font-bold">عجز: {(cat.totalShortagesPieces || 0).toLocaleString()} قطعة</span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <div className="grid grid-cols-[1fr_80px_80px] py-2 text-xs font-bold text-gray-500 text-center">
                      <div className="text-right pr-2">القسم</div>
                      <div>المتاح (ق)</div>
                      <div>العجز (ق)</div>
                    </div>
                    {cat.sections.map((sec, sIdx) => (
                      <div key={sIdx} className="grid grid-cols-[1fr_80px_80px] py-2 text-sm border-t border-gray-50 items-center text-center hover:bg-gray-50 transition-colors">
                        <div className="text-gray-700 font-bold text-right pr-2 truncate" title={sec.name.split(' (')[0]}>{sec.name.split(' (')[0]}</div>
                        <div className="font-bold text-emerald-600 bg-emerald-50 rounded py-0.5 mx-1">{(sec.pieces || 0).toLocaleString()}</div>
                        <div className={`font-bold rounded py-0.5 mx-1 ${sec.shortagesPieces > 0 ? 'text-red-600 bg-red-50' : 'text-gray-300'}`}>
                          {sec.shortagesPieces > 0 ? (sec.shortagesPieces || 0).toLocaleString() : '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs / Actions */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <button 
            className={`flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-base transition-all duration-300 border-2 ${activeTab === 'manage' ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'}`} 
            onClick={() => setActiveTab('manage')}
          >
            <Layers size={18} strokeWidth={2.5} />
            عرض الموديلات
          </button>
          <button 
            className={`flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-base transition-all duration-300 border-2 ${activeTab === 'add' ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'}`} 
            onClick={() => setActiveTab('add')}
          >
            <Plus size={18} strokeWidth={2.5} />
            إضافة موديل
          </button>
          
          <div className="hidden md:block flex-1" /> {/* Spacer */}
          
          <a 
            href="/admin/inventory/logs"
            className="flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-base transition-all duration-300 bg-white text-purple-700 border-2 border-purple-100 hover:bg-purple-50 hover:border-purple-300 shadow-sm"
          >
            <FileText size={18} strokeWidth={2.5} />
            سجل حركة المخزن
          </a>
        </div>

        {activeTab === 'manage' && (
          <div className="w-full">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-8 animate-fade-in-up">
              <div className="relative w-full md:w-1/2 group">
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                </div>
                <input 
                  type="text" 
                  className="w-full bg-white border border-gray-200 text-gray-900 text-sm font-bold rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent block pr-12 p-4 transition-all shadow-sm hover:border-gray-300 outline-none" 
                  placeholder="بحث برقم الموديل أو الاسم..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              
              <button 
                onClick={() => fetchProducts(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                تحديث البيانات
              </button>
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
                      <div className="flex-1">
                        <label className="block mb-1.5 text-xs font-bold text-gray-500">الكمية</label>
                        <input type="number" className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={color.quantity ?? ""} onChange={e => handleColorChange(index, "quantity", Number(e.target.value))} required placeholder="مثال: 50" />
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
