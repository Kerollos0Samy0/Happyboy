"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Image as ImageIcon, CheckCircle, AlertCircle, ArrowRight, Printer } from 'lucide-react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';

export default function NewProductionOrderPage() {
  const router = useRouter();
  
  // Basic Info
  const [modelName, setModelName] = useState('');
  const [totalQuantity, setTotalQuantity] = useState('');
  const [fabricType, setFabricType] = useState('');
  const [fabricColor, setFabricColor] = useState('');
  const [fabricSupplier, setFabricSupplier] = useState('');
  
  // Stages Info
  const [cuttingNotes, setCuttingNotes] = useState('');
  const [printingType, setPrintingType] = useState('');
  const [printingDetails, setPrintingDetails] = useState('');
  const [pressingNotes, setPressingNotes] = useState('');
  const [pairingNotes, setPairingNotes] = useState('');
  const [sewingNotes, setSewingNotes] = useState('');
  
  // Removed finishing and packing notes, replaced with general notes
  const [generalNotes, setGeneralNotes] = useState('');

  // Image
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Print View State
  const [generatedOrderId, setGeneratedOrderId] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
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
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelName || !totalQuantity || !imageBase64) {
      setError('??? ????? ??? ???????? ??????? ???? ???? ???????.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const orderData = {
        modelName,
        totalQuantity: Number(totalQuantity),
        fabricType,
        fabricColor,
        fabricSupplier,
        cuttingNotes,
        printingType,
        printingDetails,
        pressingNotes,
        pairingNotes,
        sewingNotes,
        generalNotes,
        modelImage: imageBase64,
        currentStage: 1,
        status: '??? ???????',
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'factory_production_orders'), orderData);
      
      setGeneratedOrderId(docRef.id);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '??? ??? ??? ????? ????? ?????.');
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (generatedOrderId) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 pb-20" dir="rtl">
        <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm print:hidden">
          <p className="text-green-600 font-bold flex items-center gap-2"><CheckCircle /> ?? ????? ?????!</p>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2">
              <Printer size={18} /> ????? ??? ???????
            </button>
            <Link href="/factory/production" className="bg-gray-200 text-gray-800 px-4 py-2 rounded">
              ?????? ?????
            </Link>
          </div>
        </div>

        {/* A4 Print Ticket Container */}
        <div className="bg-white p-8 shadow-lg print:shadow-none print:p-0 w-full mx-auto flex flex-col" style={{ minHeight: '297mm' }}>
          
          {/* Header Ticket */}
          <div className="border-4 border-gray-800 p-4 mb-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h1 className="text-3xl font-black mb-2 text-gray-900">??? ????? ???? (?????)</h1>
                <div className="grid grid-cols-2 gap-4 mt-4 text-lg">
                  <div className="font-bold border-b border-gray-300 pb-1">???????: <span className="font-normal">{modelName}</span></div>
                  <div className="font-bold border-b border-gray-300 pb-1">??????: <span className="font-normal">{totalQuantity} ????</span></div>
                  <div className="font-bold border-b border-gray-300 pb-1">???????: <span className="font-normal">{new Date().toLocaleDateString('ar-EG')}</span></div>
                </div>
              </div>
              
              <div className="w-32 flex flex-col items-center border-r-2 pr-4 ml-4">
                <QRCodeSVG value={generatedOrderId} size={100} />
                <span className="text-xs font-mono mt-2">{generatedOrderId.slice(-6).toUpperCase()}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-6 flex-1">
            {/* Image Section */}
            <div className="w-1/3 flex flex-col">
              <div className="border-2 border-gray-400 h-80 relative flex items-center justify-center p-2 mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageBase64!} alt="Model" className="w-full h-full object-contain" />
              </div>
              <div className="border border-gray-400 p-3 bg-gray-50 flex-1 flex flex-col">
                <h3 className="font-bold border-b pb-1 mb-2 text-lg">???? ??????</h3>
                <p className="text-base mb-2"><strong>?????:</strong> {fabricType || '---'}</p>
                <p className="text-base mb-2"><strong>?????:</strong> {fabricColor || '---'}</p>
                <p className="text-base mb-2"><strong>??????:</strong> {fabricSupplier || '---'}</p>
                
                {/* Swatches Section */}
                <div className="mt-auto pt-4 pb-2 flex justify-center gap-6">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-[2cm] h-[2cm] border-2 border-gray-400 bg-white shadow-inner"></div>
                    <span className="text-xs font-bold text-gray-600">??????</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-[2cm] h-[2cm] border-2 border-gray-400 bg-white shadow-inner"></div>
                    <span className="text-xs font-bold text-gray-600">??????</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stages Grid */}
            <div className="w-2/3 grid grid-cols-2 gap-4 h-fit">
              
              {/* Cutting - Spans full width */}
              <div className="border border-gray-400 p-3 flex flex-col col-span-2">
                <h3 className="font-bold border-b border-gray-300 pb-1 mb-2 bg-gray-100 px-1 text-lg">?? ??? ???? ??????</h3>
                <p className="text-base min-h-[140px] whitespace-pre-wrap">{cuttingNotes || '- ??????:\n- ??????:'}</p>
              </div>
              
              {/* Printing */}
              <div className="border border-gray-400 p-3 flex flex-col">
                <h3 className="font-bold border-b border-gray-300 pb-1 mb-2 bg-gray-100 px-1 text-lg">??? ??? ??????? ???????</h3>
                <p className="text-base mb-1"><strong>??? ???????:</strong> {printingType || '????'}</p>
                <p className="text-base min-h-[80px] whitespace-pre-wrap">{printingDetails || '- ??????:\n- ??????:'}</p>
              </div>

              {/* Pressing */}
              <div className="border border-gray-400 p-3 flex flex-col">
                <h3 className="font-bold border-b border-gray-300 pb-1 mb-2 bg-gray-100 px-1 text-lg">?? ??? ?????</h3>
                <p className="text-base min-h-[80px] whitespace-pre-wrap">{pressingNotes || '- ??????:\n- ??????:'}</p>
              </div>

              {/* Pairing */}
              <div className="border border-gray-400 p-3 flex flex-col">
                <h3 className="font-bold border-b border-gray-300 pb-1 mb-2 bg-gray-100 px-1 text-lg">?? ??? ???????</h3>
                <p className="text-base min-h-[80px] whitespace-pre-wrap">{pairingNotes || '- ??????:\n- ??????:'}</p>
              </div>

              {/* Sewing */}
              <div className="border border-gray-400 p-3 flex flex-col">
                <h3 className="font-bold border-b border-gray-300 pb-1 mb-2 bg-gray-100 px-1 text-lg">?? ??? ????? (???????)</h3>
                <p className="text-base min-h-[80px] whitespace-pre-wrap">{sewingNotes || '- ??????:\n- ??????:'}</p>
              </div>

              {/* General Notes replacing Finishing/Ironing/Packing */}
              <div className="border border-gray-400 p-3 col-span-2 flex flex-col">
                <h3 className="font-bold border-b border-gray-300 pb-1 mb-2 bg-gray-100 px-1 text-lg">?? ??????? ???? (?????? ?????? ?????)</h3>
                <p className="text-base min-h-[100px] whitespace-pre-wrap">{generalNotes || '---'}</p>
              </div>

            </div>
          </div>
          
          {/* Signatures */}
          <div className="mt-auto pt-8 flex justify-between border-t-2 border-dashed border-gray-400 px-10 pb-8">
            <div className="text-center"><p className="font-bold text-lg mb-8">????? ???? ???????</p><p>.................................</p></div>
            <div className="text-center"><p className="font-bold text-lg mb-8">????? ???? ??????</p><p>.................................</p></div>
            <div className="text-center"><p className="font-bold text-lg mb-8">????? ???? ??????</p><p>.................................</p></div>
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
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 print:hidden" dir="rtl">
      <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow-sm border-r-4 border-blue-500">
        <Link href="/factory/production" className="p-2 hover:bg-gray-100 rounded-full transition">
          <ArrowRight size={24} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">????? ??? ????? ????</h1>
          <p className="text-sm text-gray-500 mt-1">?? ?????? ?????? ??????? ?????? ?????? ???? ??? ??????? (A4).</p>
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
          
          {/* Right Column - Image Upload */}
          <div className="md:col-span-1 bg-white p-6 rounded-lg shadow-sm h-fit sticky top-24">
            <label className="block text-sm font-bold text-gray-700 mb-2">???? ??????? ???????? *</label>
            <div className={`border-2 border-dashed rounded-xl h-72 flex flex-col items-center justify-center relative overflow-hidden transition ${imageBase64 ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}>
              
              {imageBase64 ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageBase64} alt="Model Preview" className="absolute inset-0 w-full h-full object-contain p-2" />
                  <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition">
                    <span className="text-white font-bold">????? ??????</span>
                  </div>
                </>
              ) : (
                <div className="text-center p-6">
                  <ImageIcon size={48} className="mx-auto text-gray-400 mb-3" />
                  <p className="text-sm font-medium text-gray-600">???? ???? ???? ???????</p>
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
              ?? <strong>?????:</strong> ??? ????? ??? ?????? ???? ???? ????? (A4) ????? ??????? ????? ?????? ??? ??? ?????? ?????????.
            </div>
          </div>

          {/* Left Column - Form Fields */}
          <div className="md:col-span-2 space-y-6">
            
            {/* 1. Basic Info */}
            <div className="bg-white p-6 rounded-lg shadow-sm space-y-4 border-t-4 border-gray-800">
              <h2 className="text-lg font-bold border-b pb-2 text-gray-800">1. ???????? ???????? ???????</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">??? ?? ??? ??????? *</label>
                  <input type="text" value={modelName} onChange={(e) => setModelName(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">?????? ????????? (????) *</label>
                  <input type="number" value={totalQuantity} onChange={(e) => setTotalQuantity(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required min="1" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">??? ??????</label>
                  <input type="text" value={fabricType} onChange={(e) => setFabricType(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="????: ???? ??????..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">??????? (????? ??????)</label>
                  <input type="text" value={fabricColor} onChange={(e) => setFabricColor(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="????: ????? ????? ????..." />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">?????? / ??????? ??????</label>
                  <input type="text" value={fabricSupplier} onChange={(e) => setFabricSupplier(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="??? ?????? ?? ???? ??????" />
                </div>
              </div>
            </div>

            {/* 2. Departments Instructions */}
            <div className="bg-white p-6 rounded-lg shadow-sm space-y-6 border-t-4 border-gray-800">
              <h2 className="text-lg font-bold border-b pb-2 text-gray-800">2. ??????? ??????? (???? ?? ???????)</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">?? ??? ???? ??????</label>
                  <textarea value={cuttingNotes} onChange={(e) => setCuttingNotes(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="- ??????: (??????? ???)&#10;- ??????: (??????? ???)" rows={3} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">??? ??? ???????</label>
                    <select value={printingType} onChange={(e) => setPrintingType(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="">-- ???? ??? ??????? --</option>
                      <option value="???? ?????">???? ????? (????)</option>
                      <option value="DTF">????? DTF</option>
                      <option value="????">????? ???? / ???????</option>
                      <option value="??? ?????">??? ?????</option>
                      <option value="????">????? ????</option>
                      <option value="?????">?????</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">?????? ??????? / ??????</label>
                    <textarea value={printingDetails} onChange={(e) => setPrintingDetails(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="- ??????: ...&#10;- ??????: ..." rows={2} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">?? ??? ?????</label>
                    <textarea value={pressingNotes} onChange={(e) => setPressingNotes(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="- ??????: ...&#10;- ??????: ..." rows={2} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">?? ??? ???????</label>
                    <textarea value={pairingNotes} onChange={(e) => setPairingNotes(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="- ??????: ...&#10;- ??????: ..." rows={2} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">?? ??? ????? (???????)</label>
                  <textarea value={sewingNotes} onChange={(e) => setSewingNotes(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="- ??????: ...&#10;- ??????: ..." rows={3} />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">?? ??????? ???? (?????? ?????? ?????)</label>
                  <textarea value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="?? ??????? ???? ??? ??????? ???????? ???????? ???????..." rows={2} />
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
                ???? ??????? ???????...
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                ????? ??? ??????? ???? ???????
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
