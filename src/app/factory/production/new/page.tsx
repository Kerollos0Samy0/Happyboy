"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../../lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy, updateDoc, doc, limit } from 'firebase/firestore';
import { Image as ImageIcon, CheckCircle, AlertCircle, ArrowRight, Printer, Plus, Minus } from 'lucide-react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';

const colorCodes: Record<string, string> = {
  'أسود': 'BK', 'أبيض': 'WH', 'كحلي': 'NV', 'رمادي': 'GR', 'أحمر': 'RD',
  'أصفر': 'YL', 'أخضر': 'GN', 'زيتي': 'OL', 'أزرق زهرى': 'RB', 'كشمير': 'CS',
  'بيج': 'BG', 'بني': 'BR', 'برتقالي': 'OR', 'بينك': 'PK', 'لبني': 'LB', 'نبيتي': 'MR'
};

const colorHexMap: Record<string, string> = {
  'أسود': '#000000', 'أبيض': '#FFFFFF', 'كحلي': '#000080', 'رمادي': '#808080', 'أحمر': '#FF0000',
  'أصفر': '#FFFF00', 'أخضر': '#008000', 'زيتي': '#556B2F', 'أزرق زهرى': '#4169E1', 'كشمير': '#D1B2A1',
  'بيج': '#F5F5DC', 'بني': '#8B4513', 'برتقالي': '#FFA500', 'بينك': '#FFC0CB', 'لبني': '#ADD8E6', 'نبيتي': '#800000'
};

export default function NewProductionOrderPage() {
  const router = useRouter();
  
  const [modelName, setModelName] = useState('');
  const [totalQuantity, setTotalQuantity] = useState('');
  const [fabricType, setFabricType] = useState('');
  const [sizesSeries, setSizesSeries] = useState('');
  
  // Dynamic color pairs array (now includes quantity and rollsCount)
  const [colorPairs, setColorPairs] = useState([{ tshirt: '', pants: '', quantity: '', tRolls: '', pRolls: '' }]);
  
  const [fabricSupplier, setFabricSupplier] = useState('');
  
  const [cuttingNotes, setCuttingNotes] = useState('');
  const [printingType, setPrintingType] = useState('');
  const [printingDetails, setPrintingDetails] = useState('');
  const [pressingNotes, setPressingNotes] = useState('');
  const [pairingNotes, setPairingNotes] = useState('');
  const [sewingNotes, setSewingNotes] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');

  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedOrderId, setGeneratedOrderId] = useState<string | null>(null);

  // Auto-calculate total quantity based on colors
  useEffect(() => {
    const calculatedTotal = colorPairs.reduce((sum, pair) => {
      let multiplier = 0;
      if (pair.tshirt && pair.tshirt.trim() !== '') multiplier++;
      if (pair.pants && pair.pants.trim() !== '') multiplier++;
      if (multiplier === 0) multiplier = 1;
      return sum + ((Number(pair.quantity) || 0) * multiplier);
    }, 0);
    
    if (calculatedTotal > 0 || colorPairs.length > 0) {
      setTotalQuantity(calculatedTotal.toString());
    }
  }, [colorPairs]);

  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setImageBase64(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          processImageFile(file);
        }
      }
    };
    
    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelName || !totalQuantity || !imageBase64) {
      setError('يجب إدخال اسم الموديل، الكمية، ورفع صورة الموديل.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const validPairs = colorPairs.filter(p => p.tshirt.trim() || p.pants.trim());
      const tColors = validPairs.length > 0 ? validPairs.map(p => p.tshirt) : [''];
      const pColors = validPairs.length > 0 ? validPairs.map(p => p.pants) : [''];
      
      const allColors = validPairs.map(p => {
        let name = '';
        if (p.tshirt && p.pants) name = `${p.tshirt} مع ${p.pants}`;
        else name = p.tshirt || p.pants;
        return p.quantity ? `${name} (${p.quantity}ق)` : name;
      }).filter(c => c).join('، ');

      // Request and deduct rolls for each color
      const usedRollsData: any[] = [];
      const allRollsToDeduct: any[] = [];

      for (const pair of validPairs) {
        // Fetch for Tshirt color
        if (pair.tshirt && Number(pair.tRolls) > 0) {
          const tCount = Number(pair.tRolls);
          const qT = query(collection(db, 'factory_fabric_rolls'), where('color', '==', pair.tshirt), where('status', '==', 'in_stock'));
          const snapT = await getDocs(qT);
          let docsT = snapT.docs.map(d => ({id: d.id, ...d.data() as any}));
          docsT.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?._seconds ? a.createdAt._seconds * 1000 : 0);
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?._seconds ? b.createdAt._seconds * 1000 : 0);
            return timeA - timeB; // Oldest first
          });
          
          const selectedT = docsT.slice(0, tCount);
          selectedT.forEach(r => {
            usedRollsData.push({ ...r, usedFor: 'tshirt' });
            allRollsToDeduct.push(r.id);
          });
        }
        
        // Fetch for Pants color
        if (pair.pants && Number(pair.pRolls) > 0) {
          const pCount = Number(pair.pRolls);
          const qP = query(collection(db, 'factory_fabric_rolls'), where('color', '==', pair.pants), where('status', '==', 'in_stock'));
          const snapP = await getDocs(qP);
          let docsP = snapP.docs.map(d => ({id: d.id, ...d.data() as any}));
          docsP.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?._seconds ? a.createdAt._seconds * 1000 : 0);
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?._seconds ? b.createdAt._seconds * 1000 : 0);
            return timeA - timeB; // Oldest first
          });
          
          // Filter out rolls already selected in this same request to avoid duplicates
          docsP = docsP.filter(r => !allRollsToDeduct.includes(r.id));
          const selectedP = docsP.slice(0, pCount);
          
          selectedP.forEach(r => {
            usedRollsData.push({ ...r, usedFor: 'pants' });
            allRollsToDeduct.push(r.id);
          });
        }
      }

      // Mark the selected rolls as used
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);

      const orderData = {
        modelName,
        totalQuantity: Number(totalQuantity),
        fabricType,
        sizesSeries,
        tshirtColors: tColors,
        pantsColors: pColors,
        colorPairs: validPairs,
        fabricColor: allColors,
        fabricSupplier,
        cuttingNotes,
        printingType,
        printingDetails,
        pressingNotes,
        pairingNotes,
        sewingNotes,
        generalNotes,
        modelImage: imageBase64,
        used_rolls: usedRollsData,
        currentStage: 1,
        status: 'قيد التنفيذ',
        createdAt: serverTimestamp(),
      };

      const newOrderRef = doc(collection(db, 'factory_production_orders'));
      batch.set(newOrderRef, orderData);

      for (const rollId of allRollsToDeduct) {
        batch.update(doc(db, 'factory_fabric_rolls', rollId), {
          status: 'used',
          usedAt: serverTimestamp(),
          usedInOrder: newOrderRef.id
        });
      }

      await batch.commit();
      
      setGeneratedOrderId(newOrderRef.id);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'حدث خطأ غير متوقع أثناء الحفظ.');
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (generatedOrderId) {
    const validPairs = colorPairs.filter(p => p.tshirt.trim() || p.pants.trim());
    const tColors = validPairs.length > 0 ? validPairs.map(p => p.tshirt) : [''];
    const pColors = validPairs.length > 0 ? validPairs.map(p => p.pants) : [''];
    
    return (
      <div className="max-w-4xl mx-auto space-y-4 pb-20" dir="rtl">
        <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm print:hidden">
          <p className="text-green-600 font-bold flex items-center gap-2"><CheckCircle /> تم الحفظ بنجاح!</p>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2">
              <Printer size={18} /> طباعة أمر التشغيل
            </button>
            <Link href="/factory/production" className="bg-gray-200 text-gray-800 px-4 py-2 rounded">
              العودة للوحة
            </Link>
          </div>
        </div>

        <div className="bg-white p-8 shadow-lg print:shadow-none print:p-8 w-full mx-auto flex flex-col" style={{ minHeight: '297mm' }}>
          
          <div className="border-4 border-gray-800 p-4 mb-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <h1 className="text-3xl font-black mb-2 text-gray-900">أمر تشغيل مصنع (رئيسي)</h1>
                  <div className="flex flex-col items-center justify-center">
                    <Barcode value={generatedOrderId} width={1.5} height={40} displayValue={true} fontSize={12} margin={0} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 text-lg">
                  <div className="font-bold border-b border-gray-300 pb-1">الموديل: <span className="font-normal">{modelName}</span></div>
                  <div className="font-bold border-b border-gray-300 pb-1">التصنيف: <span className="font-normal">{sizesSeries}</span></div>
                  <div className="font-bold border-b border-gray-300 pb-1">الكمية: <span className="font-normal">{totalQuantity} قطعة</span></div>
                  <div className="font-bold border-b border-gray-300 pb-1">التاريخ: <span className="font-normal">{new Date().toLocaleDateString('ar-EG')}</span></div>
                </div>
              </div>
              
              <div className="w-32 flex flex-col items-center border-r-2 pr-4 ml-4">
                <QRCodeSVG value={typeof window !== 'undefined' ? `${window.location.origin}/public/order/${generatedOrderId}` : ''} size={100} />
                <span className="text-xs font-mono mt-2">{generatedOrderId.slice(-6).toUpperCase()}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-6 flex-1">
            <div className="w-1/3 flex flex-col">
            <div className="border-2 border-gray-400 h-64 relative flex items-center justify-center p-2 mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {imageBase64 ? <img src={imageBase64} alt="Model" className="w-full h-full object-contain" /> : <div className="text-gray-400">لا توجد صورة</div>}
            </div>
            <div className="border border-gray-400 p-2 bg-gray-50 flex-1 flex flex-col">
                <h3 className="font-bold border-b pb-1 mb-2 text-lg">مخزن القماش</h3>
                <p className="text-sm mb-2"><strong>النوع:</strong> {fabricType || '---'}</p>
                <p className="text-sm mb-2"><strong>المورد:</strong> {fabricSupplier || '---'}</p>
                <p className="text-sm mb-2"><strong>الكمية (كجم/توب):</strong> .....................</p>
                <p className="text-sm mb-2"><strong>استهلاك القطعة:</strong> .....................</p>
                
                <div className="grid grid-cols-2 gap-4 mt-auto pt-4 justify-items-center">
                  {[...Array(Math.max(tColors.length, pColors.length, 1))].map((_, i) => {
                    const pair = validPairs[i];
                    const qtyText = pair?.quantity ? ` (${pair.quantity}ق)` : '';
                    return (
                      <React.Fragment key={i}>
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-[2cm] h-[2cm] border-2 border-gray-400 bg-white shadow-sm" style={{ backgroundColor: tColors[i] ? colorHexMap[tColors[i]] : 'white', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}></div>
                          <span className="text-xs font-bold text-gray-800 text-center">{tColors[i] ? `تيشيرت ${tColors[i]}${qtyText}` : 'تيشيرت'}</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-[2cm] h-[2cm] border-2 border-gray-400 bg-white shadow-sm" style={{ backgroundColor: pColors[i] ? colorHexMap[pColors[i]] : 'white', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}></div>
                          <span className="text-xs font-bold text-gray-800 text-center">{pColors[i] ? `بنطلون ${pColors[i]}${qtyText}` : 'بنطلون'}</span>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="w-2/3 grid grid-cols-2 gap-2 h-fit">
            <div className="border border-gray-400 p-2 flex flex-col col-span-2">
              <h3 className="font-bold border-b border-gray-300 pb-1 mb-2 bg-gray-100 px-1 text-md">✂️ قسم القص</h3>
              <div className="flex flex-col gap-1 mb-1 border-b border-dashed border-gray-300 pb-1">
                <p className="text-sm font-bold text-red-700">المقاسات: {sizesSeries || '---'}</p>
                <p className="text-sm font-bold text-blue-700">الكمية: {totalQuantity}</p>
              </div>
              <div className="mb-1 border-b border-dashed border-gray-300 pb-2 mt-2">
                <table className="w-full text-center text-xs border-collapse border border-gray-400">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-400 p-1">التيشيرت</th>
                      <th className="border border-gray-400 p-1">البنطلون</th>
                      <th className="border border-gray-400 p-1">الكمية</th>
                      <th className="border border-gray-400 p-1">المقاس الواحد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {colorPairs?.filter((p: any) => p.quantity).map((pair: any, idx: number) => (
                      <tr key={idx}>
                        <td className="border border-gray-400 p-1">{pair.tshirt}</td>
                        <td className="border border-gray-400 p-1">{pair.pants}</td>
                        <td className="border border-gray-400 p-1">{pair.quantity}</td>
                        <td className="border border-gray-400 p-1">{pair.quantity / 4}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-bold">
                      <td className="border border-gray-400 p-1" colSpan={2}>الإجمالي</td>
                      <td className="border border-gray-400 p-1 text-center" colSpan={2}>{totalQuantity} قطعة</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm min-h-[30px] whitespace-pre-wrap">{cuttingNotes || '---'}</p>
            </div>



              <div className="border border-gray-400 p-3 flex flex-col col-span-2">
                <div className="flex justify-between items-center border-b border-gray-300 pb-1 mb-2 bg-gray-100 px-1">
                  <h3 className="font-bold text-lg">🧵 قسم المكن (التقفيل)</h3>
                </div>
                <p className="text-sm mb-2 whitespace-pre-wrap">{sewingNotes || 'ملاحظات المكن:'}</p>
                
                <div className="flex flex-col gap-4">
                  <table className="w-full text-center border-collapse border border-gray-400 text-xs">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-400 p-1 font-bold w-1/4">التيشيرت</th>
                        <th className="border border-gray-400 p-1 font-bold w-8">{sizesSeries?.match(/[\d-]+/)?.[0]?.split('-')[0] || ''}</th>
                        <th className="border border-gray-400 p-1 font-bold w-8">{sizesSeries?.match(/[\d-]+/)?.[0]?.split('-')[1] || ''}</th>
                        <th className="border border-gray-400 p-1 font-bold w-8">{sizesSeries?.match(/[\d-]+/)?.[0]?.split('-')[2] || ''}</th>
                        <th className="border border-gray-400 p-1 font-bold w-8">{sizesSeries?.match(/[\d-]+/)?.[0]?.split('-')[3] || ''}</th>
                        <th className="border border-gray-400 p-1 font-bold w-1/4">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {colorPairs.map((p, i) => p.tshirt ? (
                        <tr key={i}>
                          <td className="border border-gray-400 p-1 font-bold bg-gray-50">{p.tshirt}</td>
                          <td className="border border-gray-400 p-1"></td><td className="border border-gray-400 p-1"></td><td className="border border-gray-400 p-1"></td><td className="border border-gray-400 p-1"></td><td className="border border-gray-400 p-1"></td>
                        </tr>
                      ) : null)}
                      <tr><td className="border border-gray-400 p-1 bg-gray-50 h-5"></td><td className="border border-gray-400 p-1"></td><td className="border border-gray-400 p-1"></td><td className="border border-gray-400 p-1"></td><td className="border border-gray-400 p-1"></td><td className="border border-gray-400 p-1"></td></tr>
                    </tbody>
                  </table>

                  <table className="w-full text-center border-collapse border border-gray-400 text-xs">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-400 p-1 font-bold w-1/4">البنطلون</th>
                        <th className="border border-gray-400 p-1 font-bold w-8">{sizesSeries?.match(/[\d-]+/)?.[0]?.split('-')[0] || ''}</th>
                        <th className="border border-gray-400 p-1 font-bold w-8">{sizesSeries?.match(/[\d-]+/)?.[0]?.split('-')[1] || ''}</th>
                        <th className="border border-gray-400 p-1 font-bold w-8">{sizesSeries?.match(/[\d-]+/)?.[0]?.split('-')[2] || ''}</th>
                        <th className="border border-gray-400 p-1 font-bold w-8">{sizesSeries?.match(/[\d-]+/)?.[0]?.split('-')[3] || ''}</th>
                        <th className="border border-gray-400 p-1 font-bold w-1/4">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {colorPairs.map((p, i) => p.pants ? (
                        <tr key={i}>
                          <td className="border border-gray-400 p-1 font-bold bg-gray-50">{p.pants}</td>
                          <td className="border border-gray-400 p-1"></td><td className="border border-gray-400 p-1"></td><td className="border border-gray-400 p-1"></td><td className="border border-gray-400 p-1"></td><td className="border border-gray-400 p-1"></td>
                        </tr>
                      ) : null)}
                      <tr><td className="border border-gray-400 p-1 bg-gray-50 h-5"></td><td className="border border-gray-400 p-1"></td><td className="border border-gray-400 p-1"></td><td className="border border-gray-400 p-1"></td><td className="border border-gray-400 p-1"></td><td className="border border-gray-400 p-1"></td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="border border-gray-400 p-2 col-span-2 flex flex-col">
                <h3 className="font-bold border-b border-gray-300 pb-1 mb-1 bg-gray-100 px-1 text-md">📝 ملاحظات عامة (تشطيب، مكواة، تعبئة)</h3>
                <p className="text-sm min-h-[50px] whitespace-pre-wrap">{generalNotes || '---'}</p>
              </div>
            </div>
          </div>
          

        </div>
        
        <style jsx global>{`
          @media print {
            @page {
              margin: 0;
            }
            body {
              margin: 1cm;
            }
            body * {
              visibility: hidden;
            }
            .print\\:shadow-none {
              box-shadow: none !important;
            }
            .print\\:p-0 {
              padding: 0 !important;
            }
            .print\\:hidden {
              display: none !important;
            }
            .max-w-4xl > div:nth-child(2), .max-w-4xl > div:nth-child(2) * {
              visibility: visible;
            }
            .max-w-4xl > div:nth-child(2) {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              box-sizing: border-box;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 print:hidden" dir="rtl">
      <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow-sm border-r-4 border-blue-500">
        <Link href="/factory/dashboard" className="p-2 hover:bg-gray-100 rounded-full transition">
          <ArrowRight size={24} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">إصدار أمر تشغيل جديد</h1>
          <p className="text-sm text-gray-500 mt-1">قم بتعبئة بيانات الأقسام لإصدار وطباعة ورقة أمر التشغيل (A4).</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-r-4 border-red-500 p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="text-red-500 mt-0.5" size={20} />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="md:col-span-1 bg-white p-6 rounded-lg shadow-sm h-fit sticky top-24">
            <label className="block text-sm font-bold text-gray-700 mb-2">صورة الموديل المرجعية *</label>
            <div className={`border-2 border-dashed rounded-xl h-72 flex flex-col items-center justify-center relative overflow-hidden transition ${imageBase64 ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}>
              
              {imageBase64 ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageBase64} alt="Model Preview" className="absolute inset-0 w-full h-full object-contain p-2" />
                  <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition">
                    <span className="text-white font-bold">تغيير الصورة</span>
                  </div>
                </>
              ) : (
                <div className="text-center p-6">
                  <ImageIcon size={48} className="mx-auto text-gray-400 mb-3" />
                  <p className="text-sm font-medium text-gray-600">اضغط لرفع صورة الموديل أو قم بلصقها (Ctrl+V)</p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG</p>
                </div>
              )}
              
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                required={!imageBase64}
              />
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded text-sm text-blue-800 border border-blue-100">
              💡 <strong>تلميح:</strong> بعد الضغط على إصدار، سيتم نقلك لشاشة (A4) جاهزة للطباعة فوراً لتحتوي على هذه الصورة والباركود.
            </div>
          </div>

          <div className="md:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm space-y-4 border-t-4 border-gray-800">
              <h2 className="text-lg font-bold border-b pb-2 text-gray-800">1. البيانات الأساسية والمخزن</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">اسم أو كود الموديل *</label>
                  <input type="text" value={modelName} onChange={(e) => setModelName(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">تصنيف الموديل (المرحلة والمقاسات) *</label>
                  <select value={sizesSeries} onChange={(e) => setSizesSeries(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required>
                    <option value="">-- اختر التصنيف --</option>
                    <option value="بيبي 2-3-4-5">بيبي 2-3-4-5</option>
                    <option value="وسط 6-8-10-12">وسط 6-8-10-12</option>
                    <option value="محير 14-16-18-20">محير 14-16-18-20</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">الكمية المستهدفة (تُحسب تلقائياً) *</label>
                  <input type="number" value={totalQuantity} readOnly className="w-full p-2.5 border border-gray-300 rounded-lg outline-none bg-gray-200 cursor-not-allowed font-bold" required min="1" placeholder="أدخل كميات الألوان بالأسفل" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">نوع القماش</label>
                  <input type="text" value={fabricType} onChange={(e) => setFabricType(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="مثال: قطن، ميلتون..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">المورد / المخزن</label>
                  <input type="text" value={fabricSupplier} onChange={(e) => setFabricSupplier(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="مكان القماش" />
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <h3 className="font-bold text-blue-900 mb-3 text-sm flex items-center gap-2">🎨 ألوان القطع والتنسيق والكميات</h3>
                
                <div className="space-y-3">
                  {colorPairs.map((pair, idx) => (
                    <div key={idx} className="flex gap-2 items-center flex-wrap md:flex-nowrap">
                      <div className="flex-[2] flex flex-col gap-1 min-w-[150px]">
                        <select 
                          value={pair.tshirt} 
                          onChange={(e) => {
                            const newPairs = [...colorPairs];
                            newPairs[idx].tshirt = e.target.value;
                            setColorPairs(newPairs);
                          }} 
                          className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white" 
                        >
                          <option value="">لون التيشيرت ({idx + 1})</option>
                          {Object.keys(colorCodes).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {pair.tshirt && (
                          <input 
                            type="number" 
                            min="0"
                            placeholder="عدد الأتواب المسحوبة" 
                            value={pair.tRolls}
                            onChange={(e) => {
                              const newPairs = [...colorPairs];
                              newPairs[idx].tRolls = e.target.value;
                              setColorPairs(newPairs);
                            }}
                            className="w-full p-1.5 text-xs border border-green-300 bg-green-50 rounded"
                          />
                        )}
                      </div>
                      <div className="flex-[2] flex flex-col gap-1 min-w-[150px]">
                        <select 
                          value={pair.pants} 
                          onChange={(e) => {
                            const newPairs = [...colorPairs];
                            newPairs[idx].pants = e.target.value;
                            setColorPairs(newPairs);
                          }} 
                          className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white" 
                        >
                          <option value="">لون البنطلون ({idx + 1})</option>
                          {Object.keys(colorCodes).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {pair.pants && (
                          <input 
                            type="number" 
                            min="0"
                            placeholder="عدد الأتواب المسحوبة" 
                            value={pair.pRolls}
                            onChange={(e) => {
                              const newPairs = [...colorPairs];
                              newPairs[idx].pRolls = e.target.value;
                              setColorPairs(newPairs);
                            }}
                            className="w-full p-1.5 text-xs border border-green-300 bg-green-50 rounded"
                          />
                        )}
                      </div>
                      <div className="w-24 shrink-0 flex flex-col justify-start h-full self-start">
                        <input 
                          type="number" 
                          value={pair.quantity} 
                          onChange={(e) => {
                            const newPairs = [...colorPairs];
                            newPairs[idx].quantity = e.target.value;
                            setColorPairs(newPairs);
                          }} 
                          className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-blue-700" 
                          placeholder="الكمية (ق)" 
                        />
                      </div>
                      {colorPairs.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => {
                            const newPairs = [...colorPairs];
                            newPairs.splice(idx, 1);
                            setColorPairs(newPairs);
                          }} 
                          className="p-2.5 text-red-500 hover:bg-red-100 rounded-lg transition shrink-0"
                        >
                          <Minus size={20} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                <button 
                  type="button" 
                  onClick={() => setColorPairs([...colorPairs, { tshirt: '', pants: '', quantity: '' }])} 
                  className="text-blue-700 text-sm font-bold flex items-center gap-1 hover:bg-blue-100 p-2 rounded transition mt-2"
                >
                  <Plus size={16} /> إضافة لون آخر
                </button>
              </div>

            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm space-y-6 border-t-4 border-gray-800">
              <h2 className="text-lg font-bold border-b pb-2 text-gray-800">2. تعليمات الأقسام (تظهر في الطباعة)</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">✂️ قسم القص والفرز</label>
                  <textarea value={cuttingNotes} onChange={(e) => setCuttingNotes(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="- تيشيرت: (ملاحظات هنا)&#10;- بنطلون: (ملاحظات هنا)" rows={3} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">🖨️ نوع الطباعة</label>
                    <select value={printingType} onChange={(e) => setPrintingType(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="">-- اختر نوع الطباعة --</option>
                      <option value="بدون طباعة">بدون طباعة (سادة)</option>
                      <option value="DTF">طباعة DTF</option>
                      <option value="رابر">طباعة رابر / سيليكون</option>
                      <option value="سلك سكرين">سلك سكرين</option>
                      <option value="ليزر">تفريغ ليزر</option>
                      <option value="تطريز">تطريز</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">تفاصيل الطباعة / مقاسات</label>
                    <textarea value={printingDetails} onChange={(e) => setPrintingDetails(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="- تيشيرت: ...&#10;- بنطلون: ..." rows={2} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">♨️ قسم الكبس</label>
                    <textarea value={pressingNotes} onChange={(e) => setPressingNotes(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="- تيشيرت: ...&#10;- بنطلون: ..." rows={2} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">🤝 قسم التجويز</label>
                    <textarea value={pairingNotes} onChange={(e) => setPairingNotes(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="- تيشيرت: ...&#10;- بنطلون: ..." rows={2} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">🧵 قسم المكن (التقفيل)</label>
                  <textarea value={sewingNotes} onChange={(e) => setSewingNotes(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="- تيشيرت: ...&#10;- بنطلون: ..." rows={3} />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">📝 ملاحظات عامة (تشطيب، مكواة، تعبئة)</label>
                  <textarea value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="أي تعليمات عامة حول التعبئة والتكييس والتشطيب النهائي..." rows={2} />
                </div>

              </div>
            </div>

          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border-t flex justify-end">
          <button 
            type="submit" 
            disabled={loading}
            className={`flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-white transition shadow-md ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                جاري التجهيز للطباعة...
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                إصدار أمر التشغيل وعرض للطباعة
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
