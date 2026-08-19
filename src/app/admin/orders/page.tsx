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
import { Printer, Save, Trash2, X, ChevronDown, MessageCircle, Plus, Search, Minus, Download } from "lucide-react";

interface OrderItem {
  cartItemId?: string;
  name: string;
  modelNumber: string;
  selectedColor: string;
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

const getSizesCount = (name: string, sizes: string[] | undefined) => {
  if (name.includes('بيبي') || name.includes('وسط') || name.includes('محير')) return 4;
  return sizes?.length || 1;
};

const getSizesText = (name: string, sizes: string[] | undefined) => {
  if (name.includes('بيبي')) return '(2-3-4-5)';
  if (name.includes('وسط')) return '(6-8-10-12)';
  if (name.includes('محير')) return '(14-16-18-20)';
  if (sizes && sizes.length > 0) return `(${sizes.join("-")})`;
  return '';
};


export default function LiveOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [userEmail, setUserEmail] = useState<string | null>(null);

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
    const newItem: OrderItem = {
      cartItemId: Date.now().toString() + Math.random().toString(),
      name: foundProduct.name,
      modelNumber: foundProduct.modelNumber,
      price: foundProduct.price,
      selectedColor: addSelectedColor,
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
      const sizesCount = getSizesCount(it.name, it.sizes);
      return sum + (it.isSeri ? it.price * sizesCount * qty : it.price * qty);
    }, 0);
  };

  const calculateTotalPieces = (items: OrderItem[]) => {
    return items.reduce((sum, it) => {
      const qty = it.quantity || 1;
      const sizesCount = getSizesCount(it.name, it.sizes);
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
    if (!confirm("هل أنت متأكد من حذف هذا الطلب؟")) return;
    await updateDoc(doc(db, "orders", orderId), { isDeleted: true });
    if (selectedOrder?.id === orderId) closeModal();
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
    invoiceRef.current.style.display = "block";
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      
      const canvas = await html2canvas(invoiceRef.current, { scale: 1.5, useCORS: true });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      const imgData = canvas.toDataURL("image/jpeg", 0.6);

      pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      return pdf;
    } finally {
      invoiceRef.current.style.display = "none";
    }
  };

  const handleWhatsAppShare = async () => {
    if (!selectedOrder) return;
    
    // Save first just in case
    await saveOrderDetails();
    
    const pdf = await generatePDF(selectedOrder);
    if (!pdf) return;

    const pdfBlob = pdf.output("blob");
    const fileName = `فاتورة_${selectedOrder.customerName.replace(/\s+/g, '_')}.pdf`;
    const file = new File([pdfBlob], fileName, { type: "application/pdf" });
    
    const phone = selectedOrder.customerPhone.replace(/[^0-9]/g, '');
    const intlPhone = phone.startsWith('0') ? '2' + phone : phone;
    const subtotal = calculateTotal(selectedOrder.items);
    const discountValue = (subtotal * (selectedOrder.discountPercentage || 0)) / 100;
    const remaining = subtotal - discountValue - (selectedOrder.deposit || 0);
    const msgText = `فاتورة طلبك جاهزة يا فندم من Happy Boy&Girl 🤍\nبرجاء مراجعة الفاتورة المرفقة.\nمتبقي عند الاستلام: ${remaining} ج.م`;

    // Download the PDF first
    pdf.save(fileName);
    alert("تم تحميل الفاتورة כملف PDF بنجاح!\n\nسيتم فتح واتساب الآن مع رقم العميل، يرجى إرفاق الملف المحمل يدوياً للمحادثة.");
    
    // Open WhatsApp chat directly with the customer
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msgText)}`, '_blank');
  };

  const uniqueEmployees = Array.from(new Set(orders.map(o => o.employeeName).filter(Boolean))) as string[];

  const visibleOrders = orders.filter(o => {
    const orderBranch = o.branch || "أخرى";
    
    if (employeeFilter !== "all" && o.employeeName !== employeeFilter) return false;

    if (isOwner) {
      if (branchFilter !== "all" && orderBranch !== branchFilter) return false;
      return true;
    } else if (isRestrictedWarehouseUser) {
      return orderBranch === "المخزن";
    } else {
      if (orderBranch === "المخزن") return false;
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
    cancelled: visibleOrders.filter(o => o.status === "cancelled").length,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "1rem 1.5rem", marginLeft: "calc(-50vw + 50%)", marginRight: "calc(-50vw + 50%)", width: "100vw" }}>
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
            🔔 الطلبات الحية <span style={{ color: "#A62E2E" }}>Live Orders</span>
          </h2>

          {/* Stats pills */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {[
              { key: "all",       label: `الكل (${stats.total})`,          bg: "#0f172a", color: "#fff" },
              { key: "pending",   label: `انتظار (${stats.pending})`,       bg: "#fef3c7", color: "#b45309" },
              { key: "paid",      label: `مدفوع (${stats.paid})`,           bg: "#d1fae5", color: "#065f46" },
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
          </div>

          {!isRestrictedWarehouseUser && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", width: "100%", marginTop: "0.5rem" }}>
              {[
                { key: "all",       label: "كل الفروع" },
                ...(isOwner ? [{ key: "المخزن", label: "المخزن" }] : []),
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
                  {emp.includes('@') ? emp.split('@')[0] : emp}
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
                    <div style={{ minWidth: 0 }}>
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
                        <span style={{ fontSize: "0.65rem", color: "#8b5cf6", fontWeight: "bold", background: "#ede9fe", padding: "0.1rem 0.3rem", borderRadius: "0.2rem", whiteSpace: "nowrap" }}>
                          👤 {order.employeeName.includes('@') ? order.employeeName.split('@')[0] : order.employeeName}
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
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
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
              </div>
              <button onClick={closeModal} style={{ background: "#f1f5f9", border: "none", cursor: "pointer", color: "#64748b", padding: "0.5rem", borderRadius: "50%" }}>
                <X size={20} />
              </button>
            </div>

            {/* INVOICE CONTENT (Matches PDF) */}
            <div style={{ padding: "0 1rem" }}>
              <div style={{ textAlign: "center", marginBottom: "30px", borderBottom: "2px solid #eee", paddingBottom: "20px" }}>
                <h1 style={{ fontSize: "32px", color: "#A62E2E", marginBottom: "10px", fontWeight: "bold" }}>Happy Boy&Girl</h1>
                <h2 style={{ fontSize: "22px", color: "#333" }}>فاتورة طلب رسمي</h2>
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
                        <strong>بواسطة الموظف:</strong> {selectedOrder.employeeName}
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
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
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
                      <td style={{ padding: "12px" }}>{item.selectedColor}</td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <select value={item.isSeri ? "seri" : "piece"} onChange={e => handleItemChange(i, 'isSeri', e.target.value === "seri")} style={{ padding: "4px", fontSize: "14px", border: "1px solid #cbd5e1", borderRadius: "4px", color: "#000" }}>
                          <option value="seri">ثري ({getSizesCount(item.name, item.sizes)} مقاس) {getSizesText(item.name, item.sizes)}</option>
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
                <MessageCircle size={18} /> حفظ وإرسال PDF واتساب
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

      {/* Hidden Invoice for PDF Generation (Matching Image Style with Brand Colors) */}
      <div
        ref={invoiceRef}
        style={{
          display: "none", width: "800px", minHeight: "1131px", padding: "40px",
          background: "white", color: "black",
          position: "absolute", top: "-9999px", left: "-9999px", direction: "rtl",
          fontFamily: "'Cairo', sans-serif"
        }}
      >
        {selectedOrder && (
          <div style={{
            border: "2px solid #e2e8f0",
            borderRadius: "20px",
            padding: "40px",
            position: "relative",
            minHeight: "1050px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}>
            
            {/* Geometric Shapes (Top Right) */}
            <div style={{ position: "absolute", top: 0, right: 0, width: "150px", height: "150px", background: "#A62E2E", clipPath: "polygon(100% 0, 100% 100%, 0 0)", opacity: 0.1, borderTopRightRadius: "20px" }}></div>
            <div style={{ position: "absolute", top: 0, right: "40px", width: "100px", height: "100px", background: "#0f172a", clipPath: "polygon(100% 0, 100% 100%, 0 0)", opacity: 0.1 }}></div>

            {/* Geometric Shapes (Bottom Left) */}
            <div style={{ position: "absolute", bottom: 0, left: 0, width: "150px", height: "150px", background: "#A62E2E", clipPath: "polygon(0 0, 0% 100%, 100% 100%)", opacity: 0.1, borderBottomLeftRadius: "20px" }}></div>
            <div style={{ position: "absolute", bottom: 0, left: "40px", width: "100px", height: "100px", background: "#0f172a", clipPath: "polygon(0 0, 0% 100%, 100% 100%)", opacity: 0.1 }}></div>

            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', position: "relative", zIndex: 10 }}>
              
              {/* Logo - Top Left */}
              <div style={{ width: "250px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <img src="/Logo.png" alt="Happy Boy Logo" style={{ width: '100%', objectFit: 'contain' }} />
                {/* <div style={{ fontSize: "16px", color: "#A62E2E", fontWeight: "bold", marginTop: "10px", letterSpacing: "2px" }}>HAPPY BOY</div> */}
              </div>

              {/* Title & Info - Top Right */}
              <div style={{ textAlign: 'left', width: "350px", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <div style={{ fontSize: "32px", fontWeight: "900", color: '#0f172a', marginBottom: '0px' }}>فاتورة مبيعات</div>
                <div style={{ fontSize: "16px", color: '#A62E2E', fontWeight: 'bold', letterSpacing: "8px", marginBottom: '30px', marginRight: "-8px" }}>INVOICE</div>
                
                <div style={{ width: "100%", fontSize: "16px", fontWeight: "bold", color: "#0f172a", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderBottom: "1px dashed #cbd5e1", paddingBottom: "5px" }}>
                    <span style={{ color: "#A62E2E" }}>{selectedOrder.customerName} {selectedOrder.customerBrand ? `(${selectedOrder.customerBrand})` : ''}</span>
                    <span>: اسم العميل</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderBottom: "1px dashed #cbd5e1", paddingBottom: "5px" }}>
                    <span style={{ color: "#A62E2E" }}>{selectedOrder.createdAt?.toDate ? selectedOrder.createdAt.toDate().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}</span>
                    <span>: التـاريـــــــخ</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderBottom: "1px dashed #cbd5e1", paddingBottom: "5px" }}>
                    <span style={{ color: "#A62E2E" }}>{selectedOrder.orderNumber || selectedOrder.id.slice(0, 8)}</span>
                    <span>: رقم الفاتورة</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Table */}
            <div style={{ marginBottom: "20px", flex: 1, zIndex: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", border: "1px solid #94a3b8" }}>
                <thead>
                  <tr style={{ background: "#e2e8f0", borderBottom: "1px solid #94a3b8" }}>
                    <th style={{ padding: "12px 8px", fontWeight: "bold", color: "#0f172a", fontSize: "16px", border: "1px solid #94a3b8", width: "50px" }}>رقم</th>
                    <th style={{ padding: "12px 8px", fontWeight: "bold", color: "#0f172a", fontSize: "16px", border: "1px solid #94a3b8", width: "80px" }}>الكمية</th>
                    <th style={{ padding: "12px 8px", fontWeight: "bold", color: "#0f172a", fontSize: "16px", border: "1px solid #94a3b8", width: "120px" }}>السعر</th>
                    <th style={{ padding: "12px 8px", fontWeight: "bold", color: "#0f172a", fontSize: "16px", border: "1px solid #94a3b8" }}>وصف المنتج</th>
                    <th style={{ padding: "12px 8px", fontWeight: "bold", color: "#0f172a", fontSize: "16px", border: "1px solid #94a3b8", width: "150px" }}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items?.map((item, i) => {
                    const qty = item.quantity || 1;
                    const piecesInSeri = item.isSeri ? getSizesCount(item.name, item.sizes) : 1;
                    const itemTotalPieces = item.isSeri ? piecesInSeri * qty : qty;
                    const rowTotal = item.price * itemTotalPieces;
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #cbd5e1" }}>
                        <td style={{ padding: "12px 8px", fontWeight: "bold", color: "#0f172a", fontSize: "15px", border: "1px solid #cbd5e1" }}>{i + 1}</td>
                        <td style={{ padding: "12px 8px", fontWeight: "bold", color: "#0f172a", fontSize: "15px", border: "1px solid #cbd5e1" }}>{qty} {item.isSeri ? 'ثري' : 'قطعة'}</td>
                        <td style={{ padding: "12px 8px", fontWeight: "bold", color: "#0f172a", fontSize: "15px", border: "1px solid #cbd5e1" }}>{item.price} ج.م</td>
                        <td style={{ padding: "12px 8px", fontWeight: "bold", color: "#0f172a", fontSize: "15px", border: "1px solid #cbd5e1", textAlign: "right" }}>
                           {item.name} <span style={{ color: "#A62E2E" }}>{item.modelNumber}</span> - {item.selectedColor}
                        </td>
                        <td style={{ padding: "12px 8px", fontWeight: "bold", color: "#0f172a", fontSize: "15px", border: "1px solid #cbd5e1" }}>{rowTotal} ج.م</td>
                      </tr>
                    );
                  })}
                  {/* Fill empty rows if items are few */}
                  {Array.from({ length: Math.max(0, 10 - (selectedOrder.items?.length || 0)) }).map((_, i) => (
                     <tr key={`empty-${i}`} style={{ borderBottom: "1px solid #cbd5e1", height: "45px" }}>
                        <td style={{ border: "1px solid #cbd5e1", color: "#0f172a", fontWeight: "bold" }}>{(selectedOrder.items?.length || 0) + i + 1}</td>
                        <td style={{ border: "1px solid #cbd5e1" }}></td>
                        <td style={{ border: "1px solid #cbd5e1" }}></td>
                        <td style={{ border: "1px solid #cbd5e1" }}></td>
                        <td style={{ border: "1px solid #cbd5e1" }}></td>
                     </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer Summary */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '20px', zIndex: 10 }}>
              {/* Notes */}
              <div style={{ width: "40%", textAlign: "right" }}>
                <div style={{ fontSize: "16px", fontWeight: "bold", color: "#0f172a", marginBottom: "15px" }}>: ملاحظات</div>
                <div style={{ borderBottom: "1px solid #cbd5e1", marginBottom: "15px", height: "20px" }}></div>
                <div style={{ borderBottom: "1px solid #cbd5e1", marginBottom: "15px", height: "20px" }}></div>
                <div style={{ borderBottom: "1px solid #cbd5e1", height: "20px" }}></div>
              </div>

              {/* Total Block */}
              <div style={{ background: "#e2e8f0", padding: "15px 25px", border: "1px solid #94a3b8", display: "flex", gap: "10px", alignItems: "center" }}>
                <span style={{ fontSize: "18px", fontWeight: "bold", color: "#0f172a" }}>الإجمالي المطلوب سداده :</span>
                <span style={{ fontSize: "20px", fontWeight: "900", color: "#A62E2E" }}>
                  {calculateTotal(selectedOrder.items) - ((calculateTotal(selectedOrder.items) * Number(selectedOrder.discountPercentage || 0)) / 100) - Number(selectedOrder.deposit || 0)} ج.م
                </span>
              </div>
            </div>

            {/* Bottom Contact Info */}
            <div style={{ display: 'flex', flexDirection: "column", gap: "10px", marginTop: "auto", paddingTop: "40px", zIndex: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: "bold", color: "#0f172a" }}>
                <span>📞</span> 
                <span dir="ltr">01009516578 - 0224903939</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: "bold", color: "#0f172a" }}>
                <span>✉️</span> 
                <span>hello@happyboy-eg.com</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: "bold", color: "#0f172a" }}>
                <span>📍</span> 
                <span>المصنع: المنطقة الصناعية - العبور</span>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
