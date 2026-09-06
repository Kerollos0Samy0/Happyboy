"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db, storage } from '../../../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Upload, Image as ImageIcon, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function NewProductionOrderPage() {
  const router = useRouter();
  
  const [modelName, setModelName] = useState('');
  const [totalQuantity, setTotalQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelName || !totalQuantity || !imageFile) {
      setError('يجب إدخال اسم الموديل، الكمية، ورفع صورة الموديل لبدء أمر التشغيل.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Upload Image to Storage
      const storageRef = ref(storage, `factory_production_images/${Date.now()}_${imageFile.name}`);
      const uploadTask = uploadBytesResumable(storageRef, imageFile);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const p = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setProgress(p);
        },
        (err) => {
          console.error(err);
          setError('فشل رفع الصورة. تأكد من صلاحيات Firebase Storage.');
          setLoading(false);
        },
        async () => {
          // 2. Get Download URL
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          // 3. Save to Firestore
          const orderData = {
            modelName,
            totalQuantity: Number(totalQuantity),
            notes,
            modelImage: downloadURL,
            currentStage: 1, // Start at stage 1
            status: 'قيد التنفيذ', // active
            createdAt: serverTimestamp(),
            // Empty arrays for future use
            colorsAndSizes: [],
            bom: []
          };

          const docRef = await addDoc(collection(db, 'factory_production_orders'), orderData);
          
          // Add the PO prefix to the generated ID and save it as a readable orderId
          // Actually, let's just use the Firestore ID, or we can update the doc with a readable ID.
          // For simplicity, we'll route to the dashboard and let them see it there.
          alert('تم إصدار أمر التشغيل بنجاح! رقم الأمر: ' + docRef.id);
          router.push('/factory/production');
        }
      );
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'حدث خطأ غير متوقع');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow-sm">
        <Link href="/factory/production" className="p-2 hover:bg-gray-100 rounded-full transition">
          <ArrowRight size={24} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">إصدار أمر تشغيل جديد</h1>
          <p className="text-sm text-gray-500 mt-1">أدخل بيانات الموديل والصورة لفتح أمر شغل للموسم الجديد.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-r-4 border-red-500 p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="text-red-500 mt-0.5" size={20} />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">اسم أو كود الموديل *</label>
              <input 
                type="text" 
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="مثال: سويت شيرت ولادي موديل 105"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">الكمية المستهدفة (عدد القطع) *</label>
              <input 
                type="number" 
                value={totalQuantity}
                onChange={(e) => setTotalQuantity(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="مثال: 1000"
                required
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">ملاحظات وتعليمات للمصنع</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="اكتب أي تعليمات خاصة بالقص أو الطباعة..."
                rows={4}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">صورة الموديل المرجعية *</label>
            <div className={`border-2 border-dashed rounded-xl h-64 flex flex-col items-center justify-center relative overflow-hidden transition ${imagePreview ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}>
              
              {imagePreview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Model Preview" className="absolute inset-0 w-full h-full object-contain p-2" />
                  <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition">
                    <span className="text-white font-bold">تغيير الصورة</span>
                  </div>
                </>
              ) : (
                <div className="text-center p-6">
                  <ImageIcon size={48} className="mx-auto text-gray-400 mb-3" />
                  <p className="text-sm font-medium text-gray-600">اضغط لرفع صورة الموديل</p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG حتى 5MB</p>
                </div>
              )}
              
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                required
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-6 flex justify-end">
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
                جاري الإصدار... {progress > 0 && `${progress}%`}
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
