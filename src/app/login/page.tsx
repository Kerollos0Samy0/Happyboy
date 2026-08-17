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
      // Determine where to redirect based on role (could add custom claims, but for now redirect to home/scan)
      if (email.toLowerCase() === "accounting@happyboy.com") {
        router.push("/admin");
      } else {
        router.push("/scan"); // Main flow for employees
      }
    } catch (err: any) {
      console.error(err);
      setError("الإيميل أو كلمة السر غير صحيحة");
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
            <select
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
              required
              style={{ direction: 'ltr' }}
            >
              <option value="" disabled>Select an email / اختر حسابك</option>
              <option value="accounting@happyboy.com">accounting@happyboy.com (Admin)</option>
              <option value="ref3at@happyboy.com">ref3at@happyboy.com</option>
              <option value="omnia@happyboy.com">omnia@happyboy.com</option>
              <option value="radwa@happyboy.com">radwa@happyboy.com</option>
              <option value="eslam@happyboy.com">eslam@happyboy.com</option>
              <option value="marina@happyboy.com">marina@happyboy.com</option>
              <option value="ayat@happyboy.com">ayat@happyboy.com</option>
              <option value="kerollos@happyboy.com">kerollos@happyboy.com</option>
              <option value="youssef@happyboy.com">youssef@happyboy.com</option>
            </select>
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
