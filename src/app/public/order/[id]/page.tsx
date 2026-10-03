"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '../../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { AlertCircle } from 'lucide-react';

export default function PublicOrderViewPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const docRef = doc(db, 'factory_production_orders', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setOrder({ id: snap.id, ...snap.data() });
        } else {
          setError('هذا الموديل غير موجود.');
        }
      } catch (err) {
        console.error(err);
        setError('حدث خطأ أثناء جلب البيانات.');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchOrder();
  }, [id]);

  if (loading) {
    return <div className="p-20 text-center text-gray-500 font-bold">جاري تحميل أمر التشغيل...</div>;
  }

  if (error || !order) {
    return (
      <div className="max-w-xl mx-auto p-10 bg-red-50 text-red-600 rounded-xl mt-10 text-center shadow">
        <AlertCircle size={48} className="mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-4">{error}</h2>
      </div>
    );
  }

  const tColors = order.tshirtColors || [];
  const pColors = order.pantsColors || [];
  const colorPairs = order.colorPairs || [];
  const sizesMatch = order.sizesSeries?.match(/[\d-]+/);
  const sizeHeaders = sizesMatch ? sizesMatch[0].split('-') : ['', '', '', ''];
  while(sizeHeaders.length < 4) sizeHeaders.push('');


  const validPairs = order.colorPairs?.filter(p => p.tshirt.trim() || p.pants.trim()) || [];
  

  return (
    <div className="max-w-[297mm] mx-auto pb-20 bg-gray-100 print:bg-white print:pb-0" dir="rtl">
      <div className="bg-white mx-auto flex flex-col font-sans p-2 border-2 border-gray-200 print:border-0" style={{ width: '297mm', minHeight: '210mm' }}>
          
          {/* Header */}
          <div className="flex items-stretch border-2 border-[#1a1a1a] rounded mb-2 h-20">
            {/* Title */}
            <div className="w-[30%] bg-[#1a1a1a] text-white flex flex-col justify-center items-center p-2">
              <h1 className="text-3xl font-black mb-1">أمر شغل طباعة</h1>
              <span className="tracking-widest text-xs">P R I N T &nbsp; W O R K &nbsp; O R D E R</span>
            </div>
            
            {/* Center Info */}
            <div className="flex-1 flex gap-4 p-2 items-center justify-center bg-gray-50 border-r-2 border-l-2 border-[#1a1a1a]">
              <div className="flex flex-col items-center">
                <span className="text-sm font-bold mb-1">رقم أمر الشغل</span>
                <div className="bg-white border border-gray-400 h-8 w-28 flex items-center justify-center font-bold text-sm">
                  {order.shortId || order.id.slice(-6).toUpperCase()}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm font-bold mb-1">التاريخ</span>
                <div className="bg-white border border-gray-400 h-8 w-28 flex items-center justify-center text-sm font-bold">
                  {new Date().toLocaleDateString('en-GB')}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm font-bold mb-1">كود الموديل</span>
                <div className="bg-white border border-gray-400 h-8 w-28 flex items-center justify-center font-bold text-sm">
                  {order.modelName}
                </div>
              </div>
            </div>
            
            {/* Model Name */}
            <div className="w-[30%] bg-[#1a1a1a] text-white flex flex-col p-2 items-center justify-center">
              <span className="text-sm font-bold mb-1">اسم الموديل</span>
              <div className="bg-white text-black h-8 w-full rounded flex items-center justify-center font-bold text-sm">
                {order.modelName}
              </div>
            </div>
          </div>

          {/* T-Shirt Section */}
          <div className="flex border-2 border-[#5c4033] rounded mb-2 overflow-hidden" style={{ height: '220px' }}>
            <div className="w-24 bg-[#5c4033] text-white flex flex-col items-center justify-center p-2 shrink-0">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2"><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.47a2 2 0 00-1.34-2.23z"/></svg>
              <span className="font-bold text-lg">التيشيرت</span>
              <span className="text-[10px] tracking-widest mt-1">T-SHIRT</span>
            </div>
            
            <div className="flex-1 flex p-2 gap-4">
              {/* Illustrations Area */}
              <div className="w-[35%] flex gap-2 justify-around items-end pb-2">
                <div className="flex flex-col items-center">
                  <div className="w-20 h-28 border border-gray-300 rounded mb-1 bg-gray-50 flex items-center justify-center">
                    {/* SVG placeholder for front */}
                    {order.modelImage ? <img src={order.modelImage} className="h-full object-contain p-1" /> : <div className="text-xs text-gray-400">أمام</div>}
                  </div>
                  <div className="bg-[#8b654b] text-white text-xs py-1 px-4 rounded w-full text-center">أمام</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-20 h-28 border border-gray-300 rounded mb-1 bg-gray-50"></div>
                  <div className="bg-[#8b654b] text-white text-xs py-1 px-4 rounded w-full text-center">خلف</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-16 h-28 border border-gray-300 rounded mb-1 bg-gray-50"></div>
                  <div className="bg-[#8b654b] text-white text-xs py-1 px-4 rounded w-full text-center">كم</div>
                </div>
              </div>

              {/* Checkboxes Area */}
              <div className="flex-1 grid grid-cols-3 gap-2">
                {/* Print Location */}
                <div className="border border-gray-300 rounded p-2 flex flex-col">
                  <div className="bg-[#5c4033] text-white text-center text-xs font-bold py-1 mb-2 rounded-t">موقع الطباعة</div>
                  <div className="space-y-2 flex-1 flex flex-col justify-around text-sm font-bold">
                    <div className="flex justify-between items-center px-1"><span>صدر</span> <div className="w-12 h-6 border border-gray-400 bg-white"></div></div>
                    <div className="flex justify-between items-center px-1"><span>ظهر</span> <div className="w-12 h-6 border border-gray-400 bg-white"></div></div>
                    <div className="flex justify-between items-center px-1"><span>كم يمين</span> <div className="w-12 h-6 border border-gray-400 bg-white"></div></div>
                    <div className="flex justify-between items-center px-1"><span>كم شمال</span> <div className="w-12 h-6 border border-gray-400 bg-white"></div></div>
                  </div>
                </div>

                {/* Print Type */}
                <div className="border border-gray-300 rounded p-2 flex flex-col">
                  <div className="bg-[#5c4033] text-white text-center text-xs font-bold py-1 mb-2 rounded-t">نوع الطباعة</div>
                  <div className="space-y-1.5 flex-1 flex flex-col justify-around text-xs font-bold">
                    <div className="flex justify-between items-center"><div className="bg-[#a8c8ff] py-1 px-2 rounded flex-1 ml-1 text-center">DTF</div> <div className="w-5 h-5 border border-gray-400 bg-white rounded-sm shrink-0"></div></div>
                    <div className="flex justify-between items-center"><div className="bg-[#ffb6c1] py-1 px-2 rounded flex-1 ml-1 text-center">RUBBER</div> <div className="w-5 h-5 border border-gray-400 bg-white rounded-sm shrink-0"></div></div>
                    <div className="flex justify-between items-center"><div className="bg-[#b4eeb4] py-1 px-2 rounded flex-1 ml-1 text-center">VINYL</div> <div className="w-5 h-5 border border-gray-400 bg-white rounded-sm shrink-0"></div></div>
                    <div className="flex justify-between items-center"><div className="bg-[#d8bfd8] py-1 px-2 rounded flex-1 ml-1 text-center">UV-DTF</div> <div className="w-5 h-5 border border-gray-400 bg-white rounded-sm shrink-0"></div></div>
                    <div className="flex justify-between items-center"><div className="bg-[#d3d3d3] py-1 px-2 rounded flex-1 ml-1 text-center">أخرى</div> <div className="w-5 h-5 border border-gray-400 bg-white rounded-sm shrink-0"></div></div>
                  </div>
                </div>

                {/* Colors */}
                <div className="flex flex-col gap-1 h-full">
                  <div className="flex text-center text-xs font-bold mb-1">
                    <div className="bg-[#5c4033] text-white py-1 flex-[1.5] rounded-tr ml-1">لون الموديل</div>
                    <div className="bg-[#5c4033] text-white py-1 flex-[2] rounded-tl">لون الطباعة</div>
                  </div>
                  {[
                    { id: 1, name: tColors[0] || '', bg: '#d2b48c' },
                    { id: 2, name: tColors[1] || '', bg: '#556b2f' },
                    { id: 3, name: tColors[2] || '', bg: '#4682b4' },
                    { id: 4, name: tColors[3] || '', bg: '#000000' }
                  ].map((c) => (
                    <div key={c.id} className="flex flex-1 items-center gap-1">
                      <div className="flex-[1.5] flex h-full">
                        <div className="w-6 h-full flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: c.bg }}>{c.id}</div>
                        <div className="flex-1 h-full border border-gray-400 bg-gray-50 flex items-center justify-center text-xs">{c.name}</div>
                      </div>
                      <div className="flex-[2] h-full border border-gray-400 bg-white"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Pants Section */}
          <div className="flex border-2 border-[#5c4033] rounded mb-2 overflow-hidden" style={{ height: '220px' }}>
            <div className="w-24 bg-[#5c4033] text-white flex flex-col items-center justify-center p-2 shrink-0">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2"><path d="M5.5 3h13L19 21H14L12 12L10 21H5L5.5 3Z"/><path d="M9 3v4M15 3v4"/></svg>
              <span className="font-bold text-lg">البنطلون</span>
              <span className="text-[10px] tracking-widest mt-1">PANTS</span>
            </div>
            
            <div className="flex-1 flex p-2 gap-4">
              {/* Illustrations Area */}
              <div className="w-[35%] flex gap-2 justify-around items-end pb-2">
                <div className="flex flex-col items-center">
                  <div className="w-20 h-28 border border-gray-300 rounded mb-1 bg-gray-50"></div>
                  <div className="bg-[#8b654b] text-white text-xs py-1 px-4 rounded w-full text-center">أمام</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-20 h-28 border border-gray-300 rounded mb-1 bg-gray-50"></div>
                  <div className="bg-[#8b654b] text-white text-xs py-1 px-4 rounded w-full text-center">خلف</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-16 h-28 border border-gray-300 rounded mb-1 bg-gray-50"></div>
                  <div className="bg-[#8b654b] text-white text-xs py-1 px-4 rounded w-full text-center">جنب</div>
                </div>
              </div>

              {/* Checkboxes Area */}
              <div className="flex-1 grid grid-cols-3 gap-2">
                {/* Print Location */}
                <div className="border border-gray-300 rounded p-2 flex flex-col">
                  <div className="bg-[#5c4033] text-white text-center text-xs font-bold py-1 mb-2 rounded-t">موقع الطباعة</div>
                  <div className="space-y-2 flex-1 flex flex-col justify-around text-sm font-bold">
                    <div className="flex justify-between items-center px-1"><span>أمام</span> <div className="w-12 h-6 border border-gray-400 bg-white"></div></div>
                    <div className="flex justify-between items-center px-1"><span>خلف</span> <div className="w-12 h-6 border border-gray-400 bg-white"></div></div>
                    <div className="flex justify-between items-center px-1"><span>جانب يمين</span> <div className="w-12 h-6 border border-gray-400 bg-white"></div></div>
                    <div className="flex justify-between items-center px-1"><span>جانب شمال</span> <div className="w-12 h-6 border border-gray-400 bg-white"></div></div>
                  </div>
                </div>

                {/* Print Type */}
                <div className="border border-gray-300 rounded p-2 flex flex-col">
                  <div className="bg-[#5c4033] text-white text-center text-xs font-bold py-1 mb-2 rounded-t">نوع الطباعة</div>
                  <div className="space-y-1.5 flex-1 flex flex-col justify-around text-xs font-bold">
                    <div className="flex justify-between items-center"><div className="bg-[#a8c8ff] py-1 px-2 rounded flex-1 ml-1 text-center">DTF</div> <div className="w-5 h-5 border border-gray-400 bg-white rounded-sm shrink-0"></div></div>
                    <div className="flex justify-between items-center"><div className="bg-[#ffb6c1] py-1 px-2 rounded flex-1 ml-1 text-center">RUBBER</div> <div className="w-5 h-5 border border-gray-400 bg-white rounded-sm shrink-0"></div></div>
                    <div className="flex justify-between items-center"><div className="bg-[#b4eeb4] py-1 px-2 rounded flex-1 ml-1 text-center">VINYL</div> <div className="w-5 h-5 border border-gray-400 bg-white rounded-sm shrink-0"></div></div>
                    <div className="flex justify-between items-center"><div className="bg-[#d8bfd8] py-1 px-2 rounded flex-1 ml-1 text-center">UV-DTF</div> <div className="w-5 h-5 border border-gray-400 bg-white rounded-sm shrink-0"></div></div>
                    <div className="flex justify-between items-center"><div className="bg-[#d3d3d3] py-1 px-2 rounded flex-1 ml-1 text-center">أخرى</div> <div className="w-5 h-5 border border-gray-400 bg-white rounded-sm shrink-0"></div></div>
                  </div>
                </div>

                {/* Colors */}
                <div className="flex flex-col gap-1 h-full">
                  <div className="flex text-center text-xs font-bold mb-1">
                    <div className="bg-[#5c4033] text-white py-1 flex-[1.5] rounded-tr ml-1">لون الموديل</div>
                    <div className="bg-[#5c4033] text-white py-1 flex-[2] rounded-tl">لون الطباعة</div>
                  </div>
                  {[
                    { id: 1, name: pColors[0] || '', bg: '#d2b48c' },
                    { id: 2, name: pColors[1] || '', bg: '#556b2f' },
                    { id: 3, name: pColors[2] || '', bg: '#4682b4' },
                    { id: 4, name: pColors[3] || '', bg: '#000000' }
                  ].map((c) => (
                    <div key={c.id} className="flex flex-1 items-center gap-1">
                      <div className="flex-[1.5] flex h-full">
                        <div className="w-6 h-full flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: c.bg }}>{c.id}</div>
                        <div className="flex-1 h-full border border-gray-400 bg-gray-50 flex items-center justify-center text-xs">{c.name}</div>
                      </div>
                      <div className="flex-[2] h-full border border-gray-400 bg-white"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="flex h-24 gap-2">
            <div className="w-24 bg-[#1a1a1a] text-white flex flex-col items-center justify-center rounded p-1 shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
              <span className="font-bold">الكميات</span>
              <span className="text-[8px] tracking-wider mt-1">QUANTITY</span>
            </div>
            
            <div className="flex-1 flex gap-2">
              {[
                    { id: 1, name: '', bg: '#d2b48c', qty: validPairs[0]?.quantity || '' },
                    { id: 2, name: '', bg: '#556b2f', qty: validPairs[1]?.quantity || '' },
                    { id: 3, name: '', bg: '#4682b4', qty: validPairs[2]?.quantity || '' },
                    { id: 4, name: '', bg: '#000000', qty: validPairs[3]?.quantity || '' }
              ].map((c) => (
                <div key={c.id} className="flex-1 flex flex-col border border-gray-300 rounded overflow-hidden">
                  <div className="h-8 flex items-center justify-center text-white font-bold" style={{ backgroundColor: c.bg }}>{c.id}</div>
                  <div className="flex-1 bg-white border-t border-gray-300 flex items-center justify-center font-bold text-lg">{c.qty}</div>
                </div>
              ))}
            </div>

            <div className="w-[30%] border border-gray-300 rounded flex flex-col overflow-hidden">
              <div className="h-8 bg-gray-100 border-b border-gray-300 flex items-center px-2 text-sm font-bold gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                ملاحظات التصميم
              </div>
              <div className="flex-1 bg-white p-2 flex flex-col justify-around">
                <div className="border-b border-gray-300 w-full h-1"></div>
                <div className="border-b border-gray-300 w-full h-1"></div>
                <div className="border-b border-gray-300 w-full h-1"></div>
              </div>
            </div>
          </div>
        </div>

        <style jsx global>{`
          @media print {
            @page {
              size: A4 landscape;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              background-color: white;
            }
            body * {
              visibility: hidden;
            }
            .print\\:hidden {
              display: none !important;
            }
            .max-w-\\[297mm\\] > div:nth-child(2), .max-w-\\[297mm\\] > div:nth-child(2) * {
              visibility: visible;
            }
            .max-w-\\[297mm\\] > div:nth-child(2) {
              position: absolute;
              left: 0;
              top: 0;
              width: 297mm !important;
              height: 210mm !important;
              padding: 5mm;
              box-sizing: border-box;
            }
          }
        `}</style>
      </div>
    );

}
