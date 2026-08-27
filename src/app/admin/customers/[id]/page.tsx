"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { auth, db } from "../../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, query, where, orderBy, addDoc, serverTimestamp, or } from "firebase/firestore";
import { ChevronRight, User, Building, Phone, DollarSign, Plus, Receipt, CreditCard, History, Banknote } from "lucide-react";

interface Customer {
  id: string;
  phone: string;
  name: string;
  brandName: string;
  customerType: string;
  createdAt: any;
  governorate?: string;
  address?: string;
}

interface Order {
  id: string;
  total: number;
  deposit?: number;
  createdAt: any;
  orderNumber?: string;
  status: string;
}

interface Payment {
  id: string;
  amount: number;
  type: 'payment' | 'discount' | 'refund';
  note: string;
  createdAt: any;
}

interface LedgerItem {
  id: string;
  type: 'order' | 'payment' | 'discount' | 'refund';
  amount: number; // positive for owed to us (orders), negative for payments made to us
  date: Date;
  description: string;
  refId?: string;
}

export default function CustomerAccountPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentType, setPaymentType] = useState<'payment' | 'discount'>('payment');
  const [paymentNote, setPaymentNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/admin/login");
      } else {
        const isOwner = user.email && (user.email.toLowerCase().includes('ahmed001') || user.email.toLowerCase().includes('hossam001'));
        if (!isOwner) {
          router.push("/admin/dashboard");
        }
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (!customerId) return;

    const fetchCustomer = async () => {
      try {
        const docRef = doc(db, "customers", customerId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCustomer({ id: docSnap.id, ...docSnap.data() } as Customer);
        } else {
          router.push("/admin/customers");
        }
      } catch (error) {
        console.error("Error fetching customer", error);
      }
    };
    
    fetchCustomer();
  }, [customerId, router]);

  useEffect(() => {
    if (!customer) return;

    // Fetch Orders
    let ordersQ;
    if (customer.phone) {
      ordersQ = query(
        collection(db, "orders"),
        or(
          where("customerId", "==", customerId),
          where("customerPhone", "==", customer.phone)
        )
      );
    } else {
      ordersQ = query(collection(db, "orders"), where("customerId", "==", customerId));
    }

    const unsubscribeOrders = onSnapshot(ordersQ, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      const validOrders = fetchedOrders.filter(o => {
        if (o.isDeleted) return false;
        if (o.customerId && o.customerId !== customerId) return false;
        return true;
      });
      setOrders(validOrders as Order[]);
    });

    // Fetch Payments
    const paymentsQ = query(collection(db, "payments"), where("customerId", "==", customerId));
    const unsubscribePayments = onSnapshot(paymentsQ, (snapshot) => {
      const fetchedPayments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Payment[];
      setPayments(fetchedPayments);
      setLoading(false);
    });

    return () => {
      unsubscribeOrders();
      unsubscribePayments();
    };
  }, [customer, customerId]);

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "payments"), {
        customerId,
        amount,
        type: paymentType,
        note: paymentNote,
        createdAt: serverTimestamp()
      });
      setShowModal(false);
      setPaymentAmount("");
      setPaymentNote("");
    } catch (error) {
      console.error("Error adding payment:", error);
      alert("حدث خطأ أثناء إضافة الدفعة");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !customer) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
        <div style={{ width: '3rem', height: '3rem', borderTop: '2px solid #3b82f6', borderBottom: '2px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  // Calculate Ledger
  let ledger: LedgerItem[] = [];

  // Add orders to ledger
  orders.forEach(o => {
    const date = o.createdAt?.toDate ? o.createdAt.toDate() : (o.createdAt ? new Date(o.createdAt) : new Date());
    ledger.push({
      id: o.id,
      type: 'order',
      amount: o.total, // Owed to us
      date,
      description: `فاتورة مبيعات ${o.orderNumber ? '#' + o.orderNumber : ''}`,
      refId: o.id
    });

    // If order had a deposit, treat it as a payment
    if (o.deposit && o.deposit > 0) {
      ledger.push({
        id: o.id + '_deposit',
        type: 'payment',
        amount: o.deposit,
        date,
        description: `مقدم فاتورة ${o.orderNumber ? '#' + o.orderNumber : ''}`,
        refId: o.id
      });
    }
  });

  // Add payments to ledger
  payments.forEach(p => {
    const date = p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt ? new Date(p.createdAt) : new Date());
    ledger.push({
      id: p.id,
      type: p.type,
      amount: p.amount,
      date,
      description: p.type === 'payment' ? 'دفعة نقدية' : p.type === 'discount' ? 'خصم / تسوية' : 'مرتجع',
      refId: p.id
    });
  });

  // Sort by date oldest to newest to calculate running balance
  ledger.sort((a, b) => a.date.getTime() - b.date.getTime());

  let totalPurchases = 0;
  let totalPayments = 0;

  // Add running balance
  const ledgerWithBalance = ledger.map(item => {
    if (item.type === 'order') {
      totalPurchases += item.amount;
    } else {
      totalPayments += item.amount;
    }
    return {
      ...item,
      runningBalance: totalPurchases - totalPayments
    };
  });

  // Reverse for display (newest first)
  ledgerWithBalance.reverse();

  const currentBalance = totalPurchases - totalPayments;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '2rem', fontFamily: 'system-ui, -apple-system, sans-serif' }} dir="rtl">
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              onClick={() => router.push('/admin/customers')}
              style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            >
              <ChevronRight size={20} color="#475569" />
            </button>
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b' }}>كشف حساب العميل</h1>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)' }}
          >
            <Plus size={18} /> إضافة دفعة
          </button>
        </div>

        {/* Info Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          
          {/* Customer Details */}
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 1rem 0', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={18} /> بيانات العميل
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>الاسم:</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{customer.name || 'غير محدد'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>المحل / البراند:</span>
                <span style={{ fontWeight: 500, color: '#0f172a' }}>{customer.brandName || 'غير محدد'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>الهاتف:</span>
                <span style={{ fontWeight: 500, color: '#3b82f6' }} dir="ltr">{customer.phone}</span>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', color: 'white' }}>
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 1rem 0', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Banknote size={18} /> ملخص الحساب
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8' }}>إجمالي المشتريات:</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>{totalPurchases.toLocaleString()} ج.م</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8' }}>إجمالي المدفوعات:</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 600, color: '#4ade80' }}>{totalPayments.toLocaleString()} ج.م</span>
              </div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0.25rem 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#e2e8f0', fontWeight: 500 }}>الرصيد المتبقي (عليه):</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: currentBalance > 0 ? '#f87171' : currentBalance < 0 ? '#4ade80' : 'white' }}>
                  {currentBalance.toLocaleString()} ج.م
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Ledger Table */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <h2 style={{ fontSize: '1.2rem', margin: '0 0 1.5rem 0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={20} color="#3b82f6" /> حركة الحساب
          </h2>
          
          {ledgerWithBalance.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
              <Receipt size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
              <h3>لا يوجد حركات مسجلة لهذا العميل</h3>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '1rem', fontWeight: 600 }}>التاريخ</th>
                    <th style={{ padding: '1rem', fontWeight: 600 }}>البيان</th>
                    <th style={{ padding: '1rem', fontWeight: 600 }}>مشتريات (عليه)</th>
                    <th style={{ padding: '1rem', fontWeight: 600 }}>مدفوعات (له)</th>
                    <th style={{ padding: '1rem', fontWeight: 600 }}>الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerWithBalance.map((item, index) => (
                    <tr key={item.id + index} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
                        {item.date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 500, color: '#1e293b' }}>
                        {item.description}
                        {item.type !== 'order' && payments.find(p => p.id === item.refId)?.note && (
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                            {payments.find(p => p.id === item.refId)?.note}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '1rem', color: '#f87171', fontWeight: 600 }}>
                        {item.type === 'order' ? item.amount.toLocaleString() : '-'}
                      </td>
                      <td style={{ padding: '1rem', color: '#4ade80', fontWeight: 600 }}>
                        {item.type !== 'order' ? item.amount.toLocaleString() : '-'}
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 700, color: '#334155' }}>
                        {item.runningBalance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Payment Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50, padding: '1rem' }} dir="rtl">
          <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#1e293b', fontSize: '1.25rem' }}>تسجيل دفعة جديدة</h2>
            <form onSubmit={handleAddPayment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontSize: '0.9rem' }}>نوع العملية</label>
                <select 
                  value={paymentType} 
                  onChange={(e) => setPaymentType(e.target.value as any)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                >
                  <option value="payment">دفعة نقدية</option>
                  <option value="discount">خصم / تسوية</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontSize: '0.9rem' }}>المبلغ (ج.م)</label>
                <input 
                  type="number" 
                  required
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                  placeholder="أدخل المبلغ..."
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontSize: '0.9rem' }}>ملاحظات (اختياري)</label>
                <textarea 
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', resize: 'vertical', minHeight: '80px' }}
                  placeholder="اكتب أي ملاحظات هنا..."
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: '0.75rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ flex: 1, padding: '0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: isSubmitting ? 0.7 : 1 }}
                >
                  {isSubmitting ? 'جاري الحفظ...' : 'حفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
