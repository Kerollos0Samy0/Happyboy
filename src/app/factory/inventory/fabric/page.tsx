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
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [printRolls, setPrintRolls] = useState<FabricRoll[]>([]);
  const [selectedRolls, setSelectedRolls] = useState<string[]>([]);
  
  const [filterColor, setFilterColor] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');
  
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
      const q = query(collection(db, 'factory_fabric_rolls'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FabricRoll[];
      
      data.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?._seconds ? a.createdAt._seconds * 1000 : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?._seconds ? b.createdAt._seconds * 1000 : 0);
        return timeB - timeA;
      });
      
      setRolls(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Unknown error');
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

  let processedRolls = rolls.filter(r => 
    (r.code?.toLowerCase().includes(searchTerm.toLowerCase()) || 
     r.color?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterColor ? r.color === filterColor : true)
  );

  processedRolls.sort((a, b) => {
    if (sortBy === 'heaviest') return Number(b.amount) - Number(a.amount);
    if (sortBy === 'lightest') return Number(a.amount) - Number(b.amount);
    
    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?._seconds ? a.createdAt._seconds * 1000 : 0);
    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?._seconds ? b.createdAt._seconds * 1000 : 0);
    
    if (sortBy === 'oldest') return timeA - timeB;
    return timeB - timeA; // newest (default)
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRolls(processedRolls.map(r => r.id));
    } else {
      setSelectedRolls([]);
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedRolls.includes(id)) {
      setSelectedRolls(selectedRolls.filter(r => r !== id));
    } else {
      setSelectedRolls([...selectedRolls, id]);
    }
  };

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
        <div className="p-4 bg-gray-50 border-b flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 flex-1">
            <div className="relative w-full max-w-sm">
              <Search className="absolute right-3 top-2.5 text-gray-400" size={20} />
              <input 
                type="text" 
                placeholder="ابحث بالكود أو اللون..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm"
              />
            </div>
            
            <select 
              value={filterColor} 
              onChange={(e) => setFilterColor(e.target.value)} 
              className="py-2 px-3 border border-gray-300 rounded-lg outline-none text-sm bg-white"
            >
              <option value="">كل الألوان</option>
              {Object.keys(colorCodes).map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)} 
              className="py-2 px-3 border border-gray-300 rounded-lg outline-none text-sm bg-white"
            >
              <option value="newest">الأحدث إضافة</option>
              <option value="oldest">الأقدم إضافة</option>
              <option value="heaviest">الأعلى وزناً</option>
              <option value="lightest">الأقل وزناً</option>
            </select>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm font-bold text-gray-500">
              الإجمالي: {processedRolls.length} توب
            </div>
            {selectedRolls.length > 0 && (
              <button 
                onClick={() => setPrintRolls(rolls.filter(r => selectedRolls.includes(r.id)))}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition text-sm shadow"
              >
                <Printer size={16} /> طباعة {selectedRolls.length} تيكت
              </button>
            )}
          </div>
        </div>
        {errorMsg ? (
          <div className="p-10 text-center text-red-500 font-bold bg-red-50 m-4 rounded-lg">
            حدث خطأ أثناء تحميل الأتواب: {errorMsg}
          </div>
        ) : loading ? (
          <div className="p-10 text-center text-gray-500 font-bold">جاري تحميل الأتواب...</div>
        ) : processedRolls.length === 0 ? (
          <div className="p-10 text-center text-gray-400">لا توجد نتائج مطابقة.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-gray-100 text-gray-600 text-sm">
                <tr>
                  <th className="p-4 w-12">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 cursor-pointer"
                      checked={selectedRolls.length === processedRolls.length && processedRolls.length > 0}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="p-4 font-bold">كود التوب</th>
                  <th className="p-4 font-bold">اللون</th>
                  <th className="p-4 font-bold">النوع</th>
                  <th className="p-4 font-bold">الكمية/الوزن</th>
                  <th className="p-4 font-bold">المورد</th>
                  <th className="p-4 font-bold text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {processedRolls.map(roll => (
                  <tr key={roll.id} className="hover:bg-gray-50 transition">
                    <td className="p-4">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 cursor-pointer"
                        checked={selectedRolls.includes(roll.id)}
                        onChange={() => toggleSelect(roll.id)}
                      />
                    </td>
                    <td className="p-4 text-gray-800 font-black">{roll.code}</td>
                    <td className="p-4 text-gray-800 font-bold">{roll.color}</td>
                    <td className="p-4 text-gray-600">{roll.type || '---'}</td>
                    <td className="p-4 text-green-700 font-bold bg-green-50">{roll.amount} {roll.unit}</td>
                    <td className="p-4 text-gray-500 text-sm">{roll.supplier || '---'}</td>
                    <td className="p-4 flex gap-2 justify-center">
                      <button onClick={() => setPrintRolls([roll])} className="p-2 text-blue-500 hover:bg-blue-100 rounded-lg transition" title="طباعة الباركود">
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
      {/* Print Modal */}
      {printRolls.length > 0 && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 no-print p-4">
          <div className="bg-white p-8 rounded-xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[90vh]">
            <h2 className="text-xl font-bold mb-4 text-center">
              معاينة الطباعة ({printRolls.length} تيكت) (5سم × 2.5سم)
            </h2>
            
            <div className="flex-1 overflow-auto border p-4 bg-gray-50 flex flex-wrap gap-4 justify-center">
              {/* Preview in browser (not printed) */}
              {printRolls.map(roll => (
                <div key={roll.id} className="border border-gray-300 w-[50mm] h-[25mm] bg-white flex items-center justify-between p-1 overflow-hidden shrink-0" style={{ direction: 'rtl' }}>
                  <div className="flex flex-col justify-center h-full w-[65%]">
                    <span className="font-black text-[11px] leading-tight truncate text-black">{roll.color}</span>
                    <span className="font-bold text-[9px] leading-tight truncate text-gray-800 mt-0.5">{roll.type || 'قماش'}</span>
                    <span className="font-bold text-[11px] leading-tight text-black mt-0.5">{roll.amount} {roll.unit}</span>
                    <span className="font-mono text-[8px] leading-tight text-black mt-0.5 font-bold truncate break-all">{roll.code}</span>
                  </div>
                  <div className="flex items-center justify-end h-full w-[35%]">
                    <QRCodeSVG value={roll.code} size={22} style={{ width: '22mm', height: '22mm' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* The actual element that will be printed (Hidden on screen) */}
            <div id="print-section" className="hidden">
              {printRolls.map(roll => (
                <div key={roll.id} className="print-page" style={{ direction: 'rtl' }}>
                  <div className="flex flex-col justify-center h-full w-[65%]">
                    <span className="font-black text-[11px] leading-tight truncate text-black">{roll.color}</span>
                    <span className="font-bold text-[9px] leading-tight truncate text-gray-800 mt-0.5">{roll.type || 'قماش'}</span>
                    <span className="font-bold text-[11px] leading-tight text-black mt-0.5">{roll.amount} {roll.unit}</span>
                    <span className="font-mono text-[8px] leading-tight text-black mt-0.5 font-bold truncate break-all">{roll.code}</span>
                  </div>
                  <div className="flex items-center justify-end h-full w-[35%]">
                    <QRCodeSVG value={roll.code} size={22} style={{ width: '22mm', height: '22mm' }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4 mt-6 shrink-0">
              <button 
                onClick={() => window.print()}
                className="btn bg-blue-600 hover:bg-blue-700 text-white flex-1 py-3 font-bold transition rounded-lg text-lg shadow"
              >
                🖨️ طباعة الكل
              </button>
              <button 
                onClick={() => { setPrintRolls([]); setSelectedRolls([]); }}
                className="btn bg-gray-200 hover:bg-gray-300 text-gray-700 flex-1 py-3 font-bold transition rounded-lg"
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
          #print-section { display: block !important; position: absolute; left: 0; top: 0; width: 100%; visibility: visible; }
          #print-section * { visibility: visible; }
          .print-page { 
            width: 50mm !important; 
            height: 25mm !important; 
            border: none !important;
            margin: 0 !important;
            padding: 1mm !important;
            page-break-after: always;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-sizing: border-box;
            background: white;
          }
          .no-print { display: none !important; }
        }
      `}} />

    </div>
  );
}
