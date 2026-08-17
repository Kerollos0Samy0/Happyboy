"use client";

import { useEffect, useState, useRef } from "react";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";
import { db } from "../../lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
interface ColorEntry {
  name: string;
  barcode: string;
}

interface Product {
  id: string;
  name: string;
  modelNumber: string;
  price: number;
  quantity: number;
  colors: ColorEntry[];
  sizes: string[];
  barcodes: string[];
}

const getCategoryName = (modelNumber: string) => {
  const num = parseInt(modelNumber, 10);
  if (isNaN(num)) return "أخرى";
  if (num >= 5 && num <= 90) return "بيبي ولادي";
  if (num >= 100 && num <= 150) return "وسط ولادي";
  if (num >= 300 && num <= 350) return "محير ولادي";
  if (num >= 500 && num <= 545) return "بيبي بناتي";
  if (num >= 590 && num <= 690) return "وسط بناتي";
  if (num >= 790 && num <= 890) return "محير بناتي";
  return "أخرى";
};

export default function ScanPage() {
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [matchedColor, setMatchedColor] = useState<ColorEntry | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const router = useRouter();

  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [colorQuantities, setColorQuantities] = useState<{ [key: string]: number }>({});
  
  const [showConfirm, setShowConfirm] = useState(false);
  const [searchModel, setSearchModel] = useState("");

  const scannedResultRef = useRef<string | null>(null);
  const [cartStats, setCartStats] = useState<Record<string, number>>({});

  const updateCartStats = () => {
    try {
      const existingCart = JSON.parse(localStorage.getItem("happyboy_cart") || "[]");
      const stats: Record<string, number> = {};
      existingCart.forEach((item: any) => {
        if (item.isSeri) {
          const cat = getCategoryName(item.modelNumber);
          stats[cat] = (stats[cat] || 0) + (item.quantity || 1);
        }
      });
      setCartStats(stats);
    } catch(e) {}
  };

  useEffect(() => {
    scannedResultRef.current = scannedResult;
  }, [scannedResult]);

  useEffect(() => {
    updateCartStats();
    // We no longer force redirect to /customer if they just want to scan
    const customerPhone = localStorage.getItem("customerPhone");

    const scannerElement = document.getElementById("reader");
    if (!scannerElement) return;
    if (scannerElement.innerHTML !== "") return;

    const scanner = new Html5QrcodeScanner(
      "reader",
      {
        fps: 30,
        qrbox: { width: 250, height: 250 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        showTorchButtonIfSupported: true,
      },
      false
    );

    scanner.render(
      (decodedText) => {
        handleScanSuccess(decodedText, scanner);
      },
      (error) => {
        // Handle scan errors silently
      }
    );

    return () => {
      scanner.clear().catch(console.error);
    };
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleScanSuccess(barcode: string, scanner: any) {
    scanner.pause(true);
    setScannedResult(barcode);
    setLoading(true);
    setError("");
    
    try {
      const q = query(collection(db, "products"), where("barcodes", "array-contains", barcode));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError("لم يتم العثور على أي منتج بهذا الباركود");
      } else {
        const prodData = querySnapshot.docs[0].data() as Product;
        prodData.id = querySnapshot.docs[0].id;
        
        const matched = prodData.colors.find(c => c.barcode === barcode) || prodData.colors[0];
        
        setProduct(prodData);
        setMatchedColor(matched);
        setSelectedColors([matched.name]);
        setColorQuantities({ [matched.name]: 1 });
      }
    } catch (err) {
      console.error(err);
      setError("حدث خطأ في الاتصال بقاعدة البيانات");
    } finally {
      setLoading(false);
    }
  };

  const addColorToCart = (color: ColorEntry, qty: number) => {
    if (!product) return;
    
    const cartItem = {
      cartItemId: Date.now().toString() + Math.random().toString(),
      id: product.id,
      name: product.name,
      modelNumber: product.modelNumber,
      price: product.price,
      selectedColor: color.name,
      sizes: product.sizes,
      isSeri: true,
      quantity: qty
    };
    
    const existingCart = JSON.parse(localStorage.getItem("happyboy_cart") || "[]");
    existingCart.push(cartItem);
    localStorage.setItem("happyboy_cart", JSON.stringify(existingCart));
  };

  const toggleColor = (colorName: string) => {
    if (selectedColors.includes(colorName)) {
      setSelectedColors(selectedColors.filter(c => c !== colorName));
      const newQ = { ...colorQuantities };
      delete newQ[colorName];
      setColorQuantities(newQ);
    } else {
      setSelectedColors([...selectedColors, colorName]);
      setColorQuantities({ ...colorQuantities, [colorName]: 1 });
    }
  };

  const updateQuantity = (colorName: string, change: number) => {
    setColorQuantities(prev => {
      const current = prev[colorName] || 1;
      const next = current + change;
      if (next < 1) return prev;
      return { ...prev, [colorName]: next };
    });
  };

  const handleAddSelectedColors = () => {
    if (!product || selectedColors.length === 0) return;
    
    product.colors.forEach(color => {
      if (selectedColors.includes(color.name)) {
        addColorToCart(color, colorQuantities[color.name] || 1);
      }
    });
    
    alert(`تمت إضافة المنتجات للفاتورة بنجاح!`);
    
    // Reset to scan another
    setScannedResult(null);
    setProduct(null);
    setMatchedColor(null);
    window.location.reload();
  };

  const handleManualSearch = async () => {
    if (!searchModel.trim()) return;
    
    setLoading(true);
    setError("");
    
    try {
      const q = query(collection(db, "products"), where("modelNumber", "==", searchModel.trim()));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError("لم يتم العثور على أي منتج برقم الموديل هذا");
      } else {
        const prodData = querySnapshot.docs[0].data() as Product;
        prodData.id = querySnapshot.docs[0].id;
        
        setScannedResult(searchModel);
        setProduct(prodData);
        const defaultColor = prodData.colors[0];
        setMatchedColor(defaultColor);
        setSelectedColors([defaultColor.name]);
        setColorQuantities({ [defaultColor.name]: 1 });
      }
    } catch (err) {
      console.error(err);
      setError("حدث خطأ في الاتصال بقاعدة البيانات");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col items-center mt-6 relative">
      <div className="card w-full" style={{ maxWidth: "500px", marginBottom: "1rem" }}>
        <h3 className="text-center font-bold mb-3" style={{ color: "var(--primary)" }}>📊 ملخص الفاتورة الحالية</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center" }}>
          {Object.keys(cartStats).length === 0 ? (
            <p className="text-sm text-gray-500">لا يوجد ثريهات مضافة بعد</p>
          ) : (
            Object.entries(cartStats).map(([cat, count]) => (
              <span key={cat} style={{ background: "var(--primary-light)", color: "var(--primary)", padding: "0.3rem 0.6rem", borderRadius: "9999px", fontSize: "0.85rem", fontWeight: "bold" }}>
                {cat}: {count} ثري
              </span>
            ))
          )}
        </div>
      </div>

      <div className="card w-full" style={{ maxWidth: "500px" }}>
        <h2 className="text-center mb-6" style={{ color: "var(--primary)" }}>
          📷 مسح باركود المنتج
        </h2>
        
        {!scannedResult ? (
          <div>
            <p className="text-center mb-4">قم بتوجيه الكاميرا نحو باركود اللون ليتم التعرف عليه.</p>
            <div id="reader" style={{ width: "100%", borderRadius: "var(--radius-md)", overflow: "hidden" }}></div>
            
            <div className="mt-6 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  placeholder="أو ابحث برقم الموديل يدوياً" 
                  className="input flex-1"
                  value={searchModel}
                  onChange={(e) => setSearchModel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                  style={{ padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}
                />
                <button className="btn btn-primary px-6" onClick={handleManualSearch}>بحث</button>
              </div>
            </div>

            <hr style={{ borderTop: "1px solid var(--border)", margin: "2rem 0 1rem 0" }} />
            
            <button 
              className="btn btn-secondary w-full py-3"
              onClick={() => setShowConfirm(true)}
            >
              تقفيل الفاتورة 🛒
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {loading ? (
              <p className="text-center">جاري البحث في المخزن...</p>
            ) : error ? (
              <div className="text-center text-red-500 font-bold">{error}</div>
            ) : product && matchedColor ? (
              <div className="flex flex-col gap-4">
                <div className="p-4" style={{ background: "var(--surface-hover)", borderRadius: "var(--radius-md)" }}>
                  <h3 className="text-xl">{product.name} (موديل: {product.modelNumber})</h3>
                  {product.quantity > 0 ? (
                    <div className="mt-3 mb-2 p-3 bg-green-50 text-green-800 rounded text-center font-bold text-lg border border-green-200">
                      ✅ الموديل متاح في المخزن
                    </div>
                  ) : (
                    <div className="mt-3 mb-2 p-3 bg-red-50 text-red-800 rounded text-center font-bold text-lg border border-red-200">
                      ❌ الموديل غير متاح (خلصان)
                    </div>
                  )}
                </div>
                
                {product.quantity > 0 && (
                  <>
                    <div className="p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
                      <h4 className="font-bold mb-3">الألوان المتاحة للموديل (اختر وعدّل الكمية):</h4>
                      <div className="flex flex-col gap-2">
                        {product.colors.map(color => {
                          const isSelected = selectedColors.includes(color.name);
                          return (
                            <div 
                              key={color.name} 
                              className="flex flex-col gap-2 p-3" 
                              style={{ 
                                background: "var(--background)", 
                                borderRadius: "var(--radius-sm)", 
                                border: color.name === matchedColor.name ? "1px solid var(--primary)" : "1px solid transparent" 
                              }}
                            >
                              <label className="flex items-center gap-3 cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={isSelected}
                                  onChange={() => toggleColor(color.name)}
                                  style={{ width: '20px', height: '20px' }}
                                />
                                <span className="text-lg flex-1">{color.name}</span>
                                {color.name === matchedColor.name && (
                                  <span className="text-sm font-bold px-2 py-1 rounded" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                                    ممسوح
                                  </span>
                                )}
                              </label>
                              
                              {isSelected && (
                                <div className="flex items-center gap-4 mt-2 mr-8">
                                  <span className="text-sm font-bold">الكمية (ثري):</span>
                                  <div className="flex items-center gap-2">
                                    <button 
                                      className="w-8 h-8 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 font-bold text-lg"
                                      onClick={() => updateQuantity(color.name, 1)}
                                    >+</button>
                                    <span className="font-bold text-lg w-6 text-center">{colorQuantities[color.name] || 1}</span>
                                    <button 
                                      className="w-8 h-8 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 font-bold text-lg"
                                      onClick={() => updateQuantity(color.name, -1)}
                                    >-</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    
                    <button 
                      onClick={handleAddSelectedColors} 
                      className="btn btn-primary w-full py-4 text-lg mt-2"
                      disabled={selectedColors.length === 0}
                      style={{ opacity: selectedColors.length === 0 ? 0.5 : 1 }}
                    >
                      إضافة للفاتورة وأكمل مسح 📷
                    </button>
                  </>
                )}
              </div>
            ) : null}
            
            <hr style={{ borderTop: "1px solid var(--border)", margin: "1rem 0" }} />
            
            <button 
              className="btn btn-outline w-full py-3"
              onClick={() => {
                setScannedResult(null);
                setProduct(null);
                setMatchedColor(null);
                window.location.reload();
              }}
            >
              مسح باركود آخر
            </button>
            
            <button 
              className="btn btn-secondary w-full py-3 mt-2"
              onClick={() => setShowConfirm(true)}
            >
              تقفيل الفاتورة 🛒
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="card p-6 text-center" style={{ maxWidth: '400px', width: '90%' }}>
            <h3 className="text-xl font-bold mb-4">هل أنت متأكد؟</h3>
            <p className="mb-6">هل انتهيت من مسح جميع المنتجات وتريد الانتقال لصفحة الفاتورة لتأكيد الطلب؟</p>
            <div className="flex gap-4">
              <button 
                className="btn btn-primary flex-1"
                onClick={() => router.push("/cart")}
              >
                نعم، قفّل الفاتورة
              </button>
              <button 
                className="btn btn-outline flex-1"
                onClick={() => setShowConfirm(false)}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
