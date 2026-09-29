"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, Zap, ZapOff } from 'lucide-react';

interface CameraScannerProps {
  onScan: (decodedText: string) => void;
  onClose?: () => void;
  title?: string;
}

export default function CameraScanner({ onScan, onClose, title = "مسح بالكاميرا" }: CameraScannerProps) {
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (isScannerActive) {
      let isMounted = true;
      const html5QrCode = new Html5Qrcode("qr-reader-shared");
      html5QrCodeRef.current = html5QrCode;

      const startScanner = async () => {
        try {
          await html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            (decodedText) => {
              if (isMounted) {
                stopScanner();
                setIsScannerActive(false);
                onScan(decodedText);
              }
            },
            (errorMessage) => {
              // Parse errors are expected frequently, do not log
            }
          );

          if (isMounted) {
            // Check if torch is supported
            const capabilities = html5QrCode.getRunningTrackCameraCapabilities();
            if (capabilities && capabilities.hasTorch) {
              setHasTorch(true);
            }
          }
        } catch (err) {
          console.error("Error starting scanner:", err);
        }
      };

      const stopScanner = () => {
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop().catch(console.error);
        }
      };

      // We add a tiny delay to ensure the DOM element is ready
      setTimeout(() => {
        if (isMounted) startScanner();
      }, 100);

      return () => {
        isMounted = false;
        stopScanner();
        html5QrCode.clear();
      };
    }
  }, [isScannerActive, onScan]);

  const toggleTorch = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        const newTorchState = !isTorchOn;
        await html5QrCodeRef.current.applyVideoConstraints({
          advanced: [{ torch: newTorchState }]
        });
        setIsTorchOn(newTorchState);
      } catch (err) {
        console.error("Failed to toggle torch:", err);
      }
    }
  };

  if (!isScannerActive) {
    return (
      <button 
        onClick={(e) => { e.preventDefault(); setIsScannerActive(true); }}
        className="flex items-center justify-center gap-2 bg-blue-100 hover:bg-blue-200 text-blue-700 py-3 px-4 rounded-xl border border-blue-300 font-bold w-full transition shadow-sm"
        type="button"
      >
        <Camera size={20} />
        {title}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl relative flex flex-col">
        <div className="flex justify-between items-center bg-blue-600 text-white p-4">
          <h3 className="font-bold">{title}</h3>
          <div className="flex items-center gap-2">
            {hasTorch && (
              <button 
                onClick={toggleTorch} 
                className="p-2 bg-blue-700 hover:bg-blue-800 rounded-lg transition"
                type="button"
                title="تشغيل الفلاش"
              >
                {isTorchOn ? <Zap size={20} className="text-yellow-400" /> : <ZapOff size={20} />}
              </button>
            )}
            <button 
              onClick={() => {
                setIsScannerActive(false);
                if (onClose) onClose();
              }} 
              className="p-2 hover:bg-white/20 rounded-lg transition"
              type="button"
            >
              <X size={24} />
            </button>
          </div>
        </div>
        <div className="p-4 bg-gray-50 flex-1 relative">
          <div id="qr-reader-shared" className="qr-reader-container w-full overflow-hidden rounded-xl shadow-inner bg-black min-h-[300px]"></div>
        </div>
        <div className="p-4 bg-white text-center border-t text-sm text-gray-500">
          قم بتوجيه الكاميرا نحو الباركود أو الـ QR Code ليتم القراءة تلقائياً
        </div>
      </div>
    </div>
  );
}
