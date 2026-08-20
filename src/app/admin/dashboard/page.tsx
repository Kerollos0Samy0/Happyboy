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
  Clock, Truck, ChevronLeft, Wallet, PlusCircle, ClipboardList
} from "lucide-react";
import styles from "./dashboard.module.css";

const getCategoryName = (modelNumber: string) => {
  const num = parseInt(modelNumber, 10);
  if (isNaN(num)) return "أخرى";
  if (num >= 5 && num <= 90) return "بيبي ولادي";
  if (num >= 100 && num <= 150) return "وسط ولادي";
  if (num >= 300 && num <= 350) return "محير ولادي";
  if (num >= 500 && num <= 589) return "بيبي بناتي";
  if (num >= 590 && num <= 699) return "وسط بناتي";
  if (num >= 790 && num <= 899) return "محير بناتي";
  return "أخرى";
};

const getSizesCount = (name: string, modelNumber: string, sizes: string[] | undefined) => {
  const category = getCategoryName(modelNumber);
  if (category.includes('بيبي') || category.includes('وسط') || category.includes('محير') || name.includes('بيبي') || name.includes('وسط') || name.includes('محير')) return 4;
  return sizes && sizes.length > 0 ? sizes.length : 1;
};

interface Order {
  id: string;
  total: number;
  deposit: number;
  status: string;
  customerName: string;
  customerGovernorate: string;
  createdAt: any;
  items: any[];
  isDeleted?: boolean;
}

interface Product {
  id: string;
  name: string;
  modelNumber: string;
  price: number;
  quantity: number;
  isDeleted?: boolean;
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
      const fetchedOrders = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }) as Order)
        .filter(o => !o.isDeleted);
      setOrders(fetchedOrders);
    });

    // Real-time listener for Products
    const productsQ = query(collection(db, "products"));
    const unsubscribeProducts = onSnapshot(productsQ, (snapshot) => {
      const fetchedProducts = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }) as Product)
        .filter(p => !p.isDeleted);
      setProducts(fetchedProducts);
    });

    return () => {
      unsubscribeOrders();
      unsubscribeProducts();
    };
  }, [loading]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
        <div style={{ width: '3rem', height: '3rem', borderTop: '2px solid var(--primary)', borderBottom: '2px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
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
        const totalPieces = item.isSeri ? getSizesCount(item.name || '', item.modelNumber, item.sizes) * qty : qty;
        
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

  const isOwner = userEmail && (userEmail.toLowerCase().includes('ahmed001') || userEmail.toLowerCase().includes('hossam001'));
  const isPrivileged = userEmail && (
    isOwner || 
    userEmail.toLowerCase().includes('ayat') || 
    userEmail.toLowerCase().includes('accounting') || 
    userEmail.toLowerCase().includes('kerollos')
  );

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.contentWrapper}>
        
        {/* Header */}
        <div className={styles.headerCard}>
          <div>
            <h1 className={styles.headerTitle}>
              <TrendingUp size={32} /> لوحة تحكم الإدارة
            </h1>
            <div className={styles.headerSubtitle}>
              <span>{userEmail}</span>
              <span className={styles.badge}>
                <span className={styles.pulseDot}></span> تحديث فوري
              </span>
            </div>
          </div>
          <button className={styles.logoutBtn} onClick={() => signOut(auth)}>
            تسجيل الخروج
          </button>
        </div>

        {/* Top Summary Cards */}
        {isOwner && (
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <div className={`${styles.iconWrap} ${styles.green}`}><DollarSign size={28} /></div>
              <div>
                <p className={styles.summaryLabel}>مبيعات اليوم</p>
                <h3 className={styles.summaryValue}>{salesToday.toLocaleString()} <span className={styles.summaryCurrency}>ج.م</span></h3>
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={`${styles.iconWrap} ${styles.blue}`}><TrendingUp size={28} /></div>
              <div>
                <p className={styles.summaryLabel}>مبيعات الشهر</p>
                <h3 className={styles.summaryValue}>{salesMonth.toLocaleString()} <span className={styles.summaryCurrency}>ج.م</span></h3>
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={`${styles.iconWrap} ${styles.yellow}`}><Wallet size={28} /></div>
              <div>
                <p className={styles.summaryLabel}>العربون المحصل</p>
                <h3 className={styles.summaryValue}>{totalDeposits.toLocaleString()} <span className={styles.summaryCurrency}>ج.م</span></h3>
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={`${styles.iconWrap} ${styles.purple}`}><Archive size={28} /></div>
              <div>
                <p className={styles.summaryLabel}>رأس مال المخزن</p>
                <h3 className={styles.summaryValue}>{totalCapital.toLocaleString()} <span className={styles.summaryCurrency}>ج.م</span></h3>
              </div>
            </div>
          </div>
        )}

        {/* Main Grid */}
        <div className={styles.mainGrid} style={{ gridTemplateColumns: isOwner ? undefined : '1fr' }}>
          
          {/* Left Column */}
          <div className={styles.column}>
            {/* Quick Access */}
            <div className={styles.sectionCard}>
              <h2 className={styles.sectionTitle}>
                <QrCode size={24} style={{color: '#3b82f6'}} /> {isOwner ? 'الوصول السريع' : 'بوابة الموظفين'}
              </h2>
              <div className={styles.linkList}>
                {isPrivileged && (
                  <a href="/admin/inventory" className={`${styles.linkItem} ${styles.gray}`}>
                    <div className={styles.linkContent}><Package size={20} style={{color: '#6366f1'}}/> إدارة المخزن</div>
                    <ChevronLeft size={18} style={{color: '#9ca3af'}} />
                  </a>
                )}
                {isOwner && (
                  <>
                    <a href="/admin/customers" className={`${styles.linkItem} ${styles.gray}`}>
                      <div className={styles.linkContent}><Users size={20} style={{color: '#f59e0b'}}/> قاعدة العملاء</div>
                      <ChevronLeft size={18} style={{color: '#9ca3af'}} />
                    </a>
                    <a href="/admin/accounts" className={`${styles.linkItem} ${styles.gray}`}>
                      <div className={styles.linkContent}><DollarSign size={20} style={{color: '#10b981'}}/> حسابات العملاء (مدين ودائن)</div>
                      <ChevronLeft size={18} style={{color: '#9ca3af'}} />
                    </a>
                  </>
                )}
                {isPrivileged && (
                  <>
                    <a href="/admin/picking" className={`${styles.linkItem} ${styles.gray}`}>
                      <div className={styles.linkContent}><ClipboardList size={20} style={{color: '#a855f7'}}/> تجهيز الأوردرات</div>
                      <ChevronLeft size={18} style={{color: '#9ca3af'}} />
                    </a>
                    <a href="/admin/orders" className={`${styles.linkItem} ${styles.gray}`}>
                      <div className={styles.linkContent}><ShoppingCart size={20} style={{color: '#3b82f6'}}/> إدارة الطلبات</div>
                      <ChevronLeft size={18} style={{color: '#9ca3af'}} />
                    </a>
                    <a href="/admin/create-order" className={`${styles.linkItem} ${styles.gray}`}>
                      <div className={styles.linkContent}><PlusCircle size={20} style={{color: '#10b981'}}/> إنشاء طلب جديد</div>
                      <ChevronLeft size={18} style={{color: '#9ca3af'}} />
                    </a>
                  </>
                )}
                <a href="/customer" className={`${styles.linkItem} ${styles.green}`}>
                  <div className={styles.linkContent}><QrCode size={20} /> مسح الموديلات</div>
                  <ChevronLeft size={18} style={{color: '#86efac'}} />
                </a>
              </div>
              
              <div className={styles.qrSection}>
                <h3 className={styles.qrTitle}>بوابة مسح العملاء (QR)</h3>
                <div className={styles.qrBox}>
                  <QRCodeSVG value={`${websiteUrl}/customer`} size={140} level="H" />
                </div>
              </div>
            </div>

            {/* Orders Status */}
            {isOwner && (
              <div className={styles.sectionCard}>
                <h2 className={styles.sectionTitle}>
                  <Truck size={24} style={{color: '#f97316'}} /> حركة الطلبات
                </h2>
                <div className={styles.statusList}>
                  <div className={`${styles.statusCard} ${styles.orange}`}>
                    <div className={styles.statusLabel}><Clock size={20}/> قيد التجهيز</div>
                    <span className={styles.statusValue}>{pendingOrders}</span>
                  </div>
                  <div className={`${styles.statusCard} ${styles.blue}`}>
                    <div className={styles.statusLabel}><Truck size={20}/> مع شركة الشحن</div>
                    <span className={styles.statusValue}>{shippedOrders}</span>
                  </div>
                  <div className={`${styles.statusCard} ${styles.green}`}>
                    <div className={styles.statusLabel}><CheckCircle size={20}/> تم التسليم</div>
                    <span className={styles.statusValue}>{deliveredOrders}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Middle & Right Column */}
          {isOwner && (
            <div className={styles.column}>
            {/* Inventory Health */}
            <div className={styles.sectionCard}>
              <h2 className={styles.sectionTitle}>
                <Package size={24} style={{color: '#a855f7'}} /> تقارير المخزن
              </h2>
              
              <div className={styles.twoColGrid}>
                <div>
                  <h3 className={styles.subTitle}><TrendingUp size={16} style={{color: '#22c55e'}}/> الأكثر مبيعاً (بالقطعة)</h3>
                  <div className={styles.itemList}>
                    {topSellers.length === 0 ? <p style={{fontSize: '0.875rem', color: '#9ca3af'}}>لا توجد مبيعات بعد</p> : topSellers.map(([model, data], i) => (
                      <div key={model} className={styles.itemCard}>
                        <span className={styles.itemLabel}>
                          <span className={styles.itemRank}>{i+1}</span>
                          {data.name} <span style={{color: '#9ca3af', fontWeight: 'normal'}}>(#{model})</span>
                        </span>
                        <span className={`${styles.itemValue} ${styles.green}`}>{data.count} قطعة</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className={styles.subTitle}><AlertTriangle size={16} style={{color: '#ef4444'}}/> نواقص المخزن (أقل من 5)</h3>
                  <div className={styles.itemList}>
                    {lowStockProducts.length === 0 ? <p style={{fontSize: '0.875rem', color: '#16a34a', display: 'flex', gap: '0.5rem', alignItems: 'center'}}><CheckCircle size={16}/> المخزن بحالة ممتازة</p> : lowStockProducts.map(p => (
                      <div key={p.id} className={`${styles.itemCard} ${styles.red}`}>
                        <span style={{fontWeight: 'bold'}}>{p.name} <span style={{fontWeight: 'normal', opacity: 0.7}}>(#{p.modelNumber})</span></span>
                        <span style={{fontWeight: '900'}}>{p.quantity} <span style={{fontWeight: 'normal', fontSize: '0.75rem'}}>ثري</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)'}}>
                <h3 className={styles.subTitle}><Archive size={16} style={{color: '#9ca3af'}}/> بضاعة راكدة (لم تباع)</h3>
                <div className={styles.tagsWrap}>
                  {zeroSalesProducts.length === 0 ? <p style={{fontSize: '0.875rem', color: '#16a34a'}}>ممتاز، كل الموديلات تباع!</p> : zeroSalesProducts.map(p => (
                    <span key={p.id} className={styles.tag}>
                      {p.name} (#{p.modelNumber})
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Customers insights */}
            <div className={styles.sectionCard}>
              <h2 className={styles.sectionTitle}>
                <Users size={24} style={{color: '#14b8a6'}} /> إحصائيات العملاء
              </h2>
              
              <div className={styles.twoColGrid}>
                <div>
                  <h3 className={styles.subTitle}><Users size={16} style={{color: '#3b82f6'}}/> كبار العملاء (الأكثر شراءً)</h3>
                  <div className={styles.itemList}>
                    {topCustomers.length === 0 ? <p style={{fontSize: '0.875rem', color: '#9ca3af'}}>لا يوجد عملاء بعد</p> : topCustomers.map(([name, total], i) => (
                      <div key={name} className={styles.itemCard}>
                        <span className={styles.itemLabel}>
                           <span className={styles.itemRank}>{i+1}</span>
                           <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px'}}>{name}</span>
                        </span>
                        <span style={{fontWeight: '900', color: '#2563eb'}}>{total.toLocaleString()} ج.م</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className={styles.subTitle}><MapPin size={16} style={{color: '#ef4444'}}/> المحافظات الأكثر طلباً</h3>
                  <div className={styles.itemList}>
                    {topGovs.length === 0 ? <p style={{fontSize: '0.875rem', color: '#9ca3af'}}>لا يوجد طلبات بعد</p> : topGovs.map(([gov, count], i) => (
                      <div key={gov} className={styles.itemCard}>
                        <span className={styles.itemLabel}>
                          <span className={styles.itemRank}>{i+1}</span>
                          {gov}
                        </span>
                        <span className={`${styles.itemValue} ${styles.white}`}>{count} طلبات</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
