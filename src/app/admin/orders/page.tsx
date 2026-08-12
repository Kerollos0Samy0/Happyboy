"use client";

import { useEffect, useState } from "react";
import { db } from "../../../lib/firebase";
import { collection, onSnapshot, query, orderBy, updateDoc, doc } from "firebase/firestore";

interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  total: number;
  status: string;
  items: any[];
  createdAt: any;
}

export default function LiveOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="animate-fade-in flex flex-col items-center mt-6">
      <div className="w-full" style={{ maxWidth: '800px' }}>
        <h2 className="mb-6 text-center" style={{ color: 'var(--primary)' }}>🔔 الطلبات الحية (Live Orders)</h2>
        
        {loading ? (
          <p className="text-center">جاري تحميل الطلبات...</p>
        ) : orders.length === 0 ? (
          <div className="card text-center"><p>لا توجد طلبات حتى الآن.</p></div>
        ) : (
          <div className="flex flex-col gap-4">
            {orders.map((order) => (
              <div key={order.id} className="card">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg">طلب رقم: {order.id.slice(0, 8)}</h3>
                    <p className="text-sm">العميل: {order.customerName} | {order.customerPhone}</p>
                    <p className="text-sm text-gray-500">
                      {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString('ar-EG') : 'الآن'}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-xl" style={{ color: 'var(--success)' }}>{order.total} ج.م</p>
                    
                    <select 
                      className="input mt-2" 
                      style={{ padding: '0.25rem', width: 'auto' }}
                      value={order.status}
                      onChange={(e) => updateStatus(order.id, e.target.value)}
                    >
                      <option value="pending">⏳ قيد الانتظار</option>
                      <option value="paid">✅ تم الدفع والتأكيد</option>
                      <option value="cancelled">❌ ملغي</option>
                    </select>
                  </div>
                </div>

                <hr style={{ borderTop: "1px solid var(--border)", margin: "0.5rem 0" }} />
                
                <div>
                  <p className="font-bold text-sm mb-2">محتويات الطلب:</p>
                  <ul style={{ listStyleType: 'disc', paddingRight: '1.5rem' }}>
                    {order.items?.map((item: any) => (
                      <li key={item.cartItemId} className="text-sm">
                        {item.name} - لون ({item.selectedColor}) - مقاس ({item.selectedSize})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
