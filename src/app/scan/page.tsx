"use client";

import { useEffect, useState } from "react";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";
import { db } from "../../lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";

interface Product {
  id: string;
  name: string;
  price: number;
  colors: string[];
  sizes: string[];
  barcode: string;
}

export default function ScanPage() {
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  
  const router = useRouter();

  useEffect(() => {
    // Prevent multiple initializations in React strict mode
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
      const q = query(collection(db, "products"), where("barcode", "==", barcode));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError("لم يتم العثور على هذا الموديل في المخزن");
      } else {
        const prodData = querySnapshot.docs[0].data() as Product;
        prodData.id = querySnapshot.docs[0].id;
        setProduct(prodData);
        if (prodData.colors.length > 0) setSelectedColor(prodData.colors[0]);
        if (prodData.sizes.length > 0) setSelectedSize(prodData.sizes[0]);
      }
    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء البحث عن الموديل");
    } finally {
      setLoading(false);
    }
  };

  const addToCart = () => {
    if (!product) return;
    
    const cartItem = {
      ...product,
      selectedColor,
      selectedSize,
      cartItemId: Date.now().toString()
    };
    
    const existingCart = JSON.parse(localStorage.getItem("happyboy_cart") || "[]");
    existingCart.push(cartItem);
    localStorage.setItem("happyboy_cart", JSON.stringify(existingCart));
    
    alert("تم إضافة القطعة للفاتورة!");
    router.push("/cart");
  };

  return (
    <div className="animate-fade-in flex flex-col items-center mt-6">
      <div className="card w-full" style={{ maxWidth: "500px" }}>
        <h2 className="text-center mb-6" style={{ color: "var(--primary)" }}>
          📷 مسح باركود الموديل
        </h2>
        
        {!scannedResult ? (
          <div>
            <p className="text-center mb-4">قم بتوجيه الكاميرا نحو باركود الموديل لإضافته لفاتورتك.</p>
            <div id="reader" style={{ width: "100%", borderRadius: "var(--radius-md)", overflow: "hidden" }}></div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {loading ? (
              <p className="text-center">جاري البحث في المخزن...</p>
            ) : error ? (
              <div className="text-center text-red-500 font-bold">{error}</div>
            ) : product ? (
              <div className="flex flex-col gap-4">
                <div className="p-4" style={{ background: "var(--surface-hover)", borderRadius: "var(--radius-md)" }}>
                  <h3 className="text-xl">{product.name}</h3>
                  <p className="font-bold text-lg" style={{ color: "var(--primary)" }}>السعر: {product.price} ج.م</p>
                </div>
                
                <div>
                  <label className="block mb-2 font-bold">اختر اللون:</label>
                  <div className="flex gap-2 flex-wrap">
                    {product.colors.map(color => (
                      <button 
                        key={color} 
                        onClick={() => setSelectedColor(color)}
                        className={`btn ${selectedColor === color ? 'btn-primary' : 'btn-outline'}`}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block mb-2 font-bold">اختر المقاس:</label>
                  <div className="flex gap-2 flex-wrap">
                    {product.sizes.map(size => (
                      <button 
                        key={size} 
                        onClick={() => setSelectedSize(size)}
                        className={`btn ${selectedSize === size ? 'btn-primary' : 'btn-outline'}`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
                
                <button onClick={addToCart} className="btn btn-secondary w-full mt-4">
                  إضافة للفاتورة
                </button>
              </div>
            ) : null}
            
            <hr style={{ borderTop: "1px solid var(--border)", margin: "1rem 0" }} />
            
            <button 
              className="btn btn-outline w-full"
              onClick={() => {
                setScannedResult(null);
                setProduct(null);
                window.location.reload();
              }}
            >
              مسح باركود آخر
            </button>
            
            <button 
              className="btn btn-primary w-full mt-2"
              onClick={() => router.push("/cart")}
            >
              الذهاب إلى الفاتورة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
