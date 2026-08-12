"use client";

import { useEffect, useState } from "react";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";

export default function ScanPage() {
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  
  useEffect(() => {
    // Prevent multiple initializations in React strict mode
    const scannerElement = document.getElementById("reader");
    if (!scannerElement) return;
    
    // Check if scanner was already initialized
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
        setScannedResult(decodedText);
        // We can pause the scanner or stop it after a successful scan
        scanner.pause(true);
      },
      (error) => {
        // Handle scan errors silently
      }
    );

    return () => {
      scanner.clear().catch(console.error);
    };
  }, []);

  return (
    <div className="animate-fade-in flex flex-col items-center">
      <div className="card w-full" style={{ maxWidth: "500px" }}>
        <h2 className="text-center mb-6" style={{ color: "var(--primary)" }}>
          📷 مسح باركود الموديل
        </h2>
        
        {!scannedResult ? (
          <div>
            <p className="text-center mb-4">قم بتوجيه الكاميرا نحو باركود الموديل للبحث عنه في المخزن.</p>
            <div id="reader" style={{ width: "100%", borderRadius: "var(--radius-md)", overflow: "hidden" }}></div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="p-4" style={{ background: "var(--success)", color: "white", borderRadius: "var(--radius-md)", width: "100%", textAlign: "center" }}>
              ✅ تم التقاط الباركود بنجاح!
            </div>
            
            <p className="font-bold text-center">الباركود المقروء: {scannedResult}</p>
            
            <hr style={{ width: "100%", border: "none", borderTop: "1px solid var(--border)", margin: "1rem 0" }} />
            
            <h3 className="w-full text-right">جاري البحث عن الموديل...</h3>
            <p className="text-right w-full">هنا ستظهر تفاصيل الموديل (الصور، الألوان، المقاسات المتاحة) بمجرد ربط النظام بقاعدة البيانات.</p>
            
            <button 
              className="btn btn-outline mt-4 w-full"
              onClick={() => {
                setScannedResult(null);
                window.location.reload(); // Simple way to reset for now
              }}
            >
              مسح باركود آخر
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
