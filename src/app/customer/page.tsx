"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "../../lib/firebase";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { Search, UserCheck, UserPlus, Phone } from "lucide-react";

export default function CustomerStartPage() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [address, setAddress] = useState("");
  const [shipping, setShipping] = useState("");
  
  const [isSearching, setIsSearching] = useState(false);
  const [customerFound, setCustomerFound] = useState<boolean | null>(null);
  
  const router = useRouter();

  // Auto search when phone number is 11 digits
  useEffect(() => {
    const searchCustomer = async () => {
      if (phone.length < 8) {
        setCustomerFound(null);
        return;
      }
      
      setIsSearching(true);
      try {
        // First try to find in 'customers' collection if it exists
        const customersQ = query(collection(db, "customers"), where("phone", "==", phone));
        const customersSnap = await getDocs(customersQ);
        
        if (!customersSnap.empty) {
          const data = customersSnap.docs[0].data();
          setName(data.name || "");
          setBrand(data.brandName || data.brand || "");
          setGovernorate(data.governorate || "");
          setAddress(data.address || "");
          setShipping(data.shipping || "");
          setCustomerFound(true);
          setIsSearching(false);
          return;
        }

        // Fallback: search in 'orders' for previous orders by this phone
        const ordersQ = query(
          collection(db, "orders"), 
          where("customerPhone", "==", phone)
        );
        const ordersSnap = await getDocs(ordersQ);
        
        if (!ordersSnap.empty) {
          // Get the most recent order data
          const docs = ordersSnap.docs.map(d => d.data());
          docs.sort((a, b) => {
             const timeA = a.createdAt?.toMillis?.() || 0;
             const timeB = b.createdAt?.toMillis?.() || 0;
             return timeB - timeA;
          });
          const lastOrder = docs[0];
          
          setName(lastOrder.customerName || "");
          setBrand(lastOrder.customerBrand || "");
          setGovernorate(lastOrder.customerGovernorate || "");
          setAddress(lastOrder.customerAddress || "");
          setShipping(lastOrder.customerShipping || "");
          setCustomerFound(true);
        } else {
          setCustomerFound(false);
          // Don't clear name/brand here so the user doesn't lose what they typed
        }
      } catch (err) {
        console.error("Error searching customer:", err);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(() => {
      searchCustomer();
    }, 500); // debounce

    return () => clearTimeout(timeoutId);
  }, [phone]);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    
    // Save to local storage
    localStorage.setItem("customerName", name);
    localStorage.setItem("customerPhone", phone);
    localStorage.setItem("customerBrand", brand);
    localStorage.setItem("customerGovernorate", governorate);
    localStorage.setItem("customerAddress", address);
    localStorage.setItem("customerShipping", shipping);
    
    // Proceed to scan
    router.push("/scan");
  };

  return (
    <div className="animate-fade-in flex flex-col items-center justify-center mt-10 px-4">
      <div className="card w-full" style={{ maxWidth: '500px' }}>
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Phone size={32} />
          </div>
          <h1 className="mb-2 text-2xl font-bold" style={{ color: 'var(--primary)' }}>بيانات العميل</h1>
          <p className="text-gray-500">أدخل رقم الهاتف، وسنقوم بجلب باقي البيانات تلقائياً إن وجدت.</p>
        </div>
        
        <form onSubmit={handleStart} className="flex flex-col gap-4" autoComplete="off">
          
          {/* Phone Field - Always first */}
          <div className="relative">
            <label className="block mb-2 font-bold text-sm text-gray-700">رقم الموبايل <span className="text-red-500">*</span></label>
            <div className="relative">
              <input 
                type="tel" 
                className="input tracking-widest font-bold w-full pl-10" 
                placeholder="01xxxxxxxxx" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required 
                dir="ltr"
                autoComplete="off"
                style={{
                  borderColor: customerFound === true ? 'var(--success)' : customerFound === false ? 'var(--warning)' : 'var(--border)'
                }}
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                {isSearching ? (
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                ) : customerFound === true ? (
                  <UserCheck size={20} className="text-green-500" />
                ) : customerFound === false ? (
                  <UserPlus size={20} className="text-yellow-500" />
                ) : (
                  <Search size={20} className="text-gray-400" />
                )}
              </div>
            </div>
            
            {/* Status messages */}
            {customerFound === true && (
              <p className="text-xs text-green-600 mt-1 font-bold">عميل مسجل مسبقاً! تم جلب البيانات.</p>
            )}
            {customerFound === false && phone.length >= 8 && (
              <p className="text-xs text-yellow-600 mt-1">عميل جديد. يرجى إدخال باقي البيانات.</p>
            )}
          </div>

          <div className={`transition-all duration-300 overflow-hidden ${phone.length >= 8 ? 'opacity-100 max-h-96' : 'opacity-50 max-h-96'}`}>
            <div className="flex flex-col gap-4 mt-2">
              <div>
                <label className="block mb-2 font-bold text-sm text-gray-700">الاسم بالكامل <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  className="input w-full" 
                  placeholder="مثال: أحمد محمد" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required 
                  autoComplete="off"
                  disabled={!phone}
                />
              </div>
              
              <div>
                <label className="block mb-2 font-bold text-sm text-gray-700">اسم البراند / المحل (اختياري)</label>
                <input 
                  type="text" 
                  className="input w-full" 
                  placeholder="مثال: بيبي فاشون" 
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  autoComplete="off"
                  disabled={!phone}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 font-bold text-sm text-gray-700">المحافظة</label>
                  <input 
                    type="text" 
                    className="input w-full" 
                    placeholder="مثال: القاهرة" 
                    value={governorate}
                    onChange={(e) => setGovernorate(e.target.value)}
                    disabled={!phone}
                  />
                </div>
                <div>
                  <label className="block mb-2 font-bold text-sm text-gray-700">شركة الشحن</label>
                  <input 
                    type="text" 
                    className="input w-full" 
                    placeholder="مثال: بوسطة" 
                    value={shipping}
                    onChange={(e) => setShipping(e.target.value)}
                    disabled={!phone}
                  />
                </div>
              </div>
              
              <div>
                <label className="block mb-2 font-bold text-sm text-gray-700">العنوان التفصيلي</label>
                <input 
                  type="text" 
                  className="input w-full" 
                  placeholder="اسم الشارع، رقم العمارة، الخ..." 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={!phone}
                />
              </div>
            </div>
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary w-full mt-6 py-4 text-lg"
            disabled={!name || !phone || isSearching}
            style={{ 
              opacity: (!name || !phone || isSearching) ? 0.6 : 1,
              cursor: (!name || !phone || isSearching) ? 'not-allowed' : 'pointer'
            }}
          >
            استمرار للمسح والطلبات 🚀
          </button>
        </form>
      </div>
    </div>
  );
}
