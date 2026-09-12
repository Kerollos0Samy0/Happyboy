"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Search, PlusCircle, Scissors, Trash2, Printer } from 'lucide-react';
import { QRCodeSVG } from "qrcode.react";

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
  const [printRoll, setPrintRoll] = useState<FabricRoll | null>(null);
  const [rollsCount, setRollsCount] = useState(1);
  const [multiAmounts, setMultiAmounts] = useState<string[]>(['']);
  const [isSaving, setIsSaving] = useState(false);
  const [newRoll, setNewRoll] = useState({
    code: '',
    color: '',
    type: '',
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

  const handleRollsCountChange = (val: number) => {
    const count = Math.max(1, val);
    setRollsCount(count);
    setMultiAmounts(prev => {
      const newArr = [...prev];
      while(newArr.length < count) newArr.push('');
      return newArr.slice(0, count);
    });
  };

  const colorCodes: Record<string, string> = {
    'أسود': 'BK', 'أبيض': 'WH', 'كحلي': 'NV', 'رمادي': 'GR', 'أحمر': 'RD',
    'أصفر': 'YL', 'أخضر': 'GN', 'زيتي': 'OL', 'أزرق زهرى': 'RB', 'كشمير': 'CS',
    'بيج': 'BG', 'بني': 'BR', 'برتقالي': 'OR', 'بينك': 'PK', 'لبني': 'LB', 'نبيتي': 'MR'
  };

  const handleColorChange = async (col: string) => {
    setNewRoll({...newRoll, color: col});
    if (!col) return;
    
    const prefix = colorCodes[col] || 'XX';
    try {
      const q = query(collection(db, 'factory_fabric_rolls'), where('color', '==', col));
      const snap = await getDocs(q);
      const count = snap.size;
      const nextNum = (count + 1).toString().padStart(3, '0');
      setNewRoll(prev => ({...prev, color: col, code: `${prefix}-${nextNum}`}));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddRoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoll.code || !newRoll.color || multiAmounts.some(a => !a)) return;
    setIsSaving(true);
    try {
      const promises = [];
      const baseNumStr = newRoll.code.split('-')[1] || '001';
      const baseNum = parseInt(baseNumStr, 10);
      const prefix = newRoll.code.split('-')[0] || 'XX';

      for (let i = 0; i < rollsCount; i++) {
        // If multiple, increment the base number for each
        const currentNum = (baseNum + i).toString().padStart(3, '0');
        const rollCode = rollsCount > 1 ? `${prefix}-${currentNum}` : newRoll.code;
        
        promises.push(addDoc(collection(db, 'factory_fabric_rolls'), {
          ...newRoll,
          code: rollCode,
          amount: Number(multiAmounts[i]),
          createdAt: serverTimestamp()
        }));
      }
      await Promise.all(promises);
      
      setShowAddForm(false);
      setNewRoll({ code: '', color: '', type: '', unit: 'كجم', supplier: '' });
      setRollsCount(1);
      setMultiAmounts(['']);
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
    r.code?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.color?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-green-800 tracking-tight flex items-center gap-2">
            <Scissors className="text-green-600" />
            مخزن القماش (أتواب)
          </h1>
          <p className="text-gray-500 mt-2">إدارة أتواب القماش الخام والباركودات الخاصة بها.</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-6 rounded-lg flex items-center gap-2 transition shadow-sm"
        >
          <PlusCircle size={20} />
          {showAddForm ? 'إلغاء' : 'إضافة توب جديد'}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-green-100 animate-fade-in mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2">تسجيل بيانات التوب</h2>
          <form onSubmit={handleAddRoll} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">اللون *</label>
              <select 
                required 
                value={newRoll.color} 
                onChange={(e) => handleColorChange(e.target.value)} 
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-gray-50 font-bold"
              >
                <option value="">-- اختر اللون --</option>
                {Object.keys(colorCodes).map(c => <option key={c} value={c}>{c}</option>)}
                <option value="أخرى">أخرى...</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">كود التوب الأساسي *</label>
              <input type="text" required value={newRoll.code} onChange={(e) => setNewRoll({...newRoll, code: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-mono" placeholder="يتم توليده تلقائياً..." />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">نوع القماش</label>
              <input type="text" value={newRoll.type} onChange={(e) => setNewRoll({...newRoll, type: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" placeholder="قطن، ميلتون..." />
            </div>

            {rollsCount === 1 ? (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">الكمية *</label>
                <div className="flex gap-2">
                  <input type="number" required min="0" step="0.01" value={multiAmounts[0]} onChange={(e) => {
                    const newArr = [...multiAmounts];
                    newArr[0] = e.target.value;
                    setMultiAmounts(newArr);
                  }} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" placeholder="مثال: 25.5" />
                  <select value={newRoll.unit} onChange={(e) => setNewRoll({...newRoll, unit: e.target.value})} className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-gray-50">
                    <option value="كجم">كجم</option>
                    <option value="متر">متر</option>
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">وحدة القياس للكل</label>
                <select value={newRoll.unit} onChange={(e) => setNewRoll({...newRoll, unit: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-gray-50">
                  <option value="كجم">كجم</option>
                  <option value="متر">متر</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">المورد</label>
              <input type="text" value={newRoll.supplier} onChange={(e) => setNewRoll({...newRoll, supplier: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" placeholder="اسم المورد أو المصنع" />
            </div>

            <div className="lg:col-span-3">
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1">عدد الأثواب المراد إضافتها (بنفس اللون والنوع)</label>
                <input 
                  type="number" 
                  min="1"
                  value={rollsCount}
                  onChange={(e) => handleRollsCountChange(Number(e.target.value) || 1)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">إذا اخترت أكثر من 1، سيتم إضافة ترقيم تلقائي للكود الأساسي (مثال: Code-01، Code-02).</p>
              </div>
              
              {rollsCount > 1 && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <label className="block text-sm font-bold text-gray-700 mb-3">أوزان الأتواب (توب توب) *</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {multiAmounts.map((amt, idx) => (
                      <div key={idx} className="flex flex-col">
                        <label className="text-xs font-bold text-gray-600 mb-1">توب {idx + 1}</label>
                        <input 
                          type="number" 
                          required min="0" step="0.01" 
                          value={amt} 
                          onChange={(e) => {
                            const newArr = [...multiAmounts];
                            newArr[idx] = e.target.value;
                            setMultiAmounts(newArr);
                          }} 
                          className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 outline-none text-center" 
                          placeholder="الوزن" 
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button type="submit" disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-8 rounded-lg flex items-center justify-center gap-2 transition shadow disabled:opacity-50">
                  {isSaving ? 'جاري الحفظ...' : 'حفظ بالمخزن'}
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
                    <td className="p-4 flex gap-2 justify-end">
                      <button onClick={() => setPrintRoll(roll)} className="p-2 text-blue-500 hover:bg-blue-100 rounded-lg transition" title="طباعة الباركود">
                        <Printer size={18} />
                      </button>
                      <button onClick={() => handleDelete(roll.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition" title="حذف التوب">
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

      {/* Print Modal */}
      {printRoll && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 no-print">
          <div className="bg-white p-8 rounded-xl max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-center">معاينة تيكت الباركود (5سم × 2.5سم)</h2>
            
            {/* The actual element that will be printed */}
            <div id="print-section" className="border border-gray-300 w-[50mm] h-[25mm] bg-white mx-auto flex items-center justify-between p-1 overflow-hidden" style={{ direction: 'rtl' }}>
              <div className="flex flex-col justify-center h-full w-[65%]">
                <span className="font-black text-[11px] leading-tight truncate text-black">{printRoll.color}</span>
                <span className="font-bold text-[9px] leading-tight truncate text-gray-800 mt-0.5">{printRoll.type || 'قماش'}</span>
                <span className="font-bold text-[11px] leading-tight text-black mt-0.5">{printRoll.amount} {printRoll.unit}</span>
                <span className="font-mono text-[8px] leading-tight text-black mt-0.5 font-bold truncate break-all">{printRoll.code}</span>
              </div>
              <div className="flex items-center justify-end h-full w-[35%]">
                <QRCodeSVG value={printRoll.code} size={22} style={{ width: '22mm', height: '22mm' }} />
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => window.print()}
                className="btn bg-blue-600 hover:bg-blue-700 text-white flex-1 py-2 font-bold transition rounded-lg"
              >
                🖨️ طباعة
              </button>
              <button 
                onClick={() => setPrintRoll(null)}
                className="btn bg-gray-200 hover:bg-gray-300 text-gray-700 flex-1 py-2 font-bold transition rounded-lg"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: 50mm 25mm;
            margin: 0;
          }
          body * { visibility: hidden; }
          #print-section, #print-section * { visibility: visible; }
          #print-section { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 50mm !important; 
            height: 25mm !important; 
            border: none !important;
            margin: 0 !important;
          }
          .no-print { display: none !important; }
        }
      `}} />

    </div>
  );
}
