"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, onSnapshot, query } from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";
import {
  TrendingUp, Users, Package, ShoppingCart, QrCode, 
  DollarSign, MapPin, AlertTriangle, Archive, CheckCircle, 
  Clock, Truck, ChevronLeft, Wallet
} from "lucide-react";

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
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--primary)' }}></div>
      </div>
    );
  }

  // --- Calculations ---
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

    if (order.status === "pending") pendingOrders++;
    else if (order.status === "shipped") shippedOrders++;
    else if (order.status === "delivered") deliveredOrders++;
    else pendingOrders++;

    if (order.customerName) {
      customerMap[order.customerName] = (customerMap[order.customerName] || 0) + orderTotal;
    }
    if (order.customerGovernorate) {
      govMap[order.customerGovernorate] = (govMap[order.customerGovernorate] || 0) + 1;
    }

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
  const zeroSalesProducts = products.filter(p => !modelSalesMap[p.modelNumber] && (Number(p.quantity) || 0) > 0);
  const totalCapital = products.reduce((sum, p) => sum + ((Number(p.quantity) || 0) * (Number(p.price) || 0)), 0);

  const topSellers = Object.entries(modelSalesMap).sort((a, b) => b[1].count - a[1].count).slice(0, 3);
  const topCustomers = Object.entries(customerMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topGovs = Object.entries(govMap).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12 animate-fade-in">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: 'var(--primary)' }}>
              <TrendingUp size={32} /> لوحة تحكم الإدارة
            </h1>
            <div className="flex items-center gap-2 mt-2 text-gray-500">
              <span className="text-sm">{userEmail}</span>
              <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> تحديث فوري
              </span>
            </div>
          </div>
          <button className="px-6 py-2 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-700 font-bold rounded-lg transition-colors flex items-center gap-2" onClick={() => signOut(auth)}>
            تسجيل الخروج
          </button>
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-4 bg-green-50 text-green-600 rounded-xl"><DollarSign size={28} /></div>
            <div>
              <p className="text-sm font-bold text-gray-400">مبيعات اليوم</p>
              <h3 className="text-2xl font-black text-gray-800">{salesToday.toLocaleString()} <span className="text-sm font-normal text-gray-500">ج.م</span></h3>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-xl"><TrendingUp size={28} /></div>
            <div>
              <p className="text-sm font-bold text-gray-400">مبيعات الشهر</p>
              <h3 className="text-2xl font-black text-gray-800">{salesMonth.toLocaleString()} <span className="text-sm font-normal text-gray-500">ج.م</span></h3>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-4 bg-yellow-50 text-yellow-600 rounded-xl"><Wallet size={28} /></div>
            <div>
              <p className="text-sm font-bold text-gray-400">العربون المحصل</p>
              <h3 className="text-2xl font-black text-gray-800">{totalDeposits.toLocaleString()} <span className="text-sm font-normal text-gray-500">ج.م</span></h3>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-4 bg-purple-50 text-purple-600 rounded-xl"><Archive size={28} /></div>
            <div>
              <p className="text-sm font-bold text-gray-400">رأس مال المخزن</p>
              <h3 className="text-2xl font-black text-gray-800">{totalCapital.toLocaleString()} <span className="text-sm font-normal text-gray-500">ج.م</span></h3>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column */}
          <div className="lg:col-span-1 flex flex-col gap-8">
            {/* Quick Access */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-800 border-b pb-4">
                <QrCode size={24} className="text-blue-500" /> الوصول السريع
              </h2>
              <div className="flex flex-col gap-3 mb-6">
                <a href="/admin/inventory" className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors font-bold text-gray-700">
                  <div className="flex items-center gap-3"><Package size={20} className="text-indigo-500"/> إدارة المخزن</div>
                  <ChevronLeft size={18} className="text-gray-400" />
                </a>
                <a href="/admin/orders" className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors font-bold text-gray-700">
                  <div className="flex items-center gap-3"><ShoppingCart size={20} className="text-blue-500"/> إدارة الطلبات</div>
                  <ChevronLeft size={18} className="text-gray-400" />
                </a>
                <a href="/scan" className="flex items-center justify-between p-4 bg-green-50 hover:bg-green-100 rounded-xl transition-colors font-bold text-green-700">
                  <div className="flex items-center gap-3"><QrCode size={20} /> مسح الموديلات</div>
                  <ChevronLeft size={18} className="text-green-600/50" />
                </a>
              </div>
              
              <div className="text-center pt-6 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-500 mb-4">بوابة مسح العملاء (QR)</h3>
                <div className="inline-block p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
                  <QRCodeSVG value={`${websiteUrl}/customer`} size={140} level="H" />
                </div>
              </div>
            </div>

            {/* Orders Status */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-800 border-b pb-4">
                <Truck size={24} className="text-orange-500" /> حركة الطلبات
              </h2>
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center p-4 rounded-xl bg-orange-50/50 border border-orange-100">
                  <div className="flex items-center gap-3 font-bold text-orange-700"><Clock size={20}/> قيد التجهيز</div>
                  <span className="text-xl font-black text-orange-600">{pendingOrders}</span>
                </div>
                <div className="flex justify-between items-center p-4 rounded-xl bg-blue-50/50 border border-blue-100">
                  <div className="flex items-center gap-3 font-bold text-blue-700"><Truck size={20}/> مع شركة الشحن</div>
                  <span className="text-xl font-black text-blue-600">{shippedOrders}</span>
                </div>
                <div className="flex justify-between items-center p-4 rounded-xl bg-green-50/50 border border-green-100">
                  <div className="flex items-center gap-3 font-bold text-green-700"><CheckCircle size={20}/> تم التسليم</div>
                  <span className="text-xl font-black text-green-600">{deliveredOrders}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Middle & Right Column */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            {/* Inventory Health */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-800 border-b pb-4">
                <Package size={24} className="text-purple-500" /> تقارير المخزن
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2"><TrendingUp size={16} className="text-green-500"/> الأكثر مبيعاً (بالقطعة)</h3>
                  <div className="flex flex-col gap-2">
                    {topSellers.length === 0 ? <p className="text-sm text-gray-400 p-3 bg-gray-50 rounded-lg">لا توجد مبيعات بعد</p> : topSellers.map(([model, data], i) => (
                      <div key={model} className="flex justify-between items-center text-sm bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <span className="font-bold text-gray-700 flex items-center gap-2">
                          <span className="w-5 h-5 flex items-center justify-center bg-white rounded-full text-xs text-gray-400 shadow-sm">{i+1}</span>
                          {data.name} <span className="text-gray-400 font-normal">(#{model})</span>
                        </span>
                        <span className="font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md">{data.count} قطعة</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-red-500"/> نواقص المخزن (أقل من 5)</h3>
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2">
                    {lowStockProducts.length === 0 ? <p className="text-sm text-green-600 font-bold p-3 bg-green-50 rounded-lg border border-green-100 flex items-center gap-2"><CheckCircle size={16}/> المخزن بحالة ممتازة</p> : lowStockProducts.map(p => (
                      <div key={p.id} className="flex justify-between items-center text-sm bg-red-50 p-3 rounded-xl border border-red-100 text-red-700">
                        <span className="font-bold">{p.name} <span className="font-normal opacity-70">(#{p.modelNumber})</span></span>
                        <span className="font-black">{p.quantity} <span className="font-normal text-xs">ثري</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2"><Archive size={16} className="text-gray-400"/> بضاعة راكدة (لم تباع)</h3>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {zeroSalesProducts.length === 0 ? <p className="text-sm text-green-600">ممتاز، كل الموديلات تباع!</p> : zeroSalesProducts.map(p => (
                    <span key={p.id} className="text-xs font-bold bg-gray-100 p-2 rounded-lg text-gray-600 border border-gray-200">
                      {p.name} (#{p.modelNumber})
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Customers insights */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-800 border-b pb-4">
                <Users size={24} className="text-teal-500" /> إحصائيات العملاء
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2"><Users size={16} className="text-blue-500"/> كبار العملاء (الأكثر شراءً)</h3>
                  <div className="flex flex-col gap-2">
                    {topCustomers.length === 0 ? <p className="text-sm text-gray-400 p-3 bg-gray-50 rounded-lg">لا يوجد عملاء بعد</p> : topCustomers.map(([name, total], i) => (
                      <div key={name} className="flex justify-between items-center text-sm bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                        <span className="font-bold text-blue-900 flex items-center gap-2">
                           <span className="w-5 h-5 flex items-center justify-center bg-white rounded-full text-xs text-blue-400 shadow-sm">{i+1}</span>
                           <span className="truncate max-w-[120px]">{name}</span>
                        </span>
                        <span className="font-black text-blue-600">{total.toLocaleString()} ج.م</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2"><MapPin size={16} className="text-red-500"/> المحافظات الأكثر طلباً</h3>
                  <div className="flex flex-col gap-2">
                    {topGovs.length === 0 ? <p className="text-sm text-gray-400 p-3 bg-gray-50 rounded-lg">لا يوجد طلبات بعد</p> : topGovs.map(([gov, count], i) => (
                      <div key={gov} className="flex justify-between items-center text-sm bg-gray-50 p-3 rounded-xl border border-gray-200">
                        <span className="font-bold text-gray-700 flex items-center gap-2">
                          <span className="w-5 h-5 flex items-center justify-center bg-white rounded-full text-xs text-gray-400 shadow-sm">{i+1}</span>
                          {gov}
                        </span>
                        <span className="font-bold text-gray-500 bg-white px-2 py-1 rounded-md border border-gray-100">{count} طلبات</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
