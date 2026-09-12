"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../../../lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import Image from "next/image";
import { factoryDepartments } from "../../../lib/departments";

export default function FactoryLoginPage() {
  const [selectedDept, setSelectedDept] = useState(factoryDepartments[0].id);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const dept = factoryDepartments.find(d => d.id === selectedDept);
    if (!dept) {
      setError("القسم غير موجود");
      setLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, dept.email, password);
      // توجيه القسم إلى لوحة التحكم الخاصة به
      router.push(`/factory/${dept.id}`);
    } catch (err) {
      console.error(err);
      setError("كلمة المرور غير صحيحة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
      <div className="card w-full p-8" style={{ maxWidth: '400px', borderTop: '4px solid var(--primary)' }}>
        <div className="text-center mb-6">
          <h2 className="mb-2 font-bold text-2xl" style={{ color: 'var(--primary)' }}>نظام تشغيل المصنع 🏭</h2>
          <p className="text-gray-500">يرجى اختيار القسم لتسجيل الدخول</p>
        </div>
        
        {error && (
          <div className="p-3 mb-4 text-sm font-bold text-center" style={{ background: 'var(--danger)', color: 'white', borderRadius: 'var(--radius-sm)' }}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div>
            <label className="block mb-2 font-bold text-sm">القسم</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="input w-full p-3 font-bold text-lg text-center"
              style={{ textAlignLast: 'center' }}
            >
              {factoryDepartments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block mb-2 font-bold text-sm">كلمة المرور</label>
            <input 
              type="password" 
              className="input w-full p-3 text-center" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
              style={{ direction: 'ltr' }}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="btn btn-primary w-full mt-4 py-3 font-bold text-lg"
          >
            {loading ? "جاري الدخول..." : "دخول"}
          </button>
        </form>
      </div>
    </div>
  );
}
