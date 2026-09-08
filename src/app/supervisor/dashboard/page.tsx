"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, getDoc, setDoc } from 'firebase/firestore';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { Users, Camera, ArrowDown, Clock, Edit2, Check, ArrowUp, ArrowDown as ArrowDownIcon, Trash2, Plus, X } from 'lucide-react';

const LINES = [
  { id: 'line_1', name: 'خط تقفيل 1' },
  { id: 'line_2', name: 'خط تقفيل 2' },
  { id: 'line_3', name: 'خط تقفيل 3' },
  { id: 'line_4', name: 'خط تقفيل 4' },
];

const MACHINE_COLORS: Record<string, string> = {
  'سنجر': 'bg-purple-100 text-purple-800 border-purple-200',
  'أوفر': 'bg-blue-100 text-blue-800 border-blue-200',
  'أورليه': 'bg-green-100 text-green-800 border-green-200',
  'عراوي': 'bg-orange-100 text-orange-800 border-orange-200',
  'أخرى': 'bg-gray-100 text-gray-800 border-gray-200',
};
const MACHINE_TYPES = Object.keys(MACHINE_COLORS);

type WorkerTask = {
  orderId: string;
  modelNumber: string;
  color: string;
  operation: string;
  quantity: number;
  assignedAt: string;
};

type Worker = {
  id: string;
  name: string;
  machine: string;
  order: number;
  activeTask?: WorkerTask | null;
};

export default function SupervisorDashboard() {
  const [selectedLine, setSelectedLine] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isEditingLine, setIsEditingLine] = useState(false);

  const [inboxBaskets, setInboxBaskets] = useState<any[]>([]);
  
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  // Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedOrderForAssign, setSelectedOrderForAssign] = useState<any>(null);
  const [assignWorkerId, setAssignWorkerId] = useState('');
  const [assignColor, setAssignColor] = useState('');
  const [assignOperation, setAssignOperation] = useState('');
  const [assignQuantity, setAssignQuantity] = useState(0);

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedLine && supervisorName.trim() && pin === '0258') {
      setIsAuthenticated(true);
      fetchLineConfig(selectedLine);
      fetchInbox(selectedLine);
    } else if (pin !== '0258') {
      alert('الرقم السري غير صحيح');
    } else {
      alert('يرجى اختيار الخط وكتابة الاسم');
    }
  };

  const fetchLineConfig = async (lineId: string) => {
    try {
      const docRef = doc(db, 'factory_line_configs', lineId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setWorkers(snap.data().workers || []);
      } else {
        setWorkers([]);
      }
    } catch(err) {
      console.error("Error fetching line config", err);
    }
  };

  const saveLineConfig = async (newWorkers: Worker[]) => {
    try {
      setWorkers(newWorkers);
      await setDoc(doc(db, 'factory_line_configs', selectedLine), { workers: newWorkers }, { merge: true });
    } catch(err) {
      console.error(err);
      alert("حدث خطأ أثناء حفظ الإعدادات");
    }
  };

  const handleAddWorker = () => {
    const newWorker = { id: `w_${Date.now()}`, name: 'اسم العامل', machine: 'سنجر', order: workers.length, activeTask: null };
    saveLineConfig([...workers, newWorker]);
  };

  const handleRemoveWorker = (id: string) => {
    if(!confirm("تأكيد حذف هذه الماكينة/العامل؟")) return;
    saveLineConfig(workers.filter(w => w.id !== id));
  };

  const moveWorker = (index: number, direction: 'up'|'down') => {
    const newWorkers = [...workers];
    if (direction === 'up' && index > 0) {
      [newWorkers[index - 1], newWorkers[index]] = [newWorkers[index], newWorkers[index - 1]];
    } else if (direction === 'down' && index < workers.length - 1) {
      [newWorkers[index + 1], newWorkers[index]] = [newWorkers[index], newWorkers[index + 1]];
    }
    saveLineConfig(newWorkers);
  };

  const fetchInbox = async (lineId: string) => {
    try {
      const q = query(collection(db, 'factory_production_orders'), where('currentLocation', '==', lineId));
      const snapshot = await getDocs(q);
      const baskets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInboxBaskets(baskets); 
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isScannerOpen) {
      const scanner = new Html5QrcodeScanner("supervisor-reader", { fps: 10, qrbox: { width: 250, height: 250 }, supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA] }, false);
      scanner.render(
        (decodedText) => {
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

  const handleReceiveScannedBasket = async (decodedText: string) => {
    try {
      const cleanCode = decodedText.trim();
      let docRefToUpdate = null;
      let docData: any = null;

      if (cleanCode.includes('/public/order/')) {
        const urlParts = cleanCode.split('/public/order/');
        const docId = urlParts[urlParts.length - 1];
        
        const docRef = doc(db, 'factory_production_orders', docId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
           docRefToUpdate = docRef;
           docData = snap.data();
           if (!docData.bundleCode) docData.bundleCode = `أمر كامل-${docId.slice(-4)}`;
           if (!docData.modelNumber) docData.modelNumber = docData.modelName; 
        }
      } else {
        const q = query(collection(db, 'factory_production_orders'), where('bundleCode', '==', cleanCode));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          docRefToUpdate = snapshot.docs[0].ref;
          docData = snapshot.docs[0].data();
        }
      }

      if (!docRefToUpdate || !docData) {
        alert(`لم يتم العثور على أمر الشغل! (المقروء: ${cleanCode})`);
        return;
      }
      
      await updateDoc(docRefToUpdate, {
        currentLocation: selectedLine,
        currentStage: 10, // 10 is 'قسم المكن'
        stageEnteredAt: new Date().toISOString(),
        history: arrayUnion({
          stageName: `استلام المشرف (${supervisorName}) - ${LINES.find(l => l.id === selectedLine)?.name || selectedLine}`,
          timestamp: new Date().toISOString()
        })
      });

      alert(`تم استلام الموديل ${docData.modelNumber} بنجاح!`);
      fetchInbox(selectedLine);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الاستلام.');
    }
  };

  const openAssignModal = (order: any) => {
    setSelectedOrderForAssign(order);
    setAssignColor('');
    setAssignOperation('');
    setAssignQuantity(order.totalQuantity || 0);
    setAssignWorkerId('');
    setIsAssignModalOpen(true);
  };

  const getAvailableColors = (order: any) => {
    if (order.colorPairs && order.colorPairs.length > 0) {
      const options: string[] = [];
      order.colorPairs.filter((p:any) => p.quantity).forEach((p:any) => {
        if (p.tshirt) options.push(`تيشيرت ${p.tshirt} (${p.quantity} قطعة)`);
        if (p.pants) options.push(`بنطلون ${p.pants} (${p.quantity} قطعة)`);
      });
      return options;
    }
    if (order.color && order.color !== 'متعدد') return [order.color];
    return [];
  };

  const handleColorChange = (val: string) => {
    setAssignColor(val);
    const match = val.match(/\\((\\d+)\\s*قطعة\\)/);
    if (match && match[1]) {
      setAssignQuantity(parseInt(match[1]));
    }
  };

  const confirmAssignment = async () => {
    if (!assignWorkerId || !assignOperation || !assignQuantity) {
      alert("يرجى إكمال البيانات (العامل، العملية، الكمية)");
      return;
    }
    const workerIndex = workers.findIndex(w => w.id === assignWorkerId);
    if (workerIndex === -1) return;

    if (workers[workerIndex].activeTask) {
      if (!confirm("هذا العامل لديه مهمة حالية، هل تريد استبدالها؟")) return;
    }

    const newWorkers = [...workers];
    newWorkers[workerIndex].activeTask = {
      orderId: selectedOrderForAssign.id,
      modelNumber: selectedOrderForAssign.modelNumber || selectedOrderForAssign.modelName,
      color: assignColor || 'بدون تحديد',
      operation: assignOperation,
      quantity: Number(assignQuantity),
      assignedAt: new Date().toISOString()
    };

    await saveLineConfig(newWorkers);
    setIsAssignModalOpen(false);
  };

  const handleEndTask = async (workerId: string) => {
    const workerIndex = workers.findIndex(w => w.id === workerId);
    const worker = workers[workerIndex];
    if (!worker || !worker.activeTask) return;

    if(!confirm("تأكيد انتهاء العامل من هذه المهمة؟")) return;

    try {
      const task = worker.activeTask;
      
      // 1. Update the order history
      await updateDoc(doc(db, 'factory_production_orders', task.orderId), {
        history: arrayUnion({
          stageName: `تشغيل: ${worker.machine} (${worker.name}) - ${task.operation} - ${task.color}`,
          quantity: task.quantity,
          startTime: task.assignedAt,
          endTime: new Date().toISOString()
        })
      });

      // 2. Automatically log productivity
      await setDoc(doc(collection(db, 'factory_productivity_logs')), {
        date: new Date().toISOString().split('T')[0],
        type: 'sewing',
        modelNumber: task.modelNumber,
        lineId: selectedLine,
        amount: task.quantity,
        unit: 'قطعة',
        notes: `تسجيل آلي: ${worker.name} (${worker.machine}) - ${task.operation}`,
        createdAt: new Date().toISOString()
      });

      // 3. Clear activeTask
      const newWorkers = [...workers];
      newWorkers[workerIndex].activeTask = null;
      await saveLineConfig(newWorkers);

    } catch (err) {
      console.error(err);
    }
  };

  const handleArchiveOrder = async (orderId: string) => {
    if(!confirm("هل أنت متأكد من إنهاء هذا الموديل بالكامل من خطك وإخفائه من صندوق الوارد؟")) return;
    try {
      await updateDoc(doc(db, 'factory_production_orders', orderId), {
        currentLocation: 'done',
        currentStage: 11 // 11 is 'قسم التشطيب'
      });
      fetchInbox(selectedLine);
    } catch(err) {
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
            <select required className="w-full p-3 border border-gray-300 rounded-lg text-right" value={selectedLine} onChange={e => setSelectedLine(e.target.value)}>
              <option value="">-- اختر الخط --</option>
              {LINES.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <input type="text" required placeholder="اسم المشرف" className="w-full p-3 border border-gray-300 rounded-lg text-right" value={supervisorName} onChange={e => setSupervisorName(e.target.value)} />
          </div>
          <div>
            <input type="password" required placeholder="الرقم السري (PIN)" className="w-full p-3 border border-gray-300 rounded-lg text-center tracking-widest text-lg" value={pin} onChange={e => setPin(e.target.value)} />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700">
            دخول للوحة التوزيع
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 relative">
      
      {/* Assign Modal */}
      {isAssignModalOpen && selectedOrderForAssign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
            <button onClick={() => setIsAssignModalOpen(false)} className="absolute top-4 left-4 text-gray-400 hover:text-gray-800">
              <X size={24} />
            </button>
            <h2 className="text-xl font-bold mb-4 border-b pb-2">توزيع مهمة للموديل: {selectedOrderForAssign.modelNumber || selectedOrderForAssign.modelName}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">اختيار الماكينة/العامل *</label>
                <select className="w-full p-2 border border-gray-300 rounded-lg" value={assignWorkerId} onChange={e => setAssignWorkerId(e.target.value)}>
                  <option value="" disabled>-- اختر العامل --</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.name} ({w.machine})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">اللون / الصنف (اختياري)</label>
                <select className="w-full p-2 border border-gray-300 rounded-lg" value={assignColor} onChange={e => handleColorChange(e.target.value)}>
                  <option value="">بدون تحديد</option>
                  {getAvailableColors(selectedOrderForAssign).map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">العملية المطلوبة (مثل: تركيب كم، أوفر جيوب) *</label>
                <input type="text" className="w-full p-2 border border-gray-300 rounded-lg" placeholder="اكتب العملية..." value={assignOperation} onChange={e => setAssignOperation(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الكمية *</label>
                <input type="number" className="w-full p-2 border border-gray-300 rounded-lg font-bold text-blue-700" value={assignQuantity} onChange={e => setAssignQuantity(Number(e.target.value))} />
              </div>

              <button onClick={confirmAssignment} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 mt-4">
                تأكيد التوزيع وإرسال المهمة للعامل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header & Inbox */}
      <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-gray-800">
        <div className="flex justify-between items-center mb-4 border-b pb-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             لوحة تحكم {LINES.find(l => l.id === selectedLine)?.name} <span className="text-sm text-gray-500 font-normal mr-2">(إشراف: {supervisorName})</span>
          </h1>
          <button onClick={() => setIsScannerOpen(!isScannerOpen)} className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-900 transition shadow">
            <Camera size={20} /> استلام موديل جديد للمكن (Scan)
          </button>
        </div>

        {isScannerOpen && (
          <div className="mb-6 p-4 bg-gray-50 border rounded-lg">
            <div id="supervisor-reader" width="100%"></div>
          </div>
        )}

        <h3 className="font-bold text-gray-600 mb-3 flex items-center gap-2">
          <ArrowDown /> الموديلات المفتوحة على الخط (صندوق الوارد)
        </h3>
        
        <div className="flex flex-wrap gap-4 min-h-[80px] bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300">
          {inboxBaskets.length === 0 ? (
            <p className="text-gray-400 w-full text-center py-4 font-medium">لا يوجد موديلات في الانتظار</p>
          ) : (
            inboxBaskets.map(basket => (
              <div key={basket.id} className="bg-white border-2 border-gray-300 p-4 rounded-lg shadow-sm w-56 text-center relative hover:border-blue-500 transition">
                <button onClick={() => handleArchiveOrder(basket.id)} className="absolute top-2 left-2 text-red-400 hover:text-red-600 bg-red-50 rounded-full p-1" title="إنهاء الموديل بالكامل">
                  <X size={16} />
                </button>
                <div className="text-xs text-gray-500 mb-1">{basket.bundleCode}</div>
                <div className="font-black text-xl text-blue-800 mb-1">{basket.modelNumber || basket.modelName}</div>
                <div className="text-sm font-bold bg-gray-100 rounded-full py-1 border shadow-inner mb-3">{basket.totalQuantity} قطعة كلياً</div>
                
                <button onClick={() => openAssignModal(basket)} className="w-full bg-gray-800 text-white font-bold py-2 rounded-lg text-sm hover:bg-gray-900 shadow">
                  توزيع مهمة لـ عامل...
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Workers Grid */}
      <div className="flex justify-between items-center mb-2 mt-8">
        <h3 className="font-bold text-gray-800 text-xl flex items-center gap-2">
          <Users className="text-blue-600" /> شبكة المكن والعمال (عمودين)
        </h3>
        <div className="flex gap-2">
          <button onClick={() => setIsEditingLine(!isEditingLine)} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm ${isEditingLine ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 border border-gray-300'}`}>
            {isEditingLine ? <><Check size={16}/> إنهاء التعديل والحفظ</> : <><Edit2 size={16}/> تعديل ترتيب المكن</>}
          </button>
          {isEditingLine && (
            <button onClick={handleAddWorker} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm shadow">
              <Plus size={16}/> إضافة ماكينة
            </button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {workers.length === 0 ? (
          <div className="col-span-2 text-center text-gray-500 py-10 bg-white rounded-xl border-2 border-dashed">
            لا توجد ماكينات على هذا الخط. اضغط على (تعديل ترتيب المكن) لإضافة العمال.
          </div>
        ) : workers.map((worker, index) => {
          const activeTask = worker.activeTask;

          return (
            <div key={worker.id} className={`relative border-2 rounded-xl p-4 flex flex-col transition-all duration-300 ${MACHINE_COLORS[worker.machine] ? MACHINE_COLORS[worker.machine].replace('text-', 'text-opacity-0 ').replace('bg-', 'bg-opacity-20 bg-') : 'bg-white'} border-gray-300 shadow-sm`}>
              
              {isEditingLine && (
                <div className="absolute -right-4 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-10">
                  <button onClick={() => moveWorker(index, 'up')} className="bg-white p-1 rounded-full shadow border hover:bg-gray-100 text-gray-600"><ArrowUp size={16}/></button>
                  <button onClick={() => moveWorker(index, 'down')} className="bg-white p-1 rounded-full shadow border hover:bg-gray-100 text-gray-600"><ArrowDownIcon size={16}/></button>
                </div>
              )}

              {isEditingLine && (
                <div className="absolute -left-3 -top-3 z-10">
                  <button onClick={() => handleRemoveWorker(worker.id)} className="bg-red-500 p-1.5 rounded-full shadow-lg text-white hover:bg-red-600"><Trash2 size={14}/></button>
                </div>
              )}

              <div className="flex justify-between items-start mb-2 border-b border-gray-300 pb-2">
                {isEditingLine ? (
                  <input type="text" value={worker.name} onChange={e => {
                    const newW = [...workers]; newW[index].name = e.target.value; saveLineConfig(newW);
                  }} className="font-black text-gray-800 text-lg border-b border-dashed border-gray-400 bg-transparent outline-none w-1/2" placeholder="اسم العامل" />
                ) : (
                  <span className="font-black text-gray-800 text-lg">{worker.name}</span>
                )}

                {isEditingLine ? (
                  <select value={worker.machine} onChange={e => {
                    const newW = [...workers]; newW[index].machine = e.target.value; saveLineConfig(newW);
                  }} className={`text-xs font-bold border px-2 py-1 rounded-full outline-none w-1/3 text-center appearance-none cursor-pointer ${MACHINE_COLORS[worker.machine] || MACHINE_COLORS['أخرى']}`}>
                    {MACHINE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                ) : (
                  <span className={`text-xs font-bold border shadow-sm px-2 py-1 rounded-full ${MACHINE_COLORS[worker.machine] || MACHINE_COLORS['أخرى']}`}>{worker.machine}</span>
                )}
              </div>

              {activeTask ? (
                <div className="bg-blue-50 p-3 rounded-lg flex-1 border border-blue-200 flex flex-col justify-center items-center relative shadow-inner">
                   <div className="text-xs text-blue-500 font-bold mb-1 border-b border-blue-200 w-full text-center pb-1">جاري العمل على</div>
                   
                   <div className="font-black text-2xl text-blue-900 leading-none mb-1">{activeTask.modelNumber}</div>
                   <div className="text-sm font-bold text-indigo-700 bg-indigo-100 px-3 py-1 rounded-full mb-1 border border-indigo-200">
                     {activeTask.operation}
                   </div>
                   
                   {activeTask.color && activeTask.color !== 'بدون تحديد' && (
                     <div className="text-xs font-bold text-gray-600 bg-white px-2 py-1 rounded border shadow-sm mb-1 max-w-[90%] text-center truncate">
                       {activeTask.color}
                     </div>
                   )}
                   
                   <div className="font-black text-blue-700 bg-white px-4 py-1.5 rounded-lg mt-1 border border-blue-300 shadow-sm">
                     {activeTask.quantity} قطعة
                   </div>
                   
                   <div className="mt-3 text-xs font-bold flex items-center gap-1 text-gray-500 bg-white px-2 py-1 rounded shadow-sm">
                     <Clock size={12} className="text-orange-500" />
                     بدأ: {new Date(activeTask.assignedAt).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}
                   </div>
                   
                   {!isEditingLine && (
                     <button onClick={() => handleEndTask(worker.id)} className="mt-3 w-full bg-white text-red-600 border border-red-200 hover:bg-red-500 hover:text-white hover:border-red-500 py-2 rounded-lg text-sm font-black transition shadow-sm">
                       نهاية القماش (إنهاء المهمة)
                     </button>
                   )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center min-h-[120px] bg-white rounded-lg border border-dashed border-gray-300 shadow-inner">
                  <span className="text-gray-400 font-bold">الماكينة فارغة (بانتظار مهمة)</span>
                </div>
              )}
              
            </div>
          );
        })}
      </div>

    </div>
  );
}
