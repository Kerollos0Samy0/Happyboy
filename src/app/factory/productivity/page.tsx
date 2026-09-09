"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import { BarChart3, PlusCircle, Calendar, Save, Trash2 } from 'lucide-react';

type ProductivityLog = {
  id: string;
  date: string;
  type: string;
  modelNumber?: string;
  lineId?: string;
  amount: number;
  unit: string;
  notes: string;
  createdAt: any;
};

const MACHINE_TYPES = [
  { id: 'cutting', name: 'قسم القص', unit: 'قطعة', icon: '✂️' },
  { id: 'sorting', name: 'قسم الفرز', unit: 'قطعة', icon: '🔍' },
  { id: 'dtf', name: 'قسم الـ DTF', unit: 'متر', icon: '🖨️' },
  { id: 'laser', name: 'قسم الـ Lazer', unit: 'متر', icon: '⚡' },
  { id: 'cutting_out', name: 'قسم القص والتفريغ', unit: 'قطعة', icon: '🔪' },
  { id: 'pressing', name: 'قسم الكبس', unit: 'قطعة', icon: '🔥' },
  { id: 'pairing', name: 'قسم التجويز', unit: 'قطعة', icon: '🔗' },
  { id: 'sewing', name: 'قسم المكن', unit: 'قطعة', icon: '🧵' },
  { id: 'finishing', name: 'قسم التشطيب', unit: 'قطعة', icon: '✨' },
  { id: 'ironing', name: 'قسم المكواة', unit: 'قطعة', icon: '💨' },
  { id: 'packaging', name: 'التعبئة والتكييس', unit: 'قطعة', icon: '📦' },
  { id: 'warehouse', name: 'مخزن الموديلات', unit: 'قطعة', icon: '🏭' },
];

export default function ProductivityPage() {
  const [logs, setLogs] = useState<ProductivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLog, setNewLog] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'cutting',
    modelNumber: '',
    lineId: '',
    amount: '',
    notes: ''
  });

  const fetchLogs = async () => {
    try {
      const q = query(collection(db, 'factory_productivity_logs'), orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ProductivityLog[];
      setLogs(data);
    } catch (err) {
      console.error("Error fetching logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLog.amount || isNaN(Number(newLog.amount))) return;
    
    const selectedMachine = MACHINE_TYPES.find(m => m.id === newLog.type);
    if (!selectedMachine) return;

    try {
      await addDoc(collection(db, 'factory_productivity_logs'), {
        date: newLog.date,
        type: newLog.type,
        modelNumber: newLog.modelNumber,
        lineId: newLog.type === 'sewing' ? newLog.lineId : null,
        amount: Number(newLog.amount),
        unit: selectedMachine.unit,
        notes: newLog.notes,
        createdAt: serverTimestamp()
      });
      
      setShowAddForm(false);
      setNewLog({ ...newLog, modelNumber: '', amount: '', notes: '', lineId: '' });
      fetchLogs();
    } catch (err) {
      console.error("Error adding log:", err);
      alert("حدث خطأ أثناء إضافة السجل.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10" dir="rtl">
      
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border-r-4 border-purple-500">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <BarChart3 className="text-purple-600" /> إدارة الإنتاجيات اليومية
          </h1>
          <p className="text-gray-500 mt-1">تتبع أمتار الطباعة والقص وإنتاجية خطوط التقفيل</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 transition shadow-md"
        >
          <PlusCircle size={20} /> إضافة إنتاجية جديدة
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-purple-100 animate-fade-in">
          <h2 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2">تسجيل إنتاجية يومية</h2>
          <form onSubmit={handleAddLog} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
            
            <div className="lg:col-span-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">التاريخ</label>
              <input 
                type="date" 
                required
                value={newLog.date} 
                onChange={(e) => setNewLog({...newLog, date: e.target.value})}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
            
            <div className="lg:col-span-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">الماكينة / الخط</label>
              <select 
                value={newLog.type} 
                onChange={(e) => setNewLog({...newLog, type: e.target.value})}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              >
                {MACHINE_TYPES.map(m => (
                  <option key={m.id} value={m.id}>{m.icon} {m.name}</option>
                ))}
              </select>
            </div>

            {newLog.type === 'sewing' && (
              <div className="lg:col-span-1">
                <label className="block text-sm font-bold text-gray-700 mb-2">رقم الخط</label>
                <select 
                  value={newLog.lineId || ''} 
                  onChange={(e) => setNewLog({...newLog, lineId: e.target.value})}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  <option value="">-- عام --</option>
                  <option value="line_1">خط هبة</option>
                  <option value="line_2">خط فرج</option>
                  <option value="line_3">خط كريم</option>
                  <option value="line_4">خط عبده</option>
                </select>
              </div>
            )}

            <div className="lg:col-span-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">رقم الموديل</label>
              <input 
                type="text" 
                required
                placeholder="رقم الموديل"
                value={newLog.modelNumber} 
                onChange={(e) => setNewLog({...newLog, modelNumber: e.target.value})}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>

            <div className="lg:col-span-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                الكمية ({MACHINE_TYPES.find(m => m.id === newLog.type)?.unit})
              </label>
              <input 
                type="number" 
                required
                min="0"
                step="0.01"
                placeholder="مثال: 500"
                value={newLog.amount} 
                onChange={(e) => setNewLog({...newLog, amount: e.target.value})}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-bold text-purple-700"
              />
            </div>

            <div className="lg:col-span-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">ملاحظات (اختياري)</label>
              <input 
                type="text" 
                placeholder="أعطال..."
                value={newLog.notes} 
                onChange={(e) => setNewLog({...newLog, notes: e.target.value})}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>

            <div className="lg:col-span-1">
              <button type="submit" className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition shadow">
                <Save size={18} /> حفظ السجل
              </button>
            </div>

          </form>
        </div>
      )}

      {/* Analytics Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {MACHINE_TYPES.map(machine => {
          // Calculate total for this machine in the logs
          const machineLogs = logs.filter(l => l.type === machine.id);
          const total = machineLogs.reduce((sum, l) => sum + l.amount, 0);
          
          return (
            <div key={machine.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <span className="text-3xl">{machine.icon}</span>
                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">{machine.unit}</span>
              </div>
              <div>
                <p className="text-gray-500 text-sm font-bold">{machine.name}</p>
                <p className="text-3xl font-black text-gray-800 mt-1">{total.toLocaleString()} <span className="text-sm text-gray-400 font-normal">{machine.unit}</span></p>
              </div>
              
              {machine.id === 'sewing' && (
                <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                  <div className="flex justify-between text-gray-500"><span>خط 1:</span> <span className="font-bold text-gray-800">{machineLogs.filter(l => l.lineId === 'line_1').reduce((s, l) => s + l.amount, 0).toLocaleString()}</span></div>
                  <div className="flex justify-between text-gray-500"><span>خط 2:</span> <span className="font-bold text-gray-800">{machineLogs.filter(l => l.lineId === 'line_2').reduce((s, l) => s + l.amount, 0).toLocaleString()}</span></div>
                  <div className="flex justify-between text-gray-500"><span>خط 3:</span> <span className="font-bold text-gray-800">{machineLogs.filter(l => l.lineId === 'line_3').reduce((s, l) => s + l.amount, 0).toLocaleString()}</span></div>
                  <div className="flex justify-between text-gray-500"><span>خط 4:</span> <span className="font-bold text-gray-800">{machineLogs.filter(l => l.lineId === 'line_4').reduce((s, l) => s + l.amount, 0).toLocaleString()}</span></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b flex items-center gap-2">
          <Calendar className="text-gray-500" size={20} /> 
          <h2 className="font-bold text-gray-700">سجل الإنتاجيات الأخير</h2>
        </div>
        
        {loading ? (
          <div className="p-10 text-center text-gray-500 font-bold">جاري تحميل السجلات...</div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-gray-400">لا توجد سجلات إنتاجية حتى الآن.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-gray-100 text-gray-600 text-sm">
                <tr>
                  <th className="p-4 font-bold">التاريخ</th>
                  <th className="p-4 font-bold">الماكينة / الخط</th>
                  <th className="p-4 font-bold">الموديل</th>
                  <th className="p-4 font-bold">الإنتاجية</th>
                  <th className="p-4 font-bold">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map(log => {
                  const machine = MACHINE_TYPES.find(m => m.id === log.type);
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 transition">
                      <td className="p-4 text-gray-800 font-medium">{log.date}</td>
                      <td className="p-4 text-gray-800 flex items-center gap-2">
                        <span>{machine?.icon}</span> 
                        {machine?.name}
                        {log.lineId && (
                          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full mr-2">
                            {log.lineId.replace('line_', 'خط ')}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-blue-700 font-bold">{log.modelNumber || '---'}</td>
                      <td className="p-4 text-purple-700 font-bold">
                        {log.amount.toLocaleString()} {log.unit}
                      </td>
                      <td className="p-4 text-gray-500 text-sm">{log.notes || '---'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
