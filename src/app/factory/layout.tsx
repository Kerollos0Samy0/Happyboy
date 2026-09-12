"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import { BarChart3, PackageOpen, Monitor, ArrowRight } from "lucide-react";

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
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, [router, pathname]);

  // Remove container class for dashboard to allow full width Kanban
  useEffect(() => {
    const rootMain = document.querySelector('body > main.container') || document.querySelector('main.container');
    if (rootMain) {
      if (pathname?.includes('/factory/dashboard')) {
        rootMain.classList.remove('container');
        rootMain.classList.add('w-full');
      } else {
        rootMain.classList.add('container');
        rootMain.classList.remove('w-full');
      }
    }
  }, [pathname]);

  if (loading) {
    return <div className="p-10 text-center font-bold text-gray-500">جاري التحميل...</div>;
  }

  const isLoginPage = pathname === "/factory/login";
  const isScannerPage = pathname === "/factory/scanner";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir="rtl">
      {!(isLoginPage || isScannerPage) && (
        <header className="bg-white shadow-sm p-4 sticky top-0 z-10">
          <div className="w-full px-4 lg:px-8 mx-auto flex justify-between items-center">
            <div className="flex items-center gap-6">
              <h1 className="text-xl font-black text-blue-900 tracking-tight">نظام مصنع HappyBoy</h1>
              {!userEmail?.startsWith("dept_") && (
                <nav className="hidden lg:flex gap-2">
                  <Link 
                    href="/factory/dashboard" 
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${pathname === '/factory/dashboard' ? 'bg-blue-100 text-blue-800 font-bold' : 'text-gray-600 hover:bg-gray-100 font-medium'}`}
                  >
                    <Monitor size={18} /> حركة المصنع
                  </Link>
                  <Link 
                    href="/factory/productivity" 
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${pathname?.includes('/factory/productivity') ? 'bg-purple-100 text-purple-800 font-bold' : 'text-gray-600 hover:bg-gray-100 font-medium'}`}
                  >
                    <BarChart3 size={18} /> الإنتاجيات
                  </Link>
                  <Link 
                    href="/factory/inventory" 
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${pathname?.includes('/factory/inventory') ? 'bg-green-100 text-green-800 font-bold' : 'text-gray-600 hover:bg-gray-100 font-medium'}`}
                  >
                    <PackageOpen size={18} /> المخازن
                  </Link>
                  <Link 
                    href="/factory/production" 
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${pathname === '/factory/production' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    إدارة الموديلات والأوامر
                  </Link>
                  <Link 
                    href="/factory/scanner" 
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${pathname === '/factory/scanner' ? 'bg-orange-50 text-orange-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    الماسح الضوئي للعمال
                  </Link>
                </nav>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-gray-500 hidden sm:inline-block bg-gray-100 px-3 py-1 rounded-full">{userEmail}</span>
              {!userEmail?.startsWith("dept_") ? (
                <Link 
                  href="/admin/dashboard" 
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-gray-200 border border-gray-200 transition flex items-center gap-2"
                >
                  <ArrowRight size={18} /> عودة للرئيسية
                </Link>
              ) : (
                <button 
                  onClick={() => {
                    import("firebase/auth").then(({ signOut }) => signOut(auth));
                  }}
                  className="bg-red-50 text-red-700 px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-red-100 border border-red-200 transition flex items-center gap-2"
                >
                  تسجيل خروج
                </button>
              )}
            </div>
          </div>
          
          {/* Mobile Navigation */}
          {!userEmail?.startsWith("dept_") && (
            <nav className="lg:hidden flex gap-2 mt-4 border-t pt-3 overflow-x-auto pb-2 scrollbar-hide">
                <Link 
                  href="/factory/dashboard" 
                  className={`px-4 py-2 whitespace-nowrap rounded-lg text-sm transition-colors flex items-center gap-1 ${pathname === '/factory/dashboard' ? 'bg-blue-100 text-blue-800 font-bold' : 'text-gray-600 hover:bg-gray-100 font-medium'}`}
                >
                  <Monitor size={16} /> حركة المصنع
                </Link>
                <Link 
                  href="/factory/productivity" 
                  className={`px-4 py-2 whitespace-nowrap rounded-lg text-sm transition-colors flex items-center gap-1 ${pathname?.includes('/factory/productivity') ? 'bg-purple-100 text-purple-800 font-bold' : 'text-gray-600 hover:bg-gray-100 font-medium'}`}
                >
                  <BarChart3 size={16} /> الإنتاجيات
                </Link>
                <Link 
                  href="/factory/inventory" 
                  className={`px-4 py-2 whitespace-nowrap rounded-lg text-sm transition-colors flex items-center gap-1 ${pathname?.includes('/factory/inventory') ? 'bg-green-100 text-green-800 font-bold' : 'text-gray-600 hover:bg-gray-100 font-medium'}`}
                >
                  <PackageOpen size={16} /> المخازن
                </Link>
            </nav>
          )}
        </header>
      )}
      {!(isLoginPage || isScannerPage) && (
        <div className={`flex-1 w-full mx-auto mt-6 ${pathname?.includes('/factory/dashboard') ? 'px-2 pb-0' : 'px-4 lg:px-8'}`}>
          {children}
        </div>
      )}
      {(isLoginPage || isScannerPage) && children}
    </div>
  );
}
