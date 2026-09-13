"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { factoryDepartments } from "../../../lib/departments";
import { db } from "../../../lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { CheckCircle, Search, AlertCircle, ArrowLeft, ArrowRight, Printer, Check } from "lucide-react";

export default function DepartmentDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const departmentId = params.departmentId as string;
  
  const [department, setDepartment] = useState<any>(null);
  
  // Scanner state
  const [orderQuery, setOrderQuery] = useState("");
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const orderInputRef = useRef<HTMLInputElement>(null);

  // Quantities state
  const [receiveQty, setReceiveQty] = useState<number | "">("");
  const [deliverQty, setDeliverQty] = useState<number | "">("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const dept = factoryDepartments.find((d) => d.id === departmentId);
    if (!dept) {
      router.push("/factory/login");
    } else {
      setDepartment(dept);
    }
  }, [departmentId, router]);

  useEffect(() => {
    if (orderInputRef.current && !activeOrder) {
      orderInputRef.current.focus();
    }
  }, [department, activeOrder]);

  const handleOrderScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!orderQuery.trim()) return;

      setLoadingOrder(true);
      setOrderError("");
      setActiveOrder(null);
      
      let rawId = orderQuery.trim();
      let parsedId = rawId;

      // Extract ID if URL
      try {
        if (rawId.includes('http')) {
          const url = new URL(rawId);
          const parts = url.pathname.split('/');
          parsedId = parts[parts.length - 1];
        }
      } catch(e) {}

      // Handle arabic layout swap
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

        // Try direct ID
        const directDocRef = doc(db, "factory_production_orders", finalId);
        const directDocSnap = await getDoc(directDocRef);
        
        if (directDocSnap.exists()) {
          orderDoc = directDocSnap.data();
        } else {
          // Try shortId
          const q = query(collection(db, "factory_production_orders"), where("shortId", "==", finalId.toUpperCase()));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            orderDoc = querySnapshot.docs[0].data();
            orderDocId = querySnapshot.docs[0].id;
          }
        }

        if (!orderDoc) {
          setOrderError("لم يتم العثور على أمر الشغل!");
        } else {
          setActiveOrder({ id: orderDocId, ...orderDoc });
          // Initialize quantities based on what was previously submitted
          const progress = orderDoc.departmentsProgress?.[departmentId] || { receivedQty: 0, deliveredQty: 0 };
          
          // Suggest default receive quantity: full order quantity minus what we already received
          const totalQty = Number(orderDoc.totalQuantity || 0);
          const remainingToReceive = Math.max(0, totalQty - progress.receivedQty);
          setReceiveQty(remainingToReceive > 0 ? remainingToReceive : "");
          
          // Suggest default deliver quantity: what we received minus what we delivered
          const remainingToDeliver = Math.max(0, progress.receivedQty - progress.deliveredQty);
          setDeliverQty(remainingToDeliver > 0 ? remainingToDeliver : "");
        }
      } catch (err) {
        console.error(err);
        setOrderError("حدث خطأ أثناء البحث.");
      } finally {
        setLoadingOrder(false);
        setOrderQuery("");
      }
    }
  };

  const updateProgress = async (type: 'receive' | 'deliver') => {
    if (!activeOrder) return;
    
    let qtyToAdd = type === 'receive' ? Number(receiveQty) : Number(deliverQty);
    if (!qtyToAdd || qtyToAdd <= 0) {
      alert("يرجى إدخال كمية صحيحة!");
      return;
    }

    setIsUpdating(true);
    try {
      const docRef = doc(db, "factory_production_orders", activeOrder.id);
      
      const currentProgress = activeOrder.departmentsProgress?.[departmentId] || { receivedQty: 0, deliveredQty: 0 };
      
      const newProgress = {
        ...currentProgress,
        lastUpdated: new Date().toISOString()
      };
      
      if (type === 'receive') {
        newProgress.receivedQty = (newProgress.receivedQty || 0) + qtyToAdd;
      } else {
        newProgress.deliveredQty = (newProgress.deliveredQty || 0) + qtyToAdd;
      }

      const updateData = {
        [`departmentsProgress.${departmentId}`]: newProgress
      };

      await updateDoc(docRef, updateData);
      
      // Update local state
      setActiveOrder({
        ...activeOrder,
        departmentsProgress: {
          ...(activeOrder.departmentsProgress || {}),
          [departmentId]: newProgress
        }
      });
      
      if (type === 'receive') {
        setReceiveQty("");
        const newRemainingToDeliver = newProgress.receivedQty - newProgress.deliveredQty;
        setDeliverQty(newRemainingToDeliver > 0 ? newRemainingToDeliver : "");
      } else {
        setDeliverQty("");
      }
      
      alert("تم تحديث الكمية بنجاح!");
      
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء التحديث.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (!department) return null;

  const currentProgress = activeOrder?.departmentsProgress?.[departmentId] || { receivedQty: 0, deliveredQty: 0 };

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push("/factory/login")} className="text-gray-500 hover:text-primary transition">
          <ArrowRight size={24} />
        </button>
        <h1 className="text-3xl font-black text-gray-800 tracking-tight">
          لوحة تحكم - {department.name}
        </h1>
      </div>

      {!activeOrder && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
            <Search size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">بحث عن أمر شغل</h2>
          <p className="text-gray-500 mb-6 text-center">اضرب باركود أمر الشغل بالاسكانر للبدء في استلامه أو تمريره</p>
          
          <div className="w-full max-w-md relative">
            <input
              ref={orderInputRef}
              type="text"
              value={orderQuery}
              onChange={(e) => setOrderQuery(e.target.value)}
              onKeyDown={handleOrderScan}
              placeholder="... اسكان باركود الأمر ..."
              className="w-full p-4 pl-12 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none text-center text-lg font-mono transition shadow-inner"
              disabled={loadingOrder}
            />
            {loadingOrder && (
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            )}
          </div>
          
          {orderError && (
            <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg w-full max-w-md">
              <AlertCircle size={20} />
              <span className="font-bold">{orderError}</span>
            </div>
          )}
        </div>
      )}

      {activeOrder && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-blue-600">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="text-sm font-bold text-gray-400 mb-1">الموديل</div>
                  <h2 className="text-3xl font-black text-gray-900">{activeOrder.modelName}</h2>
                  <div className="text-lg text-blue-600 font-bold mt-1">كود: {activeOrder.shortId || activeOrder.id.slice(-6).toUpperCase()}</div>
                </div>
                <div className="text-center bg-gray-50 px-6 py-4 rounded-xl border">
                  <div className="text-sm font-bold text-gray-500 mb-1">الكمية الكلية المستهدفة</div>
                  <div className="text-3xl font-black text-gray-800">{activeOrder.totalQuantity} <span className="text-sm font-normal text-gray-500">قطعة</span></div>
                </div>
              </div>

              {/* Notes Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                {activeOrder.cuttingNotes && <div><strong className="text-yellow-800">ملاحظات القص:</strong> <p className="text-sm mt-1">{activeOrder.cuttingNotes}</p></div>}
                {activeOrder.printingDetails && <div><strong className="text-yellow-800">تفاصيل الطباعة ({activeOrder.printingType}):</strong> <p className="text-sm mt-1">{activeOrder.printingDetails}</p></div>}
                {activeOrder.pressingNotes && <div><strong className="text-yellow-800">ملاحظات الكبس:</strong> <p className="text-sm mt-1">{activeOrder.pressingNotes}</p></div>}
                {activeOrder.sewingNotes && <div><strong className="text-yellow-800">ملاحظات المكن:</strong> <p className="text-sm mt-1">{activeOrder.sewingNotes}</p></div>}
                {activeOrder.generalNotes && <div><strong className="text-yellow-800">ملاحظات عامة:</strong> <p className="text-sm mt-1">{activeOrder.generalNotes}</p></div>}
                
                {!activeOrder.cuttingNotes && !activeOrder.printingDetails && !activeOrder.pressingNotes && !activeOrder.sewingNotes && !activeOrder.generalNotes && (
                  <div className="col-span-full text-center text-yellow-600 py-2">لا توجد ملاحظات خاصة مسجلة لهذا الأمر.</div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold mb-6 border-b pb-2">إحصائيات قسمك</h3>
              
              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-bold text-gray-600">إجمالي المُستلم:</span>
                  <span className="text-xl font-black text-blue-600">{currentProgress.receivedQty}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-bold text-gray-600">إجمالي المُسلم:</span>
                  <span className="text-xl font-black text-green-600">{currentProgress.deliveredQty}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-bold text-gray-600">رصيد بالقسم:</span>
                  <span className="text-xl font-black text-orange-500">{currentProgress.receivedQty - currentProgress.deliveredQty}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 border rounded-xl bg-blue-50/50">
                  <label className="block text-sm font-bold text-blue-800 mb-2">استلام دفعة جديدة</label>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      value={receiveQty} 
                      onChange={(e) => setReceiveQty(e.target.value ? Number(e.target.value) : "")}
                      className="flex-1 p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-center font-bold"
                      placeholder="الكمية"
                    />
                    <button 
                      onClick={() => updateProgress('receive')}
                      disabled={isUpdating || !receiveQty}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-lg font-bold transition disabled:opacity-50"
                    >
                      استلام
                    </button>
                  </div>
                </div>

                <div className="p-4 border rounded-xl bg-green-50/50">
                  <label className="block text-sm font-bold text-green-800 mb-2">تسليم دفعة للقسم التالي</label>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      value={deliverQty} 
                      onChange={(e) => setDeliverQty(e.target.value ? Number(e.target.value) : "")}
                      className="flex-1 p-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-center font-bold"
                      placeholder="الكمية"
                    />
                    <button 
                      onClick={() => updateProgress('deliver')}
                      disabled={isUpdating || !deliverQty}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 rounded-lg font-bold transition disabled:opacity-50"
                    >
                      تسليم
                    </button>
                  </div>
                </div>
              </div>

            </div>

            <button 
              onClick={() => {
                setActiveOrder(null);
                setTimeout(() => orderInputRef.current?.focus(), 100);
              }}
              className="w-full py-4 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-700 transition"
            >
              مسح أمر شغل آخر
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
