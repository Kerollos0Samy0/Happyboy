"use client";

import { useEffect, useState } from "react";
import { db } from "../../../lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { Clock, CheckCircle2, Package, Truck, Printer } from "lucide-react";

interface OrderItem {
  name: string;
  modelNumber: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  customerName: string;
  brandName: string;
  customerPhone: string;
  customerType: string;
  status: string;
  source: string;
  createdAt: any;
  items: OrderItem[];
  total: number;
}

export default function FactoryDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only fetch orders that are relevant to fulfillment (source: factory or any order really, let's fetch all active ones)
    const q = query(collection(db, "orders"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
      // Filter out delivered if we don't want them cluttering, or just keep all and categorize
      setOrders(fetched.sort((a, b) => {
        const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return dateB - dateA; // Newest first
      }));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, { status: newStatus });
    } catch (error) {
      console.error("Error updating status", error);
      alert("حدث خطأ أثناء تحديث حالة الطلب");
    }
  };

  const handlePrint = (order: Order) => {
    // Simple print function (in a real app, generates a nice PDF or print layout)
    window.print();
  };

  if (loading) {
    return <div className="p-10 text-center">جاري تحميل لوحة التجهيز...</div>;
  }

  const pendingOrders = orders.filter(o => o.status === "pending" || !o.status);
  const processingOrders = orders.filter(o => o.status === "processing");
  const readyOrders = orders.filter(o => o.status === "ready" || o.status === "shipped");

  const OrderCard = ({ order }: { order: Order }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3 print:border-black print:shadow-none">
      <div className="flex justify-between items-start border-b border-gray-100 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-800 text-lg">{order.brandName || order.customerName}</h3>
            {order.customerType && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium">
                {order.customerType}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">{order.customerPhone}</p>
        </div>
        <div className="text-left">
          <span className="text-xs text-gray-400 block">رقم الطلب</span>
          <span className="font-mono text-sm text-gray-600">#{order.id.slice(-6).toUpperCase()}</span>
        </div>
      </div>

      <div className="flex-1">
        <ul className="space-y-2">
          {order.items?.map((item, idx) => (
            <li key={idx} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
              <span className="font-medium text-gray-700">{item.name} ({item.modelNumber})</span>
              <span className="font-bold bg-blue-100 text-blue-800 px-2 rounded">x{item.quantity}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-2 pt-3 border-t border-gray-100 flex gap-2 print:hidden">
        {order.status === "pending" && (
          <button 
            onClick={() => updateOrderStatus(order.id, "processing")}
            className="flex-1 bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition flex justify-center items-center gap-1"
          >
            <Package className="w-4 h-4" /> بدء التجهيز
          </button>
        )}
        
        {order.status === "processing" && (
          <button 
            onClick={() => updateOrderStatus(order.id, "ready")}
            className="flex-1 bg-green-600 text-white py-2 rounded-md text-sm font-medium hover:bg-green-700 transition flex justify-center items-center gap-1"
          >
            <CheckCircle2 className="w-4 h-4" /> جاهز للتسليم
          </button>
        )}

        {order.status === "ready" && (
          <button 
            onClick={() => updateOrderStatus(order.id, "delivered")}
            className="flex-1 bg-gray-800 text-white py-2 rounded-md text-sm font-medium hover:bg-gray-900 transition flex justify-center items-center gap-1"
          >
            <Truck className="w-4 h-4" /> تم التسليم
          </button>
        )}

        <button 
          onClick={() => handlePrint(order)}
          className="bg-gray-100 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-200 transition"
          title="طباعة الفاتورة"
        >
          <Printer className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in h-[calc(100vh-100px)] flex flex-col">
      <div className="mb-6 print:hidden">
        <h2 className="text-2xl font-bold text-gray-800">لوحة التجهيز الحية ⚡</h2>
        <p className="text-gray-500 text-sm mt-1">تحديث فوري للطلبات الواردة من قسم المبيعات</p>
      </div>

      <div className="flex-1 flex gap-6 overflow-x-auto pb-4 print:block">
        
        {/* Column 1: New / Pending */}
        <div className="min-w-[320px] max-w-sm flex flex-col bg-gray-100 rounded-2xl p-4 print:hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              طلبات جديدة
            </h3>
            <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs font-bold">
              {pendingOrders.length}
            </span>
          </div>
          <div className="flex flex-col gap-4 overflow-y-auto pr-1 pb-2 h-full custom-scrollbar">
            {pendingOrders.length === 0 ? (
              <p className="text-center text-gray-400 text-sm mt-10">لا توجد طلبات جديدة</p>
            ) : (
              pendingOrders.map(order => <OrderCard key={order.id} order={order} />)
            )}
          </div>
        </div>

        {/* Column 2: Processing */}
        <div className="min-w-[320px] max-w-sm flex flex-col bg-blue-50/50 rounded-2xl p-4 print:hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-blue-900 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
              جاري التجهيز
            </h3>
            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-bold">
              {processingOrders.length}
            </span>
          </div>
          <div className="flex flex-col gap-4 overflow-y-auto pr-1 pb-2 h-full custom-scrollbar">
            {processingOrders.length === 0 ? (
              <p className="text-center text-blue-300 text-sm mt-10">لا توجد طلبات قيد التجهيز</p>
            ) : (
              processingOrders.map(order => <OrderCard key={order.id} order={order} />)
            )}
          </div>
        </div>

        {/* Column 3: Ready */}
        <div className="min-w-[320px] max-w-sm flex flex-col bg-green-50/50 rounded-2xl p-4 print:block">
          <div className="flex justify-between items-center mb-4 print:hidden">
            <h3 className="font-bold text-green-900 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              جاهز للتسليم
            </h3>
            <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-bold">
              {readyOrders.length}
            </span>
          </div>
          <div className="flex flex-col gap-4 overflow-y-auto pr-1 pb-2 h-full custom-scrollbar">
            {readyOrders.length === 0 ? (
              <p className="text-center text-green-300 text-sm mt-10">لا توجد طلبات جاهزة</p>
            ) : (
              readyOrders.map(order => <OrderCard key={order.id} order={order} />)
            )}
          </div>
        </div>

      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}
