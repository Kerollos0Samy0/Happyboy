"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, getDoc, setDoc } from 'firebase/firestore';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { Users, Camera, ArrowDown, Clock, Edit2, Check, ArrowUp, ArrowDown as ArrowDownIcon, Trash2, Plus, X, Play, Pause } from 'lucide-react';

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
  status?: 'assigned' | 'running' | 'paused';
  startedAt?: string | null;
  lastPauseTime?: string | null;
  totalPausedSeconds?: number;
};

type Worker = {
  id: string;
  name: string;
  machine: string;
  order: number;
  activeTask?: WorkerTask | null;
};

const LiveTimer = ({ task }: { task: WorkerTask }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!task.startedAt) return;
    
    // Initial calculation to prevent 1-sec delay
    const calculateElapsed = () => {
      const startMs = new Date(task.startedAt!).getTime();
      let currentElapsed = 0;
      if (task.status === 'paused' && task.lastPauseTime) {
         const pauseMs = new Date(task.lastPauseTime).getTime();
         currentElapsed = Math.floor((pauseMs - startMs) / 1000) - (task.totalPausedSeconds || 0);
      } else {
         const nowMs = new Date().getTime();
         currentElapsed = Math.floor((nowMs - startMs) / 1000) - (task.totalPausedSeconds || 0);
      }
      return currentElapsed > 0 ? currentElapsed : 0;
    };

    setElapsed(calculateElapsed());

    if (task.status === 'paused') return;

    const interval = setInterval(() => {
      setElapsed(calculateElapsed());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [task.startedAt, task.status, task.lastPauseTime, task.totalPausedSeconds]);

  if (!task.startedAt) return null;

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  
  const formatted = `${hours > 0 ? hours + ':' : ''}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className={`font-mono font-bold text-2xl ${task.status === 'paused' ? 'text-orange-500' : 'text-green-600'} transition-colors`}>
      {formatted} {task.status === 'paused' ? <span className="text-sm">⏸</span> : ''}
    </div>
  );
};

const DEFAULT_OPERATIONS = [
  "أوفر كتف", "تركيب كم", "تقفيل جنب", "تركيب كولا", "تركيب كابيشو", "شريط نظافة (للياقة)", "أورليه ديل", "أورليه كم", "تركيب أساور", "أوفر جيوب (تجهيز الجيب)", "تركيب جيب", "تركيب سوستة", "بنط عرض (سنجر)",
  "أوفر حجر", "تقفيل جنب (داخلي / خارجي)", "تركيب كمر", "تركيب أستك", "تركيب رباط", "أورليه رجل", "تجهيز جيوب جانبية", "تركيب جيب خلفي", "عراوي", "زراير", "فارماتورة", "كشكشة", "تركيب شريط زينة", "تنظيف خيوط سريعة على المكنة"
];

export default function SupervisorDashboard() {
  const [selectedLine, setSelectedLine] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isEditingLine, setIsEditingLine] = useState(false);

  const [inboxBaskets, setInboxBaskets] = useState<any[]>([]);
  
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedOrderForAssign, setSelectedOrderForAssign] = useState<any>(null);
  const [assignWorkerId, setAssignWorkerId] = useState('');
  const [assignColor, setAssignColor] = useState('');
  const [assignOperation, setAssignOperation] = useState('');
  const [showOpSuggestions, setShowOpSuggestions] = useState(false);
  const [assignQuantity, setAssignQuantity] = useState(0);

  const [savedOperations, setSavedOperations] = useState<string[]>(DEFAULT_OPERATIONS);

  // Receive Modal State
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [ordersToReceive, setOrdersToReceive] = useState<any[]>([]);
  const [receiveSelections, setReceiveSelections] = useState<Record<string, { selected: boolean, qty: number }>>({});

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
    const fetchOperations = async () => {
       try {
         const docRef = doc(db, 'factory_settings', 'operations_list');
         const snap = await getDoc(docRef);
         if (snap.exists()) {
            setSavedOperations(snap.data().operations || DEFAULT_OPERATIONS);
         }
       } catch (e) {
         console.error(e);
       }
    };
    fetchOperations();
  }, []);

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
      let toReceive: any[] = [];

      if (cleanCode.includes('/public/order/')) {
        const urlParts = cleanCode.split('/public/order/');
        const docId = urlParts[urlParts.length - 1];
        
        const docRef = doc(db, 'factory_production_orders', docId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
           const data = snap.data();
           
           if (data.isArchived && data.splitStatus === 'split_parent') {
             const qChildren = query(collection(db, 'factory_production_orders'), where('originalOrderId', '==', docId));
             const childSnaps = await getDocs(qChildren);
             if (!childSnaps.empty) {
                // filter out ones that are already done
                toReceive = childSnaps.docs.filter(d => d.data().currentLocation !== 'done').map(d => ({id: d.id, ...d.data()}));
             }
           } else {
             if (data.currentLocation !== 'done') {
                toReceive.push({id: docRef.id, ...data});
             }
           }
        }
      } else {
        const q = query(collection(db, 'factory_production_orders'), where('bundleCode', '==', cleanCode));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const data = snapshot.docs[0].data();
          if (data.currentLocation !== 'done') {
             toReceive.push({id: snapshot.docs[0].id, ...data});
          }
        }
      }

      if (toReceive.length === 0) {
        alert(`لم يتم العثور على أوامر متاحة للاستلام! قد يكون تم إنهاء الموديل. (المقروء: ${cleanCode})`);
        return;
      }
      
      const initialSelections: Record<string, {selected: boolean, qty: number}> = {};
      toReceive.forEach(o => {
         initialSelections[o.id] = { selected: true, qty: o.totalQuantity || 0 };
         if (!o.bundleCode) o.bundleCode = `أمر كامل-${o.id.slice(-4)}`;
         if (!o.modelNumber) o.modelNumber = o.modelName; 
      });

      setOrdersToReceive(toReceive);
      setReceiveSelections(initialSelections);
      setIsReceiveModalOpen(true);
      
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الاستلام.');
    }
  };

  const handleConfirmReceive = async () => {
    try {
      const promises = ordersToReceive.map(async (order) => {
         const sel = receiveSelections[order.id];
         if (sel && sel.selected) {
             return updateDoc(doc(db, 'factory_production_orders', order.id), {
               currentLocation: selectedLine,
               currentStage: 10,
               receivedQuantity: sel.qty,
               stageEnteredAt: new Date().toISOString(),
               history: arrayUnion({
                 stageName: `استلام المشرف (${supervisorName}) - ${LINES.find(l => l.id === selectedLine)?.name || selectedLine}`,
                 quantity: sel.qty,
                 timestamp: new Date().toISOString()
               })
             });
         }
         return Promise.resolve();
      });
      await Promise.all(promises);
      setIsReceiveModalOpen(false);
      setOrdersToReceive([]);
      alert('تم الاستلام وتحديث حركة المصنع بنجاح!');
      fetchInbox(selectedLine);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تأكيد الاستلام.');
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

    const opName = assignOperation.trim();
    if (!savedOperations.includes(opName)) {
      const newOps = [...savedOperations, opName];
      setSavedOperations(newOps);
      setDoc(doc(db, 'factory_settings', 'operations_list'), { operations: newOps }, { merge: true }).catch(console.error);
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
      assignedAt: new Date().toISOString(),
      status: 'assigned',
      totalPausedSeconds: 0
    };

    await saveLineConfig(newWorkers);
    setIsAssignModalOpen(false);
  };

  const handleStartTask = async (workerId: string) => {
    const workerIndex = workers.findIndex(w => w.id === workerId);
    if (workerIndex === -1 || !workers[workerIndex].activeTask) return;
    
    const task = workers[workerIndex].activeTask!;
    const newWorkers = [...workers];
    
    if (task.status === 'paused' && task.lastPauseTime) {
      const pauseDuration = (new Date().getTime() - new Date(task.lastPauseTime).getTime()) / 1000;
      newWorkers[workerIndex].activeTask!.totalPausedSeconds = (task.totalPausedSeconds || 0) + pauseDuration;
    } else if (task.status === 'assigned' || !task.status) {
      newWorkers[workerIndex].activeTask!.startedAt = new Date().toISOString();
    }
    
    newWorkers[workerIndex].activeTask!.status = 'running';
    newWorkers[workerIndex].activeTask!.lastPauseTime = null;
    
    await saveLineConfig(newWorkers);
  };

  const handlePauseTask = async (workerId: string) => {
    const workerIndex = workers.findIndex(w => w.id === workerId);
    if (workerIndex === -1 || !workers[workerIndex].activeTask) return;
    
    const newWorkers = [...workers];
    newWorkers[workerIndex].activeTask!.status = 'paused';
    newWorkers[workerIndex].activeTask!.lastPauseTime = new Date().toISOString();
    
    await saveLineConfig(newWorkers);
  };

  const handleEndTask = async (workerId: string) => {
    const workerIndex = workers.findIndex(w => w.id === workerId);
    const worker = workers[workerIndex];
    if (!worker || !worker.activeTask) return;

    if(!confirm("تأكيد انتهاء العامل من هذه المهمة؟")) return;

    try {
      const task = worker.activeTask;
      
      // Calculate effective duration if it was started
      let totalPausedStr = "";
      if (task.totalPausedSeconds && task.totalPausedSeconds > 60) {
         totalPausedStr = ` (توقف: ${Math.floor(task.totalPausedSeconds/60)} دقيقة)`;
      }

      const endTime = new Date().toISOString();
      let effectiveDurationSeconds = 0;
      if (task.startedAt) {
         const startMs = new Date(task.startedAt).getTime();
         const endMs = new Date(endTime).getTime();
         effectiveDurationSeconds = Math.floor((endMs - startMs) / 1000) - (task.totalPausedSeconds || 0);
         if (effectiveDurationSeconds < 0) effectiveDurationSeconds = 0;
      }

      await updateDoc(doc(db, 'factory_production_orders', task.orderId), {
        history: arrayUnion({
          stageName: `تشغيل: ${worker.machine} (${worker.name}) - ${task.operation} - ${task.color}${totalPausedStr}`,
          quantity: task.quantity,
          startTime: task.startedAt || task.assignedAt,
          endTime: endTime
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
        createdAt: new Date().toISOString(),
        // New details for reports
        workerId: worker.id,
        workerName: worker.name,
        machine: worker.machine,
        operation: task.operation,
        color: task.color,
        startTime: task.startedAt || task.assignedAt,
        endTime: endTime,
        totalPausedSeconds: task.totalPausedSeconds || 0,
        effectiveDurationSeconds: effectiveDurationSeconds
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
      
      {/* Receive Modal */}
      {isReceiveModalOpen && ordersToReceive.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
            <button onClick={() => setIsReceiveModalOpen(false)} className="absolute top-4 left-4 text-gray-400 hover:text-gray-800">
              <X size={24} />
            </button>
            <h2 className="text-xl font-bold mb-4 border-b pb-2">تأكيد استلام الموديل</h2>
            
            <p className="text-sm text-gray-500 mb-4">اختر الأجزاء التي استلمتها فعلياً وعدل الكميات إذا لزم الأمر:</p>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {ordersToReceive.map(order => (
                <div key={order.id} className={`flex flex-col gap-2 p-3 border-2 rounded-lg transition-all ${receiveSelections[order.id]?.selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                   <label className="flex items-center gap-3 font-bold text-gray-800 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={receiveSelections[order.id]?.selected} 
                        onChange={(e) => setReceiveSelections({...receiveSelections, [order.id]: {...receiveSelections[order.id], selected: e.target.checked}})} 
                        className="w-5 h-5 accent-blue-600" 
                      />
                      {order.modelName}
                   </label>
                   {receiveSelections[order.id]?.selected && (
                     <div className="flex items-center gap-2 pr-8 mt-1">
                       <span className="text-sm font-bold text-gray-600">الكمية المستلمة:</span>
                       <input 
                         type="number" 
                         value={receiveSelections[order.id]?.qty} 
                         onChange={(e) => setReceiveSelections({...receiveSelections, [order.id]: {...receiveSelections[order.id], qty: Number(e.target.value)}})} 
                         className="w-24 p-1.5 border border-blue-300 rounded text-blue-900 font-bold bg-white text-center focus:ring-2 focus:ring-blue-500 outline-none" 
                       />
                       <span className="text-xs text-gray-400 font-normal">من أصل {order.totalQuantity}</span>
                     </div>
                   )}
                </div>
              ))}
            </div>

            <button 
              onClick={handleConfirmReceive} 
              disabled={Object.values(receiveSelections).filter(s => s.selected).length === 0}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              تأكيد الاستلام
            </button>
          </div>
        </div>
      )}

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

              <div className="relative">
                <label className="block text-sm font-bold text-gray-700 mb-1">العملية المطلوبة (مثل: تركيب كم، أوفر جيوب) *</label>
                <input 
                  type="text" 
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="ابحث أو اكتب عملية جديدة..." 
                  value={assignOperation} 
                  onChange={e => {
                     setAssignOperation(e.target.value);
                     setShowOpSuggestions(true);
                  }}
                  onFocus={() => setShowOpSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowOpSuggestions(false), 200)}
                />
                {showOpSuggestions && (
                  <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
                    {savedOperations
                      .filter(op => op.replace(/[أإآا]/g, '').includes(assignOperation.replace(/[أإآا]/g, '')))
                      .map((op, idx) => (
                      <li 
                        key={idx} 
                        className="p-2 hover:bg-blue-50 cursor-pointer font-bold text-sm text-gray-800 border-b last:border-b-0"
                        onMouseDown={() => {
                          setAssignOperation(op);
                          setShowOpSuggestions(false);
                        }}
                      >
                        {op}
                      </li>
                    ))}
                    {assignOperation && savedOperations.filter(op => op.replace(/[أإآا]/g, '').includes(assignOperation.replace(/[أإآا]/g, ''))).length === 0 && (
                       <li className="p-2 text-gray-500 text-xs bg-gray-50 italic">سيتم إضافة "{assignOperation}" كعملية جديدة في القائمة</li>
                    )}
                  </ul>
                )}
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
                <div className="text-sm font-bold bg-gray-100 rounded-full py-1 border shadow-inner mb-3">
                  {basket.receivedQuantity !== undefined ? `${basket.receivedQuantity} قطعة (مستلمة)` : `${basket.totalQuantity} قطعة كلياً`}
                </div>
                
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
                   <div className={`text-xs font-bold mb-2 border-b w-full pb-1.5 flex items-center justify-center gap-2 
                     ${activeTask.status === 'running' ? 'text-green-600 border-green-200' : 
                       activeTask.status === 'paused' ? 'text-red-500 border-red-200' : 'text-yellow-600 border-yellow-200'}`}>
                     <span className="relative flex h-3 w-3">
                       {activeTask.status === 'running' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                       <span className={`relative inline-flex rounded-full h-3 w-3 ${activeTask.status === 'running' ? 'bg-green-500' : activeTask.status === 'paused' ? 'bg-red-500' : 'bg-yellow-400'}`}></span>
                     </span>
                     {!activeTask.status || activeTask.status === 'assigned' ? 'في الانتظار (لم يبدأ)' : activeTask.status === 'paused' ? 'متوقف مؤقتاً' : 'جاري العمل الآن'}
                   </div>
                   
                   <div className="flex justify-between items-center w-full px-2 mb-2">
                      <div className="flex flex-col items-start">
                        <span className="text-[10px] text-gray-500 font-bold">الموديل</span>
                        <span className="font-black text-xl text-blue-900 leading-none">{activeTask.modelNumber}</span>
                      </div>
                      <div className="text-sm font-bold text-indigo-700 bg-indigo-100 px-3 py-1 rounded-full border border-indigo-200 shadow-sm">
                        {activeTask.operation}
                      </div>
                   </div>
                   
                   <div className="flex justify-between items-center w-full px-2 mb-2 gap-2">
                      {activeTask.color && activeTask.color !== 'بدون تحديد' ? (
                        <div className="flex-1 text-xs font-bold text-gray-700 bg-white px-2 py-1.5 rounded border border-gray-200 shadow-sm text-right truncate" title={activeTask.color}>
                          {activeTask.color}
                        </div>
                      ) : <div className="flex-1"></div>}
                      
                      <div className="font-black text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm whitespace-nowrap">
                        {activeTask.quantity} قطعة
                      </div>
                   </div>
                   
                   <div className="mt-2 w-full">
                     <div className="text-xs font-bold flex flex-col items-center gap-1 text-gray-500 bg-white px-3 py-2 rounded shadow-sm w-full border border-gray-100 mb-2">
                       <div className="flex justify-between w-full border-b pb-1 mb-1">
                         <div className="flex items-center gap-1">
                           <Clock size={12} className="text-orange-500" />
                           توزيع: {new Date(activeTask.assignedAt).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}
                         </div>
                         {activeTask.startedAt && (
                           <div className="flex items-center gap-1 text-green-600">
                             <Play size={12} />
                             بدء: {new Date(activeTask.startedAt).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}
                           </div>
                         )}
                       </div>
                       
                       {activeTask.startedAt ? (
                         <div className="flex flex-col items-center justify-center w-full pt-1">
                           <span className="text-[10px] text-gray-400 mb-1">وقت التشغيل الفعلي</span>
                           <LiveTimer task={activeTask} />
                         </div>
                       ) : (
                         <div className="text-gray-400 py-1">في انتظار بدء العمل...</div>
                       )}
                     </div>
                     
                     {!isEditingLine && (
                       <div className="w-full flex flex-row gap-2 mt-1">
                         {(!activeTask.status || activeTask.status === 'assigned' || activeTask.status === 'paused') && (
                           <button onClick={() => handleStartTask(worker.id)} className="flex-1 bg-green-600 text-white hover:bg-green-700 py-2 rounded-lg text-xs font-black transition shadow-sm flex items-center justify-center gap-1">
                             <Play size={14} /> {activeTask.status === 'paused' ? 'استئناف' : 'بدء العمل'}
                           </button>
                         )}
                         
                         {activeTask.status === 'running' && (
                           <button onClick={() => handlePauseTask(worker.id)} className="flex-1 bg-orange-500 text-white hover:bg-orange-600 py-2 rounded-lg text-xs font-black transition shadow-sm flex items-center justify-center gap-1">
                             <Pause size={14} /> بريك مؤقت
                           </button>
                         )}

                         <button onClick={() => handleEndTask(worker.id)} className="flex-1 bg-white text-red-600 border border-red-200 hover:bg-red-500 hover:text-white hover:border-red-500 py-2 rounded-lg text-xs font-black transition shadow-sm">
                           إنهاء المهمة
                         </button>
                       </div>
                     )}
                   </div>
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
