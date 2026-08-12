"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/admin/dashboard");
    } catch (err: any) {
      setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
    }
  };

  return (
    <div className="animate-fade-in flex flex-col items-center justify-center mt-10">
      <div className="card w-full" style={{ maxWidth: '400px' }}>
        <div className="text-center mb-6">
          <h2 className="mb-2" style={{ color: 'var(--primary)' }}>نظام إدارة Stock HappyBoy 🔐</h2>
          <p>أدخل بياناتك للوصول للوحة التحكم.</p>
        </div>
        
        {error && (
          <div className="p-3 mb-4 text-sm" style={{ background: 'var(--danger)', color: 'white', borderRadius: 'var(--radius-sm)' }}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block mb-2 font-bold text-sm">البريد الإلكتروني</label>
            <input 
              type="email" 
              className="input" 
              placeholder="admin@happyboy.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          
          <div>
            <label className="block mb-2 font-bold text-sm">كلمة المرور</label>
            <input 
              type="password" 
              className="input" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>
          
          <button type="submit" className="btn btn-primary w-full mt-4">
            تسجيل الدخول
          </button>
        </form>
      </div>
    </div>
  );
}
