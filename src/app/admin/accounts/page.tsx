"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore";
import { Users, Search, Calculator, ArrowUpRight, ArrowDownRight, Eye, Calendar, DollarSign, Filter, RefreshCw, ArrowLeft } from "lucide-react";

interface Customer {
  id: string;
  phone: string;
  name: string;
  brandName: string;
  customerType: string;
  createdAt: any;
}

interface Order {
  id: string;
  customerPhone: string;
  total: number;
  deposit?: number;
  createdAt: any;
  isDeleted?: boolean;
}

interface Payment {
  id: string;
  customerId: string;
  amount: number;
  type: string;
  createdAt: any;
}

export default function AccountsDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'debit' | 'credit' | 'zero'>('all');

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
    // Fetch all customers
    const unsubCustomers = onSnapshot(collection(db, "customers"), (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    });

    // Fetch all orders (we filter deleted ones client side if needed, or by where query)
    const unsubOrders = onSnapshot(collection(db, "orders"), (snap) => {
      const fetchedOrders = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      setOrders(fetchedOrders.filter(o => o.isDeleted !== true));
    });

    // Fetch all payments
    const unsubPayments = onSnapshot(collection(db, "payments"), (snap) => {
      setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
    });

    // We can stop loading once all three listeners are setup
    // A more robust way would track if each returned its first snapshot, 
    // but for simplicity a small timeout works as UI gives immediate feedback
    const timer = setTimeout(() => setLoading(false), 1500);

    return () => {
      unsubCustomers();
      unsubOrders();
      unsubPayments();
      clearTimeout(timer);
    };
  }, []);

interface AccountData extends Customer {
  totalOrders: number;
  totalPaid: number;
  balance: number;
  lastOrderDate: Date | null;
  lastPaymentDate: Date | null;
}

  const accountsData: AccountData[] = useMemo(() => {
    return customers.map(c => {
      const custOrders = orders.filter(o => o.customerPhone === c.phone);
      const custPayments = payments.filter(p => p.customerId === c.id);

      let totalOrders = 0;
      let lastOrderDate: Date | null = null;
      let totalPaid = 0;
      let lastPaymentDate: Date | null = null;
      
      custOrders.forEach(o => {
        totalOrders += o.total || 0;
        const oDate = o.createdAt?.toDate?.();
        if (oDate) {
          if (!lastOrderDate || oDate > lastOrderDate) lastOrderDate = oDate;
        }
        
        // Deposits on orders are payments
        if (o.deposit && o.deposit > 0) {
          totalPaid += o.deposit;
          if (oDate) {
             if (!lastPaymentDate || oDate > lastPaymentDate) lastPaymentDate = oDate;
          }
        }
      });

      custPayments.forEach(p => {
        totalPaid += p.amount || 0;
        const pDate = p.createdAt?.toDate?.();
        if (pDate) {
          if (!lastPaymentDate || pDate > lastPaymentDate) lastPaymentDate = pDate;
        }
      });

      const balance = totalOrders - totalPaid;
      
      return {
        ...c,
        totalOrders,
        totalPaid,
        balance,
        lastOrderDate,
        lastPaymentDate
      };
    });
  }, [customers, orders, payments]);

  const filteredAccounts = useMemo(() => {
    return accountsData.filter(acc => {
      // Search
      const term = searchTerm.toLowerCase();
      const matchSearch = (acc.name || "").toLowerCase().includes(term) || 
                          (acc.phone || "").includes(term) ||
                          (acc.brandName || "").toLowerCase().includes(term);
      if (!matchSearch) return false;

      // Type Filter
      // balance > 0 means he owes us (مدين) - Debit
      // balance < 0 means we owe him (دائن) - Credit
      if (filterType === 'debit') return acc.balance > 0;
      if (filterType === 'credit') return acc.balance < 0;
      if (filterType === 'zero') return acc.balance === 0;
      
      return true;
    }).sort((a, b) => b.balance - a.balance); // Sort by highest balance owed first
  }, [accountsData, searchTerm, filterType]);

  const totalOwedToUs = accountsData.reduce((acc, curr) => curr.balance > 0 ? acc + curr.balance : acc, 0);
  const totalWeOwe = accountsData.reduce((acc, curr) => curr.balance < 0 ? acc + Math.abs(curr.balance) : acc, 0);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
        <div style={{ width: '3rem', height: '3rem', borderTop: '2px solid #3b82f6', borderBottom: '2px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '2rem', fontFamily: 'system-ui, -apple-system, sans-serif' }} dir="rtl">
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '12px', color: '#3b82f6' }}>
              <Calculator size={28} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b' }}>حسابات العملاء (مدين ودائن)</h1>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem', marginTop: '0.25rem' }}>
                متابعة أرصدة ومدفوعات العملاء
              </p>
            </div>
          </div>
          <button 
            onClick={() => router.push('/admin/dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', background: '#f1f5f9', border: 'none', borderRadius: '8px', color: '#475569', cursor: 'pointer', fontWeight: 600 }}
          >
            العودة للوحة التحكم <ArrowLeft size={18} />
          </button>
        </div>

        {/* Global Financial Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: '#fef2f2', padding: '1rem', borderRadius: '12px', color: '#ef4444' }}>
              <ArrowUpRight size={24} />
            </div>
            <div>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>إجمالي المبالغ المستحقة لنا (مدين)</p>
              <h2 style={{ margin: '0.25rem 0 0 0', color: '#1e293b', fontSize: '1.5rem' }}>{totalOwedToUs.toLocaleString()} ج.م</h2>
            </div>
          </div>

          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '12px', color: '#22c55e' }}>
              <ArrowDownRight size={24} />
            </div>
            <div>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>إجمالي المبالغ المستحقة للعملاء (دائن)</p>
              <h2 style={{ margin: '0.25rem 0 0 0', color: '#1e293b', fontSize: '1.5rem' }}>{totalWeOwe.toLocaleString()} ج.م</h2>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[
                { id: 'all', label: 'الكل' },
                { id: 'debit', label: 'مدين (عليهم فلوس)' },
                { id: 'credit', label: 'دائن (ليهم فلوس)' },
                { id: 'zero', label: 'خالص (صفر)' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id as any)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '9999px',
                    border: 'none',
                    background: filterType === f.id ? '#3b82f6' : '#f1f5f9',
                    color: filterType === f.id ? 'white' : '#475569',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '0.9rem'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
              <input 
                type="text"
                placeholder="بحث بالاسم أو رقم الهاتف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem 0.75rem 2.5rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                  fontSize: '0.95rem'
                }}
              />
              <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
          {filteredAccounts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
              <Calculator size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
              <h3>لا يوجد حسابات مطابقة للبحث</h3>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '1rem', fontWeight: 600 }}>العميل</th>
                    <th style={{ padding: '1rem', fontWeight: 600 }}>حالة الحساب</th>
                    <th style={{ padding: '1rem', fontWeight: 600 }}>الرصيد</th>
                    <th style={{ padding: '1rem', fontWeight: 600 }}>آخر فاتورة</th>
                    <th style={{ padding: '1rem', fontWeight: 600 }}>آخر دفعة</th>
                    <th style={{ padding: '1rem', fontWeight: 600 }}>التفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((acc) => (
                    <tr key={acc.id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.2s' }}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{acc.name || acc.brandName || "غير محدد"}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }} dir="ltr">{acc.phone}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {acc.balance > 0 ? (
                          <span style={{ background: '#fef2f2', color: '#ef4444', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <ArrowUpRight size={14} /> مدين (عليه)
                          </span>
                        ) : acc.balance < 0 ? (
                          <span style={{ background: '#f0fdf4', color: '#22c55e', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <ArrowDownRight size={14} /> دائن (له)
                          </span>
                        ) : (
                          <span style={{ background: '#f1f5f9', color: '#64748b', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 600 }}>
                            خالص
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 700, color: acc.balance > 0 ? '#ef4444' : acc.balance < 0 ? '#22c55e' : '#64748b' }}>
                        {Math.abs(acc.balance).toLocaleString()} ج.م
                      </td>
                      <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
                        {acc.lastOrderDate ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Calendar size={14} /> {acc.lastOrderDate.toLocaleDateString('ar-EG')}
                          </div>
                        ) : '-'}
                      </td>
                      <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
                        {acc.lastPaymentDate ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <DollarSign size={14} /> {acc.lastPaymentDate.toLocaleDateString('ar-EG')}
                          </div>
                        ) : '-'}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <button
                          onClick={() => router.push(`/admin/customers/${acc.id}`)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 1rem',
                            background: '#eff6ff',
                            color: '#3b82f6',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            transition: 'all 0.2s'
                          }}
                        >
                          <Eye size={16} /> كشف حساب
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
