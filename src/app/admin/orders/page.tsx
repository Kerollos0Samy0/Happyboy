"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "../../../lib/firebase";
import { collection, onSnapshot, query, orderBy, updateDoc, doc } from "firebase/firestore";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { ChevronDown, ChevronUp, Printer, Save } from "lucide-react";

interface Order {
  id: string;
  orderNumber?: string;
  customerName: string;
  customerPhone: string;
  customerBrand?: string;
  customerGovernorate?: string;
  customerAddress?: string;
  customerShipping?: string;
  total: number;
  deposit?: number;
  deliveryDate?: string;
  status: string;
  items: any[];
  createdAt: any;
}

export default function LiveOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  
  // Temporary state for editing deposit/delivery date
  const [editDeposit, setEditDeposit] = useState<{ [key: string]: string }>({});
  const [editDeliveryDate, setEditDeliveryDate] = useState<{ [key: string]: string }>({});

  const invoiceRef = useRef<HTMLDivElement>(null);
  const [currentPdfOrder, setCurrentPdfOrder] = useState<Order | null>(null);

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      setOrders(ordersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "orders", orderId), { status: newStatus });
    } catch (error) {
      console.error("Error updating status:", error);
      alert("حدث خطأ أثناء التحديث");
    }
  };

  const saveOrderDetails = async (orderId: string) => {
    try {
      const updates: any = {};
      if (editDeposit[orderId] !== undefined) {
        updates.deposit = Number(editDeposit[orderId]);
      }
      if (editDeliveryDate[orderId] !== undefined) {
        updates.deliveryDate = editDeliveryDate[orderId];
      }
      
      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, "orders", orderId), updates);
        alert("تم الحفظ بنجاح");
      }
    } catch (error) {
      console.error("Error saving details:", error);
      alert("حدث خطأ أثناء الحفظ");
    }
  };

  const toggleExpand = (order: Order) => {
    if (expandedOrderId === order.id) {
      setExpandedOrderId(null);
    } else {
      setExpandedOrderId(order.id);
      // Initialize edit state
      setEditDeposit(prev => ({ ...prev, [order.id]: (order.deposit || 0).toString() }));
      setEditDeliveryDate(prev => ({ ...prev, [order.id]: order.deliveryDate || "" }));
    }
  };

  // PDF Generation Logic
  useEffect(() => {
    if (currentPdfOrder) {
      generatePDF(currentPdfOrder);
    }
  }, [currentPdfOrder]);

  const generatePDF = async (order: Order) => {
    if (!invoiceRef.current) return;
    
    const invoiceEl = invoiceRef.current;
    invoiceEl.style.display = "block";
    
    try {
      const canvas = await html2canvas(invoiceEl, {
        scale: 2,
        useCORS: true,
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`invoice_${order.orderNumber || order.id.slice(0, 8)}.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF", err);
      alert("حدث خطأ أثناء استخراج الفاتورة");
    } finally {
      invoiceEl.style.display = "none";
      setCurrentPdfOrder(null);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col items-center mt-6">
      <div className="w-full px-4" style={{ maxWidth: '1200px' }}>
        <h2 className="mb-6 text-center" style={{ color: 'var(--primary)' }}>🔔 الطلبات الحية (Live Orders)</h2>
        
        {loading ? (
          <p className="text-center">جاري تحميل الطلبات...</p>
        ) : orders.length === 0 ? (
          <div className="card text-center"><p>لا توجد طلبات حتى الآن.</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((order) => (
              <div key={order.id} className="card flex flex-col justify-between" style={{ padding: '1rem' }}>
                {/* Header (Always Visible) */}
                <div 
                  className="cursor-pointer flex justify-between items-start" 
                  onClick={() => toggleExpand(order)}
                >
                  <div>
                    <h3 className="font-bold text-lg mb-1">
                      طلب رقم: <span className="text-blue-600">{order.orderNumber || order.id.slice(0, 8)}</span>
                    </h3>
                    <p className="text-sm font-bold text-gray-800">{order.customerBrand || order.customerName}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString('ar-EG') : 'الآن'}
                    </p>
                  </div>
                  <div className="text-left flex flex-col items-end">
                    <p className="font-bold text-lg" style={{ color: 'var(--success)' }}>{order.total} ج.م</p>
                    {expandedOrderId === order.id ? <ChevronUp className="mt-2 text-gray-400" /> : <ChevronDown className="mt-2 text-gray-400" />}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedOrderId === order.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 animate-fade-in">
                    <div className="mb-4 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                      <p><strong>العميل:</strong> {order.customerName}</p>
                      <p><strong>الهاتف:</strong> <span dir="ltr">{order.customerPhone}</span></p>
                      {(order.customerGovernorate || order.customerAddress) && (
                        <p className="mt-1">
                          <strong>الشحن:</strong> {order.customerGovernorate} - {order.customerAddress} ({order.customerShipping})
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <label className="block text-xs font-bold mb-1">موعد التسليم</label>
                        <input 
                          type="date" 
                          className="input w-full p-2 text-sm"
                          value={editDeliveryDate[order.id] !== undefined ? editDeliveryDate[order.id] : (order.deliveryDate || "")}
                          onChange={(e) => setEditDeliveryDate(prev => ({ ...prev, [order.id]: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1">العربون (ج.م)</label>
                        <input 
                          type="number" 
                          className="input w-full p-2 text-sm"
                          value={editDeposit[order.id] !== undefined ? editDeposit[order.id] : (order.deposit || 0)}
                          onChange={(e) => setEditDeposit(prev => ({ ...prev, [order.id]: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 mb-4">
                      <button 
                        onClick={() => saveOrderDetails(order.id)} 
                        className="btn btn-primary flex-1 py-2 text-sm flex justify-center items-center gap-1"
                      >
                        <Save size={16} /> حفظ البيانات
                      </button>
                      <button 
                        onClick={() => setCurrentPdfOrder(order)} 
                        className="btn btn-secondary flex-1 py-2 text-sm flex justify-center items-center gap-1"
                      >
                        <Printer size={16} /> طباعة الفاتورة
                      </button>
                    </div>

                    <select 
                      className="input w-full p-2 mb-4 text-sm font-bold bg-gray-50"
                      value={order.status}
                      onChange={(e) => updateStatus(order.id, e.target.value)}
                    >
                      <option value="pending">⏳ قيد الانتظار</option>
                      <option value="paid">✅ تم الدفع والتأكيد</option>
                      <option value="cancelled">❌ ملغي</option>
                    </select>

                    <div>
                      <p className="font-bold text-sm mb-2 text-primary border-b pb-1">محتويات الطلب:</p>
                      <ul style={{ listStyleType: 'disc', paddingRight: '1.25rem' }}>
                        {order.items?.map((item: any) => (
                          <li key={item.cartItemId} className="text-xs mb-1 text-gray-700">
                            {item.name} (موديل {item.modelNumber}) - لون ({item.selectedColor})
                            {item.isSeri ? ` - ثري (${item.sizes?.length} قطع)` : ` - قطعة`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Hidden Invoice Template for PDF Generation */}
        <div 
          ref={invoiceRef} 
          style={{ 
            display: "none", 
            width: "800px", 
            padding: "40px", 
            background: "white", 
            color: "black",
            position: "absolute",
            top: "-9999px",
            left: "-9999px",
            direction: "rtl"
          }}
        >
          {currentPdfOrder && (
            <>
              <div style={{ textAlign: "center", marginBottom: "30px", borderBottom: "2px solid #eee", paddingBottom: "20px" }}>
                <h1 style={{ fontSize: "32px", color: "#A62E2E", marginBottom: "10px", fontWeight: "bold" }}>Happy Boy&Girl</h1>
                <h2 style={{ fontSize: "22px", color: "#333" }}>فاتورة طلب رسمي</h2>
              </div>
              
              <div style={{ marginBottom: "30px", padding: "20px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
                  <div style={{ flex: "1 1 45%" }}>
                    <p style={{ fontSize: "18px", marginBottom: "12px" }}><strong>رقم الطلب:</strong> <span style={{ color: "#A62E2E", fontWeight: "bold" }}>{currentPdfOrder.orderNumber || currentPdfOrder.id.slice(0, 8)}</span></p>
                    <p style={{ fontSize: "16px", marginBottom: "8px" }}><strong>اسم العميل:</strong> {currentPdfOrder.customerName}</p>
                    <p style={{ fontSize: "16px", marginBottom: "8px" }}><strong>رقم الهاتف:</strong> <span dir="ltr">{currentPdfOrder.customerPhone}</span></p>
                    <p style={{ fontSize: "16px", marginBottom: "8px" }}><strong>البراند / المحل:</strong> {currentPdfOrder.customerBrand}</p>
                    <p style={{ fontSize: "16px" }}><strong>تاريخ الطلب:</strong> {currentPdfOrder.createdAt?.toDate ? currentPdfOrder.createdAt.toDate().toLocaleDateString('ar-EG') : ''}</p>
                  </div>
                  <div style={{ flex: "1 1 45%" }}>
                    <p style={{ fontSize: "16px", marginBottom: "8px" }}><strong>المحافظة:</strong> {currentPdfOrder.customerGovernorate || 'غير مسجل'}</p>
                    <p style={{ fontSize: "16px", marginBottom: "8px" }}><strong>العنوان التفصيلي:</strong> {currentPdfOrder.customerAddress || 'غير مسجل'}</p>
                    <p style={{ fontSize: "16px", marginBottom: "8px" }}><strong>شركة الشحن:</strong> {currentPdfOrder.customerShipping || 'غير مسجل'}</p>
                    <p style={{ fontSize: "16px", color: "#2563eb", fontWeight: "bold" }}><strong>موعد التسليم المتوقع:</strong> {currentPdfOrder.deliveryDate || 'لم يحدد بعد'}</p>
                  </div>
                </div>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "30px" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                    <th style={{ padding: "12px", textAlign: "right" }}>الصنف</th>
                    <th style={{ padding: "12px", textAlign: "right" }}>اللون</th>
                    <th style={{ padding: "12px", textAlign: "right" }}>المقاسات</th>
                    <th style={{ padding: "12px", textAlign: "center" }}>الكمية</th>
                    <th style={{ padding: "12px", textAlign: "center" }}>السعر</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPdfOrder.items?.map((item: any, i: number) => (
                    <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "12px" }}>{item.name} (موديل {item.modelNumber})</td>
                      <td style={{ padding: "12px" }}>{item.selectedColor}</td>
                      <td style={{ padding: "12px" }}>{item.isSeri ? item.sizes.join(' - ') : 'قطعة واحدة'}</td>
                      <td style={{ padding: "12px", textAlign: "center" }}>{item.isSeri ? `${item.sizes.length} قطع (ثري)` : '1'}</td>
                      <td style={{ padding: "12px", textAlign: "center" }}>{item.price} ج.م</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ width: "350px", background: "#f8fafc", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "16px" }}>
                    <span>الإجمالي:</span>
                    <strong>{currentPdfOrder.total} ج.م</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "16px", color: "#16a34a" }}>
                    <span>العربون المدفوع:</span>
                    <strong>{currentPdfOrder.deposit || 0} ج.م</strong>
                  </div>
                  <div style={{ borderTop: "2px solid #cbd5e1", margin: "10px 0" }}></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "20px", color: "#A62E2E", fontWeight: "bold" }}>
                    <span>المبلغ المتبقي:</span>
                    <span>{currentPdfOrder.total - (currentPdfOrder.deposit || 0)} ج.م</span>
                  </div>
                </div>
              </div>
              
              <div style={{ marginTop: "40px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>
                <p>شكراً لتعاملكم مع Happy Boy&Girl</p>
                <p>نتمنى لكم يوماً سعيداً</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
