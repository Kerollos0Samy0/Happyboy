"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { factoryDepartments } from "../../../lib/departments";
import { db } from "../../../lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { CheckCircle, Search, AlertCircle, ArrowLeft, ArrowRight, Printer, Check, Camera } from "lucide-react";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";

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

  // Printing Dept State
  const [printingLog, setPrintingLog] = useState<{
    tshirtPrints: number;
    pantsPrints: number;
    type: string;
    colors: { fabric: string; print: string; meters: number }[];
  }>({ tshirtPrints: 0, pantsPrints: 0, type: '', colors: [] });
  const [isSavingPrinting, setIsSavingPrinting] = useState(false);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  const fetchPendingOrders = async () => {
    if (departmentId !== "fabric_order" && departmentId !== "fabric_warehouse") return;
    setLoadingPending(true);
    try {
      const q = query(
        collection(db, "factory_production_orders"), 
        where("routedTo", "==", departmentId)
      );
      const snap = await getDocs(q);
      const orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort in memory by lastRoutedAt desc
      orders.sort((a: any, b: any) => {
        const dA = a.lastRoutedAt ? new Date(a.lastRoutedAt).getTime() : 0;
        const dB = b.lastRoutedAt ? new Date(b.lastRoutedAt).getTime() : 0;
        return dB - dA;
      });
      setPendingOrders(orders);
    } catch (e) {
      console.error("Error fetching pending orders", e);
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    fetchPendingOrders();
  }, [departmentId]);

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    if (isScannerOpen) {
      scanner = new Html5QrcodeScanner(
        "dept-reader",
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

  const processScan = async (queryText: string) => {
    if (!queryText.trim()) return;

    setLoadingOrder(true);
    setOrderError("");
    setActiveOrder(null);
    
    let rawId = queryText.trim();
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

        if (departmentId === "printing_laser") {
          if (orderDoc.printingLog) {
            setPrintingLog(orderDoc.printingLog);
          } else {
            setPrintingLog({ tshirtPrints: 0, pantsPrints: 0, type: '', colors: [] });
          }
        }
      }
    } catch (err) {
      console.error(err);
      setOrderError("حدث خطأ أثناء البحث.");
    } finally {
      setLoadingOrder(false);
      setOrderQuery("");
    }
  };

  const handleOrderScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await processScan(orderQuery);
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
        if (!newProgress.firstReceivedAt) {
          newProgress.firstReceivedAt = new Date().toISOString();
        }
      } else {
        newProgress.deliveredQty = (newProgress.deliveredQty || 0) + qtyToAdd;
        newProgress.lastDeliveredAt = new Date().toISOString();
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

  const routeOrder = async (targetDept: string) => {
    if (!activeOrder) return;
    setIsUpdating(true);
    try {
      const docRef = doc(db, "factory_production_orders", activeOrder.id);
      
      const updateData = {
        routedTo: targetDept,
        lastRoutedAt: new Date().toISOString()
      };

      await updateDoc(docRef, updateData);
      
      setActiveOrder({
        ...activeOrder,
        ...updateData
      });
      
      alert(targetDept === "fabric_order" ? "تم التوجيه إلى أوردر القماش بنجاح!" : "تم التوجيه إلى مخزن القماش بنجاح!");
      
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء التوجيه.");
    } finally {
      setIsUpdating(false);
    }
  };

  const savePrintingLog = async () => {
    if (!activeOrder) return;
    setIsSavingPrinting(true);
    try {
      await updateDoc(doc(db, "factory_production_orders", activeOrder.id), {
        printingLog
      });
      alert("تم حفظ بيانات الطباعة بنجاح!");
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الحفظ.");
    } finally {
      setIsSavingPrinting(false);
    }
  };

  if (!department) return null;

  const currentProgress = activeOrder?.departmentsProgress?.[departmentId] || { receivedQty: 0, deliveredQty: 0 };

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/factory/login")} className="text-gray-500 hover:text-primary transition">
            <ArrowRight size={24} />
          </button>
          <h1 className="text-3xl font-black text-gray-800 tracking-tight">
            لوحة تحكم - {department.name}
          </h1>
        </div>
        <button 
          onClick={() => router.push("/factory/order-tracking")}
          className="flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-xl font-bold hover:bg-blue-200 transition"
        >
          <Search size={18} />
          استعلام عن موديل
        </button>
      </div>

      {!activeOrder && department.id === "fabric_warehouse" && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col items-center">
          <h2 className="text-xl font-bold text-gray-800 mb-2">📦 ماسح الأتواب (مخزن القماش)</h2>
          <p className="text-gray-500 mb-6 text-center">استخدم الماسح الخاص بالمخزن لقراءة الباركود الخاص بأتواب القماش وصرفها.</p>
          <button 
            onClick={() => router.push("/factory/fabric_scanner")}
            className="w-full max-w-md py-4 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-700 transition"
          >
            فتح شاشة صرف / مرتجع الأتواب
          </button>
        </div>
      )}

      {!activeOrder && department.id !== "fabric_warehouse" && (
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
          
          <button 
            onClick={() => setIsScannerOpen(!isScannerOpen)}
            className="mt-6 flex items-center justify-center gap-2 w-full max-w-md bg-gray-800 text-white p-3 rounded-xl font-bold hover:bg-gray-900 transition shadow-lg"
          >
            <Camera size={20} /> {isScannerOpen ? "أغلق الكاميرا" : "افتح كاميرا الموبايل للاسكان"}
          </button>
          
          {isScannerOpen && (
            <div className="mt-4 w-full max-w-md border-2 rounded-xl overflow-hidden shadow-sm bg-gray-50">
              <div id="dept-reader" width="100%"></div>
            </div>
          )}
          {orderError && (
            <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg w-full max-w-md">
              <AlertCircle size={20} />
              <span className="font-bold">{orderError}</span>
            </div>
          )}

          {department.id === "samples" && (
            <div className="mt-10 pt-8 border-t border-gray-100 w-full max-w-md flex flex-col items-center">
              <h3 className="text-gray-600 font-bold mb-4">أو يمكنك إنشاء أمر جديد:</h3>
              <button 
                onClick={() => router.push("/factory/production/new")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl font-black text-lg transition shadow-md flex items-center justify-center gap-2"
              >
                <span className="text-2xl">+</span> إنشاء أمر شغل جديد
              </button>
            </div>
          )}
        </div>
      )}

      {!activeOrder && (department.id === "fabric_order" || department.id === "fabric_warehouse") && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-orange-500 mt-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <AlertCircle className="text-orange-500" />
            طلبات قماش معلقة (موجهة من العينات)
          </h2>
          
          {loadingPending ? (
            <div className="text-center p-6 text-gray-500">جاري تحميل الطلبات...</div>
          ) : pendingOrders.length === 0 ? (
            <div className="text-center p-6 bg-gray-50 rounded-xl text-gray-500 border border-dashed border-gray-300">
              لا توجد طلبات قماش معلقة في الوقت الحالي.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-orange-50 text-orange-800 rounded-t-lg">
                    <th className="p-3 rounded-tr-lg">كود الموديل</th>
                    <th className="p-3">اسم الموديل</th>
                    <th className="p-3">نوع القماش</th>
                    <th className="p-3">الكمية المستهدفة</th>
                    <th className="p-3 rounded-tl-lg">الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingOrders.map(order => (
                    <tr key={order.id} className="border-b border-gray-100 hover:bg-orange-50/50 transition">
                      <td className="p-3 font-bold text-blue-600" dir="ltr">{order.shortId || order.id.slice(-6).toUpperCase()}</td>
                      <td className="p-3 font-bold">{order.modelName}</td>
                      <td className="p-3">{order.fabricType || 'غير محدد'}</td>
                      <td className="p-3">
                        {order.colorPairs 
                          ? order.colorPairs.reduce((sum: number, pair: any) => sum + (Number(pair.quantity) || 0), 0)
                          : order.totalQuantity} طقم
                      </td>
                      <td className="p-3">
                        <button 
                          onClick={() => processScan(order.shortId || order.id.slice(-6).toUpperCase())}
                          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold text-sm transition"
                        >
                          فتح الأمر للتنفيذ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  {department.id === "samples" && (
                    <button 
                      onClick={() => router.push(`/factory/production/edit/${activeOrder.id}`)}
                      className="mt-4 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-bold transition text-sm flex items-center gap-2 border border-gray-300 shadow-sm"
                    >
                      تعديل بيانات أمر الشغل
                    </button>
                  )}
                </div>
                <div className="text-center bg-gray-50 px-6 py-4 rounded-xl border">
                  <div className="text-sm font-bold text-gray-500 mb-1">الكمية المستهدفة (عدد الأطقم)</div>
                  <div className="text-3xl font-black text-gray-800">
                    {activeOrder.colorPairs 
                      ? activeOrder.colorPairs.reduce((sum: number, pair: any) => sum + (Number(pair.quantity) || 0), 0)
                      : activeOrder.totalQuantity} <span className="text-sm font-normal text-gray-500">طقم/ترنج</span>
                  </div>
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
              
              {/* Fabric Requirements Section */}
              {activeOrder.fabricRequirements && activeOrder.fabricRequirements.length > 0 && (
                <div className="mt-6 border-t pt-6">
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    🛍️ متطلبات القماش للموديل
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right bg-white rounded-lg overflow-hidden border">
                      <thead>
                        <tr className="bg-orange-50 text-orange-900 border-b">
                          <th className="p-3 font-bold">اللون</th>
                          <th className="p-3 font-bold">عدد الأتواب</th>
                          <th className="p-3 font-bold">الخامة</th>
                          <th className="p-3 font-bold">المورد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeOrder.fabricRequirements.map((req: any, idx: number) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="p-3">{req.color || '-'}</td>
                            <td className="p-3 font-bold text-blue-600">{req.count || '-'}</td>
                            <td className="p-3">{req.material || '-'}</td>
                            <td className="p-3">{req.supplier || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            
            {departmentId === "printing_laser" && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-purple-600 mt-6">
                <h3 className="text-xl font-bold mb-6 border-b pb-2 text-purple-900">تسجيل بيانات الطباعة</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">عدد طبعات التيشيرت</label>
                    <select 
                      value={printingLog.tshirtPrints} 
                      onChange={(e) => setPrintingLog({ ...printingLog, tshirtPrints: Number(e.target.value) })}
                      className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value={0}>بدون طباعة</option>
                      <option value={1}>طبعة واحدة (1)</option>
                      <option value={2}>طبعتين (2)</option>
                      <option value={3}>3 طبعات (3)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">عدد طبعات البنطلون</label>
                    <select 
                      value={printingLog.pantsPrints} 
                      onChange={(e) => setPrintingLog({ ...printingLog, pantsPrints: Number(e.target.value) })}
                      className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value={0}>بدون طباعة</option>
                      <option value={1}>طبعة واحدة (1)</option>
                      <option value={2}>طبعتين (2)</option>
                      <option value={3}>3 طبعات (3)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">نوع الطباعة</label>
                    <select 
                      value={printingLog.type} 
                      onChange={(e) => setPrintingLog({ ...printingLog, type: e.target.value })}
                      className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">-- اختر نوع الطباعة --</option>
                      <option value="DTF">DTF</option>
                      <option value="Rubber">رابر (Rubber)</option>
                      <option value="Puff">باف (Puff)</option>
                      <option value="Vinyl">فينيل (Vinyl)</option>
                    </select>
                  </div>
                </div>

                <h4 className="font-bold text-gray-700 mb-4 border-b pb-2">أمتار الطباعة لكل لون</h4>
                {printingLog.colors.map((pc, idx) => (
                  <div key={idx} className="flex gap-4 mb-4 items-end">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-500 mb-1">لون القماش الأساسي</label>
                      <input 
                        type="text" 
                        value={pc.fabric} 
                        onChange={(e) => {
                          const newC = [...printingLog.colors];
                          newC[idx].fabric = e.target.value;
                          setPrintingLog({ ...printingLog, colors: newC });
                        }}
                        className="w-full p-2 border rounded outline-none text-sm"
                        placeholder="مثال: أسود"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-500 mb-1">لون الطباعة عليه</label>
                      <input 
                        type="text" 
                        value={pc.print} 
                        onChange={(e) => {
                          const newC = [...printingLog.colors];
                          newC[idx].print = e.target.value;
                          setPrintingLog({ ...printingLog, colors: newC });
                        }}
                        className="w-full p-2 border rounded outline-none text-sm"
                        placeholder="مثال: أحمر"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-500 mb-1">الأمتار المسحوبة</label>
                      <input 
                        type="number" 
                        value={pc.meters} 
                        onChange={(e) => {
                          const newC = [...printingLog.colors];
                          newC[idx].meters = Number(e.target.value);
                          setPrintingLog({ ...printingLog, colors: newC });
                        }}
                        className="w-full p-2 border rounded outline-none text-sm font-bold text-purple-700 text-center"
                        placeholder="0"
                      />
                    </div>
                    <button 
                      onClick={() => {
                        const newC = [...printingLog.colors];
                        newC.splice(idx, 1);
                        setPrintingLog({ ...printingLog, colors: newC });
                      }}
                      className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded transition"
                    >
                      حذف
                    </button>
                  </div>
                ))}
                
                <button 
                  onClick={() => setPrintingLog({ ...printingLog, colors: [...printingLog.colors, { fabric: '', print: '', meters: 0 }] })}
                  className="text-purple-600 font-bold text-sm bg-purple-50 px-4 py-2 rounded hover:bg-purple-100 transition mt-2"
                >
                  + إضافة لون وأمتار
                </button>

                <div className="mt-6 flex justify-end">
                  <button 
                    onClick={savePrintingLog}
                    disabled={isSavingPrinting}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-bold transition flex items-center gap-2 disabled:opacity-50 shadow-md"
                  >
                    {isSavingPrinting ? "جاري الحفظ..." : "حفظ بيانات الطباعة والأمتار"}
                  </button>
                </div>
              </div>
            )}
            
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              {department.id === "samples" ? (
                <>
                  <h3 className="text-xl font-bold mb-6 border-b pb-2">توجيه أمر الشغل</h3>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500 mb-4">بعد الانتهاء من العينة وكتابة تفاصيل الموديل، اختر مسار الموديل التالي:</p>
                    <button 
                      onClick={() => routeOrder("fabric_order")}
                      disabled={isUpdating}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl font-bold transition disabled:opacity-50 text-lg shadow-sm"
                    >
                      طلب قماش (أوردر قماش)
                    </button>
                    <button 
                      onClick={() => routeOrder("fabric_warehouse")}
                      disabled={isUpdating}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-xl font-bold transition disabled:opacity-50 text-lg shadow-sm"
                    >
                      إرسال لمخزن القماش (متاح)
                    </button>
                    
                    {activeOrder.routedTo && (
                      <div className="mt-4 p-3 bg-green-50 text-green-800 rounded-lg border border-green-200 text-center font-bold text-sm">
                        تم توجيه هذا الأمر مسبقاً إلى: {activeOrder.routedTo === "fabric_order" ? "أوردر قماش" : "مخزن القماش"}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
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
                      <div className="flex flex-col gap-3">
                        <input 
                          type="number" 
                          value={receiveQty} 
                          onChange={(e) => setReceiveQty(e.target.value ? Number(e.target.value) : "")}
                          className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-center font-bold text-lg"
                          placeholder="الكمية"
                        />
                        <button 
                          onClick={() => updateProgress('receive')}
                          disabled={isUpdating || !receiveQty}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-bold transition disabled:opacity-50 text-lg shadow-sm"
                        >
                          استلام
                        </button>
                      </div>
                    </div>

                    <div className="p-4 border rounded-xl bg-green-50/50">
                      <label className="block text-sm font-bold text-green-800 mb-2">تسليم دفعة للقسم التالي</label>
                      <div className="flex flex-col gap-3">
                        <input 
                          type="number" 
                          value={deliverQty} 
                          onChange={(e) => setDeliverQty(e.target.value ? Number(e.target.value) : "")}
                          className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-center font-bold text-lg"
                          placeholder="الكمية"
                        />
                        <button 
                          onClick={() => updateProgress('deliver')}
                          disabled={isUpdating || !deliverQty}
                          className="w-full bg-green-500 hover:bg-green-600 text-white p-3 rounded-lg font-bold transition disabled:opacity-50 text-lg shadow-sm"
                        >
                          تسليم
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
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
