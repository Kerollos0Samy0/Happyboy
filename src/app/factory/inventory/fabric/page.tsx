"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Search, PlusCircle, Scissors, Trash2 } from 'lucide-react';

type FabricRoll = {
  id: string;
  code: string;
  color: string;
  type: string;
  amount: number;
  unit: string; // kg, meters
  supplier: string;
  createdAt: any;
};

export default function FabricInventoryPage() {
  const [rolls, setRolls] = useState<FabricRoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [rollsCount, setRollsCount] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [newRoll, setNewRoll] = useState({
    code: '',
    color: '',
    type: '',
    amount: '',
    unit: 'كجم',
    supplier: ''
  });

  const fetchRolls = async () => {
    try {
      const q = query(collection(db, 'factory_fabric_rolls'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FabricRoll[];
      setRolls(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRolls();
  }, []);

  const handleAddRoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoll.code || !newRoll.color || !newRoll.amount) return;
    setIsSaving(true);
    try {
      if (rollsCount > 1) {
        const promises = [];
        for (let i = 1; i <= rollsCount; i++) {
          const paddedNum = i.toString().padStart(2, '0');
          promises.push(addDoc(collection(db, 'factory_fabric_rolls'), {
            ...newRoll,
            code: `${newRoll.code}-${paddedNum}`,
            amount: Number(newRoll.amount),
            createdAt: serverTimestamp()
          }));
        }
        await Promise.all(promises);
      } else {
        await addDoc(collection(db, 'factory_fabric_rolls'), {
          ...newRoll,
          amount: Number(newRoll.amount),
          createdAt: serverTimestamp()
        });
      }
      
      setShowAddForm(false);
      setNewRoll({ code: '', color: '', type: '', amount: '', unit: 'كجم', supplier: '' });
      setRollsCount(1);
      fetchRolls();
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الحفظ.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا التوب؟")) return;
    try {
      await deleteDoc(doc(db, 'factory_fabric_rolls', id));
      fetchRolls();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredRolls = rolls.filter(r => 
    r.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.color.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border-r-4 border-green-500">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Scissors className="text-green-600" /> مخزن الأتواب
          </h1>
          <p className="text-gray-500 mt-1">إضافة وتتبع أتواب القماش بالكود واللون</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 transition shadow-md"
        >
          <PlusCircle size={20} /> إضافة توب جديد
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-green-100 animate-fade-in">
          <h2 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2">تسجيل بيانات التوب</h2>
          <form onSubmit={handleAddRoll} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">كود التوب *</label>
              <input type="text" required value={newRoll.code} onChange={(e) => setNewRoll({...newRoll, code: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" placeholder="مثال: R-1020" />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">اللون *</label>
              <input type="text" required value={newRoll.color} onChange={(e) => setNewRoll({...newRoll, color: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" placeholder="أحمر، كحلي..." />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">نوع القماش</label>
              <input type="text" value={newRoll.type} onChange={(e) => setNewRoll({...newRoll, type: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" placeholder="قطن، ميلتون..." />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">الكمية *</label>
              <div className="flex gap-2">
                <input type="number" required min="0" step="0.01" value={newRoll.amount} onChange={(e) => setNewRoll({...newRoll, amount: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" placeholder="مثال: 25.5" />
                <select value={newRoll.unit} onChange={(e) => setNewRoll({...newRoll, unit: e.target.value})} className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-gray-50">
                  <option value="كجم">كجم</option>
                  <option value="متر">متر</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">المورد</label>
              <input type="text" value={newRoll.supplier} onChange={(e) => setNewRoll({...newRoll, supplier: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" placeholder="اسم المورد أو المصنع" />
            </div>

            <div className="lg:col-span-3">
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1">عدد الأثواب المراد إضافتها (بنفس المواصفات)</label>
                <input 
                  type="number" 
                  min="1"
                  value={rollsCount}
                  onChange={(e) => setRollsCount(Number(e.target.value) || 1)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">إذا اخترت أكثر من 1، سيتم إضافة ترقيم تلقائي للكود الأساسي (مثال: Code-01، Code-02).</p>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-8 rounded-lg flex items-center justify-center gap-2 transition shadow disabled:opacity-50">
                  {isSaving ? 'جاري الحفظ...' : 'حفظ التوب بالمخزن'}
                </button>
              </div>
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
              placeholder="ابحث بالكود أو اللون..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm"
            />
          </div>
          <div className="text-sm font-bold text-gray-500">
            الإجمالي: {rolls.length} توب
          </div>
        </div>
        
        {loading ? (
          <div className="p-10 text-center text-gray-500 font-bold">جاري تحميل الأتواب...</div>
        ) : filteredRolls.length === 0 ? (
          <div className="p-10 text-center text-gray-400">لا توجد نتائج مطابقة.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-gray-100 text-gray-600 text-sm">
                <tr>
                  <th className="p-4 font-bold">كود التوب</th>
                  <th className="p-4 font-bold">اللون</th>
                  <th className="p-4 font-bold">النوع</th>
                  <th className="p-4 font-bold">الكمية/الوزن</th>
                  <th className="p-4 font-bold">المورد</th>
                  <th className="p-4 font-bold">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRolls.map(roll => (
                  <tr key={roll.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 text-gray-800 font-black">{roll.code}</td>
                    <td className="p-4 text-gray-800 font-bold">{roll.color}</td>
                    <td className="p-4 text-gray-600">{roll.type || '---'}</td>
                    <td className="p-4 text-green-700 font-bold bg-green-50">{roll.amount} {roll.unit}</td>
                    <td className="p-4 text-gray-500 text-sm">{roll.supplier || '---'}</td>
                    <td className="p-4">
                      <button onClick={() => handleDelete(roll.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
