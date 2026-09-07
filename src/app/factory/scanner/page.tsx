"use client";

import { useEffect, useState } from "react";
import { db } from "../../../lib/firebase";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
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
  };

  const fetchOrderDetails = async (scannedText: string) => {
    setLoading(true);
    setError("");
    setOrderData(null);
    setSplitOptions([]);
    setSuccess("");

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

  const handleCompleteStage = async () => {
    if (!orderData || !workerName) return;
    
    setLoading(true);
    try {
      const nextStage = selectedStage;
      if (nextStage > 14) {
        throw new Error("لا يمكن تخطي المرحلة 14 (المخزن)");
      }

      let newTotal = editableTotalQty;
      if (editablePairs && editablePairs.length > 0) {
         newTotal = editablePairs.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
      }

      let newNotes = orderData.workerNotes || "";
      if (workerNote.trim()) {
         const stageName = STAGES.find(s => s.id === selectedStage)?.name;
         newNotes += `\n[${workerName} - ${stageName}]: ${workerNote.trim()}`;
      }

      await updateDoc(doc(db, "factory_production_orders", orderData.id), {
        currentStage: nextStage,
        lastWorkerName: workerName,
        totalQuantity: newTotal,
        colorPairs: editablePairs,
        workerNotes: newNotes.trim()
      });

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
                    الإجمالي: {editablePairs.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0)} قطعة
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

            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6 text-right">
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
                إلغاء
              </button>
              <button 
                onClick={handleCompleteStage}
                className="flex-[2] bg-green-500 text-white py-3 rounded-xl font-bold text-lg hover:bg-green-600 transition shadow-md flex justify-center items-center gap-2"
              >
                تأكيد <CheckCircle size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}
