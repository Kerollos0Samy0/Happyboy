"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Everyone goes to the dashboard. The dashboard automatically shows employee tools for employees.
      router.push("/admin/dashboard");
    } catch (err) {
      console.error(err);
      setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="card w-full max-w-md p-8 bg-white shadow-lg rounded-xl">
        <div className="flex justify-center mb-6">
          <Image src="/icon.png" alt="Happy Boy Logo" width={100} height={100} className="object-contain" />
        </div>
        
        <h1 className="text-2xl font-bold text-center mb-6" style={{ color: "var(--primary)" }}>
          تسجيل الدخول
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block mb-2 font-bold text-sm text-gray-700">الإيميل</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="example@happyboy.com"
              required
              style={{ direction: 'ltr' }}
            />
          </div>

          <div>
            <label className="block mb-2 font-bold text-sm text-gray-700">كلمة السر</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="••••••••"
              required
              style={{ direction: 'ltr' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full py-3 mt-4 rounded-lg text-white font-bold transition-colors"
            style={{ backgroundColor: "var(--primary)" }}
          >
            {loading ? "جاري الدخول..." : "دخول"}
          </button>
        </form>
      </div>
    </div>
  );
}
