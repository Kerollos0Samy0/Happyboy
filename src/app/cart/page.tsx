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
}

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerBrand, setCustomerBrand] = useState("");
  const [customerGovernorate, setCustomerGovernorate] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerShipping, setCustomerShipping] = useState("");
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
    setCustomerGovernorate(localStorage.getItem("customerGovernorate") || "");
    setCustomerAddress(localStorage.getItem("customerAddress") || "");
    setCustomerShipping(localStorage.getItem("customerShipping") || "");
  }, []);

  const calculateItemTotal = (item: CartItem) => {
    if (item.isSeri && item.sizes && item.sizes.length > 0) {
      return item.price * item.sizes.length;
    }
    return item.price; // fallback if not a seri
  };

  const total = cart.reduce((acc, item) => acc + calculateItemTotal(item), 0);

  const removeItem = (id: string) => {
    const newCart = cart.filter(item => item.cartItemId !== id);
    setCart(newCart);
    localStorage.setItem("happyboy_cart", JSON.stringify(newCart));
  };

  const generatePDF = async (orderNum: string) => {
    if (!invoiceRef.current) return;
    
    // Temporarily make the invoice visible for capturing
    const invoiceEl = invoiceRef.current;
    invoiceEl.style.display = "block";
    
    try {
      const canvas = await html2canvas(invoiceEl, {
        scale: 2, // higher resolution
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
      pdf.save(`invoice_${orderNum}.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF", err);
      alert("حدث خطأ أثناء استخراج الفاتورة");
    } finally {
      // Hide the invoice again
      invoiceEl.style.display = "none";
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
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
        items: cart,
        total,
        status: "pending",
        createdAt: serverTimestamp()
      });
      
      setOrderId(formattedOrderNumber);
      localStorage.removeItem("happyboy_cart"); // Clear cart
      
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
          <h2 className="mb-4" style={{ color: "var(--success)" }}>🎉 تم تأكيد طلبك بنجاح!</h2>
          <p className="mb-6">رقم الطلب الخاص بك: <strong>{orderId}</strong></p>
          
          <div className="p-4 mb-6" style={{ background: "var(--surface-hover)", borderRadius: "var(--radius-md)" }}>
            <h3 className="mb-2">طرق الدفع المتاحة:</h3>
            <p><strong>فودافون كاش:</strong> 01012345678</p>
            <p><strong>انستاباي:</strong> happyboy@instapay</p>
            <p className="mt-2 text-sm text-red-500">يرجى تحويل مبلغ {total} ج.م لتأكيد استلام الطلب من الكاشير.</p>
          </div>
          
          <div className="flex flex-col gap-2">
            <button onClick={() => generatePDF(orderId)} className="btn btn-primary w-full">
              📥 تحميل الفاتورة (PDF)
            </button>
            <button onClick={() => router.push("/customer")} className="btn btn-outline w-full mt-2">
              طلب جديد
            </button>
          </div>
        </div>

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
                <p style={{ fontSize: "16px", marginBottom: "8px" }}><strong>المحافظة:</strong> {customerGovernorate}</p>
                <p style={{ fontSize: "16px", marginBottom: "8px" }}><strong>شركة الشحن:</strong> {customerShipping}</p>
                <p style={{ fontSize: "16px", marginBottom: "8px" }}><strong>العنوان التفصيلي:</strong> {customerAddress}</p>
              </div>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "30px" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "12px", borderBottom: "2px solid #e2e8f0", textAlign: "right" }}>المنتج</th>
                <th style={{ padding: "12px", borderBottom: "2px solid #e2e8f0", textAlign: "right" }}>اللون</th>
                <th style={{ padding: "12px", borderBottom: "2px solid #e2e8f0", textAlign: "right" }}>النوع</th>
                <th style={{ padding: "12px", borderBottom: "2px solid #e2e8f0", textAlign: "right" }}>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item) => (
                <tr key={item.cartItemId}>
                  <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>{item.name} (موديل {item.modelNumber})</td>
                  <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>{item.selectedColor}</td>
                  <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>{item.isSeri ? `ثري (${item.sizes.length} قطع)` : 'قطعة'}</td>
                  <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>{calculateItemTotal(item)} ج.م</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ textAlign: "left", fontSize: "20px", fontWeight: "bold" }}>
            الإجمالي الكلي: {total} ج.م
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col items-center mt-6">
      <div className="card w-full" style={{ maxWidth: "600px" }}>
        <h2 className="mb-6 text-center" style={{ color: "var(--primary)" }}>🛒 الفاتورة</h2>
        
        <div className="mb-4">
          <p><strong>العميل:</strong> {customerName}</p>
          <p><strong>البراند:</strong> {customerBrand}</p>
          <p><strong>رقم الهاتف:</strong> {customerPhone}</p>
        </div>
        
        <hr className="my-4" style={{ borderTop: '1px solid var(--border)' }}/>

        {cart.length === 0 ? (
          <p className="text-center my-10">الفاتورة فارغة. قم بمسح باركود المنتجات لإضافتها.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {cart.map((item) => (
              <div key={item.cartItemId} className="flex justify-between items-center p-3" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <div className="flex-1">
                  <h4 className="font-bold">{item.name} (موديل {item.modelNumber})</h4>
                  <p className="text-sm mt-1">اللون: <span className="font-bold">{item.selectedColor}</span></p>
                  {item.isSeri && (
                    <p className="text-xs text-gray-500 mt-1">
                      (ثري {item.sizes.length} قطع: {item.sizes.join(", ")}) × {item.price} ج.م للقطعة
                    </p>
                  )}
                  <p className="text-sm font-bold mt-1 text-green-600">الإجمالي: {calculateItemTotal(item)} ج.م</p>
                </div>
                <button 
                  onClick={() => removeItem(item.cartItemId)}
                  className="btn" 
                  style={{ background: 'var(--danger)', color: 'white', padding: '0.25rem 0.75rem' }}
                >
                  حذف
                </button>
              </div>
            ))}
            
            <div className="flex justify-between items-center mt-4 p-4" style={{ background: 'var(--primary-light)', borderRadius: 'var(--radius-md)' }}>
              <h3 className="font-bold">الإجمالي الكلي:</h3>
              <h3 className="font-bold text-xl">{total} ج.م</h3>
            </div>
            
            <button onClick={handleCheckout} disabled={loading} className="btn btn-secondary w-full mt-4">
              {loading ? "جاري التأكيد..." : "تأكيد الطلب والدفع"}
            </button>
          </div>
        )}
        
        <button onClick={() => router.push("/scan")} className="btn btn-outline w-full mt-4">
          العودة للمسح
        </button>
      </div>
    </div>
  );
}
