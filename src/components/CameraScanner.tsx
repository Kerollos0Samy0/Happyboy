"use client";

import React, { useState, useEffect } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { Camera, X } from 'lucide-react';

interface CameraScannerProps {
  onScan: (decodedText: string) => void;
  onClose?: () => void;
  title?: string;
}

export default function CameraScanner({ onScan, onClose, title = "مسح بالكاميرا" }: CameraScannerProps) {
  const [isScannerActive, setIsScannerActive] = useState(false);

  useEffect(() => {
    if (isScannerActive) {
      setTimeout(() => {
        try {
          const scanner = new Html5QrcodeScanner(
            "qr-reader-shared",
            { 
              fps: 10, 
              qrbox: { width: 250, height: 250 },
              supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
            },
            false
          );
          
          scanner.render(
            (decodedText) => {
              scanner.clear(); // stop scanning once found
              setIsScannerActive(false);
              onScan(decodedText);
            },
            (error) => {}
          );
          
          return () => {
            scanner.clear().catch(e => console.error("Failed to clear scanner", e));
          };
        } catch (err) {
          console.error("Scanner setup error:", err);
        }
      }, 100);
    }
  }, [isScannerActive, onScan]);

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
          <button 
            onClick={() => {
              setIsScannerActive(false);
              if (onClose) onClose();
            }} 
            className="p-1 hover:bg-white/20 rounded-lg transition"
            type="button"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-4 bg-gray-50 flex-1">
          <div id="qr-reader-shared" className="qr-reader-container w-full overflow-hidden rounded-xl shadow-inner bg-black"></div>
        </div>
        <div className="p-4 bg-white text-center border-t text-sm text-gray-500">
          قم بتوجيه الكاميرا نحو الباركود أو الـ QR Code ليتم القراءة تلقائياً
        </div>
      </div>
    </div>
  );
}
