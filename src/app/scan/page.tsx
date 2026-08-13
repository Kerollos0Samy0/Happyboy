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
      const q = query(collection(db, "products"), where("barcodes", "array-contains", barcode));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError("لم يتم العثور على أي منتج بهذا الباركود");
      } else {
        const prodData = querySnapshot.docs[0].data() as Product;
        prodData.id = querySnapshot.docs[0].id;
        
        // Find which color matched
        const matched = prodData.colors.find(c => c.barcode === barcode) || prodData.colors[0];
        
        setProduct(prodData);
        setMatchedColor(matched);
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

  const handleAddMatchedColorOnly = () => {
    if (!matchedColor) return;
    addColorToCart(matchedColor);
    alert("تمت إضافة اللون للفاتورة بنجاح!");
    router.push("/cart");
  };

  const handleAddAllColors = () => {
    if (!product) return;
    product.colors.forEach(color => {
      addColorToCart(color);
    });
    alert("تمت إضافة الموديل بكل ألوانه للفاتورة!");
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
                  <p className="text-sm mt-1 text-gray-500">تم مسح باركود اللون: <strong>{matchedColor.name}</strong></p>
                  <p className="font-bold text-lg mt-2" style={{ color: "var(--primary)" }}>سعر القطعة: {product.price} ج.م</p>
                  <p className="text-sm">هذا الموديل يباع بالثري (المقاسات: {product.sizes.join(", ")})</p>
                </div>
                
                <button onClick={handleAddMatchedColorOnly} className="btn btn-secondary w-full py-4 text-lg">
                  إضافة لون ({matchedColor.name}) فقط
                </button>
                
                <button onClick={handleAddAllColors} className="btn btn-primary w-full py-4 text-lg mt-2">
                  إضافة الموديل بكل ألوانه ({product.colors.length} ألوان)
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
