"use client";

import { useEffect, useState } from "react";
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

const playBeep = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

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

export default function PriceCheckPage() {
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [searchModel, setSearchModel] = useState("");
  const router = useRouter();

  useEffect(() => {
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

  async function handleScanSuccess(barcode: string, scanner: any) {
    playBeep();
    if (scanner) scanner.pause(true);
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
        setProduct(prodData);
      }
    } catch (err) {
      console.error(err);
      setError("حدث خطأ في الاتصال بقاعدة البيانات");
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = async () => {
    if (!searchModel.trim()) return;
    
    setLoading(true);
    setError("");
    setScannedResult(searchModel);
    
    try {
      let q = query(collection(db, "products"), where("modelNumber", "==", searchModel.trim()));
      let querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        q = query(collection(db, "products"), where("barcodes", "array-contains", searchModel.trim()));
        querySnapshot = await getDocs(q);
      }

      if (querySnapshot.empty) {
        setError("لم يتم العثور على أي منتج بهذا الرقم (كموديل أو باركود)");
      } else {
        const prodData = querySnapshot.docs[0].data() as Product;
        prodData.id = querySnapshot.docs[0].id;
        setProduct(prodData);
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
      <div className="card w-full" style={{ maxWidth: "500px" }}>
        <h2 className="text-center mb-6" style={{ color: "var(--primary)" }}>
          💰 استعلام عن السعر
        </h2>
        
        {!scannedResult ? (
          <div>
            <p className="text-center mb-4">قم بتوجيه الكاميرا نحو الباركود أو ابحث برقم الموديل.</p>
            <div id="reader" style={{ width: "100%", borderRadius: "var(--radius-md)", overflow: "hidden" }}></div>
            
            <div className="mt-6 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  placeholder="ابحث برقم الموديل أو الباركود" 
                  className="input flex-1"
                  value={searchModel}
                  onChange={(e) => setSearchModel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                  style={{ padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}
                />
                <button className="btn btn-primary px-6" onClick={handleManualSearch}>بحث</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {loading ? (
              <p className="text-center">جاري البحث...</p>
            ) : error ? (
              <div className="text-center text-red-500 font-bold">{error}</div>
            ) : product ? (
              <div className="flex flex-col gap-4 text-center">
                <div className="p-6" style={{ background: "var(--surface-hover)", borderRadius: "var(--radius-md)" }}>
                  <h3 className="text-2xl mb-2 font-bold">{product.name}</h3>
                  <p className="text-lg mb-4 text-gray-500">موديل: {product.modelNumber}</p>
                  <div className="text-4xl font-bold py-4 px-6 rounded-lg inline-block" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                    {product.price} ج.م
                  </div>
                </div>
                
                {product.colors && product.colors.length > 0 && (
                  <div className="p-4 text-right" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
                    <h4 className="font-bold mb-3" style={{ color: "var(--primary)" }}>🎨 الألوان المتاحة للموديل:</h4>
                    <div className="flex flex-col gap-2">
                      {Array.from(new Set(product.colors.map(c => c.name.trim().replace(/ى/g, 'ي').replace(/ة/g, 'ه')))).map((colorName, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3" style={{ background: "var(--background)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                          <span className="font-bold text-lg">{colorName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
            
            <hr style={{ borderTop: "1px solid var(--border)", margin: "1rem 0" }} />
            
            <button 
              className="btn btn-primary w-full py-3 text-lg"
              onClick={() => {
                setScannedResult(null);
                setProduct(null);
                setError("");
                setSearchModel("");
                setTimeout(() => window.location.reload(), 100);
              }}
            >
              استعلام جديد 🔍
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
