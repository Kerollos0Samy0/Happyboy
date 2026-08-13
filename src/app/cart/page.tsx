"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { db } from "../../lib/firebase";
import { collection, addDoc, serverTimestamp, doc, runTransaction } from "firebase/firestore";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface CartItem {
  cartItemId: string;
  id: string;
  name: string;
  modelNumber: string;
  price: number;
  selectedColor: string;
  sizes: string[];
  isSeri: boolean;
  quantity?: number;
}

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerBrand, setCustomerBrand] = useState("");
  
  // Checkout Fields
  const [customerGovernorate, setCustomerGovernorate] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerShipping, setCustomerShipping] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deposit, setDeposit] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  
  const invoiceRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const savedCart = JSON.parse(localStorage.getItem("happyboy_cart") || "[]");
    setCart(savedCart);
    setCustomerName(localStorage.getItem("customerName") || "عميل غير معروف");
    setCustomerPhone(localStorage.getItem("customerPhone") || "");
    setCustomerBrand(localStorage.getItem("customerBrand") || "");
  }, []);

  const calculateItemTotal = (item: CartItem) => {
    const qty = item.quantity || 1;
    if (item.isSeri && item.sizes && item.sizes.length > 0) {
      return item.price * item.sizes.length * qty;
    }
    return item.price * qty;
  };

  const total = cart.reduce((acc, item) => acc + calculateItemTotal(item), 0);
  const depositNum = Number(deposit) || 0;
  const remaining = total - depositNum;

  const removeItem = (id: string) => {
    const newCart = cart.filter(item => item.cartItemId !== id);
    setCart(newCart);
    localStorage.setItem("happyboy_cart", JSON.stringify(newCart));
  };

  const generatePDF = async (orderNum: string) => {
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
      pdf.save(`Happy_Boy_Girl_Order_${orderNum}.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF", err);
      alert("حدث خطأ أثناء استخراج الفاتورة");
    } finally {
      invoiceEl.style.display = "none";
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!customerGovernorate || !customerAddress || !customerShipping) {
      alert("يرجى ملء بيانات العنوان وشركة الشحن أولاً");
      return;
    }
    
    setLoading(true);
    
    try {
      const counterRef = doc(db, "counters", "orders");
      let newOrderNumber = 1;
      
      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        if (!counterDoc.exists()) {
          transaction.set(counterRef, { current: 1 });
          newOrderNumber = 1;
        } else {
          newOrderNumber = counterDoc.data().current + 1;
          transaction.update(counterRef, { current: newOrderNumber });
        }
      });
      
      const formattedOrderNumber = String(newOrderNumber).padStart(5, '0');

      await addDoc(collection(db, "orders"), {
        orderNumber: formattedOrderNumber,
        customerName,
        customerPhone,
        customerBrand,
        customerGovernorate,
        customerAddress,
        customerShipping,
        deliveryDate,
        deposit: depositNum,
        items: cart,
        total,
        status: "pending",
        createdAt: serverTimestamp()
      });
      
      setOrderId(formattedOrderNumber);
      localStorage.removeItem("happyboy_cart");
      
    } catch (error) {
      console.error("Error creating order: ", error);
      alert("حدث خطأ أثناء تأكيد الطلب");
    } finally {
      setLoading(false);
    }
  };

  if (orderId) {
    return (
      <div className="animate-fade-in flex flex-col items-center mt-6">
        <div className="card w-full text-center" style={{ maxWidth: "500px" }}>
          <h2 className="mb-4" style={{ color: "var(--success)" }}>🎉 تم تأكيد الفاتورة بنجاح!</h2>
          <p className="mb-6">رقم الفاتورة: <strong>{orderId}</strong></p>
          
          <div className="p-4 mb-6" style={{ background: "var(--surface-hover)", borderRadius: "var(--radius-md)" }}>
            <h3 className="mb-2">طرق الدفع المتاحة:</h3>
            <p><strong>فودافون كاش:</strong> 01012345678</p>
            <p><strong>انستاباي:</strong> happyboy@instapay</p>
            <p className="mt-2 text-sm font-bold" style={{ color: "var(--primary)" }}>المتبقي دفعه: {remaining} ج.م</p>
          </div>
          
          <div className="flex flex-col gap-2">
            <button onClick={() => generatePDF(orderId)} className="btn btn-primary w-full py-4 text-lg">
              📥 تحميل الفاتورة PDF
            </button>
            <button onClick={() => router.push("/customer")} className="btn btn-outline w-full mt-2">
              فاتورة جديدة
            </button>
          </div>
        </div>

        {/* Hidden Invoice Template */}
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
          <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <h1 style={{ fontSize: "28px", color: "#A62E2E", marginBottom: "10px" }}>Happy Boy&Girl</h1>
            <h2 style={{ fontSize: "20px" }}>فاتورة طلب</h2>
          </div>
          
          <div style={{ marginBottom: "30px", padding: "20px", border: "1px solid #eee", borderRadius: "8px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
              <div style={{ flex: "1 1 45%" }}>
                <p style={{ fontSize: "16px", marginBottom: "8px" }}><strong>رقم الطلب:</strong> {orderId}</p>
                <p style={{ fontSize: "16px", marginBottom: "8px" }}><strong>اسم العميل:</strong> {customerName}</p>
                <p style={{ fontSize: "16px", marginBottom: "8px" }}><strong>رقم الهاتف:</strong> {customerPhone}</p>
                <p style={{ fontSize: "16px" }}><strong>البراند / المحل:</strong> {customerBrand}</p>
              </div>
              <div style={{ flex: "1 1 45%" }}>
                <p style={{ fontSize: "16px", marginBottom: "8px" }}><strong>العنوان:</strong> {customerGovernorate} - {customerAddress}</p>
                <p style={{ fontSize: "16px", marginBottom: "8px" }}><strong>شركة الشحن:</strong> {customerShipping}</p>
                <p style={{ fontSize: "16px", marginBottom: "8px" }}><strong>موعد التسليم المتوقع:</strong> {deliveryDate || 'غير محدد'}</p>
              </div>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "30px" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "12px", borderBottom: "2px solid #e2e8f0", textAlign: "right" }}>المنتج</th>
                <th style={{ padding: "12px", borderBottom: "2px solid #e2e8f0", textAlign: "right" }}>اللون</th>
                <th style={{ padding: "12px", borderBottom: "2px solid #e2e8f0", textAlign: "right" }}>الكمية</th>
                <th style={{ padding: "12px", borderBottom: "2px solid #e2e8f0", textAlign: "right" }}>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item) => {
                const qty = item.quantity || 1;
                return (
                  <tr key={item.cartItemId}>
                    <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>{item.name} (موديل {item.modelNumber})</td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>{item.selectedColor}</td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>
                      {item.isSeri ? `${qty} ثري (${item.sizes.length} مقاسات)` : `${qty} قطعة`}
                    </td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>{calculateItemTotal(item)} ج.م</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ textAlign: "left", fontSize: "18px", background: "#f8fafc", padding: "15px", borderRadius: "8px" }}>
            <p style={{ marginBottom: "5px" }}>الإجمالي الكلي: <strong>{total} ج.م</strong></p>
            <p style={{ marginBottom: "5px", color: "#F59E0B" }}>العربون المدفوع: <strong>{depositNum} ج.م</strong></p>
            <hr style={{ borderTop: "1px solid #e2e8f0", margin: "10px 0" }} />
            <p style={{ fontSize: "20px", color: "#A62E2E", fontWeight: "bold" }}>المتبقي: {remaining} ج.م</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col items-center mt-6">
      <div className="card w-full" style={{ maxWidth: "600px" }}>
        <h2 className="mb-6 text-center" style={{ color: "var(--primary)" }}>🛒 مراجعة وتقفيل الفاتورة</h2>
        
        <div className="mb-4 p-4" style={{ background: "var(--surface-hover)", borderRadius: "var(--radius-md)" }}>
          <h3 className="font-bold mb-2">بيانات العميل:</h3>
          <p><strong>الاسم:</strong> {customerName}</p>
          <p><strong>البراند:</strong> {customerBrand}</p>
          <p><strong>الهاتف:</strong> {customerPhone}</p>
        </div>
        
        <h3 className="font-bold mt-6 mb-3 border-b pb-2">المنتجات المختارة:</h3>
        {cart.length === 0 ? (
          <p className="text-center my-6">الفاتورة فارغة.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {cart.map((item) => {
              const qty = item.quantity || 1;
              return (
                <div key={item.cartItemId} className="flex justify-between items-center p-3" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                  <div className="flex-1">
                    <h4 className="font-bold text-lg">{item.name} (موديل {item.modelNumber})</h4>
                    <p className="text-sm mt-1">اللون: <span className="font-bold">{item.selectedColor}</span></p>
                    {item.isSeri && (
                      <p className="text-sm mt-1">
                        الكمية: <span className="font-bold">{qty} ثري</span> (مقاسات: {item.sizes.join(", ")})
                      </p>
                    )}
                    <p className="text-sm font-bold mt-2 text-green-600">الإجمالي: {calculateItemTotal(item)} ج.م</p>
                  </div>
                  <button 
                    onClick={() => removeItem(item.cartItemId)}
                    className="btn" 
                    style={{ background: 'var(--danger)', color: 'white', padding: '0.25rem 0.75rem' }}
                  >
                    حذف
                  </button>
                </div>
              );
            })}
            
            <div className="flex justify-between items-center mt-4 p-4" style={{ background: 'var(--primary-light)', borderRadius: 'var(--radius-md)' }}>
              <h3 className="font-bold">الإجمالي الكلي:</h3>
              <h3 className="font-bold text-xl">{total} ج.م</h3>
            </div>
            
            <h3 className="font-bold mt-6 mb-3 border-b pb-2">تفاصيل الشحن والدفع (مطلوب):</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 font-bold text-sm">المحافظة</label>
                <input 
                  type="text" 
                  className="input" 
                  value={customerGovernorate}
                  onChange={(e) => setCustomerGovernorate(e.target.value)}
                  placeholder="مثال: القاهرة"
                />
              </div>
              <div>
                <label className="block mb-2 font-bold text-sm">شركة الشحن</label>
                <input 
                  type="text" 
                  className="input" 
                  value={customerShipping}
                  onChange={(e) => setCustomerShipping(e.target.value)}
                  placeholder="مثال: بوسطة"
                />
              </div>
            </div>
            
            <div>
              <label className="block mb-2 font-bold text-sm">العنوان التفصيلي</label>
              <input 
                type="text" 
                className="input" 
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="اسم الشارع، رقم العمارة، الخ..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 font-bold text-sm">ميعاد التسليم</label>
                <input 
                  type="date" 
                  className="input" 
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block mb-2 font-bold text-sm">العربون (ج.م)</label>
                <input 
                  type="number" 
                  className="input" 
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            
            {depositNum > 0 && (
              <div className="text-left font-bold text-lg mt-2 text-red-600">
                المتبقي عند الاستلام: {remaining} ج.م
              </div>
            )}
            
            <button onClick={handleCheckout} disabled={loading} className="btn btn-secondary w-full py-4 text-lg mt-4">
              {loading ? "جاري التأكيد..." : "تأكيد وتقفيل الفاتورة 🚀"}
            </button>
          </div>
        )}
        
        <button onClick={() => router.push("/scan")} className="btn btn-outline w-full py-3 mt-4">
          العودة للمسح لإضافة المزيد
        </button>
      </div>
    </div>
  );
}
