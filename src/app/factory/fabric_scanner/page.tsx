"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "../../../lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";

export default function FabricScannerPage() {
  const router = useRouter();
  
  // State for Step 1: Model / Order Scan
  const [orderQuery, setOrderQuery] = useState("");
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");

  // State for Step 2: Roll Scan
  const [rollQuery, setRollQuery] = useState("");
  const [scannedRolls, setScannedRolls] = useState<any[]>([]);
  const [loadingRoll, setLoadingRoll] = useState(false);
  const [rollError, setRollError] = useState("");
  
  // Auto-focus refs
  const orderInputRef = useRef<HTMLInputElement>(null);
  const rollInputRef = useRef<HTMLInputElement>(null);

  // Focus the order input initially
  useEffect(() => {
    orderInputRef.current?.focus();
  }, []);

  const handleOrderScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!orderQuery.trim()) return;
      
      setLoadingOrder(true);
      setOrderError("");
      setActiveOrder(null);
      setScannedRolls([]);

      try {
        let searchedId = orderQuery.trim();
        let q = query(collection(db, "factory_production_orders"), where("orderId", "==", searchedId));
        let snap = await getDocs(q);

        if (snap.empty) {
          q = query(collection(db, "factory_production_orders"), where("modelName", "==", searchedId));
          snap = await getDocs(q);
        }

        // If still not found, try to find product barcode
        if (snap.empty) {
          const productQ = query(collection(db, "products"), where("barcodes", "array-contains", searchedId));
          const productSnap = await getDocs(productQ);
          if (!productSnap.empty) {
            const modelNum = productSnap.docs[0].data().modelNumber;
            if (modelNum) {
              q = query(collection(db, "factory_production_orders"), where("modelName", "==", modelNum));
              snap = await getDocs(q);
            }
          }
        }

        if (!snap.empty) {
          const orderData = { id: snap.docs[0].id, ...snap.docs[0].data() };
          setActiveOrder(orderData);
          setScannedRolls(orderData.used_rolls || []);
          setOrderQuery("");
          // Switch focus to the rolls scanner
          setTimeout(() => rollInputRef.current?.focus(), 100);
        } else {
          setOrderError("لم يتم العثور على أمر الشغل أو الموديل.");
        }
      } catch (err) {
        setOrderError("حدث خطأ أثناء البحث.");
      } finally {
        setLoadingOrder(false);
      }
    }
  };

  const handleRollScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!rollQuery.trim() || !activeOrder) return;

      setLoadingRoll(true);
      setRollError("");

      try {
        const rollCode = rollQuery.trim();
        // Check if already scanned
        if (scannedRolls.some(r => r.code === rollCode)) {
          setRollError("تم إسكان هذا التوب من قبل!");
          setRollQuery("");
          setLoadingRoll(false);
          return;
        }

        // Fetch roll from DB
        const q = query(collection(db, "factory_fabric_rolls"), where("code", "==", rollCode));
        const snap = await getDocs(q);

        if (snap.empty) {
          setRollError(`التوب (${rollCode}) غير مسجل في المخزن!`);
        } else {
          const rollDoc = snap.docs[0];
          const rollData = rollDoc.data();

          if (rollData.status === "used") {
            setRollError("هذا التوب تم صرفه مسبقاً!");
          } else {
            // Deduct and link
            const newRoll = { id: rollDoc.id, ...rollData };
            const updatedRolls = [newRoll, ...scannedRolls];
            
            // Update UI
            setScannedRolls(updatedRolls);
            
            // Update DB (Roll status)
            await updateDoc(doc(db, "factory_fabric_rolls", rollDoc.id), { status: "used", usedInOrder: activeOrder.id });
            
            // Update DB (Order used rolls)
            await updateDoc(doc(db, "factory_production_orders", activeOrder.id), { used_rolls: updatedRolls });
            
            // Optional: Play beep sound here
          }
        }
      } catch (err) {
        setRollError("حدث خطأ أثناء فحص التوب.");
      } finally {
        setRollQuery("");
        setLoadingRoll(false);
        // Keep focus on roll scanner
        setTimeout(() => rollInputRef.current?.focus(), 100);
      }
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          📦 صرف الأتواب (مخزن القماش)
        </h1>
        <button 
          onClick={() => router.back()}
          className="btn bg-gray-200 text-gray-700 font-bold px-4 py-2 rounded-lg"
        >
          رجوع
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Step 1: Model Scan */}
        <div className={`card p-6 shadow-sm rounded-xl border-t-4 ${activeOrder ? 'border-t-green-500 bg-green-50' : 'border-t-primary bg-white'}`}>
          <h2 className="text-lg font-bold mb-4">1. إسكان الموديل أو أمر الشغل</h2>
          <input 
            ref={orderInputRef}
            type="text" 
            className="input w-full p-4 text-center text-xl font-bold rounded-lg border-2" 
            placeholder="مرر باركود الموديل أو اكتب رقم الموديل واضغط Enter" 
            value={orderQuery}
            onChange={e => setOrderQuery(e.target.value)}
            onKeyDown={handleOrderScan}
            disabled={loadingOrder}
            autoFocus
          />
          {loadingOrder && <p className="text-blue-500 mt-2 font-bold">جاري البحث...</p>}
          {orderError && <p className="text-red-500 mt-2 font-bold">{orderError}</p>}
          
          {activeOrder && (
            <div className="mt-4 p-4 bg-white rounded-lg border border-green-200">
              <h3 className="font-bold text-green-800">✅ تم تحديد الموديل: {activeOrder.modelName}</h3>
              <p className="text-gray-600 mt-1">الكمية المطلوبة: {activeOrder.totalQuantity} قطعة</p>
              <button 
                onClick={() => {
                  setActiveOrder(null);
                  setScannedRolls([]);
                  setTimeout(() => orderInputRef.current?.focus(), 100);
                }}
                className="text-sm text-red-600 mt-3 underline"
              >
                إلغاء واختيار موديل آخر
              </button>
            </div>
          )}
        </div>

        {/* Step 2: Roll Scan (Only visible if order is active) */}
        {activeOrder && (
          <div className="card p-6 bg-white shadow-sm rounded-xl border-t-4 border-t-blue-500">
            <h2 className="text-lg font-bold mb-4">2. إسكان أتواب القماش لخصمها</h2>
            <input 
              ref={rollInputRef}
              type="text" 
              className="input w-full p-4 text-center text-xl font-bold rounded-lg border-2 border-blue-300 focus:border-blue-600 bg-blue-50" 
              placeholder="مرر باركود التوب لخصمه فوراً..." 
              value={rollQuery}
              onChange={e => setRollQuery(e.target.value)}
              onKeyDown={handleRollScan}
              disabled={loadingRoll}
            />
            {loadingRoll && <p className="text-blue-500 mt-2 font-bold">جاري الصرف...</p>}
            {rollError && <p className="text-red-500 mt-2 font-bold">{rollError}</p>}
            
            <div className="mt-6">
              <h3 className="font-bold text-gray-700 mb-3 border-b pb-2">الأتواب التي تم صرفها لهذا الأمر ({scannedRolls.length}):</h3>
              {scannedRolls.length === 0 ? (
                <p className="text-gray-400 text-center py-4">لم يتم صرف أي أتواب بعد.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-3">رقم التوب (كود)</th>
                        <th className="p-3">اللون</th>
                        <th className="p-3">الوزن / المتر</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scannedRolls.map((r, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-3 font-bold">{r.code}</td>
                          <td className="p-3">{r.color}</td>
                          <td className="p-3">{r.weight || r.amount} {r.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
