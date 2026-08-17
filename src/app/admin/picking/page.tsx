"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, onSnapshot, query, updateDoc, doc, where, getDoc } from "firebase/firestore";
import {
  Package, Search, CheckCircle, ChevronDown, ChevronUp, ChevronLeft
} from "lucide-react";

interface OrderItem {
  cartItemId?: string;
  name: string;
  modelNumber: string;
  selectedColor: string;
  price: number;
  isSeri?: boolean;
  sizes?: string[];
  quantity?: number;
  isPicked?: boolean;
}

interface Order {
  id: string;
  total: number;
  deposit: number;
  status: string;
  customerName: string;
  customerGovernorate: string;
  createdAt: any;
  items: OrderItem[];
}

interface PickingDetail {
  orderId: string;
  customerName: string;
  selectedColor: string;
  isSeri: boolean;
  quantity: number;
  sizesCount: number;
  isPicked: boolean;
  itemIndex: number; // Important to identify which item in the order to update
}

interface PickingModel {
  modelNumber: string;
  name: string;
  totalPieces: number;
  totalSeries: number;
  pendingSeries: number;
  pendingPieces: number;
  details: PickingDetail[];
}

export default function OrderPickingPage() {
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedModels, setExpandedModels] = useState<Record<string, boolean>>({});
  const [updating, setUpdating] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/admin/login");
      } else {
        setUserEmail(user.email);
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    // Only fetch pending and paid orders (we don't need to pick cancelled ones)
    const ordersQ = query(collection(db, "orders"), where("status", "in", ["pending", "paid"]));
    const unsubscribeOrders = onSnapshot(ordersQ, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
      setOrders(fetchedOrders);
      setLoading(false);
    });

    return () => unsubscribeOrders();
  }, []);

  const toggleExpand = (modelNumber: string) => {
    setExpandedModels(prev => ({ ...prev, [modelNumber]: !prev[modelNumber] }));
  };

  const markAsPicked = async (orderId: string, itemIndex: number) => {
    if (updating) return;
    setUpdating(true);
    try {
      const orderRef = doc(db, "orders", orderId);
      const orderDoc = await getDoc(orderRef);
      if (orderDoc.exists()) {
        const orderData = orderDoc.data() as Order;
        const newItems = [...(orderData.items || [])];
        if (newItems[itemIndex]) {
          newItems[itemIndex] = { ...newItems[itemIndex], isPicked: true };
          await updateDoc(orderRef, { items: newItems });
        }
      }
    } catch (error) {
      console.error("Error updating item status:", error);
      alert("حدث خطأ أثناء تحديث حالة التجهيز");
    } finally {
      setUpdating(false);
    }
  };

  // Group items by modelNumber
  const groupedModels: Record<string, PickingModel> = {};

  orders.forEach(order => {
    if (Array.isArray(order.items)) {
      order.items.forEach((item, index) => {
        if (!item.modelNumber) return;

        if (!groupedModels[item.modelNumber]) {
          groupedModels[item.modelNumber] = {
            modelNumber: item.modelNumber,
            name: item.name,
            totalPieces: 0,
            totalSeries: 0,
            pendingPieces: 0,
            pendingSeries: 0,
            details: []
          };
        }

        const qty = item.quantity || 1;
        const sizesCount = item.sizes?.length || 1;
        const pieces = item.isSeri ? sizesCount * qty : qty;
        const series = item.isSeri ? qty : 0;

        groupedModels[item.modelNumber].totalPieces += pieces;
        groupedModels[item.modelNumber].totalSeries += series;
        
        if (!item.isPicked) {
          groupedModels[item.modelNumber].pendingPieces += pieces;
          groupedModels[item.modelNumber].pendingSeries += series;
        }

        groupedModels[item.modelNumber].details.push({
          orderId: order.id,
          customerName: order.customerName,
          selectedColor: item.selectedColor,
          isSeri: !!item.isSeri,
          quantity: qty,
          sizesCount: sizesCount,
          isPicked: !!item.isPicked,
          itemIndex: index
        });
      });
    }
  });

  const modelsArray = Object.values(groupedModels).filter(model => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return model.modelNumber.toLowerCase().includes(query) || 
             model.name.toLowerCase().includes(query) || 
             model.details.some(d => d.customerName.toLowerCase().includes(query));
    }
    return true;
  });

  // Sort: Models with pending items first, then by total quantity
  modelsArray.sort((a, b) => {
    const aPending = a.pendingPieces > 0 ? 1 : 0;
    const bPending = b.pendingPieces > 0 ? 1 : 0;
    if (aPending !== bPending) return bPending - aPending;
    return b.totalPieces - a.totalPieces;
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
        <div style={{ width: '3rem', height: '3rem', borderTop: '2px solid #3b82f6', borderBottom: '2px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "1.5rem", direction: "rtl", marginLeft: "calc(-50vw + 50%)", marginRight: "calc(-50vw + 50%)", width: "100vw" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <button 
              onClick={() => router.push('/admin/dashboard')} 
              style={{ background: "#fff", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "0.5rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <ChevronLeft size={20} color="#475569" />
            </button>
            <h1 style={{ margin: 0, fontSize: "1.8rem", color: "#0f172a", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Package size={28} color="#a855f7" />
              نظام تجهيز الأوردرات
            </h1>
          </div>
          
          <div style={{ position: "relative", width: "100%", maxWidth: "300px" }}>
            <Search size={18} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input 
              type="text" 
              placeholder="ابحث بالموديل أو اسم العميل..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", padding: "0.75rem 2.5rem 0.75rem 1rem", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", fontSize: "0.95rem" }}
            />
          </div>
        </div>

        {/* Models List */}
        {modelsArray.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem", background: "#fff", borderRadius: "12px", border: "1px dashed #cbd5e1", color: "#64748b" }}>
            <Package size={48} style={{ margin: "0 auto 1rem auto", opacity: 0.5 }} />
            <p style={{ fontSize: "1.2rem", fontWeight: "bold" }}>لا توجد طلبات تحتاج للتجهيز حالياً</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {modelsArray.map((model) => {
              const isExpanded = expandedModels[model.modelNumber];
              const isAllPicked = model.pendingPieces === 0;

              return (
                <div key={model.modelNumber} style={{ 
                  background: "#fff", 
                  borderRadius: "12px", 
                  border: isAllPicked ? "1px solid #86efac" : "1px solid #e2e8f0", 
                  overflow: "hidden",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  transition: "all 0.2s"
                }}>
                  {/* Model Header */}
                  <div 
                    onClick={() => toggleExpand(model.modelNumber)}
                    style={{ 
                      padding: "1.25rem", 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center", 
                      cursor: "pointer",
                      background: isAllPicked ? "#f0fdf4" : "transparent"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <div style={{ 
                        width: "50px", height: "50px", 
                        background: isAllPicked ? "#dcfce7" : "#f1f5f9", 
                        borderRadius: "8px", 
                        display: "flex", justifyContent: "center", alignItems: "center",
                        fontWeight: "bold", fontSize: "1.2rem", color: isAllPicked ? "#166534" : "#475569"
                      }}>
                        #{model.modelNumber}
                      </div>
                      <div>
                        <h3 style={{ margin: "0 0 0.25rem 0", color: "#0f172a", fontSize: "1.2rem" }}>{model.name}</h3>
                        <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem", display: "flex", gap: "1rem" }}>
                          <span>إجمالي المطلوب: <strong style={{ color: "#0f172a" }}>{model.totalSeries} ثري / {model.totalPieces} قطعة</strong></span>
                          {!isAllPicked && (
                            <span style={{ color: "#ef4444" }}>متبقي للتجهيز: <strong>{model.pendingSeries} ثري / {model.pendingPieces} قطعة</strong></span>
                          )}
                        </p>
                      </div>
                    </div>
                    
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      {isAllPicked && (
                        <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#16a34a", fontWeight: "bold", fontSize: "0.9rem", background: "#dcfce7", padding: "0.4rem 0.75rem", borderRadius: "9999px" }}>
                          <CheckCircle size={16} /> مكتمل التجهيز
                        </span>
                      )}
                      <div style={{ padding: "0.5rem", background: "#f8fafc", borderRadius: "50%", color: "#94a3b8" }}>
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                  </div>

                  {/* Details Section */}
                  {isExpanded && (
                    <div style={{ padding: "0 1.25rem 1.25rem 1.25rem", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
                        <thead>
                          <tr style={{ background: "#e2e8f0", textAlign: "right" }}>
                            <th style={{ padding: "0.75rem", borderRadius: "0 8px 8px 0" }}>اسم العميل</th>
                            <th style={{ padding: "0.75rem" }}>اللون</th>
                            <th style={{ padding: "0.75rem" }}>الكمية</th>
                            <th style={{ padding: "0.75rem", borderRadius: "8px 0 0 8px", textAlign: "center" }}>الحالة / الإجراء</th>
                          </tr>
                        </thead>
                        <tbody>
                          {model.details.map((detail, idx) => (
                            <tr key={`${detail.orderId}-${idx}`} style={{ borderBottom: idx === model.details.length - 1 ? "none" : "1px solid #e2e8f0" }}>
                              <td style={{ padding: "1rem 0.75rem", fontWeight: "bold", color: "#334155" }}>
                                {detail.customerName}
                                <span style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem", fontWeight: "normal" }}>طلب: {detail.orderId.slice(0, 8)}</span>
                              </td>
                              <td style={{ padding: "1rem 0.75rem" }}>
                                <span style={{ display: "inline-block", padding: "0.25rem 0.5rem", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.85rem" }}>
                                  {detail.selectedColor}
                                </span>
                              </td>
                              <td style={{ padding: "1rem 0.75rem" }}>
                                {detail.isSeri ? (
                                  <span style={{ color: "#3b82f6", fontWeight: "bold" }}>{detail.quantity} ثري (x{detail.sizesCount})</span>
                                ) : (
                                  <span style={{ color: "#6366f1", fontWeight: "bold" }}>{detail.quantity} قطعة</span>
                                )}
                              </td>
                              <td style={{ padding: "1rem 0.75rem", textAlign: "center" }}>
                                {detail.isPicked ? (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", color: "#16a34a", fontWeight: "bold", fontSize: "0.9rem" }}>
                                    <CheckCircle size={16} /> تم التجهيز
                                  </span>
                                ) : (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); markAsPicked(detail.orderId, detail.itemIndex); }}
                                    disabled={updating}
                                    style={{ 
                                      background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", 
                                      padding: "0.5rem 1rem", fontWeight: "bold", cursor: updating ? "not-allowed" : "pointer",
                                      opacity: updating ? 0.7 : 1, transition: "background 0.2s"
                                    }}
                                  >
                                    تأكيد التحضير
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
