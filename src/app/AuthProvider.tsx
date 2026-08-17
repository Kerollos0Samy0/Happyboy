"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth } from "../lib/firebase";
import { onAuthStateChanged, User, signOut } from "firebase/auth";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (!currentUser && pathname !== "/login") {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [pathname, router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-xl">جاري التحميل...</p>
      </div>
    );
  }

  // If not logged in and trying to access a protected page, render nothing to avoid flicker
  if (!user && pathname !== "/login") {
    return null;
  }

  return (
    <>
      {user && pathname !== "/login" && (
        <div className="bg-gray-100 p-2 text-sm flex justify-between items-center px-4">
          <span>
            مرحباً، <strong>{user.displayName || user.email}</strong>
          </span>
          <button 
            onClick={handleLogout}
            className="text-red-600 hover:text-red-800 font-bold"
          >
            تسجيل خروج
          </button>
        </div>
      )}
      {children}
    </>
  );
}
