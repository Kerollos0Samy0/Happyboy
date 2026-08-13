"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "../../lib/firebase";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";

export default function CustomerStartPage() {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [address, setAddress] = useState("");
  const [shippingCompany, setShippingCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const router = useRouter();

  const checkCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;
    
    setLoading(true);
    setError("");
    try {
      const q = query(collection(db, "customers"), where("phone", "==", phone));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        // Customer exists!
        const data = snapshot.docs[0].data();
        localStorage.setItem("customerName", data.name);
        localStorage.setItem("customerPhone", data.phone);
        localStorage.setItem("customerBrand", data.brand || "");
        localStorage.setItem("customerGovernorate", data.governorate || "");
        localStorage.setItem("customerAddress", data.address || "");
        localStorage.setItem("customerShipping", data.shippingCompany || "");
        
        // Short welcome delay
        setStep(3); // Step 3 is just a "Welcome back" loader
        setTimeout(() => {
          router.push("/scan");
        }, 1500);
      } else {
        // New customer, proceed to registration
        setStep(2);
      }
    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء البحث عن بياناتك. حاول مرة أخرى.");
    } finally {
      if (step !== 3) setLoading(false);
    }
  };

  const registerNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !brand || !governorate || !address || !shippingCompany) return;
    
    setLoading(true);
    setError("");
    try {
      await addDoc(collection(db, "customers"), {
        phone,
        name,
        brand,
        governorate,
        address,
        shippingCompany
      });
      
      localStorage.setItem("customerName", name);
      localStorage.setItem("customerPhone", phone);
      localStorage.setItem("customerBrand", brand);
      localStorage.setItem("customerGovernorate", governorate);
      localStorage.setItem("customerAddress", address);
      localStorage.setItem("customerShipping", shippingCompany);
      
      router.push("/scan");
    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء حفظ البيانات. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col items-center justify-center mt-6">
      <div className="card w-full" style={{ maxWidth: '500px' }}>
        <div className="text-center mb-6">
          <h1 className="mb-2" style={{ color: 'var(--primary)' }}>أهلاً بك! 👋</h1>
          {step === 1 && <p>أدخل رقم هاتفك للبدء في تجهيز فاتورتك.</p>}
          {step === 2 && <p>يبدو أنك عميل جديد معنا! 🎉 يرجى استكمال بياناتك مرة واحدة فقط.</p>}
          {step === 3 && <p className="font-bold text-lg text-green-600">مرحباً بعودتك! جاري نقلك...</p>}
        </div>
        
        {error && <div className="text-red-500 text-center mb-4 font-bold">{error}</div>}
        
        {step === 1 && (
          <form onSubmit={checkCustomer} className="flex flex-col gap-4">
            <div>
              <label className="block mb-2 font-bold text-sm">رقم الموبايل</label>
              <input 
                type="tel" 
                className="input text-center text-xl tracking-widest font-bold" 
                placeholder="01xxxxxxxxx" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required 
                dir="ltr"
              />
            </div>
            
            <button type="submit" disabled={loading} className="btn btn-primary w-full mt-4 py-4 text-lg">
              {loading ? "جاري البحث..." : "التالي"}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={registerNewCustomer} className="flex flex-col gap-4">
            <div className="p-3 mb-2" style={{ background: "var(--surface-hover)", borderRadius: "var(--radius-md)" }}>
              <p className="text-sm">رقم الموبايل المسجل: <strong>{phone}</strong></p>
            </div>
            
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
              <label className="block mb-2 font-bold text-sm">اسم البراند / المحل</label>
              <input 
                type="text" 
                className="input" 
                placeholder="مثال: بيبي فاشون" 
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                required 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 font-bold text-sm">المحافظة</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="مثال: القاهرة" 
                  value={governorate}
                  onChange={(e) => setGovernorate(e.target.value)}
                  required 
                />
              </div>
              <div>
                <label className="block mb-2 font-bold text-sm">شركة الشحن</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="مثال: بوسطة" 
                  value={shippingCompany}
                  onChange={(e) => setShippingCompany(e.target.value)}
                  required 
                />
              </div>
            </div>
            
            <div>
              <label className="block mb-2 font-bold text-sm">العنوان التفصيلي</label>
              <input 
                type="text" 
                className="input" 
                placeholder="أدخل عنوان التوصيل بالكامل" 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required 
              />
            </div>
            
            <button type="submit" disabled={loading} className="btn btn-primary w-full mt-4 py-3">
              {loading ? "جاري التسجيل..." : "تسجيل وبدء التسوق"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
