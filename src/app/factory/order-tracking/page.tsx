"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "../../../lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { Search, AlertCircle, ArrowRight, History, Package, Camera } from "lucide-react";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";
import { factoryDepartments } from "../../../lib/departments";

export default function OrderTrackingPage() {
  const router = useRouter();
  const [orderQuery, setOrderQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    if (isScannerOpen) {
      scanner = new Html5QrcodeScanner(
        "tracking-reader",
        { 
          qrbox: { width: 250, height: 250 }, 
          fps: 5,
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
        }, 
        false
      );
      
      scanner.render(
        (text: string) => {
          setOrderQuery(text);
          setIsScannerOpen(false);
          if (scanner) scanner.clear();
          processScan(text);
        }, 
        (err: any) => { /* ignore */ }
      );
    }
    return () => {
      if (scanner) {
        scanner.clear().catch((e: any) => console.error(e));
      }
    };
  }, [isScannerOpen]);

  useEffect(() => {
    if (inputRef.current && !activeOrder) {
      inputRef.current.focus();
    }
  }, [activeOrder]);

  const processScan = async (queryText: string) => {
    if (!queryText.trim()) return;

    setLoading(true);
    setError("");
    setActiveOrder(null);
    
    let rawId = queryText.trim();
    let parsedId = rawId;

    try {
      if (rawId.includes('http')) {
        const url = new URL(rawId);
        const parts = url.pathname.split('/');
        parsedId = parts[parts.length - 1];
      }
    } catch(e) {}

    const arabicMap: Record<string, string> = {
      'ض': 'q', 'ص': 'w', 'ث': 'e', 'ق': 'r', 'ف': 't', 'غ': 'y', 'ع': 'u', 'ه': 'i', 'خ': 'o', 'ح': 'p', 'ج': '[', 'د': ']',
      'ش': 'a', 'س': 's', 'ي': 'd', 'ب': 'f', 'ل': 'g', 'ا': 'h', 'ت': 'j', 'ن': 'k', 'م': 'l', 'ك': ';', 'ط': "'",
      'ئ': 'z', 'ء': 'x', 'ؤ': 'c', 'ر': 'v', 'لا': 'b', 'ى': 'n', 'ة': 'm', 'و': ',', 'ز': '.', 'ظ': '/',
      'َ': 'Q', 'ً': 'W', 'ُ': 'E', 'ٌ': 'R', 'لإ': 'T', 'إ': 'Y', '‘': 'U', '÷': 'I', '×': 'O', '؛': 'P',
      'ِ': 'A', 'ٍ': 'S', ']': 'D', '[': 'F', 'لأ': 'G', 'أ': 'H', 'ـ': 'J', '،': 'K', '/': 'L', ':': ':', '"': '"',
      '~': 'Z', 'ْ': 'X', '}': 'C', '{': 'V', 'لآ': 'B', 'آ': 'N', '’': 'M', ',': '<', '.': '>', '؟': '?'
    };
    
    let finalId = "";
    for (let i = 0; i < parsedId.length; i++) {
      finalId += arabicMap[parsedId[i]] || parsedId[i];
    }
    
    try {
      let orderDoc: any = null;
      let orderDocId = finalId;

      const directDocRef = doc(db, "factory_production_orders", finalId);
      const directDocSnap = await getDoc(directDocRef);
      
      if (directDocSnap.exists()) {
        orderDoc = directDocSnap.data();
      } else {
        const q = query(collection(db, "factory_production_orders"), where("shortId", "==", finalId.toUpperCase()));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          orderDoc = querySnapshot.docs[0].data();
          orderDocId = querySnapshot.docs[0].id;
        }
      }

      if (!orderDoc) {
        setError("لم يتم العثور على أمر الشغل!");
      } else {
        setActiveOrder({ id: orderDocId, ...orderDoc });
      }
    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء البحث.");
    } finally {
      setLoading(false);
      setOrderQuery("");
    }
  };

  const handleScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await processScan(orderQuery);
    }
  };

  const totalSets = activeOrder?.colorPairs
    ? activeOrder.colorPairs.reduce((sum: number, pair: any) => sum + (Number(pair.quantity) || 0), 0)
    : activeOrder?.totalQuantity;

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-blue-600 transition bg-white p-2 rounded-full shadow-sm">
          <ArrowRight size={24} />
        </button>
        <h1 className="text-3xl font-black text-gray-800 tracking-tight flex items-center gap-3">
          <History className="text-blue-600" size={32} />
          استعلام عن خط سير الموديل
        </h1>
      </div>

      {!activeOrder && (
        <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6">
            <Search size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">ابحث بالباركود</h2>
          <p className="text-gray-500 mb-8 text-center text-lg">اضرب باركود أمر الشغل بالاسكانر لمعرفة رصيده وحركته في جميع الأقسام</p>
          
          <div className="w-full max-w-lg relative">
            <input
              ref={inputRef}
              type="text"
              value={orderQuery}
              onChange={(e) => setOrderQuery(e.target.value)}
              onKeyDown={handleScan}
              placeholder="... اسكان الباركود هنا ..."
              className="w-full p-5 pl-12 border-2 border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none text-center text-xl font-mono transition shadow-inner"
              disabled={loading}
            />
            {loading && (
              <div className="absolute left-6 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            )}
          </div>

          <button 
            onClick={() => setIsScannerOpen(!isScannerOpen)}
            className="mt-6 flex items-center justify-center gap-2 w-full max-w-lg bg-gray-800 text-white p-4 rounded-2xl font-bold hover:bg-gray-900 transition shadow-lg"
          >
            <Camera size={24} /> {isScannerOpen ? "أغلق الكاميرا" : "افتح كاميرا الموبايل للاسكان"}
          </button>
          
          {isScannerOpen && (
            <div className="mt-4 w-full max-w-lg border-2 rounded-xl overflow-hidden shadow-sm bg-gray-50">
              <div id="tracking-reader" width="100%"></div>
            </div>
          )}
          
          {error && (
            <div className="mt-6 flex items-center gap-2 text-red-600 bg-red-50 px-6 py-4 rounded-xl w-full max-w-lg text-lg">
              <AlertCircle size={24} />
              <span className="font-bold">{error}</span>
            </div>
          )}
        </div>
      )}

      {activeOrder && (
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border-t-4 border-blue-600 flex justify-between items-center">
            <div>
              <div className="text-sm font-bold text-gray-500 mb-1 flex items-center gap-2"><Package size={16}/> الموديل</div>
              <h2 className="text-4xl font-black text-gray-900">{activeOrder.modelName}</h2>
              <div className="text-xl text-blue-600 font-bold mt-2 tracking-wider">{activeOrder.shortId || activeOrder.id.slice(-6).toUpperCase()}</div>
            </div>
            <div className="text-center bg-gray-50 px-8 py-6 rounded-2xl border border-gray-100 shadow-inner">
              <div className="text-sm font-bold text-gray-500 mb-2">الكمية المستهدفة</div>
              <div className="text-4xl font-black text-gray-800">{totalSets} <span className="text-lg font-normal text-gray-500">ترنج/طقم</span></div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2 border-b pb-4">
              <History className="text-blue-500" /> مسار الموديل في الأقسام
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="p-4 font-bold border-b">القسم</th>
                    <th className="p-4 font-bold border-b text-center text-blue-700">الكمية المستلمة</th>
                    <th className="p-4 font-bold border-b text-center text-green-700">الكمية المُسلمة</th>
                    <th className="p-4 font-bold border-b text-center text-orange-600">الرصيد المتبقي بالقسم</th>
                    <th className="p-4 font-bold border-b text-left">آخر تحديث</th>
                  </tr>
                </thead>
                <tbody>
                  {factoryDepartments.map((dept) => {
                    const progress = activeOrder.departmentsProgress?.[dept.id];
                    const received = progress?.receivedQty || 0;
                    const delivered = progress?.deliveredQty || 0;
                    const balance = received - delivered;
                    
                    if (received === 0 && delivered === 0) return null; // Hide untouched departments for cleaner UI

                    return (
                      <tr key={dept.id} className="border-b hover:bg-gray-50 transition">
                        <td className="p-4 font-bold text-gray-800">{dept.name}</td>
                        <td className="p-4 text-center font-black text-blue-600 text-lg">{received}</td>
                        <td className="p-4 text-center font-black text-green-600 text-lg">{delivered}</td>
                        <td className="p-4 text-center font-black text-orange-500 text-lg">{balance > 0 ? balance : "-"}</td>
                        <td className="p-4 text-left text-sm text-gray-500" dir="ltr">
                          {progress?.lastUpdated ? new Date(progress.lastUpdated).toLocaleString('ar-EG') : '-'}
                        </td>
                      </tr>
                    );
                  })}
                  {(!activeOrder.departmentsProgress || Object.keys(activeOrder.departmentsProgress).length === 0) && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500 font-bold">
                        لم يتم تسجيل أي حركة لهذا الموديل في الأقسام حتى الآن.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <button 
            onClick={() => {
              setActiveOrder(null);
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
            className="w-full py-5 bg-gray-900 text-white rounded-2xl font-bold text-xl hover:bg-gray-800 transition shadow-lg"
          >
            مسح موديل آخر
          </button>
        </div>
      )}
    </div>
  );
}
