"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "../../../lib/firebase";
import {
  collection, onSnapshot, query, orderBy,
  updateDoc, doc, deleteDoc, where, getDocs
} from "firebase/firestore";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Printer, Save, Trash2, X, ChevronDown, MessageCircle, Plus, Search, Minus } from "lucide-react";

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
  deliveryDate?: string;
  status: string;
  items: OrderItem[];
  createdAt: any;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "قيد الانتظار", color: "#b45309", bg: "#fef3c7" },
  paid:      { label: "تم الدفع",    color: "#065f46", bg: "#d1fae5" },
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

export default function LiveOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Item editing state
  const [addModelSearch, setAddModelSearch] = useState("");
  const [foundProduct, setFoundProduct] = useState<any>(null);
  const [searchingModel, setSearchingModel] = useState(false);
  const [addSelectedColor, setAddSelectedColor] = useState("");
  const [addQty, setAddQty] = useState(1);

  const invoiceRef = useRef<HTMLDivElement>(null);
  const [currentPdfOrder, setCurrentPdfOrder] = useState<Order | null>(null);

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
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
    setSelectedOrder({ ...order, items: [...order.items] });
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
      const sizes = it.sizes?.length || 1;
      return sum + (it.isSeri ? it.price * sizes * qty : it.price * qty);
    }, 0);
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
    await deleteDoc(doc(db, "orders", orderId));
    if (selectedOrder?.id === orderId) closeModal();
  };

  // PDF
  useEffect(() => {
    if (currentPdfOrder) {
      generatePDF(currentPdfOrder).then(() => {
         setCurrentPdfOrder(null);
      });
    }
  }, [currentPdfOrder]);

  const generatePDF = async (order: Order) => {
    if (!invoiceRef.current) return;
    invoiceRef.current.style.display = "block";
    try {
      const canvas = await html2canvas(invoiceRef.current, { scale: 2, useCORS: true });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const w = pdf.internal.pageSize.getWidth();
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, (canvas.height * w) / canvas.width);
      pdf.save(`فاتورة_${order.customerName.replace(/\s+/g, '_')}.pdf`);
    } finally {
      invoiceRef.current.style.display = "none";
    }
  };

  const handleWhatsAppShare = async () => {
    if (!selectedOrder) return;
    
    // Save first just in case
    await saveOrderDetails();
    
    // Trigger PDF Download
    await generatePDF(selectedOrder);
    
    alert("تم تحميل الفاتورة כملف PDF بنجاح! \n\nسيتم الآن فتح واتساب، يرجى إرفاق الملف المحمل وإرساله للعميل.");
    
    const phone = selectedOrder.customerPhone.replace(/[^0-9]/g, '');
    const intlPhone = phone.startsWith('0') ? '2' + phone : phone;
    const msg = `فاتورة طلبك جاهزة يا فندم من Happy Boy&Girl 🤍\nبرجاء مراجعة الفاتورة المرفقة.\nمتبقي عند الاستلام: ${calculateTotal(selectedOrder.items) - (selectedOrder.deposit || 0)} ج.م`;
    
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const filteredOrders = filterStatus === "all"
    ? orders
    : orders.filter(o => o.status === filterStatus);

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === "pending").length,
    paid: orders.filter(o => o.status === "paid").length,
    cancelled: orders.filter(o => o.status === "cancelled").length,
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
              const remaining = order.total - (order.deposit ?? 0);
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
                    <div style={{ display: "flex", gap: "0.25rem", alignItems: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: "0.68rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                        {timeAgo(date)}
                      </span>
                    </div>
                  </div>

                  <p style={{ fontSize: "0.72rem", color: "#475569", margin: 0, direction: "ltr", textAlign: "right" }}>
                    {order.customerPhone}
                  </p>

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
                        {order.total} ج
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
                          <option value="seri">ثري ({item.sizes?.length || 1} مقاس)</option>
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
                    <span>الإجمالي الكلي:</span>
                    <strong>{calculateTotal(selectedOrder.items)} ج.م</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", fontSize: "16px", color: "#16a34a", alignItems: "center" }}>
                    <span>العربون المدفوع:</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <input type="number" value={selectedOrder.deposit || ''} onChange={e => handleOrderChange('deposit', e.target.value)} style={{ width: "80px", padding: "4px", textAlign: "center", border: "1px solid #bbf7d0", borderRadius: "4px", fontWeight: "bold", color: "#16a34a" }} />
                      <strong>ج.م</strong>
                    </div>
                  </div>
                  <div style={{ borderTop: "2px solid #cbd5e1", margin: "15px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "20px", color: "#A62E2E", fontWeight: "bold" }}>
                    <span>المبلغ المتبقي:</span>
                    <span>{calculateTotal(selectedOrder.items) - (selectedOrder.deposit || 0)} ج.م</span>
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
                onClick={() => setCurrentPdfOrder(selectedOrder)}
                style={{ flex: "1 1 150px", padding: "0.8rem", background: "#f8fafc", color: "#334155", border: "1px solid #cbd5e1", borderRadius: "8px", fontWeight: "bold", fontSize: "16px", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}
              >
                <Printer size={18} /> تحميل PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Invoice for PDF Generation (Clean Read-Only Version) */}
      <div
        ref={invoiceRef}
        style={{
          display: "none", width: "800px", padding: "40px",
          background: "white", color: "black",
          position: "absolute", top: "-9999px", left: "-9999px", direction: "rtl"
        }}
      >
        {currentPdfOrder && (
          <div style={{ fontFamily: "Arial, sans-serif", color: "black" }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <img src="/Logo.png" alt="Happy Boy Logo" style={{ height: '60px', objectFit: 'contain' }} />
              <div style={{ fontSize: "20px", fontWeight: "bold" }}>
                إذن صرف رقم : <span style={{ marginRight: '10px' }}>{currentPdfOrder.orderNumber || currentPdfOrder.id.slice(0, 8)}</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: "16px", fontWeight: "bold" }}>
                القاهرة فى {currentPdfOrder.createdAt?.toDate ? currentPdfOrder.createdAt.toDate().toLocaleDateString('ar-EG') : ''}
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: "16px", fontWeight: "bold", flex: 1 }}>
                عميل رقم : {currentPdfOrder.orderNumber || currentPdfOrder.id.slice(0, 8)}
              </div>
              <div style={{ fontSize: "16px", fontWeight: "bold", flex: 1, textAlign: 'left', direction: 'rtl' }}>
                اسم العميل / {currentPdfOrder.customerName} {currentPdfOrder.customerBrand ? ` - ${currentPdfOrder.customerBrand}` : ''}
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontSize: "16px", fontWeight: "bold", flex: 1 }}>
                شركة الشحن : {currentPdfOrder.customerShipping || 'استلام مصنع'}
              </div>
              <div style={{ fontSize: "16px", fontWeight: "bold", flex: 1, textAlign: 'center' }}>
                موبيل / <span dir="ltr">{currentPdfOrder.customerPhone}</span>
              </div>
              <div style={{ fontSize: "16px", fontWeight: "bold", flex: 1, textAlign: 'left', direction: 'rtl' }}>
                العنوان / {currentPdfOrder.customerAddress || currentPdfOrder.customerGovernorate || ''}
              </div>
            </div>

            {/* Table */}
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid black", marginBottom: "30px", textAlign: "center" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid black" }}>
                  <th style={{ border: "1px solid black", padding: "8px", fontWeight: "bold" }}>الموديل</th>
                  <th style={{ border: "1px solid black", padding: "8px", fontWeight: "bold" }}>اسم الصنف</th>
                  <th style={{ border: "1px solid black", padding: "8px", fontWeight: "bold" }}>اللون</th>
                  <th style={{ border: "1px solid black", padding: "8px", fontWeight: "bold" }}>السعر</th>
                  <th style={{ border: "1px solid black", padding: "8px", fontWeight: "bold" }}>طقم</th>
                  <th style={{ border: "1px solid black", padding: "8px", fontWeight: "bold" }}>الكمية</th>
                  <th style={{ border: "1px solid black", padding: "8px", fontWeight: "bold" }}>الاجمالي</th>
                </tr>
              </thead>
              <tbody>
                {currentPdfOrder.items?.map((item, i) => {
                  const qty = item.quantity || 1;
                  const piecesInSeri = item.isSeri ? (item.sizes?.length || 1) : 1;
                  const totalPieces = item.isSeri ? piecesInSeri * qty : qty;
                  const rowTotal = item.price * totalPieces;
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid black" }}>
                      <td style={{ border: "1px solid black", padding: "8px" }}>{item.modelNumber}</td>
                      <td style={{ border: "1px solid black", padding: "8px" }}>{item.name}</td>
                      <td style={{ border: "1px solid black", padding: "8px" }}>{item.selectedColor}</td>
                      <td style={{ border: "1px solid black", padding: "8px" }}>{item.price}</td>
                      <td style={{ border: "1px solid black", padding: "8px" }}>{piecesInSeri}</td>
                      <td style={{ border: "1px solid black", padding: "8px" }}>{qty}</td>
                      <td style={{ border: "1px solid black", padding: "8px", fontWeight: "bold" }}>{rowTotal}</td>
                    </tr>
                  );
                })}
                {/* Total Row */}
                <tr>
                  <td colSpan={6} style={{ border: "1px solid black", padding: "8px", textAlign: "left", fontWeight: "bold" }}>الإجمالي الكلي</td>
                  <td style={{ border: "1px solid black", padding: "8px", fontWeight: "bold" }}>{calculateTotal(currentPdfOrder.items)}</td>
                </tr>
                {currentPdfOrder.deposit > 0 && (
                  <tr>
                    <td colSpan={6} style={{ border: "1px solid black", padding: "8px", textAlign: "left", fontWeight: "bold", color: "#16a34a" }}>المدفوع (عربون)</td>
                    <td style={{ border: "1px solid black", padding: "8px", fontWeight: "bold", color: "#16a34a" }}>{currentPdfOrder.deposit}</td>
                  </tr>
                )}
                {currentPdfOrder.deposit > 0 && (
                  <tr>
                    <td colSpan={6} style={{ border: "1px solid black", padding: "8px", textAlign: "left", fontWeight: "bold", color: "#A62E2E" }}>المبلغ المتبقي</td>
                    <td style={{ border: "1px solid black", padding: "8px", fontWeight: "bold", color: "#A62E2E" }}>{calculateTotal(currentPdfOrder.items) - currentPdfOrder.deposit}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Footer */}
            <div style={{ textAlign: "center", fontSize: "14px", fontWeight: "bold", marginBottom: "10px" }}>
              توقيع العميل أو من ينوب عنه باستلام البضاعة يعتبر بمثابة إيصال بقيمتها و تعهد منه بسداد القيمة المذكورة عاليه وقت طلبها منه و يعتبر مسئولا مسئولية مدنية و جنائية عنها.
            </div>
            <div style={{ textAlign: "center", fontSize: "18px", fontWeight: "bold", marginBottom: "30px" }}>
              *** نرجو الاتصال بالمصنع في حالة عدم مطابقة الفاتورة  ت : 0224903939 - 01009516578 ***
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
              <div style={{ textAlign: 'center', width: '200px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '15px' }}>المستلم</div>
                <div style={{ fontWeight: 'bold', marginBottom: '15px', textAlign: 'right' }}>الاسم:</div>
                <div style={{ fontWeight: 'bold', textAlign: 'right' }}>التوقيع:</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ width: '80px', height: '30px', border: '1px solid black' }}></div>
                <span style={{ fontWeight: 'bold', fontSize: "16px" }}>: عدد الاكياس</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '50px', fontSize: '14px', fontWeight: 'bold' }}>
              <div>صفحة 1 من 1</div>
              <div>إذن رقم : {currentPdfOrder.orderNumber || currentPdfOrder.id.slice(0, 8)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
