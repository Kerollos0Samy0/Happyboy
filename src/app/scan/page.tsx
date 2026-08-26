"use client";

import { useEffect, useState, useRef } from "react";

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
  if (num >= 100 && num <= 299) return "وسط ولادي";
  if (num >= 300 && num <= 499) return "محير ولادي";
  if (num >= 500 && num <= 589) return "بيبي بناتي";
  if (num >= 590 && num <= 789) return "وسط بناتي";
  if (num >= 790 && num <= 999) return "محير بناتي";
  if (num >= 1000 && num <= 2999) return "رياضي";
  if (num >= 3000 && num <= 4999) return "سمر ولادي";
  if (num >= 5000 && num <= 6999) return "سمر بناتي";
  return "أخرى";
};

const playBeep = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // Classic POS Scanner Beep (2500Hz sine wave, 100ms duration)
    osc.type = "sine";
    osc.frequency.setValueAtTime(2500, ctx.currentTime);
    
    gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.5, ctx.currentTime + 0.08);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {
    console.error("Audio beep failed", e);
  }
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
  const [duplicateScanPrompt, setDuplicateScanPrompt] = useState<{product: Product, matchedColor: ColorEntry, existingIndex: number} | null>(null);

  const scannedResultRef = useRef<string | null>(null);
  const [cartStats, setCartStats] = useState<Record<string, number>>({});
  
  const [syncing, setSyncing] = useState(false);

  const syncProducts = async () => {
    setSyncing(true);
    try {
      const snapshot = await getDocs(collection(db, "products"));
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      localStorage.setItem('offline_products', JSON.stringify(prods));
      localStorage.setItem('offline_products_time', Date.now().toString());
      alert("تم مزامنة المنتجات بنجاح! يمكن المسح بدون نت الآن.");
    } catch(err) {
      console.error(err);
      alert("حدث خطأ أثناء المزامنة");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const cachedTime = localStorage.getItem('offline_products_time');
    if (!cachedTime || (Date.now() - Number(cachedTime) > 12 * 60 * 60 * 1000)) {
      syncProducts();
    }
  }, []);

  const checkDuplicateAndProceed = (prodData: Product, matched: ColorEntry) => {
    const existingCart = JSON.parse(localStorage.getItem("happyboy_cart") || "[]");
    const existingIndex = existingCart.findIndex((item: any) => item.id === prodData.id && item.selectedColor === matched.name);
    
    if (existingIndex !== -1) {
      setDuplicateScanPrompt({ product: prodData, matchedColor: matched, existingIndex });
    } else {
      setProduct(prodData);
      setMatchedColor(matched);
      setSelectedColors([matched.name]);
      setColorQuantities({ [matched.name]: 1 });
    }
  };

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

    let scanner: any = null;

    const initScanner = async () => {
      const { Html5QrcodeScanner, Html5QrcodeScanType } = await import("html5-qrcode");
      scanner = new Html5QrcodeScanner(
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
        (decodedText: string) => {
          handleScanSuccess(decodedText, scanner);
        },
        (error: any) => {
          // Handle scan errors silently
        }
      );
    };

    initScanner();

    return () => {
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleScanSuccess(barcode: string, scanner: any) {
    playBeep(); // 🎵 Play the beep sound!
    scanner.pause(true);
    setScannedResult(barcode);
    setLoading(true);
    setError("");
    
    try {
      const cachedProductsStr = localStorage.getItem('offline_products');
      if (cachedProductsStr) {
        const cachedProducts = JSON.parse(cachedProductsStr);
        let foundProduct = null;
        for (const p of cachedProducts) {
          if (p.barcodes && p.barcodes.includes(barcode)) {
            foundProduct = p;
            break;
          }
        }
        
        if (foundProduct) {
          const matched = foundProduct.colors.find((c:any) => c.barcode === barcode) || foundProduct.colors[0];
          checkDuplicateAndProceed(foundProduct, matched);
          setLoading(false);
          return;
        }
      }
      
      const q = query(collection(db, "products"), where("barcodes", "array-contains", barcode));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError("لم يتم العثور على أي منتج بهذا الباركود");
      } else {
        const prodData = querySnapshot.docs[0].data() as Product;
        prodData.id = querySnapshot.docs[0].id;
        
        const matched = prodData.colors.find(c => c.barcode === barcode) || prodData.colors[0];
        
        checkDuplicateAndProceed(prodData, matched);
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
    
    const existingCart = JSON.parse(localStorage.getItem("happyboy_cart") || "[]");
    const existingItemIndex = existingCart.findIndex((item: any) => item.id === product.id && item.selectedColor === color.name);

    if (existingItemIndex !== -1) {
      existingCart[existingItemIndex].quantity += qty;
    } else {
      const cartItem = {
        cartItemId: Date.now().toString() + Math.random().toString(),
        id: product.id,
        name: product.name,
        modelNumber: product.modelNumber,
        price: product.price,
        selectedColor: color.name,
        colorBarcode: color.barcode || "",
        sizes: product.sizes,
        isSeri: true,
        quantity: qty
      };
      existingCart.push(cartItem);
    }
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
      const cachedProductsStr = localStorage.getItem('offline_products');
      if (cachedProductsStr) {
        const cachedProducts = JSON.parse(cachedProductsStr);
        const foundProduct = cachedProducts.find((p:any) => p.modelNumber == searchModel.trim());
        
        if (foundProduct) {
          setScannedResult(searchModel);
          const defaultColor = foundProduct.colors[0];
          checkDuplicateAndProceed(foundProduct, defaultColor);
          setLoading(false);
          return;
        }
      }

      const q = query(collection(db, "products"), where("modelNumber", "==", searchModel.trim()));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError("لم يتم العثور على أي منتج برقم الموديل هذا");
      } else {
        const prodData = querySnapshot.docs[0].data() as Product;
        prodData.id = querySnapshot.docs[0].id;
        
        setScannedResult(searchModel);
        const defaultColor = prodData.colors[0];
        checkDuplicateAndProceed(prodData, defaultColor);
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
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="text-xl">{product.name} (موديل: {product.modelNumber})</h3>
                    <span className="text-xl font-bold px-3 py-1 rounded-full whitespace-nowrap" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                      {product.price} ج.م
                    </span>
                  </div>
                  <div className="mt-3 mb-2 p-3 bg-green-50 text-green-800 rounded text-center font-bold text-lg border border-green-200">
                    ✅ الموديل متاح في المخزن
                  </div>
                </div>
                
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
                              <span className="text-lg flex-1">
                                {color.name} {color.barcode ? `(${color.barcode})` : ''}
                              </span>
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

      {/* Duplicate Scan Modal */}
      {duplicateScanPrompt && (
        <div className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="card p-6 text-center" style={{ maxWidth: '400px', width: '90%' }}>
            <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--primary)' }}>تم مسح هذا المنتج مسبقاً!</h3>
            <p className="mb-6">
              الموديل: <span className="font-bold">{duplicateScanPrompt.product.modelNumber}</span><br/>
              السعر: <span className="font-bold" style={{ color: "var(--primary)" }}>{duplicateScanPrompt.product.price} ج.م</span><br/>
              اللون: <span className="font-bold">{duplicateScanPrompt.matchedColor.name} {duplicateScanPrompt.matchedColor.barcode ? `(${duplicateScanPrompt.matchedColor.barcode})` : ''}</span><br/><br/>
              موجود بالفعل في الفاتورة. هل تريد زيادة الكمية بمقدار 1؟
            </p>
            <div className="flex flex-col gap-3">
              <button 
                className="btn btn-primary w-full py-3"
                onClick={() => {
                  const existingCart = JSON.parse(localStorage.getItem("happyboy_cart") || "[]");
                  existingCart[duplicateScanPrompt.existingIndex].quantity += 1;
                  localStorage.setItem("happyboy_cart", JSON.stringify(existingCart));
                  alert("تمت زيادة الكمية بنجاح!");
                  setDuplicateScanPrompt(null);
                  setScannedResult(null);
                  window.location.reload();
                }}
              >
                نعم، زوّد الكمية ➕
              </button>
              <div className="flex gap-3">
                <button 
                  className="btn btn-outline flex-1"
                  onClick={() => {
                    setProduct(duplicateScanPrompt.product);
                    setMatchedColor(duplicateScanPrompt.matchedColor);
                    setSelectedColors([duplicateScanPrompt.matchedColor.name]);
                    setColorQuantities({ [duplicateScanPrompt.matchedColor.name]: 1 });
                    setDuplicateScanPrompt(null);
                  }}
                >
                  تعديل يدوي
                </button>
                <button 
                  className="btn btn-outline flex-1"
                  onClick={() => {
                    setDuplicateScanPrompt(null);
                    setScannedResult(null);
                    window.location.reload();
                  }}
                >
                  إلغاء المسح
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
