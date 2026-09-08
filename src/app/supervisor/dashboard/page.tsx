"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { Users, Camera, AlertTriangle, ArrowDown, Clock } from 'lucide-react';
// تمت إزالة الاستيرادات غير المستخدمة مؤقتاً لحل مشكلة eslint

// تعريف خطوط الإنتاج والعمال (في بيئة حقيقية يتم جلبهم من قاعدة البيانات)
const LINES = [
  { id: 'line_1', name: 'خط تقفيل 1' },
  { id: 'line_2', name: 'خط تقفيل 2' },
  { id: 'line_3', name: 'خط تقفيل 3' },
  { id: 'line_4', name: 'خط تقفيل 4' },
];

const MOCK_WORKERS = [
  { id: 'w1', name: 'سيد محمد', machine: 'سنجر', color: 'bg-purple-100 border-purple-400' },
  { id: 'w2', name: 'أحمد علي', machine: 'أوفر', color: 'bg-blue-100 border-blue-400' },
  { id: 'w3', name: 'محمود حسين', machine: 'أورليه', color: 'bg-green-100 border-green-400' },
  { id: 'w4', name: 'كريم مصطفى', machine: 'أوفر', color: 'bg-blue-100 border-blue-400' },
  { id: 'w5', name: 'عادل إمام', machine: 'عراوي', color: 'bg-orange-100 border-orange-400' },
  { id: 'w6', name: 'محمد صبحي', machine: 'سنجر', color: 'bg-purple-100 border-purple-400' },
];

export default function SupervisorDashboard() {
  const [selectedLine, setSelectedLine] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [inboxBaskets, setInboxBaskets] = useState<any[]>([]);
  const [workerBaskets, setWorkerBaskets] = useState<Record<string, any>>({});
  
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [scannedData, setScannedData] = useState<string | null>(null);

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedLine && supervisorName.trim() && pin === '1234') { // PIN تجريبي
      setIsAuthenticated(true);
      fetchInbox();
    } else if (pin !== '1234') {
      alert('الرقم السري غير صحيح');
    } else {
      alert('يرجى اختيار الخط وكتابة الاسم');
    }
  };

  // Fetch Baskets assigned to this line
  const fetchInbox = async () => {
    try {
      const q = query(
        collection(db, 'factory_production_orders'), 
        where('currentLocation', '==', selectedLine)
      );
      const snapshot = await getDocs(q);
      const baskets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInboxBaskets(baskets.filter(b => !b.assignedWorker)); // Only unassigned
      
      // Load assigned baskets
      const assigned = baskets.filter(b => b.assignedWorker);
      const workerMap: Record<string, any> = {};
      assigned.forEach(b => {
        workerMap[b.assignedWorker] = b;
      });
      setWorkerBaskets(workerMap);
    } catch (err) {
      console.error(err);
    }
  };

  // Setup Scanner
  useEffect(() => {
    if (isScannerOpen) {
      const scanner = new Html5QrcodeScanner(
        "supervisor-reader",
        { fps: 10, qrbox: { width: 250, height: 250 }, supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA] },
        false
      );

      scanner.render(
        (decodedText) => {
          setScannedData(decodedText);
          scanner.clear();
          setIsScannerOpen(false);
          handleReceiveScannedBasket(decodedText);
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        (err) => { /* ignore */ }
      );

      return () => { scanner.clear().catch(console.error); };
    }
  }, [isScannerOpen]);

  // Handle Receiving a Basket into Inbox
  const handleReceiveScannedBasket = async (bundleCode: string) => {
    try {
      const q = query(collection(db, 'factory_production_orders'), where('bundleCode', '==', bundleCode));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        alert('لم يتم العثور على أمر الشغل!');
        return;
      }
      
      const docRef = snapshot.docs[0].ref;
      const docData = snapshot.docs[0].data();

      // Assign to this line's inbox
      await updateDoc(docRef, {
        currentLocation: selectedLine,
        assignedWorker: null, // Clear worker assignment if it had one
        stageEnteredAt: new Date().toISOString(),
        history: arrayUnion({
          stageName: `استلام المشرف (${supervisorName}) - ${LINES.find(l => l.id === selectedLine)?.name || selectedLine}`,
          timestamp: new Date().toISOString()
        })
      });

      alert(`تم استلام سلة الموديل ${docData.modelNumber} بنجاح!`);
      fetchInbox();
      setScannedData(null);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الاستلام.');
    }
  };

  // Mock Assign logic (Drag & Drop or Click)
  const handleAssignToWorker = async (basketId: string, workerId: string) => {
    try {
      await updateDoc(doc(db, 'factory_production_orders', basketId), {
        assignedWorker: workerId,
        assignedAt: new Date().toISOString()
      });
      fetchInbox();
    } catch (err) {
      console.error(err);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-xl shadow-lg text-center">
        <Users className="mx-auto text-blue-600 mb-4" size={48} />
        <h2 className="text-2xl font-bold mb-6 text-gray-800">بوابة الدخول للمشرفين</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <select 
              required
              className="w-full p-3 border border-gray-300 rounded-lg text-right"
              value={selectedLine}
              onChange={e => setSelectedLine(e.target.value)}
            >
              <option value="">-- اختر الخط --</option>
              {LINES.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <input 
              type="text" 
              required
              placeholder="اسم المشرف"
              className="w-full p-3 border border-gray-300 rounded-lg text-right"
              value={supervisorName}
              onChange={e => setSupervisorName(e.target.value)}
            />
          </div>
          <div>
            <input 
              type="password" 
              required
              placeholder="الرقم السري (PIN)"
              className="w-full p-3 border border-gray-300 rounded-lg text-center tracking-widest text-lg"
              value={pin}
              onChange={e => setPin(e.target.value)}
            />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700">
            دخول للوحة التوزيع
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      
      {/* Header & Inbox */}
      <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-gray-800">
        <div className="flex justify-between items-center mb-4 border-b pb-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             لوحة تحكم {LINES.find(l => l.id === selectedLine)?.name} <span className="text-sm text-gray-500 font-normal mr-2">(إشراف: {supervisorName})</span>
          </h1>
          <button 
            onClick={() => setIsScannerOpen(!isScannerOpen)}
            className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"
          >
            <Camera size={20} /> استلام شغل جديد (Scan)
          </button>
        </div>

        {isScannerOpen && (
          <div className="mb-6 p-4 bg-gray-50 border rounded-lg">
            <div id="supervisor-reader" width="100%"></div>
          </div>
        )}

        <h3 className="font-bold text-gray-600 mb-3 flex items-center gap-2">
          <ArrowDown /> صندوق الوارد (قيد التوزيع)
        </h3>
        
        <div className="flex flex-wrap gap-3 min-h-[80px] bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300">
          {inboxBaskets.length === 0 ? (
            <p className="text-gray-400 w-full text-center py-4 font-medium">لا توجد سلات في الانتظار</p>
          ) : (
            inboxBaskets.map(basket => (
              <div key={basket.id} className="bg-white border-2 border-gray-300 p-3 rounded-lg shadow-sm cursor-grab active:cursor-grabbing w-40 text-center relative hover:border-blue-500 transition">
                <div className="text-xs text-gray-500 mb-1">{basket.bundleCode}</div>
                <div className="font-black text-lg text-blue-700">{basket.modelNumber}</div>
                <div className="text-sm font-bold mt-1 bg-gray-100 rounded-full">{basket.totalQuantity} قطعة</div>
                
                {/* Mock Assignment Dropdown for Demo purposes without Drag&Drop library */}
                <select 
                  className="mt-2 text-xs w-full p-1 border rounded"
                  onChange={(e) => handleAssignToWorker(basket.id, e.target.value)}
                  defaultValue=""
                >
                  <option value="" disabled>توزيع لـ...</option>
                  {MOCK_WORKERS.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Workers Grid */}
      <h3 className="font-bold text-gray-800 text-xl flex items-center gap-2">
        <Users className="text-blue-600" /> شبكة المكن والعمال
      </h3>
      
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {MOCK_WORKERS.map(worker => {
          const activeBasket = workerBaskets[worker.id];
          
          // محاكاة تحذير التكدس (تضيء باللون الأحمر إذا كان هناك سلة منذ مدة طويلة)
          // في الكود الحقيقي، سيتم استخدام calculateNetWorkingTime(activeBasket.assignedAt) > 1 hours
          const isBottleneck = activeBasket && false; // Change logic as needed

          return (
            <div 
              key={worker.id} 
              className={`relative border-2 rounded-xl p-4 flex flex-col transition-all duration-300 ${worker.color} ${isBottleneck ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse' : 'shadow-sm'}`}
            >
              {isBottleneck && (
                <div className="absolute -top-3 -right-3 bg-red-500 text-white p-1.5 rounded-full shadow-lg">
                  <AlertTriangle size={16} />
                </div>
              )}
              
              <div className="flex justify-between items-start mb-2 border-b border-black/10 pb-2">
                <span className="font-black text-gray-800 text-lg">{worker.name}</span>
                <span className="text-xs font-bold bg-white/60 px-2 py-1 rounded-full text-gray-700">{worker.machine}</span>
              </div>

              {activeBasket ? (
                <div className="bg-white/80 p-3 rounded-lg flex-1 border border-black/5 flex flex-col justify-center items-center">
                   <div className="text-xs text-gray-500">جاري العمل على</div>
                   <div className="font-black text-xl text-gray-800">{activeBasket.modelNumber}</div>
                   <div className="font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full mt-1">
                     {activeBasket.totalQuantity} قطعة
                   </div>
                   
                   {/* وقت العمل المباشر */}
                   <div className="mt-3 text-xs font-bold flex items-center gap-1 text-gray-600">
                     <Clock size={12} />
                     منذ 15 دقيقة
                   </div>
                   
                   {/* زر إنهاء أو سحب */}
                   <button 
                     onClick={() => handleAssignToWorker(activeBasket.id, '')} 
                     className="mt-3 text-xs text-red-600 hover:underline font-bold"
                   >
                     سحب السلة (إنهاء)
                   </button>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center min-h-[120px]">
                  <span className="text-gray-400 font-bold">المكنة فارغة</span>
                </div>
              )}
              
            </div>
          );
        })}
      </div>

    </div>
  );
}
