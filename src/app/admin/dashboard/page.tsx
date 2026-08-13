"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  const [ordersToday, setOrdersToday] = useState(0);
  const [inventoryCount, setInventoryCount] = useState(0);

  const router = useRouter();

  // In production, this would be your actual deployed Vercel domain.
  // For local testing, we use the local IP or localhost.
  const websiteUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/admin/login");
      } else {
        setUserEmail(user.email);
        setLoading(false);
        fetchStats(user.email);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchStats = async (email: string | null) => {
    try {
      // 1. Fetch Orders Today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const ordersQ = query(
        collection(db, "orders"),
        where("createdAt", ">=", today)
      );
      const ordersSnapshot = await getDocs(ordersQ);
      setOrdersToday(ordersSnapshot.size);

      // 2. Fetch Inventory Count (only if Ahmed)
      if (email?.toLowerCase().includes('ahmed')) {
        const prodSnapshot = await getDocs(collection(db, "products"));
        let totalItems = 0;
        prodSnapshot.forEach(doc => {
          totalItems += Number(doc.data().quantity || 0);
        });
        setInventoryCount(totalItems);
      }
    } catch (err) {
      console.error("Error fetching stats", err);
    }
  };

  if (loading) {
    return <div className="p-10 text-center">جاري التحميل...</div>;
  }

  const isAhmed = userEmail?.toLowerCase().includes('ahmed');

  return (
    <div className="animate-fade-in flex flex-col items-center mt-6">
      <div className="w-full flex justify-between items-center mb-6">
        <h1>لوحة تحكم الإدارة 📊</h1>
        <button 
          className="btn btn-outline"
          onClick={() => signOut(auth)}
        >
          تسجيل الخروج
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6 w-full" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {/* QR Code Card */}
        <div className="card flex flex-col items-center text-center">
          <h2 className="mb-4" style={{ color: 'var(--primary)' }}>QR Code بوابة العملاء</h2>
          <p className="text-sm mb-6">اطبع هذا الرمز وضعه في المحل. سيقوم العميل بمسحه بهاتفه ليتمكن من تسجيل بياناته وعمل الطلب بنفسه.</p>
          
          <div className="p-4" style={{ background: 'white', borderRadius: '1rem', border: '2px dashed var(--border)' }}>
            <QRCodeSVG value={`${websiteUrl}/customer`} size={200} level="H" />
          </div>
          
          <p className="mt-4 text-sm font-bold" style={{ color: 'var(--text-muted)' }}>الرابط: {websiteUrl}/customer</p>
        </div>

        {/* Quick Stats Card */}
        <div className="card">
          <h2 className="mb-4" style={{ color: 'var(--primary)' }}>مرحباً: {userEmail}</h2>
          <div className="flex flex-col gap-4">
            <div className="p-4" style={{ background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)' }}>
              <p className="text-sm">طلبات اليوم</p>
              <h3 className="text-2xl mt-1">{ordersToday}</h3>
            </div>
            
            {isAhmed && (
              <div className="p-4" style={{ background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)' }}>
                <p className="text-sm">إجمالي القطع في المخزن</p>
                <h3 className="text-2xl mt-1">{inventoryCount}</h3>
              </div>
            )}
            
            <div className="flex gap-2 w-full mt-2">
              {isAhmed && (
                <a href="/admin/inventory" className="btn btn-primary flex-1" style={{ textDecoration: 'none', display: 'flex', justifyContent: 'center' }}>
                  إدارة المخزن
                </a>
              )}
              <a href="/admin/orders" className="btn btn-secondary flex-1" style={{ textDecoration: 'none', display: 'flex', justifyContent: 'center' }}>
                الطلبات الحية
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
