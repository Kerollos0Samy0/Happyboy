"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "../../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const savedCart = JSON.parse(localStorage.getItem("happyboy_cart") || "[]");
    setCart(savedCart);
    setCustomerName(localStorage.getItem("customerName") || "عميل غير معروف");
    setCustomerPhone(localStorage.getItem("customerPhone") || "");
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

  const generatePDF = (orderNum: string) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Stock HappyBoy - Invoice", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.text(`Order ID: ${orderNum}`, 20, 40);
    doc.text(`Customer Name: ${customerName}`, 20, 50);
    doc.text(`Customer Phone: ${customerPhone}`, 20, 60);
    
    const tableData = cart.map(item => [
      `${item.name} (${item.modelNumber})`, 
      item.selectedColor, 
      item.isSeri ? `Seri (${item.sizes.length} pcs)` : 'Piece',
      `${calculateItemTotal(item)} EGP`
    ]);
    
    autoTable(doc, {
      startY: 70,
      head: [['Product', 'Color', 'Type', 'Total Price']],
      body: tableData,
    });
    
    // @ts-ignore
    const finalY = (doc as any).lastAutoTable.finalY || 100;
    doc.setFontSize(14);
    doc.text(`Total: ${total} EGP`, 20, finalY + 10);
    
    doc.save(`invoice_${orderNum}.pdf`);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    
    try {
      const docRef = await addDoc(collection(db, "orders"), {
        customerName,
        customerPhone,
        items: cart,
        total,
        status: "pending",
        createdAt: serverTimestamp()
      });
      
      setOrderId(docRef.id);
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
          <p className="mb-6">رقم الطلب الخاص بك: <strong>{orderId.slice(0, 8)}</strong></p>
          
          <div className="p-4 mb-6" style={{ background: "var(--surface-hover)", borderRadius: "var(--radius-md)" }}>
            <h3 className="mb-2">طرق الدفع المتاحة:</h3>
            <p><strong>فودافون كاش:</strong> 01012345678</p>
            <p><strong>انستاباي:</strong> happyboy@instapay</p>
            <p className="mt-2 text-sm text-red-500">يرجى تحويل مبلغ {total} ج.م لتأكيد استلام الطلب من الكاشير.</p>
          </div>
          
          <div className="flex flex-col gap-2">
            <button onClick={() => generatePDF(orderId.slice(0, 8))} className="btn btn-primary w-full">
              📥 تحميل الفاتورة (PDF)
            </button>
            <button onClick={() => router.push("/customer")} className="btn btn-outline w-full mt-2">
              طلب جديد
            </button>
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
