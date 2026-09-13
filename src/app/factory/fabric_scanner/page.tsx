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
  const [expectedRolls, setExpectedRolls] = useState<any[]>([]);
  const [verifiedRolls, setVerifiedRolls] = useState<any[]>([]);
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
      setExpectedRolls([]);
      setVerifiedRolls([]);

      try {
        let rawId = orderQuery.trim();
        // Fix Arabic keyboard layout issue
        const arabicMap: Record<string, string> = {
          'ض': 'q', 'ص': 'w', 'ث': 'e', 'ق': 'r', 'ف': 't', 'غ': 'y', 'ع': 'u', 'ه': 'i', 'خ': 'o', 'ح': 'p', 'ج': '[', 'د': ']',
          'ش': 'a', 'س': 's', 'ي': 'd', 'ب': 'f', 'ل': 'g', 'ا': 'h', 'ت': 'j', 'ن': 'k', 'م': 'l', 'ك': ';', 'ط': "'",
          'ئ': 'z', 'ء': 'x', 'ؤ': 'c', 'ر': 'v', 'لا': 'b', 'ى': 'n', 'ة': 'm', 'و': ',', 'ز': '.', 'ظ': '/',
          'َ': 'Q', 'ً': 'W', 'ُ': 'E', 'ٌ': 'R', 'لإ': 'T', 'إ': 'Y', '‘': 'U', '÷': 'I', '×': 'O', '؛': 'P',
          'ِ': 'A', 'ٍ': 'S', ']': 'D', '[': 'F', 'لأ': 'G', 'أ': 'H', 'ـ': 'J', '،': 'K', '/': 'L', ':': ':', '"': '"',
          '~': 'Z', 'ْ': 'X', '}': 'C', '{': 'V', 'لآ': 'B', 'آ': 'N', '’': 'M', ',': '<', '.': '>', '؟': '?'
        };
        let searchedId = "";
        for (let i = 0; i < rawId.length; i++) {
          const char2 = rawId.substring(i, i + 2);
          if (arabicMap[char2]) { searchedId += arabicMap[char2]; i++; }
          else { searchedId += arabicMap[rawId[i]] || rawId[i]; }
        }
        
        let orderData = null;

        // If it's a full URL (from QR code), extract the last part
        if (searchedId.includes('/')) {
          searchedId = searchedId.split('/').pop() || searchedId;
        }

        // 1. Try Document ID directly
        if (searchedId.length > 10) {
          const docRef = doc(db, "factory_production_orders", searchedId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            orderData = { id: docSnap.id, ...docSnap.data() };
          }
        }

        // 2. Try shortId
        if (!orderData) {
          const qShort = query(collection(db, "factory_production_orders"), where("shortId", "==", searchedId.toUpperCase()));
          const snapShort = await getDocs(qShort);
          if (!snapShort.empty) {
            orderData = { id: snapShort.docs[0].id, ...snapShort.docs[0].data() };
          } else {
             // Fallback for old orders that don't have shortId
             const allOrdersSnap = await getDocs(collection(db, "factory_production_orders"));
             const oldOrder = allOrdersSnap.docs.find(d => d.id.slice(-6).toUpperCase() === searchedId.toUpperCase());
             if (oldOrder) orderData = { id: oldOrder.id, ...oldOrder.data() };
          }
        }

        // 3. Try modelName
        if (!orderData) {
          const qModel = query(collection(db, "factory_production_orders"), where("modelName", "==", searchedId));
          const snapModel = await getDocs(qModel);
          if (!snapModel.empty) {
            orderData = { id: snapModel.docs[0].id, ...snapModel.docs[0].data() };
          }
        }

        // 4. Try product barcode
        if (!orderData) {
          const productQ = query(collection(db, "products"), where("barcodes", "array-contains", searchedId));
          const productSnap = await getDocs(productQ);
          if (!productSnap.empty) {
            const modelNum = productSnap.docs[0].data().modelNumber;
            if (modelNum) {
              const qModel2 = query(collection(db, "factory_production_orders"), where("modelName", "==", modelNum));
              const snapModel2 = await getDocs(qModel2);
              if (!snapModel2.empty) {
                orderData = { id: snapModel2.docs[0].id, ...snapModel2.docs[0].data() };
              }
            }
          }
        }

        if (orderData) {
          setActiveOrder(orderData);
          setExpectedRolls(orderData.used_rolls || []);
          setVerifiedRolls(orderData.verified_rolls || []);
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
        let rawId = rollQuery.trim();
        const arabicMap: Record<string, string> = {
          'ض': 'q', 'ص': 'w', 'ث': 'e', 'ق': 'r', 'ف': 't', 'غ': 'y', 'ع': 'u', 'ه': 'i', 'خ': 'o', 'ح': 'p', 'ج': '[', 'د': ']',
          'ش': 'a', 'س': 's', 'ي': 'd', 'ب': 'f', 'ل': 'g', 'ا': 'h', 'ت': 'j', 'ن': 'k', 'م': 'l', 'ك': ';', 'ط': "'",
          'ئ': 'z', 'ء': 'x', 'ؤ': 'c', 'ر': 'v', 'لا': 'b', 'ى': 'n', 'ة': 'm', 'و': ',', 'ز': '.', 'ظ': '/',
          'َ': 'Q', 'ً': 'W', 'ُ': 'E', 'ٌ': 'R', 'لإ': 'T', 'إ': 'Y', '‘': 'U', '÷': 'I', '×': 'O', '؛': 'P',
          'ِ': 'A', 'ٍ': 'S', ']': 'D', '[': 'F', 'لأ': 'G', 'أ': 'H', 'ـ': 'J', '،': 'K', '/': 'L', ':': ':', '"': '"',
          '~': 'Z', 'ْ': 'X', '}': 'C', '{': 'V', 'لآ': 'B', 'آ': 'N', '’': 'M', ',': '<', '.': '>', '؟': '?'
        };
        let rollCode = "";
        for (let i = 0; i < rawId.length; i++) {
          const char2 = rawId.substring(i, i + 2);
          if (arabicMap[char2]) { rollCode += arabicMap[char2]; i++; }
          else { rollCode += arabicMap[rawId[i]] || rawId[i]; }
        }
        rollCode = rollCode.toUpperCase();
        // Check if already verified
        if (verifiedRolls.some(r => r.code === rollCode)) {
          setRollError("تم إسكان هذا التوب من قبل!");
          setRollQuery("");
          setLoadingRoll(false);
          return;
        }

        // Check if this roll is expected for this order
        const expectedRoll = expectedRolls.find(r => r.code === rollCode);
        
        if (!expectedRoll) {
          setRollError(`هذا التوب غير مطلوب لهذا الموديل!`);
        } else {
          // Verify and link
          const updatedVerifiedRolls = [...verifiedRolls, expectedRoll];
          
          // Update UI
          setVerifiedRolls(updatedVerifiedRolls);
          
          // Update DB (Order verified rolls)
          await updateDoc(doc(db, "factory_production_orders", activeOrder.id), { verified_rolls: updatedVerifiedRolls });
          
          // Set the roll as 'used' (Deducted) in the fabric_rolls collection
          await updateDoc(doc(db, "factory_fabric_rolls", expectedRoll.id), { 
            status: 'used',
            verifiedAt: new Date().toISOString() 
          });
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
                  setExpectedRolls([]);
                  setVerifiedRolls([]);
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
              <div className="flex justify-between items-center mb-3 border-b pb-2">
                <h3 className="font-bold text-gray-700">قائمة الأتواب المطلوبة للموديل ({expectedRolls.length}):</h3>
                <span className="text-sm font-bold bg-green-100 text-green-700 px-3 py-1 rounded-full">
                  تم سحب {verifiedRolls.length} من {expectedRolls.length}
                </span>
              </div>
              
              {expectedRolls.length === 0 ? (
                <p className="text-gray-400 text-center py-4">لم يتم تحديد أي أتواب لهذا الأمر.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-3">حالة السحب</th>
                        <th className="p-3">رقم التوب (كود)</th>
                        <th className="p-3">اللون</th>
                        <th className="p-3">الوزن / المتر</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expectedRolls.map((r, i) => {
                        const isVerified = verifiedRolls.some(vr => vr.code === r.code);
                        return (
                          <tr key={i} className={`border-b ${isVerified ? 'bg-green-50' : 'bg-white'}`}>
                            <td className="p-3 font-bold">
                              {isVerified ? (
                                <span className="text-green-600 flex items-center gap-1">✅ تم السحب</span>
                              ) : (
                                <span className="text-gray-400 flex items-center gap-1">⏳ قيد الانتظار...</span>
                              )}
                            </td>
                            <td className={`p-3 font-bold ${isVerified ? 'text-green-800' : 'text-gray-800'}`}>{r.code}</td>
                            <td className="p-3">{r.color}</td>
                            <td className="p-3">{r.weight || r.amount} {r.unit}</td>
                          </tr>
                        );
                      })}
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
