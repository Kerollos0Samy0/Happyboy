"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "../../../lib/firebase";
import {
  collection, onSnapshot, query, orderBy,
  updateDoc, doc, deleteDoc, where, getDocs
} from "firebase/firestore";
import { auth } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { WAREHOUSE_EMAILS } from "../../../lib/location";
import { restoreInventory, deductInventory } from "../../../lib/inventory";
import { Printer, Save, Trash2, X, ChevronDown, MessageCircle, Plus, Search, Minus, Download, Archive, Copy } from "lucide-react";

const getCategoryName = (modelNumber: string) => {
  const num = parseInt(modelNumber, 10);
  if (isNaN(num)) return "أخرى";
  if (num >= 5 && num <= 90) return "بيبي ولادي";
  if (num >= 100 && num <= 299) return "وسط ولادي";
  if (num >= 300 && num <= 499) return "محير ولادي";
  if (num >= 500 && num <= 589) return "بيبي بناتي";
  if (num >= 590 && num <= 789) return "وسط بناتي";
  if (num >= 790 && num <= 999) return "محير بناتي";
  if (num >= 1000 && num <= 2999) return "رياضي";
  if (num >= 3000 && num <= 4999) return "سمر ولادي";
  if (num >= 5000 && num <= 6999) return "سمر بناتي";
  return "أخرى";
};

interface OrderItem {
  cartItemId?: string;
  name: string;
  modelNumber: string;
  selectedColor: string;
  colorBarcode?: string;
  price: number;
  isSeri?: boolean;
  sizes?: string[];
  quantity?: number;
}

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
  discountPercentage?: number;
  deliveryDate?: string;
  status: string;
  branch?: string;
  employeeName?: string;
  items: OrderItem[];
  createdAt: any;
  isDeleted?: boolean;
  isArchived?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "قيد الانتظار", color: "#b45309", bg: "#fef3c7" },
  paid:      { label: "تم الدفع",    color: "#065f46", bg: "#d1fae5" },
  shipped:   { label: "مع شركة الشحن", color: "#1d4ed8", bg: "#dbeafe" },
  delivered: { label: "تم التسليم", color: "#15803d", bg: "#dcfce7" },
  cancelled: { label: "ملغي",        color: "#991b1b", bg: "#fee2e2" },
};

function timeAgo(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "الآن";
  if (diff < 3600) return `${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} س`;
  return `${Math.floor(diff / 86400)} يوم`;
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


export default function LiveOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const handleSelectAll = (checked: boolean, currentVisible: Order[]) => {
    if (checked) {
      setSelectedOrderIds(currentVisible.map(o => o.id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  const handleSelectOrder = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedOrderIds(prev => [...prev, id]);
    } else {
      setSelectedOrderIds(prev => prev.filter(oid => oid !== id));
    }
  };

  const deleteSelectedOrders = async () => {
    if (selectedOrderIds.length === 0) return;
    if (!confirm(`هل أنت متأكد من حذف ${selectedOrderIds.length} طلب وإرجاع كمياتهم للمخزن؟`)) return;
    
    try {
      const empName = auth.currentUser?.displayName || auth.currentUser?.email || "Unknown";
      await Promise.all(selectedOrderIds.map(async (id) => {
        const order = orders.find(o => o.id === id);
        if (order && order.items && order.items.length > 0) {
          await restoreInventory(order.items, order.orderNumber || order.id, empName);
        }
        return updateDoc(doc(db, "orders", id), { isDeleted: true });
      }));
      setSelectedOrderIds([]);
    } catch(e) {
      console.error(e);
      alert("حدث خطأ أثناء الحذف");
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUserEmail(user?.email || null);
    });
    return () => unsub();
  }, []);

  const isWarehouseUser = userEmail ? WAREHOUSE_EMAILS.includes(userEmail.toLowerCase()) : false;
  const isOwner = userEmail ? (userEmail.toLowerCase().includes('ahmed001') || userEmail.toLowerCase().includes('hossam001')) : false;
  const isRestrictedWarehouseUser = isWarehouseUser && !isOwner;

  // Item editing state
  const [addModelSearch, setAddModelSearch] = useState("");
  const [foundProduct, setFoundProduct] = useState<any>(null);
  const [searchingModel, setSearchingModel] = useState(false);
  const [addSelectedColor, setAddSelectedColor] = useState("");
  const [addQty, setAddQty] = useState(1);

  const invoiceRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      setOrders(
        snapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as Order))
          .filter(o => !o.isDeleted)
      );
      setLoading(false);
    });
  }, []);

  // Sync selected order when orders update
  useEffect(() => {
    if (selectedOrder) {
      const updated = orders.find(o => o.id === selectedOrder.id);
      if (updated && !saving) setSelectedOrder(updated);
    }
  }, [orders]);

  const openModal = (order: Order) => {
    const sortedItems = [...order.items].sort((a, b) => a.modelNumber.localeCompare(b.modelNumber, undefined, { numeric: true }));
    setSelectedOrder({ ...order, items: sortedItems });
    setFoundProduct(null);
    setAddModelSearch("");
    setAddSelectedColor("");
    setAddQty(1);
  };

  const closeModal = () => { setSelectedOrder(null); setFoundProduct(null); };

  const handleOrderChange = (field: keyof Order, value: any) => {
    if (selectedOrder) {
      setSelectedOrder({ ...selectedOrder, [field]: value });
    }
  };

  const handleItemChange = (index: number, field: keyof OrderItem, value: any) => {
    if (selectedOrder) {
      const newItems = [...selectedOrder.items];
      newItems[index] = { ...newItems[index], [field]: value };
      setSelectedOrder({ ...selectedOrder, items: newItems });
    }
  };

  const removeItemFromOrder = (index: number) => {
    if (!selectedOrder) return;
    const newItems = selectedOrder.items.filter((_, i) => i !== index);
    setSelectedOrder({ ...selectedOrder, items: newItems });
  };

  const searchModel = async () => {
    if (!addModelSearch.trim()) return;
    setSearchingModel(true);
    setFoundProduct(null);
    try {
      const q = query(collection(db, "products"), where("modelNumber", "==", addModelSearch.trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setFoundProduct({ id: snap.docs[0].id, ...data });
        if (data.colors?.length > 0) setAddSelectedColor(data.colors[0].name);
      } else {
        alert("مش لاقي موديل بالرقم ده");
      }
    } finally {
      setSearchingModel(false);
    }
  };

  const addItemToOrder = () => {
    if (!selectedOrder || !foundProduct || !addSelectedColor) return;
    
    const colorEntry = foundProduct.colors?.find((c: any) => c.name === addSelectedColor);
    
    const newItem: OrderItem = {
      cartItemId: Date.now().toString() + Math.random().toString(),
      name: foundProduct.name,
      modelNumber: foundProduct.modelNumber,
      price: foundProduct.price,
      selectedColor: addSelectedColor,
      colorBarcode: colorEntry?.barcode || "",
      sizes: foundProduct.sizes || [],
      isSeri: true,
      quantity: 1
    };
    const newItems = [...selectedOrder.items, ...Array(addQty).fill(null).map(() => ({ ...newItem, cartItemId: Date.now().toString() + Math.random().toString() }))];
    newItems.sort((a, b) => a.modelNumber.localeCompare(b.modelNumber, undefined, { numeric: true }));
    setSelectedOrder({ ...selectedOrder, items: newItems });
    setFoundProduct(null);
    setAddModelSearch("");
    setAddSelectedColor("");
    setAddQty(1);
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    await updateDoc(doc(db, "orders", orderId), { status: newStatus });
  };

  const calculateTotal = (items: OrderItem[]) => {
    return items.reduce((sum, it) => {
      const qty = it.quantity || 1;
      const sizesCount = getSizesCount(it.name, it.modelNumber, it.sizes);
      return sum + (it.isSeri ? it.price * sizesCount * qty : it.price * qty);
    }, 0);
  };

  const calculateTotalPieces = (items: OrderItem[]) => {
    return items.reduce((sum, it) => {
      const qty = it.quantity || 1;
      const sizesCount = getSizesCount(it.name, it.modelNumber, it.sizes);
      return sum + (it.isSeri ? sizesCount * qty : qty);
    }, 0);
  };

  const calculateTotalSeries = (items: OrderItem[]) => {
    return items.reduce((sum, it) => sum + (it.isSeri ? (it.quantity || 1) : 0), 0);
  };

  const saveOrderDetails = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    try {
      const newTotal = calculateTotal(selectedOrder.items);
      const updateData = {
        customerName: selectedOrder.customerName,
        customerPhone: selectedOrder.customerPhone,
        customerBrand: selectedOrder.customerBrand || "",
        customerGovernorate: selectedOrder.customerGovernorate || "",
        customerAddress: selectedOrder.customerAddress || "",
        customerShipping: selectedOrder.customerShipping || "",
        deliveryDate: selectedOrder.deliveryDate || "",
        deposit: Number(selectedOrder.deposit) || 0,
        discountPercentage: Number(selectedOrder.discountPercentage) || 0,
        items: selectedOrder.items,
        total: newTotal
      };
      
      await updateDoc(doc(db, "orders", selectedOrder.id), updateData);
      setSelectedOrder({ ...selectedOrder, ...updateData });
      alert("تم حفظ تعديلات الفاتورة بنجاح ✅");
    } catch(e) {
      alert("حدث خطأ أثناء حفظ الفاتورة");
    } finally {
      setSaving(false);
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الطلب وإرجاع الكميات للمخزن؟")) return;
    const order = orders.find(o => o.id === orderId);
    if (order && order.items && order.items.length > 0) {
      const empName = auth.currentUser?.displayName || auth.currentUser?.email || "Unknown";
      await restoreInventory(order.items, order.orderNumber || order.id, empName);
    }
    await updateDoc(doc(db, "orders", orderId), { isDeleted: true });
    if (selectedOrder?.id === orderId) closeModal();
  };

  const archiveOrder = async (orderId: string, currentArchived: boolean) => {
    if (!confirm(`هل أنت متأكد من ${currentArchived ? 'استرجاع' : 'أرشفة'} هذا الطلب؟`)) return;
    await updateDoc(doc(db, "orders", orderId), { isArchived: !currentArchived });
    if (selectedOrder?.id === orderId) closeModal();
  };

  const duplicateOrder = async (orderId: string) => {
    if (!confirm("هل أنت متأكد من تكرار (نسخ) هذا الطلب لنفس العميل؟ سيتم خصم الكميات مرة أخرى من المخزن.")) return;
    const orderToCopy = orders.find(o => o.id === orderId);
    if (!orderToCopy) return;

    try {
      const { addDoc, collection, serverTimestamp, runTransaction } = await import("firebase/firestore");
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
      const empName = auth.currentUser?.displayName || auth.currentUser?.email || "Unknown";

      if (orderToCopy.items && orderToCopy.items.length > 0) {
        await deductInventory(orderToCopy.items, formattedOrderNumber, empName);
      }
      
      const newOrderData = {
        ...orderToCopy,
        id: undefined,
        orderNumber: formattedOrderNumber,
        status: "pending",
        isArchived: false,
        createdAt: serverTimestamp(),
        employeeName: empName
      };
      
      await addDoc(collection(db, "orders"), newOrderData);
      
      alert(`تم تكرار الطلب بنجاح برقم: ${formattedOrderNumber}`);
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء تكرار الطلب");
    }
  };

  // PDF
  const handleDownloadPDF = async () => {
    if (!selectedOrder) return;
    const pdf = await generatePDF(selectedOrder);
    if (pdf) {
      pdf.save(`فاتورة_${selectedOrder.customerName.replace(/\s+/g, '_')}.pdf`);
    }
  };

  const handlePrintPDF = async () => {
    if (!selectedOrder) return;
    const pdf = await generatePDF(selectedOrder);
    if (!pdf) return;
    
    pdf.autoPrint();
    window.open(pdf.output('bloburl'), '_blank');
  };

  const generatePDF = async (order: Order) => {
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
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      
      const pdfWidth = 210; // A4 width in mm
      const margin = 10; // 1cm margin
      const printWidth = pdfWidth - (margin * 2);
      
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });
      
      const pages = invoiceEl.querySelectorAll('.invoice-page');
      
      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i] as HTMLElement;
        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          windowWidth: pageEl.scrollWidth,
          windowHeight: pageEl.scrollHeight
        });
        
        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        const ratio = printWidth / canvas.width;
        const imgHeight = canvas.height * ratio;
        
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", margin, 0, printWidth, imgHeight);
      }
      
      return pdf;
    } finally {
      invoiceEl.style.display = origDisplay;
      invoiceEl.style.width = origWidth;
      invoiceEl.style.position = origPosition;
      invoiceEl.style.left = origLeft;
      invoiceEl.style.top = origTop;
      invoiceEl.style.zIndex = origZIndex;
    }
  };

  const handleWhatsAppShare = async () => {
    if (!selectedOrder) return;
    
    const phone = selectedOrder.customerPhone.replace(/[^0-9]/g, '');
    const intlPhone = phone.startsWith('0') ? '2' + phone : phone;
    const subtotal = calculateTotal(selectedOrder.items);
    const discountValue = (subtotal * (selectedOrder.discountPercentage || 0)) / 100;
    const remaining = subtotal - discountValue - (selectedOrder.deposit || 0);
    const msgText = `فاتورة طلبك جاهزة يا فندم من Happy Boy&Girl 🤍\nبرجاء مراجعة الفاتورة المرفقة.\nمتبقي عند الاستلام: ${remaining} ج.م`;

    // Open window immediately to prevent popup blockers
    const whatsappWindow = window.open('about:blank', '_blank');
    
    // Save first just in case
    await saveOrderDetails();
    
    const pdf = await generatePDF(selectedOrder);
    if (!pdf) {
        if (whatsappWindow) whatsappWindow.close();
        return;
    }

    const fileName = `فاتورة_${selectedOrder.customerName.replace(/\s+/g, '_')}.pdf`;

    // Download the PDF first
    pdf.save(fileName);
    alert("تم تحميل الفاتورة كملف PDF بنجاح!\n\nسيتم فتح واتساب الآن مع رقم العميل، يرجى إرفاق الملف المحمل يدوياً للمحادثة.");
    
    // Navigate the already opened tab to WhatsApp
    if (whatsappWindow) {
      whatsappWindow.location.href = `https://wa.me/${intlPhone}?text=${encodeURIComponent(msgText)}`;
    } else {
      window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msgText)}`, '_blank');
    }
  };

  const getDisplayEmployee = (emp?: string) => {
    if (!emp) return "";
    let display = emp;
    if (display.includes('@')) display = display.split('@')[0];
    display = display.trim().toLowerCase();
    if (display === 'ahmed001') return 'Ahmed';
    if (display === 'hossam001') return 'Hossam';
    return display;
  };

  const uniqueEmployees = Array.from(new Set(orders.map(o => getDisplayEmployee(o.employeeName)).filter(Boolean))) as string[];

  const visibleOrders = orders.filter(o => {
    if (showArchived && !o.isArchived) return false;
    if (!showArchived && o.isArchived) return false;
    
    if (startDate || endDate) {
      const orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (orderDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (orderDate > end) return false;
      }
    }

    const orderBranch = o.branch || "أخرى";
    
    if (employeeFilter !== "all" && getDisplayEmployee(o.employeeName) !== employeeFilter) return false;

    if (isOwner) {
      if (branchFilter !== "all" && orderBranch !== branchFilter) return false;
      return true;
    } else if (isRestrictedWarehouseUser) {
      return orderBranch === "المخزن";
    } else {
      if (branchFilter !== "all" && orderBranch !== branchFilter) return false;
      return true;
    }
  });

  const filteredOrders = filterStatus === "all"
    ? visibleOrders
    : visibleOrders.filter(o => o.status === filterStatus);

  const stats = {
    total: visibleOrders.length,
    pending: visibleOrders.filter(o => o.status === "pending").length,
    paid: visibleOrders.filter(o => o.status === "paid").length,
    shipped: visibleOrders.filter(o => o.status === "shipped").length,
    delivered: visibleOrders.filter(o => o.status === "delivered").length,
    cancelled: visibleOrders.filter(o => o.status === "cancelled").length,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "1rem 1.5rem", marginLeft: "calc(-50vw + 50%)", marginRight: "calc(-50vw + 50%)", width: "100vw" }}>
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
              🔔 الطلبات الحية <span style={{ color: "#A62E2E" }}>Live Orders</span>
            </h2>
            {isOwner && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.25rem 0.75rem", background: "#fff", borderRadius: "0.5rem", border: "1px solid #e2e8f0" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.85rem", fontWeight: "bold", color: "#475569" }}>
                  <input 
                    type="checkbox" 
                    checked={filteredOrders.length > 0 && selectedOrderIds.length === filteredOrders.length}
                    onChange={(e) => handleSelectAll(e.target.checked, filteredOrders)}
                    style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#A62E2E" }}
                  />
                  تحديد الكل ({filteredOrders.length})
                </label>
                {selectedOrderIds.length > 0 && (
                  <button 
                    onClick={deleteSelectedOrders}
                    style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.25rem 0.5rem", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "0.25rem", fontSize: "0.75rem", fontWeight: "bold", cursor: "pointer" }}
                  >
                    <Trash2 size={14} /> حذف المحدد ({selectedOrderIds.length})
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Stats pills */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            {[
              { key: "all",       label: `الكل (${stats.total})`,           bg: "#1e293b", color: "#fff" },
              { key: "pending",   label: `انتظار (${stats.pending})`,       bg: "#fef3c7", color: "#b45309" },
              { key: "paid",      label: `مدفوع (${stats.paid})`,           bg: "#d1fae5", color: "#065f46" },
              { key: "shipped",   label: `شحن (${stats.shipped})`,          bg: "#dbeafe", color: "#1d4ed8" },
              { key: "delivered", label: `تسليم (${stats.delivered})`,      bg: "#dcfce7", color: "#15803d" },
              { key: "cancelled", label: `ملغي (${stats.cancelled})`,       bg: "#fee2e2", color: "#991b1b" },
            ].map(s => (
              <button
                key={s.key}
                onClick={() => setFilterStatus(s.key)}
                style={{
                  padding: "0.35rem 0.85rem",
                  borderRadius: "9999px",
                  border: filterStatus === s.key ? "2px solid #A62E2E" : "2px solid transparent",
                  background: s.bg,
                  color: s.color,
                  fontFamily: "inherit",
                  fontWeight: 700,
                  fontSize: "0.78rem",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {s.label}
              </button>
            ))}
            
            <div style={{ flex: 1 }} />
            
            <button
              onClick={() => setShowArchived(!showArchived)}
              style={{
                display: "flex", alignItems: "center", gap: "0.3rem",
                padding: "0.35rem 0.85rem",
                borderRadius: "9999px",
                border: showArchived ? "2px solid #6b21a8" : "2px solid transparent",
                background: showArchived ? "#f3e8ff" : "#f1f5f9",
                color: showArchived ? "#6b21a8" : "#475569",
                fontFamily: "inherit",
                fontWeight: 700,
                fontSize: "0.78rem",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <Archive size={14} /> {showArchived ? "إخفاء الأرشيف" : "عرض الأرشيف"}
            </button>
          </div>

          {/* Date Filters */}
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", width: "100%", marginTop: "0.5rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#475569" }}>من:</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: "0.25rem 0.5rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.85rem", fontFamily: "inherit" }}
            />
            <span style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#475569" }}>إلى:</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: "0.25rem 0.5rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.85rem", fontFamily: "inherit" }}
            />
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(""); setEndDate(""); }}
                style={{ padding: "0.25rem 0.5rem", borderRadius: "0.375rem", border: "none", background: "#fee2e2", color: "#991b1b", fontSize: "0.85rem", fontWeight: "bold", cursor: "pointer" }}
              >
                مسح التواريخ
              </button>
            )}
          </div>

          {!isRestrictedWarehouseUser && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", width: "100%", marginTop: "0.5rem" }}>
              {[
                { key: "all",       label: "كل الفروع" },
                { key: "المخزن", label: "المخزن" },
                { key: "التجمع",    label: "التجمع" },
                { key: "العبور",    label: "العبور" },
                { key: "عين شمس",    label: "عين شمس" },
                { key: "أخرى",      label: "أخرى" },
              ].map(b => (
                <button
                  key={b.key}
                  onClick={() => setBranchFilter(b.key)}
                  style={{
                    padding: "0.35rem 0.85rem",
                    borderRadius: "9999px",
                    border: branchFilter === b.key ? "2px solid #3b82f6" : "2px solid transparent",
                    background: branchFilter === b.key ? "#dbeafe" : "#e2e8f0",
                    color: branchFilter === b.key ? "#1d4ed8" : "#475569",
                    fontFamily: "inherit",
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          )}
          
          {!isRestrictedWarehouseUser && uniqueEmployees.length > 0 && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", width: "100%", marginTop: "0.5rem" }}>
              <button
                onClick={() => setEmployeeFilter("all")}
                style={{
                  padding: "0.35rem 0.85rem",
                  borderRadius: "9999px",
                  border: employeeFilter === "all" ? "2px solid #8b5cf6" : "2px solid transparent",
                  background: employeeFilter === "all" ? "#ede9fe" : "#f1f5f9",
                  color: employeeFilter === "all" ? "#6d28d9" : "#475569",
                  fontFamily: "inherit",
                  fontWeight: 700,
                  fontSize: "0.78rem",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                كل الموظفين
              </button>
              {uniqueEmployees.map(emp => (
                <button
                  key={emp}
                  onClick={() => setEmployeeFilter(emp)}
                  style={{
                    padding: "0.35rem 0.85rem",
                    borderRadius: "9999px",
                    border: employeeFilter === emp ? "2px solid #8b5cf6" : "2px solid transparent",
                    background: employeeFilter === emp ? "#ede9fe" : "#f1f5f9",
                    color: employeeFilter === emp ? "#6d28d9" : "#475569",
                    fontFamily: "inherit",
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {emp}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <p style={{ textAlign: "center", color: "#64748b", padding: "3rem" }}>جاري تحميل الطلبات...</p>
        ) : filteredOrders.length === 0 ? (
          <p style={{ textAlign: "center", color: "#64748b", padding: "3rem" }}>لا توجد طلبات.</p>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
            gap: "0.75rem",
          }}>
            {filteredOrders.map((order) => {
              const st = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
              const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
              const discountValue = (order.total * (order.discountPercentage || 0)) / 100;
              const finalTotal = order.total - discountValue;
              const itemsSummary = order.items?.slice(0, 2).map(i =>
                `${i.name} (${i.modelNumber}) - ${i.selectedColor}`
              ).join(" / ") + (order.items?.length > 2 ? ` +${order.items.length - 2}` : "");

              return (
                <div
                  key={order.id}
                  onClick={() => openModal(order)}
                  style={{
                    background: "#fff",
                    borderRadius: "0.75rem",
                    border: "1px solid #e2e8f0",
                    padding: "0.75rem",
                    cursor: "pointer",
                    transition: "box-shadow 0.15s, transform 0.15s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.4rem",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)";
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.25rem" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", minWidth: 0 }}>
                      {isOwner && (
                        <input 
                          type="checkbox" 
                          checked={selectedOrderIds.includes(order.id)}
                          onChange={(e) => handleSelectOrder(order.id, e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#A62E2E", marginTop: "2px" }}
                        />
                      )}
                      <div>
                        <p style={{
                          fontWeight: 800, fontSize: "0.82rem", color: "#0f172a",
                          margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                        }}>
                          {order.customerBrand || order.customerName}
                        </p>
                        <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: 0 }}>
                          {order.customerName}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.3rem", flexShrink: 0 }}>
                      <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                        <span style={{ fontSize: "0.68rem", color: "#3b82f6", fontWeight: "bold", background: "#dbeafe", padding: "0.1rem 0.4rem", borderRadius: "0.2rem", whiteSpace: "nowrap" }}>
                          {order.branch || "أخرى"}
                        </span>
                        <span style={{ fontSize: "0.68rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                          {timeAgo(date)}
                        </span>
                      </div>
                      {order.employeeName && (
                        <span style={{ background: "#e2e8f0", padding: "2px 8px", borderRadius: "12px", fontSize: "12px", color: "#475569", fontWeight: "bold" }}>
                          👤 {getDisplayEmployee(order.employeeName)}
                        </span>
                      )}
                    </div>
                  </div>

                  <p style={{ fontSize: "0.72rem", color: "#475569", margin: 0, direction: "ltr", textAlign: "right" }}>
                    {order.customerPhone}
                  </p>

                  {/* We moved employeeName to the top left badge, so it's hidden from here */}

                  {order.items?.length > 0 && (
                    <p style={{
                      fontSize: "0.68rem", color: "#475569", margin: 0,
                      background: "#f8fafc", padding: "0.25rem 0.4rem",
                      borderRadius: "0.35rem", border: "1px solid #f1f5f9",
                      lineHeight: 1.4,
                    }}>
                      {itemsSummary}
                    </p>
                  )}

                  {order.deliveryDate && (
                    <p style={{ fontSize: "0.68rem", color: "#3b82f6", margin: 0, fontWeight: 600 }}>
                      📅 {order.deliveryDate}
                    </p>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.1rem" }}>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "#A62E2E" }}>
                        {finalTotal} ج
                      </span>
                      {(order.deposit ?? 0) > 0 && (
                        <span style={{ fontSize: "0.65rem", color: "#10b981", marginRight: "0.3rem" }}>
                          عربون: {order.deposit}
                        </span>
                      )}
                    </div>
                    <span style={{
                      fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.45rem",
                      borderRadius: "9999px", background: st.bg, color: st.color,
                    }}>
                      {st.label}
                    </span>
                  </div>
                  {isOwner && (
                    <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem", borderTop: "1px solid #f1f5f9", paddingTop: "0.4rem" }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); duplicateOrder(order.id); }}
                        style={{ flex: 1, padding: "0.3rem", background: "#f1f5f9", border: "none", borderRadius: "0.3rem", color: "#475569", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "4px", fontSize: "0.7rem", fontWeight: "bold" }} title="تكرار"
                      >
                        <Copy size={14} /> تكرار
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); archiveOrder(order.id, !!order.isArchived); }}
                        style={{ flex: 1, padding: "0.3rem", background: order.isArchived ? "#fef3c7" : "#f1f5f9", border: "none", borderRadius: "0.3rem", color: order.isArchived ? "#b45309" : "#475569", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "4px", fontSize: "0.7rem", fontWeight: "bold" }} title="أرشفة"
                      >
                        <Archive size={14} /> أرشفة
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteOrder(order.id); }}
                        style={{ flex: 1, padding: "0.3rem", background: "#fee2e2", border: "none", borderRadius: "0.3rem", color: "#991b1b", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "4px", fontSize: "0.7rem", fontWeight: "bold" }} title="حذف"
                      >
                        <Trash2 size={14} /> حذف
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* EDITABLE INVOICE MODAL */}
      {selectedOrder && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1rem",
          }}
          onClick={closeModal}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#fff", width: "100%", maxWidth: "800px",
              maxHeight: "95vh", overflowY: "auto", padding: "2rem",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              borderRadius: "0.5rem",
              animation: "fadeIn 0.2s ease",
              position: "relative",
              direction: "rtl"
            }}
          >
            {/* Toolbar Top */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", borderBottom: "2px solid #e2e8f0", paddingBottom: "1rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <select
                  className="input"
                  style={{ padding: "0.4rem 0.75rem", fontSize: "0.85rem", fontWeight: "bold", background: STATUS_CONFIG[selectedOrder.status]?.bg, color: STATUS_CONFIG[selectedOrder.status]?.color, border: "none" }}
                  value={selectedOrder.status}
                  onChange={e => updateStatus(selectedOrder.id, e.target.value)}
                >
                  <option value="pending">⏳ قيد الانتظار</option>
                  <option value="paid">✅ تم الدفع والتأكيد</option>
                  <option value="shipped">🚚 مع شركة الشحن</option>
                  <option value="delivered">📦 تم التسليم</option>
                  <option value="cancelled">❌ ملغي</option>
                </select>
                {isOwner && (
                  <>
                    <button 
                      onClick={() => archiveOrder(selectedOrder.id, !!selectedOrder.isArchived)}
                      style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.4rem 0.75rem", background: selectedOrder.isArchived ? "#fef3c7" : "#f1f5f9", color: selectedOrder.isArchived ? "#b45309" : "#475569", border: "none", borderRadius: "0.25rem", fontSize: "0.75rem", fontWeight: "bold", cursor: "pointer" }}
                    >
                      <Archive size={16} /> {selectedOrder.isArchived ? 'إلغاء الأرشفة' : 'أرشفة الطلب'}
                    </button>
                    <button 
                      onClick={() => deleteOrder(selectedOrder.id)}
                      style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.4rem 0.75rem", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "0.25rem", fontSize: "0.75rem", fontWeight: "bold", cursor: "pointer" }}
                    >
                      <Trash2 size={16} /> حذف الطلب
                    </button>
                  </>
                )}
              </div>
              <button onClick={closeModal} style={{ background: "#f1f5f9", border: "none", cursor: "pointer", color: "#64748b", padding: "0.5rem", borderRadius: "50%" }}>
                <X size={20} />
              </button>
            </div>

            {/* INVOICE CONTENT (Matches PDF) */}
            <div style={{ padding: "0 1rem" }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '30px', borderBottom: '2px solid #eee', paddingBottom: '20px' }}>
                <img src="/ColoredLogo.png" alt="Happy Boy Logo" style={{ height: '120px', objectFit: 'contain' }} />
              </div>
              
              <div style={{ marginBottom: "30px", padding: "20px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
                  <div style={{ flex: "1 1 45%", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <p style={{ fontSize: "16px", margin: 0, display: "flex", alignItems: "center", gap: "5px" }}>
                      <strong>رقم الطلب:</strong> <span style={{ color: "#A62E2E", fontWeight: "bold" }}>{selectedOrder.orderNumber || selectedOrder.id.slice(0, 8)}</span>
                    </p>
                    <p style={{ fontSize: "16px", margin: 0, display: "flex", alignItems: "center", gap: "5px" }}>
                      <strong>اسم العميل:</strong> 
                      <input type="text" value={selectedOrder.customerName} onChange={e => handleOrderChange('customerName', e.target.value)} style={{ border: "none", borderBottom: "1px dashed #cbd5e1", background: "transparent", outline: "none", fontSize: "16px", flex: 1, padding: "2px 5px", color: "#000" }} />
                    </p>
                    <p style={{ fontSize: "16px", margin: 0, display: "flex", alignItems: "center", gap: "5px" }}>
                      <strong>رقم الهاتف:</strong> 
                      <input type="text" value={selectedOrder.customerPhone} onChange={e => handleOrderChange('customerPhone', e.target.value)} dir="ltr" style={{ border: "none", borderBottom: "1px dashed #cbd5e1", background: "transparent", outline: "none", fontSize: "16px", flex: 1, padding: "2px 5px", textAlign: "right", color: "#000" }} />
                    </p>
                    <p style={{ fontSize: "16px", margin: 0, display: "flex", alignItems: "center", gap: "5px" }}>
                      <strong>البراند:</strong> 
                      <input type="text" value={selectedOrder.customerBrand || ''} onChange={e => handleOrderChange('customerBrand', e.target.value)} style={{ border: "none", borderBottom: "1px dashed #cbd5e1", background: "transparent", outline: "none", fontSize: "16px", flex: 1, padding: "2px 5px", color: "#000" }} />
                    </p>
                    {selectedOrder.employeeName && (
                      <p style={{ fontSize: "16px", margin: 0, display: "flex", alignItems: "center", gap: "5px", color: "#A62E2E" }}>
                        <strong>بواسطة الموظف:</strong> {getDisplayEmployee(selectedOrder.employeeName)}
                      </p>
                    )}
                  </div>
                  <div style={{ flex: "1 1 45%", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <p style={{ fontSize: "16px", margin: 0, display: "flex", alignItems: "center", gap: "5px" }}>
                      <strong>المحافظة:</strong> 
                      <input type="text" value={selectedOrder.customerGovernorate || ''} onChange={e => handleOrderChange('customerGovernorate', e.target.value)} style={{ border: "none", borderBottom: "1px dashed #cbd5e1", background: "transparent", outline: "none", fontSize: "16px", flex: 1, padding: "2px 5px", color: "#000" }} />
                    </p>
                    <p style={{ fontSize: "16px", margin: 0, display: "flex", alignItems: "center", gap: "5px" }}>
                      <strong>العنوان:</strong> 
                      <input type="text" value={selectedOrder.customerAddress || ''} onChange={e => handleOrderChange('customerAddress', e.target.value)} style={{ border: "none", borderBottom: "1px dashed #cbd5e1", background: "transparent", outline: "none", fontSize: "16px", flex: 1, padding: "2px 5px", color: "#000" }} />
                    </p>
                    <p style={{ fontSize: "16px", margin: 0, display: "flex", alignItems: "center", gap: "5px" }}>
                      <strong>الشحن:</strong> 
                      <input type="text" value={selectedOrder.customerShipping || ''} onChange={e => handleOrderChange('customerShipping', e.target.value)} style={{ border: "none", borderBottom: "1px dashed #cbd5e1", background: "transparent", outline: "none", fontSize: "16px", flex: 1, padding: "2px 5px", color: "#000" }} />
                    </p>
                    <p style={{ fontSize: "16px", margin: 0, display: "flex", alignItems: "center", gap: "5px", color: "#2563eb" }}>
                      <strong>التسليم:</strong> 
                      <input type="date" value={selectedOrder.deliveryDate || ''} onChange={e => handleOrderChange('deliveryDate', e.target.value)} style={{ border: "none", borderBottom: "1px dashed #cbd5e1", background: "transparent", outline: "none", fontSize: "16px", flex: 1, padding: "2px 5px", color: "#2563eb", fontWeight: "bold" }} />
                    </p>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div style={{ overflowX: "auto", width: "100%", paddingBottom: "10px" }}>
                <table style={{ width: "100%", minWidth: "650px", borderCollapse: "collapse", marginBottom: "20px" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                    <th style={{ padding: "12px", textAlign: "right" }}>الصنف</th>
                    <th style={{ padding: "12px", textAlign: "right" }}>اللون</th>
                    <th style={{ padding: "12px", textAlign: "center" }}>النوع (ثري/قطعة)</th>
                    <th style={{ padding: "12px", textAlign: "center" }}>الكمية</th>
                    <th style={{ padding: "12px", textAlign: "center" }}>السعر (ج)</th>
                    <th style={{ padding: "12px", textAlign: "center" }}>🗑️</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items?.map((item, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "12px" }}>{item.name} (موديل {item.modelNumber})</td>
                      <td style={{ padding: "12px" }}>{item.selectedColor} {item.colorBarcode ? `(${item.colorBarcode})` : '(---)'}</td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <select value={item.isSeri ? "seri" : "piece"} onChange={e => handleItemChange(i, 'isSeri', e.target.value === "seri")} style={{ padding: "4px", fontSize: "14px", border: "1px solid #cbd5e1", borderRadius: "4px", color: "#000" }}>
                          <option value="seri">ثري ({getSizesCount(item.name, item.modelNumber, item.sizes)} مقاس) {getSizesText(item.name, item.modelNumber, item.sizes)}</option>
                          <option value="piece">قطعة واحدة</option>
                        </select>
                      </td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <input type="number" min="1" value={item.quantity || 1} onChange={e => handleItemChange(i, 'quantity', Number(e.target.value))} style={{ width: "60px", padding: "4px", textAlign: "center", border: "1px solid #cbd5e1", borderRadius: "4px", color: "#000" }} />
                      </td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <input type="number" value={item.price} onChange={e => handleItemChange(i, 'price', Number(e.target.value))} style={{ width: "80px", padding: "4px", textAlign: "center", border: "1px solid #cbd5e1", borderRadius: "4px", color: "#000" }} />
                      </td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <button onClick={() => removeItemFromOrder(i)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              {/* Add New Item */}
              <div style={{ padding: "12px", background: "#f0fdf4", borderRadius: "8px", border: "1px dashed #86efac", marginBottom: "30px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ color: "#166534", fontSize: "14px", whiteSpace: "nowrap" }}>إضافة منتج:</strong>
                <input type="text" placeholder="رقم الموديل" value={addModelSearch} onChange={e => setAddModelSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && searchModel()} style={{ padding: "6px 10px", borderRadius: "4px", border: "1px solid #bbf7d0", flex: 1, minWidth: "100px", color: "#000" }} />
                <button onClick={searchModel} style={{ padding: "6px 12px", background: "#166534", color: "white", borderRadius: "4px", border: "none", cursor: "pointer", fontWeight: "bold" }}>بحث</button>
                
                {foundProduct && (
                  <>
                    <select value={addSelectedColor} onChange={e => setAddSelectedColor(e.target.value)} style={{ padding: "6px", borderRadius: "4px", border: "1px solid #bbf7d0", color: "#000" }}>
                      {foundProduct.colors?.map((c: any) => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    <button onClick={addItemToOrder} style={{ padding: "6px 12px", background: "#10b981", color: "white", borderRadius: "4px", border: "none", cursor: "pointer", fontWeight: "bold", display: "flex", alignItems: "center", gap: "5px" }}><Plus size={14} /> إضافة للصنف</button>
                  </>
                )}
              </div>

              {/* Totals Section */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ width: "350px", background: "#f8fafc", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", fontSize: "16px" }}>
                    <span>إجمالي القطع:</span>
                    <strong>{calculateTotalPieces(selectedOrder.items)} قطعة</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", fontSize: "16px" }}>
                    <span>إجمالي الثريهات:</span>
                    <strong>{calculateTotalSeries(selectedOrder.items)} ثري</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", fontSize: "16px" }}>
                    <span>الإجمالي الكلي:</span>
                    <strong>{calculateTotal(selectedOrder.items)} ج.م</strong>
                  </div>
                  {Number(selectedOrder.discountPercentage) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", fontSize: "16px", color: "#16a34a" }}>
                      <span>قيمة الخصم ({selectedOrder.discountPercentage}%):</span>
                      <strong>- {(calculateTotal(selectedOrder.items) * Number(selectedOrder.discountPercentage)) / 100} ج.م</strong>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", fontSize: "16px", color: "#16a34a", alignItems: "center" }}>
                    <span>العربون المدفوع:</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <input type="number" value={selectedOrder.deposit || ''} onChange={e => handleOrderChange('deposit', e.target.value)} style={{ width: "80px", padding: "4px", textAlign: "center", border: "1px solid #bbf7d0", borderRadius: "4px", fontWeight: "bold", color: "#16a34a" }} />
                      <strong>ج.م</strong>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", fontSize: "16px", color: "#2563eb", alignItems: "center" }}>
                    <span>نسبة الخصم (%):</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <input type="number" min="0" max="100" value={selectedOrder.discountPercentage || ''} onChange={e => handleOrderChange('discountPercentage', e.target.value)} style={{ width: "80px", padding: "4px", textAlign: "center", border: "1px solid #bfdbfe", borderRadius: "4px", fontWeight: "bold", color: "#2563eb" }} />
                      <strong>%</strong>
                    </div>
                  </div>
                  <div style={{ borderTop: "2px solid #cbd5e1", margin: "15px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "20px", color: "#A62E2E", fontWeight: "bold" }}>
                    <span>المبلغ المتبقي:</span>
                    <span>{calculateTotal(selectedOrder.items) - ((calculateTotal(selectedOrder.items) * Number(selectedOrder.discountPercentage || 0)) / 100) - (selectedOrder.deposit || 0)} ج.م</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "1rem", marginTop: "2rem", paddingTop: "1.5rem", borderTop: "2px solid #e2e8f0", flexWrap: "wrap" }}>
              <button
                onClick={saveOrderDetails}
                disabled={saving}
                style={{ flex: "1 1 200px", padding: "0.8rem", background: "#0f172a", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "16px", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}
              >
                <Save size={18} /> {saving ? "جاري الحفظ..." : "حفظ الفاتورة"}
              </button>
              
              <button
                onClick={handleWhatsAppShare}
                style={{ flex: "1 1 250px", padding: "0.8rem", background: "#25D366", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "16px", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}
              >
                <MessageCircle size={18} /> حفظ و ارسال واتساب
              </button>

              <button
                onClick={handlePrintPDF}
                style={{ flex: "1 1 150px", padding: "0.8rem", background: "#f8fafc", color: "#334155", border: "1px solid #cbd5e1", borderRadius: "8px", fontWeight: "bold", fontSize: "16px", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}
              >
                <Printer size={18} /> طباعة
              </button>

              <button
                onClick={handleDownloadPDF}
                style={{ flex: "1 1 150px", padding: "0.8rem", background: "#f8fafc", color: "#334155", border: "1px solid #cbd5e1", borderRadius: "8px", fontWeight: "bold", fontSize: "16px", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}
              >
                <Download size={18} /> تحميل PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Invoice for PDF Generation */}
      <div
        ref={invoiceRef}
        style={{
          display: "none", width: "794px",
          background: "white", color: "black",
          position: "absolute", top: "-9999px", left: "-9999px", direction: "rtl",
          fontFamily: "'Cairo', sans-serif",
          boxSizing: "border-box"
        }}
      >
        {selectedOrder && (() => {
          const items = selectedOrder.items || [];
          const FIRST_PAGE_LIMIT = 32;
          const OTHER_PAGE_LIMIT = 35;
          const pages: any[][] = [];
          let i = 0;
          while (i < items.length) {
            const take: number = pages.length === 0 ? FIRST_PAGE_LIMIT : OTHER_PAGE_LIMIT;
            pages.push(items.slice(i, i + take));
            i += take;
          }
          if (pages.length === 0) pages.push([]);
          
          const lastPageItems = pages[pages.length - 1];
          const isFirstPageLast = pages.length === 1;
          const maxItemsForTotals = isFirstPageLast ? 22 : 26; 
          if (lastPageItems.length > maxItemsForTotals) {
             pages.push([]); // Empty page to ensure totals fit perfectly
          }

          return pages.map((pageItems, pageIndex) => (
            <div key={pageIndex} className="invoice-page" style={{ width: "100%", padding: "20px", boxSizing: "border-box" }}>
              
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "15px", gap: "20px" }}>
                {pageIndex === 0 ? (
                  <div style={{ flex: 1, padding: "12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", display: "flex", gap: "15px" }}>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                      <p style={{ fontSize: "14px", margin: 0 }}><strong>رقم الطلب:</strong> <span style={{ color: "#A62E2E", fontWeight: "bold" }}>{selectedOrder.orderNumber || selectedOrder.id.slice(0, 8)}</span></p>
                      <p style={{ fontSize: "14px", margin: 0 }}><strong>اسم العميل:</strong> {selectedOrder.customerName}</p>
                      <p style={{ fontSize: "14px", margin: 0 }}><strong>رقم الهاتف:</strong> <span dir="ltr">{selectedOrder.customerPhone}</span></p>
                      <p style={{ fontSize: "14px", margin: 0 }}><strong>البراند:</strong> {selectedOrder.customerBrand}</p>
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                      <p style={{ fontSize: "14px", margin: 0 }}><strong>المحافظة:</strong> {selectedOrder.customerGovernorate}</p>
                      <p style={{ fontSize: "14px", margin: 0 }}><strong>العنوان:</strong> {selectedOrder.customerAddress}</p>
                      <p style={{ fontSize: "14px", margin: 0 }}><strong>الشحن:</strong> {selectedOrder.customerShipping}</p>
                      <p style={{ fontSize: "14px", margin: 0, color: "#2563eb" }}>
                        <strong>التسليم:</strong> {selectedOrder.deliveryDate || (selectedOrder.createdAt?.toDate ? selectedOrder.createdAt.toDate().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : '')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", justifyContent: "center" }}>
                    <p style={{ fontSize: "15px", margin: 0, color: "#1e293b" }}><strong>تابع الفاتورة رقم:</strong> <span style={{ color: "#A62E2E", fontWeight: "bold" }}>{selectedOrder.orderNumber || selectedOrder.id.slice(0, 8)}</span></p>
                    <p style={{ fontSize: "14px", margin: 0, color: "#475569", fontWeight: "bold" }}>{new Date().toLocaleDateString('en-GB')} &nbsp;|&nbsp; صفحة {pageIndex + 1} من {pages.length}</p>
                  </div>
                )}
                
                {pageIndex === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start' }}>
                    <img src="/ColoredLogo.png" alt="Happy Boy Logo" style={{ height: '80px', objectFit: 'contain' }} />
                    {selectedOrder.employeeName && (
                      <span style={{ marginTop: "5px", fontSize: "14px", color: "#A62E2E", fontWeight: "bold" }}>{getDisplayEmployee(selectedOrder.employeeName)}</span>
                    )}
                    <span style={{ marginTop: "5px", fontSize: "14px", fontWeight: "bold", color: "#475569" }}>{new Date().toLocaleDateString('en-GB')} - صفحة {pageIndex + 1}/{pages.length}</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <img src="/ColoredLogo.png" alt="Happy Boy Logo" style={{ height: '65px', objectFit: 'contain' }} />
                  </div>
                )}
              </div>

              {/* Table */}
              {pageItems.length > 0 && (
                <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", marginBottom: "20px" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1", fontSize: "14px" }}>
                    <th style={{ padding: "8px", textAlign: "center", width: "8%", verticalAlign: "middle" }}>الموديل</th>
                    <th style={{ padding: "8px", textAlign: "center", width: "30%", verticalAlign: "middle" }}>الصنف</th>
                    <th style={{ padding: "8px", textAlign: "center", width: "12%", verticalAlign: "middle" }}>اللون</th>
                    <th style={{ padding: "8px", textAlign: "center", width: "33%", verticalAlign: "middle" }}>النوع (ثري/قطعة)</th>
                    <th style={{ padding: "8px", textAlign: "center", width: "7%", verticalAlign: "middle" }}>الكمية</th>
                    <th style={{ padding: "8px", textAlign: "center", width: "10%", verticalAlign: "middle" }}>السعر (ج)</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #e2e8f0", fontSize: "14px" }}>
                      <td style={{ padding: "4px 8px", textAlign: "center", width: "8%", fontWeight: "bold", whiteSpace: "nowrap", verticalAlign: "middle" }}>{item.modelNumber}</td>
                      <td style={{ padding: "4px 8px", textAlign: "center", width: "30%", whiteSpace: "nowrap", verticalAlign: "middle" }}>{item.name}</td>
                      <td style={{ padding: "4px 8px", textAlign: "center", width: "12%", whiteSpace: "nowrap", verticalAlign: "middle" }}>{item.selectedColor} {item.colorBarcode ? `(${item.colorBarcode})` : '(---)'}</td>
                      <td style={{ padding: "4px 8px", textAlign: "center", width: "33%", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                        {item.isSeri ? `ثري (${getSizesCount(item.name, item.modelNumber, item.sizes)} مقاس) ${getSizesText(item.name, item.modelNumber, item.sizes)}` : 'قطعة واحدة'}
                      </td>
                      <td style={{ padding: "4px 8px", textAlign: "center", width: "7%", whiteSpace: "nowrap", verticalAlign: "middle" }}>{item.quantity || 1}</td>
                      <td style={{ padding: "4px 8px", textAlign: "center", width: "10%", whiteSpace: "nowrap", verticalAlign: "middle" }}>{item.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}

              {/* Totals (Only on the last page) */}
              {pageIndex === pages.length - 1 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "stretch", gap: "20px", marginBottom: "30px" }}>
                  <div style={{ flex: "1", background: "#f8fafc", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "16px", fontWeight: "bold", color: "#1e293b", borderBottom: "2px solid #e2e8f0", paddingBottom: "10px", width: "100%", textAlign: "center", marginBottom: "5px" }}>📞 أرقام التواصل</span>
                    <span style={{ fontSize: "18px", fontWeight: "bold", direction: "ltr", textAlign: "center", color: "#A62E2E" }}>01009516578</span>
                    <span style={{ fontSize: "18px", fontWeight: "bold", direction: "ltr", textAlign: "center", color: "#A62E2E" }}>0224903939</span>
                  </div>
                  
                  <div style={{ flex: "1", background: "#f8fafc", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', borderBottom: "2px solid #e2e8f0", paddingBottom: "10px", display: 'block', marginBottom: '15px', textAlign: "center" }}>ملخص الموديلات</span>
                    {Object.entries(
                      (selectedOrder.items || []).reduce((acc, item) => {
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
                  
                  <div style={{ flex: "1.5", background: "#f8fafc", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", fontSize: "15px" }}>
                      <span>إجمالي القطع:</span><strong>{calculateTotalPieces(selectedOrder.items)} قطعة</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", fontSize: "15px" }}>
                      <span>إجمالي الثريهات:</span><strong>{calculateTotalSeries(selectedOrder.items)} ثري</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", fontSize: "15px" }}>
                      <span>إجمالي المبلغ:</span><strong>{calculateTotal(selectedOrder.items)} ج.م</strong>
                    </div>
                    {Number(selectedOrder.discountPercentage || 0) > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", fontSize: "15px", color: "#16a34a" }}>
                        <span>الخصم ({selectedOrder.discountPercentage}%):</span>
                        <strong>- {(calculateTotal(selectedOrder.items) * Number(selectedOrder.discountPercentage)) / 100} ج.م</strong>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", fontSize: "15px", color: "#16a34a", alignItems: "center" }}>
                      <span>العربون المدفوع:</span><strong>{selectedOrder.deposit || 0}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", fontWeight: "bold", borderTop: "1px solid #cbd5e1", paddingTop: "15px", color: "#A62E2E" }}>
                      <span>الإجمالي المستحق:</span>
                      <span>{calculateTotal(selectedOrder.items) - ((calculateTotal(selectedOrder.items) * Number(selectedOrder.discountPercentage || 0)) / 100) - Number(selectedOrder.deposit || 0)} ج.م</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ));
        })()}
      </div>
    </div>
  );
}
