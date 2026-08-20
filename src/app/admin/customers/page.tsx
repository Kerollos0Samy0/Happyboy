"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { Users, Search, Phone, ChevronLeft, MapPin, Building, Briefcase, Eye } from "lucide-react";

interface Customer {
  id: string;
  phone: string;
  name: string;
  brandName: string;
  customerType: string;
  createdAt: any;
}

const CUSTOMER_TYPES = [
  "محلات حساب",
  "محلات مقابل",
  "عملاء خارجي",
  "عملاء مكاتب",
  "مجموعات محلات"
];

export default function AdminCustomersPage() {
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState(CUSTOMER_TYPES[0]);

  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/admin/login");
      } else {
        const isOwner = user.email && (user.email.toLowerCase().includes('ahmed001') || user.email.toLowerCase().includes('hossam001'));
        if (!isOwner) {
          router.push("/admin/dashboard"); // Restrict to owners
        } else {
          setUserEmail(user.email);
          setLoading(false);
        }
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (loading) return;

    const customersQ = query(collection(db, "customers"));
    const unsubscribe = onSnapshot(customersQ, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Customer[];
      fetched.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || (a.createdAt ? new Date(a.createdAt) : new Date(0));
        const dateB = b.createdAt?.toDate?.() || (b.createdAt ? new Date(b.createdAt) : new Date(0));
        return dateB.getTime() - dateA.getTime();
      });
      setCustomers(fetched);
    });

    return () => unsubscribe();
  }, [loading]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
        <div style={{ width: '3rem', height: '3rem', borderTop: '2px solid #3b82f6', borderBottom: '2px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  const mapCustomerType = (type: string) => {
    if (!type) return "مجموعات محلات";
    const t = type.trim();
    if (t.includes('مكاتب')) return 'عملاء مكاتب';
    if (t.includes('مقابل')) return 'محلات مقابل';
    if (t.includes('خارجي')) return 'عملاء خارجي';
    if (t.includes('حساب')) return 'محلات حساب';
    // Any other category like توحيدات, جعفر, etc will be under مجموعات محلات
    return 'مجموعات محلات';
  };

  const filteredCustomers = customers.filter(c => {
    const term = searchTerm.toLowerCase();
    const mappedType = mapCustomerType(c.customerType);
    const matchType = mappedType === activeTab;
    const matchSearch = (c.name || "").toLowerCase().includes(term) || 
                        (c.phone || "").includes(term) ||
                        (c.brandName || "").toLowerCase().includes(term);
    return matchType && matchSearch;
  });

  // Calculate counts for tabs
  const counts = CUSTOMER_TYPES.reduce((acc, type) => {
    acc[type] = customers.filter(c => mapCustomerType(c.customerType) === type).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '2rem', fontFamily: 'system-ui, -apple-system, sans-serif' }} dir="rtl">
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '12px', color: '#3b82f6' }}>
              <Users size={28} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b' }}>قاعدة العملاء</h1>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem', marginTop: '0.25rem' }}>
                إجمالي العملاء المسجلين: {customers.length} عميل
              </p>
            </div>
          </div>
          <button 
            onClick={() => router.push('/admin/dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', background: '#f1f5f9', border: 'none', borderRadius: '8px', color: '#475569', cursor: 'pointer', fontWeight: 600 }}
          >
            العودة للوحة التحكم <ChevronLeft size={18} />
          </button>
        </div>

        {/* Tabs & Search */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', marginBottom: '2rem' }}>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1.5rem' }}>
            
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
              {CUSTOMER_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  style={{
                    padding: '0.75rem 1.25rem',
                    borderRadius: '9999px',
                    border: 'none',
                    background: activeTab === type ? '#3b82f6' : '#f1f5f9',
                    color: activeTab === type ? 'white' : '#475569',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {type}
                  <span style={{ 
                    background: activeTab === type ? 'rgba(255,255,255,0.2)' : '#e2e8f0', 
                    padding: '0.1rem 0.5rem', 
                    borderRadius: '999px',
                    fontSize: '0.85rem'
                  }}>
                    {counts[type]}
                  </span>
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

          {/* Customers List */}
          {filteredCustomers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
              <Users size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
              <h3>لا يوجد عملاء مطابقين للبحث في قسم ({activeTab})</h3>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '1rem', fontWeight: 600 }}>اسم المحل / البراند</th>
                    <th style={{ padding: '1rem', fontWeight: 600 }}>اسم العميل</th>
                    <th style={{ padding: '1rem', fontWeight: 600 }}>رقم الهاتف</th>
                    <th style={{ padding: '1rem', fontWeight: 600 }}>تاريخ الإضافة</th>
                    <th style={{ padding: '1rem', fontWeight: 600 }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.2s' }}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#0f172a' }}>
                          <Building size={16} color="#6366f1" /> {customer.brandName || "غير محدد"}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', color: '#334155' }}>
                        {customer.name || "غير محدد"}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#3b82f6', fontWeight: 500 }} dir="ltr">
                          <Phone size={14} /> {customer.phone}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
                        {customer.createdAt?.toDate 
                          ? new Date(customer.createdAt.toDate()).toLocaleDateString('ar-EG') 
                          : customer.createdAt 
                            ? new Date(customer.createdAt).toLocaleDateString('ar-EG') 
                            : "غير معروف"}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <button
                          onClick={() => router.push(`/admin/customers/${customer.id}`)}
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
                          <Eye size={16} /> عرض الحساب
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
