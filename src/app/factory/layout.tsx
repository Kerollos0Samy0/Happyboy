"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth } from "../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Link from "next/link";

export default function FactoryLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user && pathname !== "/factory/login") {
        router.push("/factory/login");
      } else if (user) {
        setUserEmail(user.email);
        setLoading(false);
      } else {
        setLoading(false); // For login page
      }
    });
    return () => unsubscribeAuth();
  }, [router, pathname]);

  if (loading) {
    return <div className="p-10 text-center">جاري التحميل...</div>;
  }

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/factory/login");
  };

  const isLoginPage = pathname === "/factory/login";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {!isLoginPage && (
        <header className="bg-white shadow-sm p-4 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-6">
              <h1 className="text-xl font-bold text-gray-800">نظام المصنع 🏭</h1>
              <nav className="hidden md:flex gap-4">
                <Link 
                  href="/factory/dashboard" 
                  className={`px-3 py-2 rounded-md transition-colors ${pathname === '/factory/dashboard' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  لوحة التجهيز
                </Link>
                <Link 
                  href="/factory/production" 
                  className={`px-3 py-2 rounded-md transition-colors ${pathname === '/factory/production' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  إدارة المصنع والإنتاج
                </Link>
                <Link 
                  href="/factory/invoices" 
                  className={`px-3 py-2 rounded-md transition-colors ${pathname === '/factory/invoices' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  إنشاء فاتورة سريعة
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500 hidden sm:inline-block">{userEmail}</span>
              <button onClick={handleLogout} className="text-sm text-red-600 hover:bg-red-50 px-3 py-1 rounded transition-colors">
                خروج
              </button>
            </div>
          </div>
          {/* Mobile Navigation */}
          <nav className="md:hidden flex gap-2 mt-4 border-t pt-2 overflow-x-auto">
             <Link 
                href="/factory/dashboard" 
                className={`px-3 py-2 whitespace-nowrap rounded-md text-sm transition-colors ${pathname === '/factory/dashboard' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                لوحة التجهيز
              </Link>
              <Link 
                href="/factory/production" 
                className={`px-3 py-2 whitespace-nowrap rounded-md text-sm transition-colors ${pathname === '/factory/production' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                المصنع
              </Link>
              <Link 
                href="/factory/invoices" 
                className={`px-3 py-2 whitespace-nowrap rounded-md text-sm transition-colors ${pathname === '/factory/invoices' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                إنشاء فاتورة
              </Link>
          </nav>
        </header>
      )}
      
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
