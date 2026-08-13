"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "../../../lib/firebase";
import {
  collection, onSnapshot, query, orderBy,
  updateDoc, doc, deleteDoc
} from "firebase/firestore";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Printer, Save, Trash2, X, ChevronDown } from "lucide-react";

interface OrderItem {
  cartItemId?: string;
  name: string;
  modelNumber: string;
  selectedColor: string;
  price: number;
  isSeri?: boolean;
  sizes?: string[];
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
  const [editDeposit, setEditDeposit] = useState("");
  const [editDeliveryDate, setEditDeliveryDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

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
      if (updated) setSelectedOrder(updated);
    }
  }, [orders]);

  const openModal = (order: Order) => {
    setSelectedOrder(order);
    setEditDeposit((order.deposit ?? 0).toString());
    setEditDeliveryDate(order.deliveryDate ?? "");
  };

  const closeModal = () => setSelectedOrder(null);

  const updateStatus = async (orderId: string, newStatus: string) => {
    await updateDoc(doc(db, "orders", orderId), { status: newStatus });
  };

  const saveOrderDetails = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "orders", selectedOrder.id), {
        deposit: Number(editDeposit),
        deliveryDate: editDeliveryDate,
      });
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
    if (currentPdfOrder) generatePDF(currentPdfOrder);
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
      setCurrentPdfOrder(null);
    }
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
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "1.5rem" }}>
      {/* Header */}
      <div style={{ maxWidth: "100%", margin: "0 auto" }}>
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
                  {/* Top row: name + time + delete */}
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
                      <button
                        onClick={e => { e.stopPropagation(); deleteOrder(order.id); }}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "#ef4444", padding: "2px", borderRadius: "4px",
                          display: "flex", alignItems: "center",
                          transition: "background 0.15s",
                        }}
                        title="حذف الطلب"
                        onMouseEnter={e => (e.currentTarget.style.background = "#fee2e2")}
                        onMouseLeave={e => (e.currentTarget.style.background = "none")}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Phone */}
                  <p style={{ fontSize: "0.72rem", color: "#475569", margin: 0, direction: "ltr", textAlign: "right" }}>
                    {order.customerPhone}
                  </p>



                  {/* Items summary */}
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

                  {/* Delivery date */}
                  {order.deliveryDate && (
                    <p style={{ fontSize: "0.68rem", color: "#3b82f6", margin: 0, fontWeight: 600 }}>
                      📅 {order.deliveryDate}
                    </p>
                  )}

                  {/* Bottom: price + status */}
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

      {/* Modal */}
      {selectedOrder && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1rem",
          }}
          onClick={closeModal}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: "1rem", width: "100%", maxWidth: "520px",
              maxHeight: "90vh", overflowY: "auto", padding: "1.5rem",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              animation: "fadeIn 0.2s ease",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>
                  {selectedOrder.customerBrand || selectedOrder.customerName}
                </h3>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>
                  طلب رقم: {selectedOrder.orderNumber || selectedOrder.id.slice(0, 8)}
                </p>
              </div>
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={20} />
              </button>
            </div>

            {/* Customer info */}
            <div style={{ background: "#f8fafc", borderRadius: "0.6rem", padding: "0.85rem", marginBottom: "1rem", fontSize: "0.82rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                <div><span style={{ color: "#64748b" }}>الاسم: </span><strong>{selectedOrder.customerName}</strong></div>
                <div dir="ltr" style={{ textAlign: "right" }}><span style={{ color: "#64748b" }}>📞 </span><strong>{selectedOrder.customerPhone}</strong></div>
                {selectedOrder.customerBrand && <div><span style={{ color: "#64748b" }}>البراند: </span><strong>{selectedOrder.customerBrand}</strong></div>}

              </div>
            </div>

            {/* Status selector */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#374151", display: "block", marginBottom: "0.35rem" }}>
                حالة الطلب
              </label>
              <select
                className="input"
                style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem" }}
                value={selectedOrder.status}
                onChange={e => updateStatus(selectedOrder.id, e.target.value)}
              >
                <option value="pending">⏳ قيد الانتظار</option>
                <option value="paid">✅ تم الدفع والتأكيد</option>
                <option value="cancelled">❌ ملغي</option>
              </select>
            </div>

            {/* Deposit + delivery date */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#374151", display: "block", marginBottom: "0.35rem" }}>
                  موعد التسليم
                </label>
                <input
                  type="date"
                  className="input"
                  style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem" }}
                  value={editDeliveryDate}
                  onChange={e => setEditDeliveryDate(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#374151", display: "block", marginBottom: "0.35rem" }}>
                  العربون (ج.م)
                </label>
                <input
                  type="number"
                  className="input"
                  style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem" }}
                  value={editDeposit}
                  onChange={e => setEditDeposit(e.target.value)}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
              <button
                onClick={saveOrderDetails}
                disabled={saving}
                className="btn btn-primary"
                style={{ flex: 1, padding: "0.6rem", fontSize: "0.85rem" }}
              >
                <Save size={15} /> {saving ? "جاري الحفظ..." : "حفظ البيانات"}
              </button>
              <button
                onClick={() => setCurrentPdfOrder(selectedOrder)}
                className="btn btn-secondary"
                style={{ flex: 1, padding: "0.6rem", fontSize: "0.85rem" }}
              >
                <Printer size={15} /> طباعة الفاتورة
              </button>
              <button
                onClick={() => deleteOrder(selectedOrder.id)}
                style={{
                  padding: "0.6rem 0.85rem", borderRadius: "0.5rem", border: "none",
                  background: "#fee2e2", color: "#991b1b", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "0.25rem",
                  fontFamily: "inherit", fontWeight: 600, fontSize: "0.85rem",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#fecaca")}
                onMouseLeave={e => (e.currentTarget.style.background = "#fee2e2")}
              >
                <Trash2 size={15} />
              </button>
            </div>

            {/* Items list */}
            <div>
              <p style={{ fontWeight: 700, fontSize: "0.82rem", color: "#A62E2E", marginBottom: "0.5rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.35rem" }}>
                محتويات الطلب ({selectedOrder.items?.length} عناصر)
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {selectedOrder.items?.map((item, i) => (
                  <div key={item.cartItemId || i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: "#f8fafc", borderRadius: "0.5rem", padding: "0.5rem 0.75rem",
                    fontSize: "0.78rem",
                  }}>
                    <div>
                      <span style={{ fontWeight: 700, color: "#0f172a" }}>{item.name}</span>
                      <span style={{ color: "#64748b" }}> (موديل {item.modelNumber}) — {item.selectedColor}</span>
                      {item.isSeri && <span style={{ color: "#3b82f6", marginRight: "0.25rem" }}>ثري ({item.sizes?.length} قطع)</span>}
                    </div>
                    <span style={{ fontWeight: 700, color: "#A62E2E", whiteSpace: "nowrap" }}>{item.price} ج</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div style={{
              marginTop: "1rem", background: "#f8fafc", borderRadius: "0.6rem",
              padding: "0.85rem", fontSize: "0.85rem",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                <span style={{ color: "#64748b" }}>الإجمالي</span>
                <strong>{selectedOrder.total} ج.م</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                <span style={{ color: "#64748b" }}>العربون</span>
                <strong style={{ color: "#10b981" }}>{selectedOrder.deposit ?? 0} ج.م</strong>
              </div>
              <div style={{ borderTop: "1px solid #e2e8f0", marginTop: "0.5rem", paddingTop: "0.5rem", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700 }}>المتبقي</span>
                <strong style={{ color: "#A62E2E", fontSize: "1rem" }}>
                  {selectedOrder.total - (selectedOrder.deposit ?? 0)} ج.م
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Invoice for PDF */}
      <div
        ref={invoiceRef}
        style={{
          display: "none", width: "800px", padding: "40px",
          background: "white", color: "black",
          position: "absolute", top: "-9999px", left: "-9999px", direction: "rtl"
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
                  <p style={{ fontSize: "16px", marginBottom: "8px" }}><strong>العنوان:</strong> {currentPdfOrder.customerAddress || 'غير مسجل'}</p>
                  <p style={{ fontSize: "16px", marginBottom: "8px" }}><strong>شركة الشحن:</strong> {currentPdfOrder.customerShipping || 'غير مسجل'}</p>
                  <p style={{ fontSize: "16px", color: "#2563eb", fontWeight: "bold" }}><strong>موعد التسليم:</strong> {currentPdfOrder.deliveryDate || 'لم يحدد بعد'}</p>
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
                {currentPdfOrder.items?.map((item, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "12px" }}>{item.name} (موديل {item.modelNumber})</td>
                    <td style={{ padding: "12px" }}>{item.selectedColor}</td>
                    <td style={{ padding: "12px" }}>{item.isSeri ? item.sizes?.join(' - ') : 'قطعة واحدة'}</td>
                    <td style={{ padding: "12px", textAlign: "center" }}>{item.isSeri ? `${item.sizes?.length} قطع (ثري)` : '1'}</td>
                    <td style={{ padding: "12px", textAlign: "center" }}>{item.price} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{ width: "350px", background: "#f8fafc", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "16px" }}>
                  <span>الإجمالي:</span><strong>{currentPdfOrder.total} ج.م</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "16px", color: "#16a34a" }}>
                  <span>العربون المدفوع:</span><strong>{currentPdfOrder.deposit || 0} ج.م</strong>
                </div>
                <div style={{ borderTop: "2px solid #cbd5e1", margin: "10px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "20px", color: "#A62E2E", fontWeight: "bold" }}>
                  <span>المبلغ المتبقي:</span>
                  <span>{currentPdfOrder.total - (currentPdfOrder.deposit || 0)} ج.م</span>
                </div>
              </div>
            </div>
            <div style={{ marginTop: "40px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>
              <p>شكراً لتعاملكم مع Happy Boy&Girl</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
