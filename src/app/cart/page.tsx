"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { db } from "../../lib/firebase";
import { collection, addDoc, serverTimestamp, doc, runTransaction } from "firebase/firestore";
import { auth } from "../../lib/firebase";
import { detectBranch } from "../../lib/location";
import { deductInventory } from "../../lib/inventory";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const getCategoryName = (modelNumber: string) => {
  const num = parseInt(modelNumber, 10);
  if (isNaN(num)) return "أخرى";
  if (num >= 5 && num <= 90) return "بيبي ولادي";
  if (num >= 100 && num <= 199) return "وسط ولادي";
  if (num >= 300 && num <= 399) return "محير ولادي";
  if (num >= 500 && num <= 589) return "بيبي بناتي";
  if (num >= 590 && num <= 699) return "وسط بناتي";
  if (num >= 790 && num <= 899) return "محير بناتي";
  if (num >= 1000 && num <= 2999) return "رياضي";
  return "أخرى";
};

interface CartItem {
  cartItemId: string;
  id: string;
  name: string;
  modelNumber: string;
  price: number;
  selectedColor: string;
  colorBarcode?: string;
  sizes: string[];
  isSeri: boolean;
  quantity?: number;
}

const getSizesCount = (name: string, modelNumber: string, sizes: string[] | undefined) => {
  const category = getCategoryName(modelNumber);
  if (category.includes('بيبي') || category.includes('وسط') || category.includes('محير') || category.includes('رياضي') || name.includes('بيبي') || name.includes('وسط') || name.includes('محير')) return 4;
  return sizes && sizes.length > 0 ? sizes.length : 1;
};

const getSizesText = (name: string, modelNumber: string, sizes: string[] | undefined) => {
  const category = getCategoryName(modelNumber);
  if (category.includes('بيبي') || name.includes('بيبي')) return '(2-3-4-5)';
  if (category.includes('وسط') || name.includes('وسط')) return '(6-8-10-12)';
  if (category.includes('محير') || category.includes('رياضي') || name.includes('محير')) return '(14-16-18-20)';
  if (sizes && sizes.length > 0) return `(${sizes.join("-")})`;
  return '';
};


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
  const [discountPercentage, setDiscountPercentage] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  
  const invoiceRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const savedCart = JSON.parse(localStorage.getItem("happyboy_cart") || "[]");
    setCart(savedCart);
    setCustomerName(localStorage.getItem("customerName") || "عميل غير معروف");
    setCustomerBrand(localStorage.getItem("customerBrand") || "");
    setCustomerGovernorate(localStorage.getItem("customerGovernorate") || "");
    setCustomerAddress(localStorage.getItem("customerAddress") || "");
    setCustomerShipping(localStorage.getItem("customerShipping") || "");
    
    const phone = localStorage.getItem("customerPhone") || "";
    setCustomerPhone(phone);
    
    if (phone && !localStorage.getItem("customerGovernorate")) {
      // Fetch latest shipping info for this phone if not in local storage
      import("firebase/firestore").then(({ query, where, getDocs }) => {
        const q = query(collection(db, "orders"), where("customerPhone", "==", phone));
        getDocs(q).then((snapshot) => {
          if (!snapshot.empty) {
            const docs = snapshot.docs.map(d => d.data());
            docs.sort((a, b) => {
               const timeA = a.createdAt?.toMillis?.() || 0;
               const timeB = b.createdAt?.toMillis?.() || 0;
               return timeB - timeA;
            });
            const lastOrder = docs[0];
            if (lastOrder.customerGovernorate) setCustomerGovernorate(lastOrder.customerGovernorate);
            if (lastOrder.customerAddress) setCustomerAddress(lastOrder.customerAddress);
            if (lastOrder.customerShipping) setCustomerShipping(lastOrder.customerShipping);
          }
        }).catch(err => console.error("Error fetching shipping info:", err));
      });
    }

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        let name = user.displayName || user.email?.split('@')[0] || "Unknown";
        if (name.toLowerCase() === 'ahmed001') name = 'Ahmed';
        if (name.toLowerCase() === 'hossam001') name = 'Hossam';
        setEmployeeName(name);
      }
    });

    return () => unsubscribe();
  }, []);

  const calculateItemTotal = (item: CartItem) => {
    const qty = item.quantity || 1;
    const sizesCount = getSizesCount(item.name, item.modelNumber, item.sizes);
    if (item.isSeri) {
      return item.price * sizesCount * qty;
    }
    return item.price * qty;
  };

  const total = cart.reduce((acc, item) => acc + calculateItemTotal(item), 0);
  const depositNum = Number(deposit) || 0;
  const discountNum = Number(discountPercentage) || 0;
  const discountValue = (total * discountNum) / 100;
  const finalTotal = total - discountValue;
  const remaining = finalTotal - depositNum;

  const totalPieces = cart.reduce((sum, item) => sum + (item.isSeri ? getSizesCount(item.name, item.modelNumber, item.sizes) * (item.quantity || 1) : (item.quantity || 1)), 0);
  const totalSeries = cart.reduce((sum, item) => sum + (item.isSeri ? (item.quantity || 1) : 0), 0);


  const removeItem = (id: string) => {
    const newCart = cart.filter(item => item.cartItemId !== id);
    setCart(newCart);
    localStorage.setItem("happyboy_cart", JSON.stringify(newCart));
  };

  const updateQuantity = (id: string, change: number) => {
    const newCart = cart.map(item => {
      if (item.cartItemId === id) {
        const currentQty = item.quantity || 1;
        const newQty = currentQty + change;
        if (newQty < 1) return item; // minimum is 1
        return { ...item, quantity: newQty };
      }
      return item;
    });
    setCart(newCart);
    localStorage.setItem("happyboy_cart", JSON.stringify(newCart));
  };

  const sortedCart = [...cart].sort((a, b) => a.modelNumber.localeCompare(b.modelNumber, undefined, { numeric: true }));

  const generatePDF = async (orderNum: string, shouldSave = true) => {
    if (!invoiceRef.current) return null;
    
    const invoiceEl = invoiceRef.current;
    const origDisplay = invoiceEl.style.display;
    const origWidth = invoiceEl.style.width;
    const origPosition = invoiceEl.style.position;
    const origLeft = invoiceEl.style.left;
    const origTop = invoiceEl.style.top;
    const origZIndex = invoiceEl.style.zIndex;
    
    invoiceEl.style.display = "block";
    invoiceEl.style.width = "794px";
    invoiceEl.style.position = "fixed";
    invoiceEl.style.left = "0px";
    invoiceEl.style.top = "0px";
    invoiceEl.style.zIndex = "-9999";
    
    try {
      const canvas = await html2canvas(invoiceEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: invoiceEl.scrollWidth,
        windowHeight: invoiceEl.scrollHeight
      });
      
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      
      // Standard A4 format with multi-page support
      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 10;
      const printWidth = pdfWidth - (margin * 2);
      const printHeight = pdfHeight - (margin * 2);
      
      const ratio = printWidth / canvas.width;
      const imgHeight = canvas.height * ratio;
      
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });
      
      let heightLeft = imgHeight;
      let position = margin;
      
      pdf.addImage(imgData, "JPEG", margin, position, printWidth, imgHeight);
      
      // Cover margins with white rectangles to prevent bleeding
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pdfWidth, margin, 'F');
      pdf.rect(0, pdfHeight - margin, pdfWidth, margin, 'F');
      
      heightLeft -= printHeight;
      
      while (heightLeft > 0) {
        position -= printHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", margin, position, printWidth, imgHeight);
        
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pdfWidth, margin, 'F');
        pdf.rect(0, pdfHeight - margin, pdfWidth, margin, 'F');
        
        heightLeft -= printHeight;
      }
      
      if (shouldSave) {
        pdf.save(`Happy_Boy_Girl_Order_${orderNum}.pdf`);
      }
      return pdf;
    } catch (err) {
      console.error("Failed to generate PDF", err);
      alert("حدث خطأ أثناء استخراج الفاتورة");
      return null;
    } finally {
      invoiceEl.style.display = origDisplay;
      invoiceEl.style.width = origWidth;
      invoiceEl.style.position = origPosition;
      invoiceEl.style.left = origLeft;
      invoiceEl.style.top = origTop;
      invoiceEl.style.zIndex = origZIndex;
    }
  };

  const handleWhatsAppShare = async (orderNum: string) => {
    const phone = customerPhone.replace(/[^0-9]/g, '');
    const intlPhone = phone.startsWith('0') ? '2' + phone : phone;
    const msgText = `فاتورة طلبك جاهزة يا فندم من Happy Boy&Girl 🤍\nبرجاء مراجعة الفاتورة المرفقة.\nمتبقي عند الاستلام: ${remaining} ج.م`;

    const whatsappWindow = window.open('about:blank', '_blank');

    const pdf = await generatePDF(orderNum, false);
    if (!pdf) {
        if (whatsappWindow) whatsappWindow.close();
        return;
    }

    const fileName = `Happy_Boy_Girl_Order_${orderNum}.pdf`;
    
    pdf.save(fileName);
    alert("تم تحميل الفاتورة كملف PDF بنجاح!\n\nسيتم فتح واتساب الآن مع رقم العميل، يرجى إرفاق الملف المحمل يدوياً للمحادثة.");
    
    if (whatsappWindow) {
      whatsappWindow.location.href = `https://wa.me/${intlPhone}?text=${encodeURIComponent(msgText)}`;
    } else {
      window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msgText)}`, '_blank');
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
      
      const branchName = await detectBranch(auth.currentUser?.email);
      const empName = employeeName || auth.currentUser?.displayName || auth.currentUser?.email || "Unknown";

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
        discountPercentage: discountNum,
        items: sortedCart,
        total: total,
        status: "pending",
        branch: branchName,
        employeeName: empName,
        createdAt: serverTimestamp()
      });
      
      // Deduct inventory
      await deductInventory(sortedCart, formattedOrderNumber, empName);

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
            <p className="flex items-center justify-center gap-2">
              <strong>انستاباي:</strong> ahmed.1010.2020@instapay
            </p>
            <p className="mt-2 text-sm font-bold" style={{ color: "var(--primary)" }}>المتبقي دفعه: {remaining} ج.م</p>
            <a href="instapay://" className="btn btn-outline w-full mt-4 flex items-center justify-center gap-2" style={{ borderColor: "#6f42c1", color: "#6f42c1" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
              فتح تطبيق انستاباي لتحويل العربون
            </a>
          </div>
          
          <div className="flex flex-col gap-2">
            <button onClick={() => generatePDF(orderId, true)} className="btn w-full py-4 text-lg" style={{ background: "#f8fafc", color: "#334155", border: "1px solid #cbd5e1" }}>
              📥 تحميل الفاتورة PDF
            </button>
            <button onClick={() => handleWhatsAppShare(orderId)} className="btn w-full py-4 text-lg" style={{ background: "#25D366", color: "white" }}>
              💬 حفظ و ارسال واتساب
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
            width: "700px", 
            padding: "20px", 
            background: "white", 
            color: "black",
            position: "absolute",
            top: "-9999px",
            left: "-9999px",
            direction: "rtl"
          }}
        >
          <div style={{ fontFamily: "'Cairo', sans-serif", color: "black", background: "#ffffff" }}>
            {/* Header */}
          <div style={{ fontFamily: "'Cairo', sans-serif", color: "#1e293b", background: "#fff", padding: "10px" }}>
            {/* Header Section */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "15px", gap: "20px" }}>
              {/* Customer Info Box */}
              <div style={{ flex: 1, border: '1px solid #1e293b', padding: '15px', borderRadius: '10px', background: '#f8fafc', display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 'bold' }}>رقم الطلبية: <span style={{ color: '#A62E2E' }}>{orderId}</span></div>
                  <div style={{ fontSize: '15px', fontWeight: 'bold' }}>التاريخ: <span style={{ color: '#A62E2E' }}>{new Date().toLocaleDateString('en-GB')}</span></div>
                  <div style={{ fontSize: '15px', fontWeight: 'bold' }}>اسم العميل: <span style={{ color: '#A62E2E' }}>{customerName}</span></div>
                  <div style={{ fontSize: '15px', fontWeight: 'bold' }}>رقم الهاتف: <span style={{ color: '#A62E2E' }} dir="ltr">{customerPhone}</span></div>
                  {customerBrand && <div style={{ fontSize: '15px', fontWeight: 'bold' }}>البراند: <span style={{ color: '#A62E2E' }}>{customerBrand}</span></div>}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {customerGovernorate && <div style={{ fontSize: '15px', fontWeight: 'bold' }}>المحافظة: <span style={{ color: '#A62E2E' }}>{customerGovernorate}</span></div>}
                  <div style={{ fontSize: '15px', fontWeight: 'bold' }}>العنوان: <span style={{ color: '#A62E2E' }}>{customerAddress || 'غير متوفر'}</span></div>
                  <div style={{ fontSize: '15px', fontWeight: 'bold' }}>الشحن: <span style={{ color: '#A62E2E' }}>{customerShipping || 'استلام من المصنع'}</span></div>
                  <div style={{ fontSize: '15px', fontWeight: 'bold' }}>التسليم: <span style={{ color: '#2563eb' }}>{deliveryDate ? new Date(deliveryDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start' }}>
                <img src="/ColoredLogo.png" alt="Happy Boy Logo" style={{ height: '80px', objectFit: 'contain' }} />
                {employeeName && (
                  <span style={{ marginTop: "5px", fontSize: "14px", color: "#A62E2E", fontWeight: "bold" }}>{employeeName}</span>
                )}
              </div>
            </div>

            {/* Elegant List Layout (Borderless Table) */}
            <div style={{ marginBottom: "40px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #cbd5e1" }}>
                    <th style={{ padding: "12px 8px", fontWeight: "bold", color: "#64748b", fontSize: "14px", textAlign: "center" }}>الموديل</th>
                    <th style={{ padding: "12px 8px", fontWeight: "bold", color: "#64748b", fontSize: "14px", textAlign: "center" }}>الصنف</th>
                    <th style={{ padding: "12px 8px", fontWeight: "bold", color: "#64748b", fontSize: "14px", textAlign: "center" }}>اللون</th>
                    <th style={{ padding: "12px 8px", fontWeight: "bold", color: "#64748b", fontSize: "14px", textAlign: "center" }}>الكمية</th>
                    <th style={{ padding: "12px 8px", fontWeight: "bold", color: "#64748b", fontSize: "14px", textAlign: "center" }}>السعر</th>
                    <th style={{ padding: "12px 8px", fontWeight: "bold", color: "#1e293b", fontSize: "14px", textAlign: "center" }}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCart.map((item, i) => {
                    const qty = item.quantity || 1;
                    const piecesInSeri = item.isSeri ? getSizesCount(item.name, item.modelNumber, item.sizes) : 1;
                    const itemTotalPieces = item.isSeri ? piecesInSeri * qty : qty;
                    const rowTotal = item.price * itemTotalPieces;
                    return (
                      <tr key={i} style={{ borderBottom: "1px dashed #e2e8f0" }}>
                        <td style={{ padding: "16px 8px", textAlign: "center", fontWeight: "bold", color: "#0f172a", fontSize: "15px" }}>
                          {item.modelNumber}
                        </td>
                        <td style={{ padding: "16px 8px", textAlign: "center", fontWeight: "bold", color: "#0f172a", fontSize: "15px" }}>
                          {item.name}
                        </td>
                        <td style={{ padding: "16px 8px", color: "#475569", fontSize: "15px", fontWeight: "bold", textAlign: "center", whiteSpace: "nowrap" }}>
                          {item.selectedColor} {item.colorBarcode ? `(${item.colorBarcode})` : ''}
                        </td>
                        <td style={{ padding: "16px 8px", fontWeight: "bold", color: "#475569", textAlign: "center" }}>
                          <div style={{ fontSize: "15px" }}>{qty} {item.isSeri ? 'ثري' : 'قطعة'}</div>
                          {item.isSeri && <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>{getSizesText(item.name, item.modelNumber, item.sizes)}</div>}
                        </td>
                        <td style={{ padding: "16px 8px", fontWeight: "bold", color: "#475569", textAlign: "center" }}>{item.price} ج.م</td>
                        <td style={{ padding: "16px 8px", fontWeight: "900", color: "#1e293b", textAlign: "center", fontSize: "16px" }}>{rowTotal} ج.م</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', gap: '20px', marginBottom: '30px' }}>
              {/* Contact Card */}
              <div style={{ flex: "1", background: "#f8fafc", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "16px", fontWeight: "bold", color: "#1e293b", borderBottom: "2px solid #e2e8f0", paddingBottom: "10px", width: "100%", textAlign: "center", marginBottom: "5px" }}>📞 أرقام التواصل</span>
                <span style={{ fontSize: "18px", fontWeight: "bold", direction: "ltr", textAlign: "center", color: "#A62E2E" }}>01009516578</span>
                <span style={{ fontSize: "18px", fontWeight: "bold", direction: "ltr", textAlign: "center", color: "#A62E2E" }}>0224903939</span>
              </div>
              
              {/* Model Summary Card */}
              <div style={{ flex: "1", background: "#f8fafc", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', borderBottom: "2px solid #e2e8f0", paddingBottom: "10px", display: 'block', marginBottom: '15px', textAlign: "center" }}>ملخص الموديلات</span>
                {Object.entries(
                  sortedCart.reduce((acc, item) => {
                    const cat = getCategoryName(item.modelNumber);
                    acc[cat] = (acc[cat] || 0) + (item.isSeri ? (item.quantity || 1) : 0);
                    return acc;
                  }, {} as Record<string, number>)
                ).filter(([_, count]) => count > 0).map(([cat, count]) => (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: '15px', marginBottom: '10px' }}>
                    <span>{cat}</span>
                    <span style={{ fontWeight: 'bold' }}>{count} ثري</span>
                  </div>
                ))}
              </div>

              {/* Totals Card */}
              <div style={{ flex: "1.5", background: "#f8fafc", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '15px' }}>
                  <span>إجمالي عدد القطع</span>
                  <span style={{ fontWeight: 'bold' }}>{totalPieces} قطعة</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '15px' }}>
                  <span>إجمالي عدد الثريهات</span>
                  <span style={{ fontWeight: 'bold' }}>{totalSeries} ثري</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '15px' }}>
                  <span>إجمالي المبلغ</span>
                  <span style={{ fontWeight: 'bold' }}>{total} ج.م</span>
                </div>
                
                {discountNum > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #e2e8f0', color: '#16a34a', fontSize: '15px' }}>
                    <span>نسبة الخصم</span>
                    <span style={{ fontWeight: 'bold' }}>{discountNum}% (-{discountValue} ج.م)</span>
                  </div>
                )}
                
                {depositNum > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #e2e8f0', color: '#16a34a', fontSize: '15px' }}>
                    <span>العربون</span>
                    <span style={{ fontWeight: 'bold' }}>{depositNum} ج.م</span>
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', marginTop: '8px', borderTop: '2px solid #1e293b', color: '#A62E2E' }}>
                  <span style={{ fontWeight: '900', fontSize: '20px' }}>الصافي المستحق</span>
                  <span style={{ fontWeight: '900', fontSize: '22px' }}>{remaining} ج.م</span>
                </div>
              </div>
            </div>


            
          </div>
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
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold">بيانات العميل:</h3>
            <button onClick={() => router.push("/customer")} className="btn btn-outline text-sm px-3 py-1">
              تغيير / اختيار عميل
            </button>
          </div>
          <p><strong>الاسم:</strong> {customerName || "غير محدد"}</p>
          <p><strong>البراند:</strong> {customerBrand || "غير محدد"}</p>
          <p><strong>الهاتف:</strong> {customerPhone || "غير محدد"}</p>
        </div>
        
        <h3 className="font-bold mt-6 mb-3 border-b pb-2">المنتجات المختارة:</h3>
        {sortedCart.length === 0 ? (
          <p className="text-center my-6">الفاتورة فارغة.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {sortedCart.map((item) => {
              const qty = item.quantity || 1;
              return (
                <div key={item.cartItemId} className="flex justify-between items-center p-3" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                  <div className="flex-1">
                    <h4 className="font-bold text-lg">{item.name} (موديل {item.modelNumber})</h4>
                    <p className="text-sm mt-1">اللون: <span className="font-bold">{item.selectedColor} {item.colorBarcode ? `(${item.colorBarcode})` : ''}</span></p>
                    {item.isSeri ? (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm">الكمية (ثري):</span>
                        <div className="flex items-center gap-2">
                          <button 
                            className="w-8 h-8 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 font-bold text-gray-700"
                            onClick={() => updateQuantity(item.cartItemId, 1)}
                          >+</button>
                          <span className="font-bold w-6 text-center">{qty}</span>
                          <button 
                            className="w-8 h-8 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 font-bold text-gray-700"
                            onClick={() => updateQuantity(item.cartItemId, -1)}
                          >-</button>
                        </div>
                        <span className="text-xs text-gray-500 mr-2">(مقاسات: {getSizesText(item.name, item.modelNumber, item.sizes)})</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm">الكمية (قطعة):</span>
                        <div className="flex items-center gap-2">
                          <button 
                            className="w-8 h-8 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 font-bold text-gray-700"
                            onClick={() => updateQuantity(item.cartItemId, 1)}
                          >+</button>
                          <span className="font-bold w-6 text-center">{qty}</span>
                          <button 
                            className="w-8 h-8 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 font-bold text-gray-700"
                            onClick={() => updateQuantity(item.cartItemId, -1)}
                          >-</button>
                        </div>
                      </div>
                    )}
                    <p className="text-sm font-bold mt-3 text-green-600">الإجمالي: {calculateItemTotal(item)} ج.م</p>
                  </div>
                  <button 
                    onClick={() => removeItem(item.cartItemId)}
                    className="btn self-start mt-2" 
                    style={{ background: 'var(--danger)', color: 'white', padding: '0.4rem 1rem' }}
                  >
                    حذف
                  </button>
                </div>
              );
            })}
            
            <div className="flex justify-between items-center mt-4 p-4" style={{ background: 'var(--primary-light)', borderRadius: 'var(--radius-md)' }}>
              <div>
                <h3 className="font-bold">الإجمالي الكلي:</h3>
                <p className="text-sm mt-1">
                  اجمالي عدد القطع: <strong>{totalPieces}</strong> | اجمالي عدد الثريهات: <strong>{totalSeries}</strong>
                </p>
                {discountNum > 0 && <p className="text-sm text-green-700 mt-1">يوجد خصم {discountNum}% (-{discountValue} ج.م)</p>}
              </div>
              <div className="text-left">
                {discountNum > 0 && <h3 className="font-bold text-sm line-through text-gray-500">{total} ج.م</h3>}
                <h3 className="font-bold text-xl text-primary">{finalTotal} ج.م</h3>
              </div>
            </div>
            
            <h3 className="font-bold mt-6 mb-3 border-b pb-2">تفاصيل الشحن والدفع (اختياري):</h3>
            
            <div className="mb-4">
              <label className="block mb-2 font-bold text-sm">البائع / مندوب المبيعات</label>
              <input 
                type="text" 
                className="input bg-gray-100 cursor-not-allowed" 
                value={employeeName}
                readOnly
                disabled
              />
            </div>

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
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block mb-2 font-bold text-sm">العربون (ج.م)</label>
                  <input 
                    type="number" 
                    className="input" 
                    value={deposit}
                    onChange={(e) => setDeposit(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="flex-1">
                  <label className="block mb-2 font-bold text-sm">خصم (%)</label>
                  <input 
                    type="number" 
                    className="input" 
                    value={discountPercentage}
                    onChange={(e) => setDiscountPercentage(e.target.value)}
                    placeholder="0"
                    min="0"
                    max="100"
                  />
                </div>
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
