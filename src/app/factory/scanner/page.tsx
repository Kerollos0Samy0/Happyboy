"use client";

import { useEffect, useState } from "react";
import { db } from "../../../lib/firebase";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";
import { Camera, CheckCircle, AlertCircle, ArrowRight, UserCircle } from "lucide-react";
import Link from "next/link";

const STAGES = [
  { id: 1, name: "قسم العينات" },
  { id: 2, name: "اوردر قماش" },
  { id: 3, name: "مخزن قماش" },
  { id: 4, name: "قسم القص" },
  { id: 5, name: "قسم الفرز" },
  { id: 6, name: "قسم الطباعة - ليزر" },
  { id: 7, name: "قسم القص والتفريغ" },
  { id: 8, name: "قسم الكبس" },
  { id: 9, name: "قسم التجويز" },
  { id: 10, name: "قسم المكن" },
  { id: 11, name: "قسم التشطيب" },
  { id: 12, name: "قسم المكواة" },
  { id: 13, name: "التعبئة والتكييس" },
  { id: 14, name: "مخزن الموديلات" }
];

interface ProductionOrder {
  id: string;
  modelName: string;
  totalQuantity: number;
  modelImage?: string;
  colorPairs?: any[];
  workerNotes?: string;
  currentStage?: number;
  splitChildren?: any[];
  isSplit?: boolean;
  fabricSentAmount?: number;
  fabricSentUnit?: 'توب' | 'كيلو';
  fabricSentColors?: string;
  stageStatus?: 'idle' | 'running';
  stageStartedAt?: string;
  stageWorkerName?: string;
}

export default function WorkerScannerPage() {
  const [workerName, setWorkerName] = useState("");
  const [selectedStage, setSelectedStage] = useState<number>(0);
  const [isScannerActive, setIsScannerActive] = useState(false);
  
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<ProductionOrder | null>(null);
  const [splitOptions, setSplitOptions] = useState<ProductionOrder[]>([]);
  const [editablePairs, setEditablePairs] = useState<any[]>([]);
  const [editableTotalQty, setEditableTotalQty] = useState<number>(0);
  const [workerNote, setWorkerNote] = useState("");
  
  // Custom states for Cutting Department (Stage 4)
  const [fabricUnit, setFabricUnit] = useState<'توب' | 'كيلو'>('توب');
  const [fabricAmount, setFabricAmount] = useState<number | ''>('');
  const [fabricRolls, setFabricRolls] = useState<{id?: string, code?: string, color: string, amount: number | '', unit?: string}[]>([]);
  const [rollScanCode, setRollScanCode] = useState('');
  const [isScanningRoll, setIsScanningRoll] = useState(false);
  const [fabricColors, setFabricColors] = useState<string>('');
  const [receivedParts, setReceivedParts] = useState<'both' | 'tshirt' | 'pants' | 'tshirt_front' | 'tshirt_front_back' | 'set_front' | 'set_front_back'>('both');
  const [printedMeters, setPrintedMeters] = useState<number | ''>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Setup Scanner
  useEffect(() => {
    if (isScannerActive) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
        },
        false
      );

      scanner.render(
        (decodedText) => {
          // On success
          setScannedData(decodedText);
          scanner.clear(); // stop scanning once found
          setIsScannerActive(false);
        },
        (errorMessage) => {
          // On error - ignore to prevent spamming logs
        }
      );

      return () => {
        scanner.clear().catch(e => console.error("Failed to clear scanner", e));
      };
    }
  }, [isScannerActive]);

  // Fetch order when scanned
  useEffect(() => {
    if (scannedData) {
      fetchOrderDetails(scannedData);
    }
  }, [scannedData]);

  const handleScanRoll = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!rollScanCode.trim()) return;
      setIsScanningRoll(true);
      try {
        const q = query(collection(db, 'factory_fabric_rolls'), where('code', '==', rollScanCode.trim()));
        const snap = await getDocs(q);
        if (snap.empty) {
          alert('هذا التوب غير مسجل في المخزن أو كود غير صحيح.');
        } else {
          const rollDoc = snap.docs[0];
          const rollData = rollDoc.data();
          const newRoll = {
            id: rollDoc.id,
            code: rollData.code,
            color: rollData.color,
            amount: rollData.amount,
            unit: rollData.unit || 'كيلو'
          };
          
          if (fabricRolls.some(r => r.id === newRoll.id)) {
             alert('تم إضافة هذا التوب مسبقاً للقائمة.');
          } else {
             const filtered = fabricRolls.filter(r => r.amount !== '');
             setFabricRolls([...filtered, newRoll]);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setRollScanCode('');
        setIsScanningRoll(false);
      }
    }
  };

  const selectSplitOption = (data: ProductionOrder) => {
    setSplitOptions([]);
    if (data.currentStage !== selectedStage) {
      const currentStageName = STAGES.find(s => s.id === data.currentStage)?.name;
      const myStageName = STAGES.find(s => s.id === selectedStage)?.name;
      setError(`تنبيه: هذا الموديل متواجد حالياً في "${currentStageName}" وليس في قسمك (${myStageName}). تأكد من استلامه أولاً.`);
    }
    
    setOrderData(data);
    setEditablePairs(data.colorPairs || []);
    setEditableTotalQty(data.totalQuantity || 0);
    setWorkerNote("");
    setFabricAmount(data.fabricSentAmount || '');
    setFabricUnit(data.fabricSentUnit || 'توب');
    setFabricColors(data.fabricSentColors || '');

    // Initialize Fabric Rolls automatically based on colorPairs
    const uniqueColors = Array.from(new Set(
      (data.colorPairs || []).flatMap(p => [p.tshirt, p.pants]).filter(c => c && c !== 'بدون تحديد' && c.trim() !== '')
    ));
    let initialRolls = uniqueColors.map(c => ({ color: c, amount: '' as number | '' }));
    
    // If we are in stage 4, we might want to show what the warehouse sent, but the user requested automatic colors.
    // We will just populate the colors.
    if (initialRolls.length === 0) initialRolls = [{ color: '', amount: '' }];
    setFabricRolls(initialRolls);
  };

  const fetchOrderDetails = async (scannedText: string) => {
    setLoading(true);
    setError("");
    setOrderData(null);
    setSplitOptions([]);
    setSuccess("");
    setFabricAmount('');
    setFabricColors('');
    setFabricRolls([]);

    try {
      let orderId = scannedText;
      
      if (scannedText.includes('/public/order/')) {
        const parts = scannedText.split('/public/order/');
        orderId = parts[1].split(/[/?#]/)[0];
      } else {
        const idMatch = scannedText.match(/ID:\s*([a-zA-Z0-9_-]+)/);
        if (idMatch && idMatch[1]) {
          orderId = idMatch[1];
        }
      }

      const docRef = doc(db, "factory_production_orders", orderId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as ProductionOrder;
        data.id = docSnap.id;
        selectSplitOption(data);
      } else {
        const q = query(collection(db, "factory_production_orders"), where("originalOrderId", "==", orderId));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const splits = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as ProductionOrder));
          setSplitOptions(splits);
        } else {
          setError("لم يتم العثور على أمر تشغيل بهذا الرمز. تأكد من أن الرمز صحيح (أو ربما تم حذفه).");
        }
      }
    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء الاتصال بقاعدة البيانات.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartStage = async () => {
    if (!orderData || !workerName) return;
    setLoading(true);
    try {
      const now = new Date().toISOString();
      
      // Auto-end previous stage if it was left running
      if (orderData.stageStatus === 'running' && orderData.stageStartedAt && orderData.currentStage !== selectedStage) {
        const start = new Date(orderData.stageStartedAt);
        const end = new Date(now);
        const durationSecs = Math.floor((end.getTime() - start.getTime()) / 1000);
        const prevStageName = STAGES.find(s => s.id === orderData.currentStage)?.name || 'مرحلة سابقة';
        
        await addDoc(collection(db, 'factory_productivity_logs'), {
          date: new Date().toISOString().split('T')[0],
          type: 'department',
          modelNumber: orderData.modelName,
          lineId: prevStageName,
          amount: orderData.totalQuantity, // Fallback to base quantity
          workerName: orderData.stageWorkerName || 'غير معروف',
          machine: 'إسكانر (إغلاق تلقائي)',
          operation: 'إنهاء تلقائي',
          effectiveDurationSeconds: durationSecs > 0 ? durationSecs : 0,
          totalPausedSeconds: 0,
          timestamp: serverTimestamp()
        });
      }

      await updateDoc(doc(db, "factory_production_orders", orderData.id), {
        stageStatus: 'running',
        stageStartedAt: now,
        stageWorkerName: workerName,
        currentStage: selectedStage // Move model immediately to this stage
      });
      setOrderData({
        ...orderData,
        stageStatus: 'running',
        stageStartedAt: now,
        stageWorkerName: workerName,
        currentStage: selectedStage
      });
    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء بدء العمل.");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteStage = async () => {
    if (!orderData || !workerName) return;
    
    setLoading(true);
    try {
      const nextStage = selectedStage;
      if (nextStage > 14) {
        throw new Error("لا يمكن تخطي المرحلة 14 (المخزن)");
      }

      let basePieces = editableTotalQty;
      if (editablePairs && editablePairs.length > 0) {
         basePieces = editablePairs.reduce((sum, p) => {
           let mult = 0;
           if (p.tshirt && p.tshirt.trim() !== '') mult++;
           if (p.pants && p.pants.trim() !== '') mult++;
           if (mult === 0) mult = 1;
           return sum + ((Number(p.quantity) || 0) * mult);
         }, 0);
      }

      // Calculate Productivity Amount based on Stage
      let prodAmount = basePieces; 
      let prodUnit = 'قطعة';

      // Calculate final fabric amounts and colors
      let finalFabricAmount = Number(fabricAmount) || 0;
      let finalFabricColors = fabricColors;
      if (selectedStage === 3 || selectedStage === 4) {
         const validRolls = fabricRolls.filter(r => r.amount !== '' && Number(r.amount) > 0);
         if (validRolls.length > 0) {
            finalFabricAmount = validRolls.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
            finalFabricColors = validRolls.map(r => `${r.color} (${r.amount})`).join('، ');
         }
      }

      if (selectedStage === 1) {
        prodAmount = 1; 
        prodUnit = 'عينة';
      } else if (selectedStage === 2 || selectedStage === 3) {
        prodAmount = finalFabricAmount;
        prodUnit = fabricUnit;
      } else if (selectedStage === 6) {
        prodAmount = Number(printedMeters) || 0;
        prodUnit = 'متر';
      } else if (selectedStage === 7 || selectedStage === 8) {
         prodAmount = editablePairs.reduce((sum, p) => {
           let m = 0;
           if (receivedParts === 'tshirt_front') m = 1;
           else if (receivedParts === 'tshirt_front_back') m = 2;
           else if (receivedParts === 'pants') m = 1;
           else if (receivedParts === 'set_front') m = 2;
           else if (receivedParts === 'set_front_back') m = 3;
           else if (receivedParts === 'tshirt') m = 1;
           else {
             if (p.tshirt && p.tshirt.trim() !== '') m++;
             if (p.pants && p.pants.trim() !== '') m++;
             if (m === 0) m = 1;
           }
           return sum + ((Number(p.quantity) || 0) * m);
         }, 0);
      } else if (selectedStage === 13 || selectedStage === 14) {
        prodAmount = editablePairs.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
        prodUnit = 'طقم';
      }

      let newNotes = orderData.workerNotes || "";
      const stageName = STAGES.find(s => s.id === selectedStage)?.name;
      
      const updateData: any = {
        currentStage: nextStage,
        lastWorkerName: workerName,
        totalQuantity: basePieces, // Keep order total as pieces count
        colorPairs: editablePairs,
      };

      if (receivedParts !== 'both') {
        const partNames: Record<string, string> = {
          'tshirt': 'تيشيرت فقط',
          'pants': 'بنطلون فقط',
          'tshirt_front': 'تيشيرت وجه واحد',
          'tshirt_front_back': 'تيشيرت وجهين',
          'set_front': 'طقم (صدر وبنطلون)',
          'set_front_back': 'طقم (صدر وظهر وبنطلون)'
        };
        const partName = partNames[receivedParts as string] || receivedParts;
        newNotes += `\n[${workerName} - ${stageName}]: استلم ${partName}`;
      }

      // Stage 3 (Warehouse) sending fabric
      if (selectedStage === 3 && finalFabricAmount && finalFabricColors) {
         newNotes += `\n[${workerName} - ${stageName} (صرف قماش)]: تم صرف ${finalFabricAmount} ${fabricUnit}، الألوان: ${finalFabricColors}`;
         updateData.fabricSentAmount = finalFabricAmount;
         updateData.fabricSentUnit = fabricUnit;
         updateData.fabricSentColors = finalFabricColors;

         // Deduct from inventory (delete scanned rolls)
         const validRolls = fabricRolls.filter(r => r.amount !== '' && Number(r.amount) > 0);
         const promises = validRolls.map(r => {
           if (r.id) return deleteDoc(doc(db, 'factory_fabric_rolls', r.id));
           return Promise.resolve();
         });
         await Promise.all(promises);
      }
      
      // Stage 4 (Cutting) receiving fabric
      if (selectedStage === 4 && finalFabricAmount && finalFabricColors) {
         newNotes += `\n[${workerName} - ${stageName} (استلام قماش)]: استلمت ${finalFabricAmount} ${fabricUnit}، الألوان: ${finalFabricColors}`;
      }

      if (workerNote.trim()) {
         newNotes += `\n[${workerName} - ${stageName}]: ${workerNote.trim()}`;
      }
      
      updateData.workerNotes = newNotes.trim();
      updateData.stageStatus = 'idle';

      await updateDoc(doc(db, "factory_production_orders", orderData.id), updateData);

      // Log productivity if stage was running
      if (orderData.stageStatus === 'running' && orderData.stageStartedAt) {
        const start = new Date(orderData.stageStartedAt);
        const end = new Date();
        const durationSecs = Math.floor((end.getTime() - start.getTime()) / 1000);
        
        await addDoc(collection(db, 'factory_productivity_logs'), {
          date: new Date().toISOString().split('T')[0],
          type: 'department',
          modelNumber: orderData.modelName,
          lineId: stageName || 'حركة المصنع', // Shows as department name
          amount: prodAmount,
          unit: prodUnit,
          workerName: workerName,
          machine: 'إسكانر (حركة المصنع)', 
          operation: 'إنهاء المرحلة وتسليم',
          effectiveDurationSeconds: durationSecs,
          totalPausedSeconds: 0,
          timestamp: serverTimestamp()
        });
      }

      setSuccess(`تم نقل الموديل بنجاح إلى المرحلة التالية (${STAGES.find(s => s.id === nextStage)?.name}).`);
      setOrderData(null);
      setScannedData(null);
      
      // Auto restart scanner after 3 seconds
      setTimeout(() => {
        setSuccess("");
        setIsScannerActive(true);
      }, 3000);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "حدث خطأ أثناء تحديث حالة الموديل.");
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Worker Login / Section Selection
  if (!selectedStage || !workerName) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-xl shadow-lg border border-gray-100" dir="rtl">
        <div className="flex items-center gap-3 mb-6 border-b pb-4">
          <Camera className="text-blue-600" size={28} />
          <h2 className="text-xl font-bold text-gray-800">بوابة العمال (الماسح الضوئي)</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">اسم العامل / المسؤول</label>
            <div className="relative">
              <UserCircle className="absolute right-3 top-2.5 text-gray-400" size={20} />
              <input 
                type="text" 
                className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="أدخل اسمك..."
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">القسم الحالي</label>
            <select 
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={selectedStage}
              onChange={(e) => setSelectedStage(Number(e.target.value))}
            >
              <option value={0}>-- اختر القسم الذي تعمل به --</option>
              {STAGES.map(stage => (
                <option key={stage.id} value={stage.id}>{stage.id}. {stage.name}</option>
              ))}
            </select>
          </div>

          <button 
            disabled={!workerName || !selectedStage}
            onClick={() => setIsScannerActive(true)}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50 mt-4 shadow-md"
          >
            بدء العمل وفتح الكاميرا
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Scanner & Order Processing
  return (
    <div className="max-w-lg mx-auto pb-20" dir="rtl">
      
      {/* Header */}
      <div className="bg-gray-800 text-white p-4 rounded-xl shadow-lg mb-6 flex justify-between items-center sticky top-4 z-10">
        <div>
          <p className="text-sm text-gray-300">مرحباً بك، <span className="font-bold text-white">{workerName}</span></p>
          <p className="font-bold text-lg text-blue-300">{STAGES.find(s => s.id === selectedStage)?.name}</p>
        </div>
        <button 
          onClick={() => { setSelectedStage(0); setScannedData(null); setIsScannerActive(false); }}
          className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-sm transition"
        >
          تغيير القسم
        </button>
      </div>

      {/* Camera Area */}
      {!scannedData && !loading && !success && (
        <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 mb-6 overflow-hidden">
          <div className="text-center mb-4">
            <h3 className="font-bold text-gray-800 flex justify-center items-center gap-2">
              <Camera size={20} className="text-blue-600" /> مسح الباركود
            </h3>
            <p className="text-sm text-gray-500">قم بتوجيه الكاميرا نحو المربع (QR Code) الموجود على ورقة أمر التشغيل</p>
          </div>
          
          <div id="reader" className="w-full rounded-lg overflow-hidden border-2 border-blue-100"></div>
          
          {!isScannerActive && (
            <button 
              onClick={() => setIsScannerActive(true)}
              className="w-full bg-blue-100 text-blue-700 font-bold py-3 rounded-lg mt-4"
            >
              إعادة فتح الكاميرا
            </button>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white p-8 rounded-xl shadow-lg text-center">
          <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="font-bold text-gray-700">جاري قراءة البيانات...</p>
        </div>
      )}

      {/* Success State */}
      {success && (
        <div className="bg-green-50 border border-green-200 p-8 rounded-xl shadow-lg text-center animate-fade-in mb-6">
          <CheckCircle className="text-green-500 w-16 h-16 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-green-800 mb-2">{success}</h3>
          <p className="text-green-600">سيتم فتح الكاميرا للموديل التالي تلقائياً...</p>
        </div>
      )}

      {/* Split Selection State */}
      {splitOptions.length > 0 && !loading && (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-blue-200 animate-fade-in text-right mb-6">
          <div className="flex gap-3 text-blue-700 font-bold mb-4 items-center">
            <AlertCircle /> <h3>لقد تم تقسيم هذا الأوردر مسبقاً. اختر الجزء الذي تعمل عليه حالياً:</h3>
          </div>
          <div className="space-y-3">
            {splitOptions.map((opt) => (
              <button 
                key={opt.id}
                onClick={() => selectSplitOption(opt)}
                className="w-full text-right p-4 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition flex justify-between items-center group"
              >
                <div>
                  <h4 className="font-bold text-gray-800">{opt.modelName}</h4>
                  <p className="text-sm text-gray-500">الكمية: {opt.totalQuantity} قطعة | القسم الحالي: {STAGES.find(s => s.id === opt.currentStage)?.name}</p>
                </div>
                <ArrowRight className="text-gray-400 group-hover:text-blue-500 transition-transform group-hover:-translate-x-2" />
              </button>
            ))}
          </div>
          <button 
            onClick={() => { setSplitOptions([]); setScannedData(null); setIsScannerActive(true); }}
            className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-bold mt-6 hover:bg-gray-200"
          >
            إلغاء ومسح كود آخر
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl shadow-lg mb-6 animate-fade-in">
          <div className="flex gap-3 text-red-700 font-bold mb-4">
            <AlertCircle /> <p>{error}</p>
          </div>
          <button 
            onClick={() => { setError(""); setScannedData(null); setIsScannerActive(true); }}
            className="w-full bg-white text-red-600 border border-red-200 py-2 rounded-lg font-bold"
          >
            مسح موديل آخر
          </button>
        </div>
      )}

      {/* Order Action Card */}
      {orderData && !loading && !success && (
        <div className="bg-white rounded-xl shadow-2xl border border-blue-100 overflow-hidden animate-fade-in">
          <div className="bg-blue-600 p-4 text-white text-center">
            <h3 className="font-bold text-xl mb-1">{orderData.modelName}</h3>
            <p className="opacity-80">الكمية الإجمالية: {orderData.totalQuantity} قطعة</p>
          </div>
          
          <div className="p-4 bg-gray-50">
            {orderData.modelImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={orderData.modelImage} 
                alt="Model" 
                className="w-32 h-32 object-cover rounded-lg border border-gray-200 mx-auto mb-4 shadow-sm bg-white"
              />
            )}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-100 mb-4 text-right">
              <h4 className="font-bold text-indigo-800 mb-3 border-b pb-2">مكونات وألوان الموديل:</h4>
              
              {selectedStage === 3 && orderData.colorPairs && (
                <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <span className="font-bold text-yellow-800 block mb-1">الألوان المطلوبة لتحضير القماش:</span>
                  <span className="text-yellow-700 font-black text-lg">
                    {Array.from(new Set(
                      orderData.colorPairs.flatMap(p => [p.tshirt, p.pants]).filter(c => c && c !== 'بدون تحديد' && c.trim() !== '')
                    )).join('، ') || 'غير محدد'}
                  </span>
                </div>
              )}

              {orderData.colorPairs && orderData.colorPairs.length > 0 ? (
                <ul className="space-y-2">
                  {orderData.colorPairs.map((pair, idx) => (
                    <li key={idx} className="flex justify-between items-center bg-indigo-50 p-2 rounded text-indigo-900 font-bold text-sm border border-indigo-100">
                      <span>
                        {pair.tshirt && <span>{pair.tshirt}</span>}
                        {pair.tshirt && pair.pants && <span className="text-indigo-400 mx-2"> مع </span>}
                        {pair.pants && <span>{pair.pants}</span>}
                      </span>
                      <span className="bg-white px-2 py-1 rounded shadow-sm text-blue-700">{pair.quantity} قطعة</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-sm font-bold">لا توجد تفاصيل (إجمالي: {orderData.totalQuantity} قطعة)</p>
              )}
            </div>
            
            {orderData.stageStatus === 'running' ? (
              <>
                <div className="bg-indigo-50 border-r-4 border-indigo-500 p-3 mb-4 rounded flex items-center justify-between">
                  <div>
                     <p className="font-bold text-indigo-800">جاري العمل على هذا الموديل ⏱️</p>
                     <p className="text-xs text-indigo-600">بدأ: {new Date(orderData.stageStartedAt!).toLocaleTimeString('ar-EG')}</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-4 text-right">
                  <h4 className="font-bold text-gray-800 mb-2">تأكيد / تعديل الكميات</h4>
                  {editablePairs && editablePairs.length > 0 ? (
                    <div className="space-y-2">
                      {editablePairs.map((pair, idx) => (
                        <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2 rounded border">
                          <div className="flex-1 text-sm font-bold text-gray-700">
                            {pair.tshirt && <span>{pair.tshirt}</span>}
                            {pair.tshirt && pair.pants && <span> مع </span>}
                            {pair.pants && <span>{pair.pants}</span>}
                          </div>
                          <div className="w-24 shrink-0">
                            <input 
                              type="number" 
                              value={pair.quantity || ''} 
                              onChange={(e) => {
                                const newPairs = [...editablePairs];
                                newPairs[idx].quantity = e.target.value;
                                setEditablePairs(newPairs);
                              }} 
                              className="w-full p-1.5 border rounded text-center font-bold text-blue-700" 
                              placeholder="الكمية" 
                            />
                          </div>
                        </div>
                      ))}
                      <div className="text-left mt-2 font-bold text-gray-700">
                        الإجمالي: {editablePairs.reduce((sum, p) => {
                          let multiplier = 0;
                          if (p.tshirt && p.tshirt.trim() !== '') multiplier++;
                          if (p.pants && p.pants.trim() !== '') multiplier++;
                          if (multiplier === 0) multiplier = 1;
                          return sum + ((Number(p.quantity) || 0) * multiplier);
                        }, 0)} قطعة
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-bold text-gray-700">إجمالي الكمية:</label>
                      <input 
                        type="number" 
                        value={editableTotalQty || ''} 
                        onChange={(e) => setEditableTotalQty(Number(e.target.value))} 
                        className="flex-1 p-2 border rounded font-bold text-blue-700 text-center" 
                      />
                    </div>
                  )}
                </div>

                {(selectedStage === 3 || selectedStage === 4) && (
                  <div className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-200 mb-6 text-right animate-fade-in">
                    <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                      <CheckCircle size={18} />
                      {selectedStage === 3 ? 'تسجيل صرف القماش (مخزن القماش)' : 'تأكيد استلام القماش (قسم القص)'}
                    </h4>
                    {selectedStage === 4 && orderData?.fabricSentAmount ? (
                      <div className="mb-3 p-2 bg-white rounded border border-blue-100 text-sm">
                        <span className="text-gray-500 font-bold">المرسل من المخزن:</span>
                        <div className="font-black text-blue-700">{orderData.fabricSentAmount} {orderData.fabricSentUnit} (الألوان: {orderData.fabricSentColors})</div>
                      </div>
                    ) : null}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-bold text-blue-700">{selectedStage === 3 ? 'الألوان والكميات المنصرفة' : 'الألوان والكميات المستلمة'}</label>
                        <select 
                          value={fabricUnit}
                          onChange={(e) => setFabricUnit(e.target.value as 'توب' | 'كيلو')}
                          className="w-24 p-1 border border-blue-200 rounded outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold text-blue-700 bg-white"
                        >
                          <option value="توب">توب</option>
                          <option value="كيلو">كيلو</option>
                        </select>
                      </div>
                      {selectedStage === 3 && (
                        <div className="mb-3">
                          <input 
                            type="text" 
                            value={rollScanCode}
                            onChange={(e) => setRollScanCode(e.target.value)}
                            onKeyDown={handleScanRoll}
                            disabled={isScanningRoll}
                            className="w-full p-3 border-2 border-dashed border-indigo-400 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-indigo-50/50 text-indigo-900 font-bold placeholder-indigo-300 text-center"
                            placeholder={isScanningRoll ? "جاري البحث..." : "اكتب كود التوب واضغط Enter (أو استخدم جهاز الباركود)"}
                          />
                        </div>
                      )}
                      {fabricRolls.map((roll, idx) => (
                        <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded border border-blue-100">
                           <div className="flex-1 flex flex-col">
                              <input 
                                type="text" 
                                value={roll.color}
                                readOnly={!!roll.id}
                                onChange={(e) => {
                                  const newRolls = [...fabricRolls];
                                  newRolls[idx].color = e.target.value;
                                  setFabricRolls(newRolls);
                                }}
                                className={`w-full p-2 border rounded outline-none ${roll.id ? 'bg-gray-100 text-gray-600 border-gray-200' : 'border-blue-200 focus:ring-2 focus:ring-blue-500'}`}
                                placeholder="اسم اللون..."
                              />
                              {roll.code && <span className="text-[10px] text-gray-500 mt-1 mr-1 font-mono">الكود: {roll.code}</span>}
                           </div>
                           <div className="w-28 shrink-0 flex items-center gap-1">
                              <input 
                                type="number" 
                                value={roll.amount}
                                readOnly={!!roll.id}
                                onChange={(e) => {
                                  const newRolls = [...fabricRolls];
                                  newRolls[idx].amount = e.target.value === '' ? '' : Number(e.target.value);
                                  setFabricRolls(newRolls);
                                }}
                                className={`w-full p-2 border rounded outline-none text-center font-bold ${roll.id ? 'bg-gray-100 text-gray-600 border-gray-200' : 'border-blue-200 focus:ring-2 focus:ring-blue-500'}`}
                                placeholder="الكمية"
                              />
                              {roll.unit && <span className="text-xs text-gray-500">{roll.unit}</span>}
                           </div>
                           <button
                             onClick={() => {
                               const newRolls = fabricRolls.filter((_, i) => i !== idx);
                               setFabricRolls(newRolls);
                             }}
                             className="text-red-500 hover:bg-red-50 p-2 rounded"
                           >
                             ✕
                           </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setFabricRolls([...fabricRolls, { color: '', amount: '' }])}
                        className="w-full p-2 border-2 border-dashed border-blue-300 rounded text-blue-600 font-bold hover:bg-blue-50 transition"
                      >
                        + إضافة لون آخر
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6 text-right">
                  {selectedStage === 6 && (
                    <div className="mb-4">
                      <h4 className="font-bold text-gray-800 mb-2">عدد الأمتار (قسم الطباعة)</h4>
                      <input 
                        type="number"
                        min="0"
                        value={printedMeters}
                        onChange={(e) => setPrintedMeters(Number(e.target.value))}
                        placeholder="أدخل عدد الأمتار هنا"
                        className="w-full p-2 border border-blue-200 rounded outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50 font-bold text-blue-800"
                      />
                    </div>
                  )}

                  <h4 className="font-bold text-gray-800 mb-2">تفاصيل القطع المستلمة</h4>
                  <div className="mb-4">
                    <select 
                      value={receivedParts}
                      onChange={(e) => setReceivedParts(e.target.value as any)}
                      className="w-full p-2 border border-blue-200 rounded outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50 font-bold text-blue-800"
                    >
                      <option value="both">إفتراضي (حسب الموديل - تيشيرت وبنطلون)</option>
                      <option value="tshirt">تيشيرت فقط</option>
                      <option value="pants">بنطلون فقط</option>
                      {(selectedStage === 7 || selectedStage === 8) && (
                        <>
                          <option value="tshirt_front">تيشيرت وجه واحد (صدر فقط)</option>
                          <option value="tshirt_front_back">تيشيرت وجهين (صدر وظهر)</option>
                          <option value="set_front">طقم (صدر تيشيرت + بنطلون)</option>
                          <option value="set_front_back">طقم كامل (صدر وظهر + بنطلون)</option>
                        </>
                      )}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">يؤثر هذا الخيار على حساب القطع المنتجة في تقرير إنتاجيتك</p>
                  </div>

                  <h4 className="font-bold text-gray-800 mb-2">إضافة ملاحظات (اختياري)</h4>
                  <textarea 
                    value={workerNote}
                    onChange={(e) => setWorkerNote(e.target.value)}
                    placeholder="أي ملاحظات حول الألوان، القص، التقفيل..."
                    className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[80px]"
                  />
                  {orderData.workerNotes && (
                    <div className="mt-2 p-2 bg-yellow-50 text-yellow-800 text-xs rounded border border-yellow-100 whitespace-pre-wrap max-h-24 overflow-y-auto">
                      <strong>ملاحظات سابقة:</strong><br/>
                      {orderData.workerNotes}
                    </div>
                  )}
                </div>
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => { setOrderData(null); setScannedData(null); setIsScannerActive(true); setError(""); }}
                    className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-xl font-bold hover:bg-gray-300 transition"
                  >
                    تأجيل
                  </button>
                  <button 
                    onClick={handleCompleteStage}
                    className="flex-[2] bg-green-500 text-white py-3 rounded-xl font-bold text-lg hover:bg-green-600 transition shadow-md flex justify-center items-center gap-2"
                  >
                    إنهاء المرحلة <CheckCircle size={20} />
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-4">
                <button 
                  onClick={handleStartStage}
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-xl hover:bg-blue-700 transition shadow-md flex justify-center items-center gap-2 mb-3"
                >
                  بدء العمل ⏱️
                </button>
                <button 
                  onClick={() => { setOrderData(null); setScannedData(null); setIsScannerActive(true); setError(""); }}
                  className="w-full bg-gray-200 text-gray-800 py-3 rounded-xl font-bold hover:bg-gray-300 transition"
                >
                  إلغاء
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
    </div>
  );
}
