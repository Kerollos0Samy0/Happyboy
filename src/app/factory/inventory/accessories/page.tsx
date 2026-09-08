"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Search, PlusCircle, Box, Trash2, Camera, Image as ImageIcon } from 'lucide-react';

type AccessoryStock = {
  id: string;
  name: string;
  type: string;
  quantity: number;
  unit: string;
  supplier: string;
  details?: string;
  image?: string;
  createdAt: any;
};

export default function AccessoriesInventoryPage() {
  const [accessories, setAccessories] = useState<AccessoryStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    type: '',
    quantity: '',
    unit: 'قطعة',
    supplier: '',
    details: '',
    image: ''
  });

  const fetchAccessories = async () => {
    try {
      const q = query(collection(db, 'factory_accessories_stock'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AccessoryStock[];
      setAccessories(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccessories();
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name || !newItem.quantity) return;

    try {
      await addDoc(collection(db, 'factory_accessories_stock'), {
        ...newItem,
        quantity: Number(newItem.quantity),
        createdAt: serverTimestamp()
      });
      
      setShowAddForm(false);
      setNewItem({ name: '', type: '', quantity: '', unit: 'قطعة', supplier: '', details: '', image: '' });
      fetchAccessories();
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الحفظ.");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewItem({ ...newItem, image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الصنف؟")) return;
    try {
      await deleteDoc(doc(db, 'factory_accessories_stock', id));
      fetchAccessories();
    } catch (err) {
      console.error(err);
    }
  };

  const updateQuantity = async (id: string, currentQty: number, change: number) => {
    const newQty = Math.max(0, currentQty + change);
    try {
      await updateDoc(doc(db, 'factory_accessories_stock', id), { quantity: newQty });
      setAccessories(accessories.map(t => t.id === id ? { ...t, quantity: newQty } : t));
    } catch (err) {
      console.error(err);
    }
  };

  const filteredAccessories = accessories.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (a.type && a.type.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border-r-4 border-orange-500">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Box className="text-orange-600" /> مخزن الإكسسوارات
          </h1>
          <p className="text-gray-500 mt-1">تتبع الأزرار، السوست، الشرائط، التيكيت وكل المستلزمات</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 transition shadow-md"
        >
          <PlusCircle size={20} /> إضافة صنف جديد
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-orange-100 animate-fade-in">
          <h2 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2">تسجيل صنف جديد</h2>
          <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">اسم الصنف *</label>
              <input type="text" required value={newItem.name} onChange={(e) => setNewItem({...newItem, name: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="مثال: زرار قميص أبيض، سوستة 20سم..." />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">النوع / التصنيف</label>
              <input type="text" value={newItem.type} onChange={(e) => setNewItem({...newItem, type: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="أزرار، سوست، شرائط، تيكيت..." />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">الكمية *</label>
              <div className="flex gap-2">
                <input type="number" required min="0" value={newItem.quantity} onChange={(e) => setNewItem({...newItem, quantity: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="العدد المتوفر" />
                <select value={newItem.unit} onChange={(e) => setNewItem({...newItem, unit: e.target.value})} className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-gray-50">
                  <option value="قطعة">قطعة</option>
                  <option value="كيس">كيس</option>
                  <option value="علبة">علبة</option>
                  <option value="لفة">لفة</option>
                  <option value="متر">متر</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">المورد</label>
              <input type="text" value={newItem.supplier} onChange={(e) => setNewItem({...newItem, supplier: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="اسم المورد" />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">التفاصيل والأبعاد (الطول، المقاس، اللون)</label>
              <input type="text" value={newItem.details} onChange={(e) => setNewItem({...newItem, details: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="مثال: طول الكرتونة 50سم، سوستة 20سم، إلخ..." />
            </div>

            <div className="lg:col-span-3 border-t pt-4 mt-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">صورة الصنف (اختياري)</label>
              <div className="flex items-center gap-4">
                <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-bold flex items-center gap-2 border-2 border-dashed border-gray-300 transition w-full md:w-auto justify-center">
                  <Camera size={20} />
                  التقط أو اختر صورة
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
                </label>
                {newItem.image && (
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-orange-500 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={newItem.image} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-3 flex justify-end mt-4">
              <button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 px-8 rounded-lg flex items-center justify-center gap-2 transition shadow">
                إضافة للمخزن
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-2.5 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="ابحث باسم الصنف أو النوع..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm"
            />
          </div>
          <div className="text-sm font-bold text-gray-500">
            الإجمالي: {accessories.length} صنف
          </div>
        </div>
        
        {loading ? (
          <div className="p-10 text-center text-gray-500 font-bold">جاري تحميل الإكسسوارات...</div>
        ) : filteredAccessories.length === 0 ? (
          <div className="p-10 text-center text-gray-400">لا توجد نتائج مطابقة.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
            {filteredAccessories.map(item => (
              <div key={item.id} className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition">
                <div className="flex gap-4 mb-3 border-b pb-3">
                  {item.image ? (
                    <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-50 border border-gray-100 flex-shrink-0 flex items-center justify-center text-gray-300">
                      <ImageIcon size={24} />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-lg text-gray-800">{item.name}</h3>
                      {item.type && <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-mono">{item.type}</span>}
                    </div>
                    <p className="text-sm text-gray-500">{item.supplier || 'بدون مورد'}</p>
                    {item.details && (
                      <p className="text-xs text-orange-600 mt-1 font-medium bg-orange-50 inline-block px-2 py-0.5 rounded">
                        تفاصيل: {item.details}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="bg-orange-50 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-orange-800 font-bold text-sm">الرصيد:</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => updateQuantity(item.id, item.quantity, -1)} className="w-8 h-8 flex items-center justify-center bg-white text-orange-600 rounded shadow-sm font-bold border border-orange-100 hover:bg-orange-100">-</button>
                    <span className="font-black text-xl text-orange-900 w-10 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity, 1)} className="w-8 h-8 flex items-center justify-center bg-white text-orange-600 rounded shadow-sm font-bold border border-orange-100 hover:bg-orange-100">+</button>
                  </div>
                </div>
                <div className="text-center text-xs text-orange-400 mt-1">{item.unit}</div>
                
                <button onClick={() => handleDelete(item.id)} className="w-full mt-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded transition flex justify-center">
                  حذف الصنف
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
