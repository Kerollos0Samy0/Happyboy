"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Image as ImageIcon, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function NewProductionOrderPage() {
  const router = useRouter();
  
  // Basic Info
  const [modelName, setModelName] = useState('');
  const [totalQuantity, setTotalQuantity] = useState('');
  const [fabricType, setFabricType] = useState('');
  
  // Stages Info
  const [cuttingNotes, setCuttingNotes] = useState('');
  const [printingType, setPrintingType] = useState('');
  const [pressingNotes, setPressingNotes] = useState('');
  const [sewingNotes, setSewingNotes] = useState('');

  // Image
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Resize and compress image to base64 to avoid Firebase Storage setup issues
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
          
          // Compress to JPEG with 0.7 quality
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
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
      setError('يجب إدخال اسم الموديل، الكمية، ورفع صورة الموديل.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const orderData = {
        modelName,
        totalQuantity: Number(totalQuantity),
        fabricType,
        cuttingNotes,
        printingType,
        pressingNotes,
        sewingNotes,
        modelImage: imageBase64, // Stored directly as a compressed string
        currentStage: 1, // Start at stage 1
        status: 'قيد التنفيذ', // active
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'factory_production_orders'), orderData);
      
      alert('تم إصدار أمر التشغيل بنجاح! رقم الأمر: ' + docRef.id);
      router.push('/factory/production');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'حدث خطأ غير متوقع أثناء الحفظ.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20" dir="rtl">
      <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow-sm border-r-4 border-blue-500">
        <Link href="/factory/production" className="p-2 hover:bg-gray-100 rounded-full transition">
          <ArrowRight size={24} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">إصدار أمر تشغيل جديد</h1>
          <p className="text-sm text-gray-500 mt-1">أدخل بيانات الموديل وتعليمات الأقسام الـ 13 لفتح أمر الشغل.</p>
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
          <div className="md:col-span-1 bg-white p-6 rounded-lg shadow-sm h-fit">
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
                  <p className="text-sm font-medium text-gray-600">اضغط لرفع صورة الموديل</p>
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
          </div>

          {/* Left Column - Form Fields */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Basic Info */}
            <div className="bg-white p-6 rounded-lg shadow-sm space-y-4">
              <h2 className="text-lg font-bold border-b pb-2 text-gray-800">1. البيانات الأساسية</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">اسم أو كود الموديل *</label>
                  <input 
                    type="text" 
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="مثال: سويت شيرت ولادي 105"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">الكمية المستهدفة (قطعة) *</label>
                  <input 
                    type="number" 
                    value={totalQuantity}
                    onChange={(e) => setTotalQuantity(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="مثال: 1000"
                    required min="1"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">نوع القماش (مخزن القماش)</label>
                  <input 
                    type="text" 
                    value={fabricType}
                    onChange={(e) => setFabricType(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="مثال: ميلتون مبطن، قطن 100%"
                  />
                </div>
              </div>
            </div>

            {/* Departments Instructions */}
            <div className="bg-white p-6 rounded-lg shadow-sm space-y-4">
              <h2 className="text-lg font-bold border-b pb-2 text-gray-800">2. تعليمات الأقسام</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-2">تعليمات قسم القص</label>
                  <textarea 
                    value={cuttingNotes}
                    onChange={(e) => setCuttingNotes(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="ملاحظات للباترون والقص..."
                    rows={2}
                  />
                </div>
                
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-2">نوع الطباعة (قسم الطباعة)</label>
                  <select 
                    value={printingType}
                    onChange={(e) => setPrintingType(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">-- اختر نوع الطباعة --</option>
                    <option value="بدون طباعة">بدون طباعة (سادة)</option>
                    <option value="DTF">طباعة DTF</option>
                    <option value="رابر">طباعة رابر / سيليكون</option>
                    <option value="سلك سكرين">سلك سكرين</option>
                    <option value="ليزر">تفريغ ليزر</option>
                    <option value="تطريز">تطريز</option>
                  </select>
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-2">تعليمات قسم الكبس</label>
                  <textarea 
                    value={pressingNotes}
                    onChange={(e) => setPressingNotes(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="درجات الحرارة، أماكن الكبس..."
                    rows={2}
                  />
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-2">تعليمات قسم المكن (التقفيل)</label>
                  <textarea 
                    value={sewingNotes}
                    onChange={(e) => setSewingNotes(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="نوع الخياطة، لون الخيط، تركيب تيكت..."
                    rows={2}
                  />
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
                جاري الإصدار...
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                تأكيد وإصدار أمر التشغيل
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
