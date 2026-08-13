"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CustomerStartPage() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  
  const router = useRouter();

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    
    // Save to local storage
    localStorage.setItem("customerName", name);
    localStorage.setItem("customerPhone", phone);
    localStorage.setItem("customerBrand", brand);
    
    // Proceed to scan
    router.push("/scan");
  };

  return (
    <div className="animate-fade-in flex flex-col items-center justify-center mt-6">
      <div className="card w-full" style={{ maxWidth: '500px' }}>
        <div className="text-center mb-6">
          <h1 className="mb-2" style={{ color: 'var(--primary)' }}>أهلاً بك! 👋</h1>
          <p>أدخل بياناتك السريعة للبدء في مسح الموديلات وتجهيز فاتورتك.</p>
        </div>
        
        <form onSubmit={handleStart} className="flex flex-col gap-4">
          <div>
            <label className="block mb-2 font-bold text-sm">الاسم بالكامل</label>
            <input 
              type="text" 
              className="input" 
              placeholder="مثال: أحمد محمد" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required 
            />
          </div>

          <div>
            <label className="block mb-2 font-bold text-sm">رقم الموبايل</label>
            <input 
              type="tel" 
              className="input tracking-widest font-bold" 
              placeholder="01xxxxxxxxx" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required 
              dir="ltr"
            />
          </div>
          
          <div>
            <label className="block mb-2 font-bold text-sm">اسم البراند / المحل (اختياري)</label>
            <input 
              type="text" 
              className="input" 
              placeholder="مثال: بيبي فاشون" 
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            />
          </div>
          
          <button type="submit" className="btn btn-primary w-full mt-4 py-4 text-lg">
            ابدأ الفاتورة 🚀
          </button>
        </form>
      </div>
    </div>
  );
}
