"use client";

import React, { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Scissors, Printer, PlusCircle, CheckCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react'; // qrcode.react is installed according to package.json

type Bundle = {
  id: string;
  bundleCode: string;
  modelNumber: string;
  color: string;
  size: string;
  quantity: number;
};

export default function CuttingDepartmentPage() {
  const [modelNumber, setModelNumber] = useState('');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [totalQty, setTotalQty] = useState('');
  const [bundleSize, setBundleSize] = useState('50');
  
  const [generatedBundles, setGeneratedBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelNumber || !totalQty || !bundleSize) return;

    setLoading(true);
    setSuccess('');
    
    try {
      const total = parseInt(totalQty);
      const bSize = parseInt(bundleSize);
      
      const numBundles = Math.ceil(total / bSize);
      const newBundles: Bundle[] = [];
      const timestampId = Date.now().toString().slice(-6);

      for (let i = 0; i < numBundles; i++) {
        let qtyForThisBundle = bSize;
        if (i === numBundles - 1 && total % bSize !== 0) {
          qtyForThisBundle = total % bSize;
        }

        const bundleCode = `BNDL-${modelNumber}-${timestampId}-${i + 1}`;
        
        // Save to Firestore
        await addDoc(collection(db, 'factory_production_orders'), {
          bundleCode,
          modelNumber,
          color: color || 'متعدد',
          size: size || 'متعدد',
          totalQuantity: qtyForThisBundle,
          currentStage: 1, // Stage 1 is typical start (or adjust based on stages list)
          currentLocation: 'cutting', // Initial location
          createdAt: serverTimestamp(),
          history: [
            {
              stageId: 1,
              stageName: 'توليد القص',
              workerName: 'قسم القص',
              timestamp: new Date().toISOString(),
              quantity: qtyForThisBundle
            }
          ]
        });

        newBundles.push({
          id: bundleCode,
          bundleCode,
          modelNumber,
          color,
          size,
          quantity: qtyForThisBundle
        });
      }

      setGeneratedBundles(newBundles);
      setSuccess(`تم توليد وحفظ ${numBundles} تيكت للطباعة بنجاح.`);
      // Reset form
      setModelNumber('');
      setColor('');
      setSize('');
      setTotalQty('');
      
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ أوامر الشغل.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto pb-20" dir="rtl">
      
      {/* Hide form during printing */}
      <div className="print:hidden bg-white p-6 rounded-xl shadow-sm border-t-4 border-blue-500 mb-8">
        <div className="flex items-center gap-2 mb-6 border-b pb-4">
          <Scissors className="text-blue-600" size={24} />
          <h1 className="text-2xl font-bold text-gray-800">إصدار أوامر تشغيل (قسم القص)</h1>
        </div>

        {success && (
          <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 flex items-center gap-2 font-bold">
            <CheckCircle size={20} />
            {success}
          </div>
        )}

        <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">رقم الموديل *</label>
            <input 
              type="text" 
              required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={modelNumber}
              onChange={e => setModelNumber(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">اللون</label>
            <input 
              type="text" 
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={color}
              onChange={e => setColor(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">المقاس</label>
            <input 
              type="text" 
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={size}
              onChange={e => setSize(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">إجمالي الكمية المطلوبة *</label>
            <input 
              type="number" 
              required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={totalQty}
              onChange={e => setTotalQty(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">كمية السلة/الربطة الواحدة *</label>
            <input 
              type="number" 
              required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold"
              value={bundleSize}
              onChange={e => setBundleSize(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 disabled:opacity-50"
            >
              <PlusCircle size={20} />
              {loading ? 'جاري التوليد...' : 'توليد تيكتات الـ QR'}
            </button>
          </div>
        </form>
      </div>

      {/* Printable Area */}
      {generatedBundles.length > 0 && (
        <div>
          <div className="print:hidden flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-700">التيكتات الجاهزة للطباعة ({generatedBundles.length})</h2>
            <button 
              onClick={handlePrint}
              className="bg-gray-800 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-bold hover:bg-gray-900"
            >
              <Printer size={18} /> طباعة التيكتات
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 print:grid-cols-2 print:gap-2">
            {generatedBundles.map((bundle, idx) => (
              <div key={bundle.id} className="border-2 border-black p-4 rounded-lg bg-white flex flex-col items-center justify-center text-center print:border-dashed">
                <div className="mb-2 w-full flex justify-between text-xs font-bold border-b border-gray-300 pb-2">
                  <span>موديل: {bundle.modelNumber}</span>
                  <span>سلة: {idx + 1}/{generatedBundles.length}</span>
                </div>
                
                <QRCodeSVG value={bundle.bundleCode} size={100} className="my-3" />
                
                <div className="text-lg font-black mt-2">
                  {bundle.quantity} قطعة
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  اللون: {bundle.color || '---'} | المقاس: {bundle.size || '---'}
                </div>
                <div className="text-[10px] text-gray-400 mt-3 tracking-wider">
                  {bundle.bundleCode}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
