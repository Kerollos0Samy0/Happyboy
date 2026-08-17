"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth } from "../lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";

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
      {children}
    </>
  );
}
