"use client";

import { useEffect, useState } from "react";
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
  colors: ColorEntry[];
  sizes: string[];
  barcodes: string[];
}

export default function ScanPage() {
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [matchedColor, setMatchedColor] = useState<ColorEntry | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const router = useRouter();

  const [selectedColors, setSelectedColors] = useState<string[]>([]);

  useEffect(() => {
    const scannerElement = document.getElementById("reader");
    if (!scannerElement) return;
    if (scannerElement.innerHTML !== "") return;

    const scanner = new Html5QrcodeScanner(
      "reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
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

  const handleScanSuccess = async (barcode: string, scanner: any) => {
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
        setSelectedColors([matched.name]); // Pre-select the scanned color
      }
    } catch (err) {
      console.error(err);
      setError("حدث خطأ في الاتصال بقاعدة البيانات");
    } finally {
      setLoading(false);
    }
  };

  const addColorToCart = (color: ColorEntry) => {
    if (!product) return;
    
    const cartItem = {
      cartItemId: Date.now().toString() + Math.random().toString(),
      id: product.id,
      name: product.name,
      modelNumber: product.modelNumber,
      price: product.price,
      selectedColor: color.name,
      sizes: product.sizes,
      isSeri: true
    };
    
    const existingCart = JSON.parse(localStorage.getItem("happyboy_cart") || "[]");
    existingCart.push(cartItem);
    localStorage.setItem("happyboy_cart", JSON.stringify(existingCart));
  };

  const toggleColor = (colorName: string) => {
    if (selectedColors.includes(colorName)) {
      setSelectedColors(selectedColors.filter(c => c !== colorName));
    } else {
      setSelectedColors([...selectedColors, colorName]);
    }
  };

  const handleAddSelectedColors = () => {
    if (!product || selectedColors.length === 0) return;
    
    product.colors.forEach(color => {
      if (selectedColors.includes(color.name)) {
        addColorToCart(color);
      }
    });
    
    alert(`تمت إضافة ${selectedColors.length} لون للفاتورة بنجاح!`);
    router.push("/cart");
  };

  return (
    <div className="animate-fade-in flex flex-col items-center mt-6">
      <div className="card w-full" style={{ maxWidth: "500px" }}>
        <h2 className="text-center mb-6" style={{ color: "var(--primary)" }}>
          📷 مسح باركود المنتج
        </h2>
        
        {!scannedResult ? (
          <div>
            <p className="text-center mb-4">قم بتوجيه الكاميرا نحو باركود اللون ليتم التعرف عليه.</p>
            <div id="reader" style={{ width: "100%", borderRadius: "var(--radius-md)", overflow: "hidden" }}></div>
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
                  <p className="font-bold text-lg mt-2" style={{ color: "var(--primary)" }}>سعر القطعة: {product.price} ج.م</p>
                  <p className="text-sm">المقاسات: {product.sizes.join(", ")}</p>
                </div>
                
                <div className="p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
                  <h4 className="font-bold mb-3">الألوان المتاحة للموديل (اختر ما تود إضافته):</h4>
                  <div className="flex flex-col gap-2">
                    {product.colors.map(color => (
                      <label 
                        key={color.name} 
                        className="flex items-center gap-3 p-3 cursor-pointer" 
                        style={{ 
                          background: "var(--background)", 
                          borderRadius: "var(--radius-sm)", 
                          border: color.name === matchedColor.name ? "1px solid var(--primary)" : "1px solid transparent" 
                        }}
                      >
                        <input 
                          type="checkbox" 
                          checked={selectedColors.includes(color.name)}
                          onChange={() => toggleColor(color.name)}
                          style={{ width: '20px', height: '20px' }}
                        />
                        <span className="text-lg">{color.name}</span>
                        {color.name === matchedColor.name && (
                          <span className="text-sm font-bold px-2 py-1 rounded" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                            اللون الممسوح
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
                
                <button 
                  onClick={handleAddSelectedColors} 
                  className="btn btn-primary w-full py-4 text-lg mt-2"
                  disabled={selectedColors.length === 0}
                  style={{ opacity: selectedColors.length === 0 ? 0.5 : 1 }}
                >
                  إضافة الألوان المحددة ({selectedColors.length}) للفاتورة
                </button>
              </div>
            ) : null}
            
            <hr style={{ borderTop: "1px solid var(--border)", margin: "1rem 0" }} />
            
            <button 
              className="btn btn-outline w-full"
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
              className="btn w-full mt-2"
              style={{ background: 'var(--surface-hover)', color: 'var(--text-main)' }}
              onClick={() => router.push("/cart")}
            >
              الانتقال للفاتورة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
