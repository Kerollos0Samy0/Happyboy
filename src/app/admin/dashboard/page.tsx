"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, onSnapshot, query } from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";

interface Order {
  id: string;
  total: number;
  deposit: number;
  status: string;
  customerName: string;
  customerGovernorate: string;
  createdAt: any;
  items: any[];
}

interface Product {
  id: string;
  name: string;
  modelNumber: string;
  price: number;
  quantity: number;
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const router = useRouter();
  const websiteUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/admin/login");
      } else {
        setUserEmail(user.email);
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (loading) return;

    // Real-time listener for Orders
    const ordersQ = query(collection(db, "orders"));
    const unsubscribeOrders = onSnapshot(ordersQ, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
      setOrders(fetchedOrders);
    });

    // Real-time listener for Products
    const productsQ = query(collection(db, "products"));
    const unsubscribeProducts = onSnapshot(productsQ, (snapshot) => {
      const fetchedProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setProducts(fetchedProducts);
    });

    return () => {
      unsubscribeOrders();
      unsubscribeProducts();
    };
  }, [loading]);

  if (loading) {
    return <div className="p-10 text-center">جاري التحميل...</div>;
  }

  const isAhmed = userEmail?.toLowerCase().includes('ahmed') || userEmail?.toLowerCase().includes('hossam');

  // --- 1. Sales & Cash Flow ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  let salesToday = 0;
  let salesMonth = 0;
  let totalDeposits = 0;
  let totalRemaining = 0;
  
  let pendingOrders = 0;
  let shippedOrders = 0;
  let deliveredOrders = 0;

  const customerMap: Record<string, number> = {};
  const govMap: Record<string, number> = {};
  
  const modelSalesMap: Record<string, { count: number, name: string }> = {};

  orders.forEach(order => {
    const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
    const orderTotal = Number(order.total) || 0;
    const orderDeposit = Number(order.deposit) || 0;

    if (orderDate >= today) salesToday += orderTotal;
    if (orderDate >= startOfMonth) salesMonth += orderTotal;

    totalDeposits += orderDeposit;
    totalRemaining += (orderTotal - orderDeposit);

    // Statuses
    if (order.status === "pending") pendingOrders++;
    else if (order.status === "shipped") shippedOrders++;
    else if (order.status === "delivered") deliveredOrders++;
    else pendingOrders++; // Fallback

    // Customers
    if (order.customerName) {
      customerMap[order.customerName] = (customerMap[order.customerName] || 0) + orderTotal;
    }
    if (order.customerGovernorate) {
      govMap[order.customerGovernorate] = (govMap[order.customerGovernorate] || 0) + 1;
    }

    // Items
    if (Array.isArray(order.items)) {
      order.items.forEach(item => {
        const qty = item.quantity || 1;
        const totalPieces = item.isSeri && item.sizes ? item.sizes.length * qty : qty;
        
        if (!modelSalesMap[item.modelNumber]) {
          modelSalesMap[item.modelNumber] = { count: 0, name: item.name };
        }
        modelSalesMap[item.modelNumber].count += totalPieces;
      });
    }
  });


  const lowStockProducts = products.filter(p => (Number(p.quantity) || 0) > 0 && (Number(p.quantity) || 0) < 5);
  
  // Find zero sales (in stock but not in modelSalesMap)
  const zeroSalesProducts = products.filter(p => !modelSalesMap[p.modelNumber] && (Number(p.quantity) || 0) > 0);

  // Top Sellers
  const topSellers = Object.entries(modelSalesMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3);

  // Top Customers
  const topCustomers = Object.entries(customerMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Top Govs
  const topGovs = Object.entries(govMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="animate-fade-in flex flex-col items-center mt-6 mb-12">
      <div className="w-full flex justify-between items-center mb-6" style={{ maxWidth: '1200px' }}>
        <div>
          <h1>لوحة تحكم الإدارة 📊</h1>
          <p className="text-sm">مرحباً: {userEmail} <span className="mr-2 text-green-600 font-bold">(تحديث فوري 🟢)</span></p>
        </div>
        <button className="btn btn-outline" onClick={() => signOut(auth)}>تسجيل الخروج</button>
      </div>

      <div className="w-full grid gap-6" style={{ maxWidth: '1200px', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        
        {/* Quick Actions & QR */}
        <div className="card flex flex-col items-center text-center">
          <h2 className="mb-2" style={{ color: 'var(--primary)' }}>الوصول السريع</h2>
          <div className="flex gap-2 w-full mt-4 mb-6">
            <a href="/admin/inventory" className="btn btn-primary flex-1 text-center" style={{ display: 'flex' }}>المخزن</a>
            <a href="/admin/orders" className="btn btn-secondary flex-1 text-center" style={{ display: 'flex' }}>الطلبات</a>
            <a href="/scan" className="btn btn-outline flex-1 text-center" style={{ borderColor: 'var(--success)', color: 'var(--success)', display: 'flex' }}>مسح</a>
          </div>
          
          <h3 className="mb-2 text-sm text-gray-500 border-t pt-4 w-full">بوابة العملاء (QR)</h3>
          <div className="p-2 mt-2 bg-white rounded-lg border-2 border-dashed border-gray-200">
            <QRCodeSVG value={`${websiteUrl}/customer`} size={120} level="H" />
          </div>
        </div>

        {/* Sales & Cash Flow */}
        <div className="card">
          <h2 className="mb-4 border-b pb-2">💰 المبيعات والسيولة</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded text-center">
              <p className="text-xs text-gray-500">مبيعات اليوم</p>
              <h3 className="text-lg font-bold text-green-600">{salesToday.toLocaleString()} ج.م</h3>
            </div>
            <div className="p-3 bg-gray-50 rounded text-center">
              <p className="text-xs text-gray-500">مبيعات الشهر</p>
              <h3 className="text-lg font-bold text-blue-600">{salesMonth.toLocaleString()} ج.م</h3>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="p-3 bg-yellow-50 rounded text-center">
              <p className="text-xs text-gray-500">عربون تم تحصيله</p>
              <h3 className="text-md font-bold text-yellow-700">{totalDeposits.toLocaleString()} ج.م</h3>
            </div>
            <div className="p-3 bg-gray-100 rounded text-center">
              <p className="text-xs text-gray-500">متبقي عند التسليم</p>
              <h3 className="text-md font-bold text-gray-700">{totalRemaining.toLocaleString()} ج.م</h3>
            </div>
          </div>
        </div>

        {/* Orders Overview */}
        <div className="card">
          <h2 className="mb-4 border-b pb-2">🚚 حركة الطلبات</h2>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center p-3 rounded" style={{ background: 'var(--primary-light)' }}>
              <span className="font-bold text-gray-700">قيد التجهيز (Pending)</span>
              <span className="text-xl font-bold" style={{ color: 'var(--primary)' }}>{pendingOrders}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded bg-blue-50">
              <span className="font-bold text-gray-700">مع شركة الشحن (Shipped)</span>
              <span className="text-xl font-bold text-blue-600">{shippedOrders}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded bg-green-50">
              <span className="font-bold text-gray-700">تم التسليم (Delivered)</span>
              <span className="text-xl font-bold text-green-600">{deliveredOrders}</span>
            </div>
          </div>
        </div>

        {/* Inventory Health */}
        <div className="card">
          <h2 className="mb-4 border-b pb-2">📦 حالة المخزن</h2>
          
          <h3 className="text-sm text-gray-500 mb-2">🔥 الأكثر مبيعاً (ترتيب بالقطعة)</h3>
          <div className="flex flex-col gap-2 mb-4">
            {topSellers.length === 0 ? <p className="text-sm">لا توجد مبيعات بعد</p> : topSellers.map(([model, data]) => (
              <div key={model} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                <span>{data.name} (موديل {model})</span>
                <span className="font-bold text-green-600">{data.count} قطع</span>
              </div>
            ))}
          </div>

          <h3 className="text-sm text-gray-500 mb-2">⚠️ نواقص المخزن (أقل من 5 ثريهات)</h3>
          <div className="flex flex-col gap-2 mb-4 max-h-32 overflow-y-auto">
            {lowStockProducts.length === 0 ? <p className="text-sm text-green-600">المخزن بحالة جيدة</p> : lowStockProducts.map(p => (
              <div key={p.id} className="flex justify-between text-sm bg-red-50 p-2 rounded text-red-700">
                <span>{p.name} ({p.modelNumber})</span>
                <span className="font-bold">{p.quantity} ثري</span>
              </div>
            ))}
          </div>
          
          <h3 className="text-sm text-gray-500 mb-2">💤 بضاعة راكدة (لم تباع أبداً)</h3>
          <div className="flex flex-col gap-2 max-h-24 overflow-y-auto">
            {zeroSalesProducts.length === 0 ? <p className="text-sm text-green-600">ممتاز، كل الموديلات تباع!</p> : zeroSalesProducts.map(p => (
              <div key={p.id} className="text-sm bg-gray-100 p-2 rounded text-gray-600">
                {p.name} ({p.modelNumber})
              </div>
            ))}
          </div>
        </div>

        {/* Customer Insights */}
        <div className="card">
          <h2 className="mb-4 border-b pb-2">👥 إحصائيات العملاء</h2>
          
          <h3 className="text-sm text-gray-500 mb-2">⭐ كبار العملاء (الأكثر شراءً)</h3>
          <div className="flex flex-col gap-2 mb-4">
            {topCustomers.length === 0 ? <p className="text-sm">لا يوجد عملاء بعد</p> : topCustomers.map(([name, total]) => (
              <div key={name} className="flex justify-between text-sm bg-blue-50 p-2 rounded">
                <span className="truncate w-3/4">{name}</span>
                <span className="font-bold text-blue-700">{total.toLocaleString()} ج</span>
              </div>
            ))}
          </div>

          <h3 className="text-sm text-gray-500 mb-2">📍 المحافظات الأكثر طلباً</h3>
          <div className="flex flex-col gap-2">
            {topGovs.length === 0 ? <p className="text-sm">لا يوجد طلبات بعد</p> : topGovs.map(([gov, count]) => (
              <div key={gov} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                <span>{gov}</span>
                <span className="font-bold text-gray-600">{count} طلبات</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
