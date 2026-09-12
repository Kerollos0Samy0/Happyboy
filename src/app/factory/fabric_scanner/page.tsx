"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FabricScannerPage() {
  const router = useRouter();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          📦 شاشة إسكان الأتواب (مخزن القماش)
        </h1>
        <button 
          onClick={() => router.back()}
          className="btn bg-gray-200 text-gray-700 font-bold px-4 py-2 rounded-lg"
        >
          رجوع
        </button>
      </div>

      <div className="card w-full bg-white shadow-sm p-8 rounded-xl border-t-4 border-t-primary text-center">
        <h2 className="text-xl mb-4 font-bold">جاري برمجة وتجهيز هذه الشاشة 🚧</h2>
        <p className="text-gray-500 mb-6">
          ستحتوي هذه الشاشة على نظام لقراءة باركود أتواب القماش وربطها بأوامر الشغل وخصم الكميات من الرصيد.
        </p>
      </div>
    </div>
  );
}
