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

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 pb-10 p-2 sm:p-4" dir="rtl">
      <div className="bg-white p-3 sm:p-8 shadow-lg w-full mx-auto flex flex-col rounded-lg">
        
        <div className="border-2 sm:border-4 border-gray-800 p-3 sm:p-4 mb-4 sm:mb-6 rounded">
          <div className="flex flex-col sm:flex-row justify-between items-start">
            <div className="flex-1 w-full">
              <h1 className="text-xl sm:text-3xl font-black mb-2 text-gray-900 text-center sm:text-right">أمر تشغيل مصنع (رئيسي)</h1>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mt-2 sm:mt-4 text-sm sm:text-lg">
                <div className="font-bold border-b border-gray-300 pb-1">الموديل: <span className="font-normal">{order.modelName}</span></div>
                <div className="font-bold border-b border-gray-300 pb-1">التصنيف: <span className="font-normal">{order.sizesSeries || '---'}</span></div>
                <div className="font-bold border-b border-gray-300 pb-1">الكمية: <span className="font-normal">{order.totalQuantity} قطعة</span></div>
                <div className="font-bold border-b border-gray-300 pb-1">التاريخ: <span className="font-normal">{order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('ar-EG') : new Date().toLocaleDateString('ar-EG')}</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 flex-1">
          <div className="w-full sm:w-1/3 flex flex-col">
            <div className="border-2 border-gray-400 h-48 sm:h-64 relative flex items-center justify-center p-2 mb-2 rounded">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {order.modelImage ? <img src={order.modelImage} alt="Model" className="w-full h-full object-contain" /> : <div className="text-gray-400 text-sm">لا توجد صورة</div>}
            </div>
            <div className="border border-gray-400 p-3 sm:p-2 bg-gray-50 flex-1 flex flex-col rounded">
              <h3 className="font-bold border-b pb-1 mb-2 text-md sm:text-lg">مخزن القماش</h3>
              <p className="text-sm mb-2"><strong>النوع:</strong> {order.fabricType || '---'}</p>
              <p className="text-sm mb-2"><strong>المورد:</strong> {order.fabricSupplier || '---'}</p>
              <p className="text-sm mb-2"><strong>الكمية (كجم/توب):</strong> .....................</p>
              <p className="text-sm mb-2"><strong>استهلاك القطعة:</strong> .....................</p>
              <div className="grid grid-cols-2 gap-2 sm:gap-4 mt-auto pt-4">
                {colorPairs?.filter((pair: any) => pair.quantity).map((pair: any, idx: number) => (
                  <React.Fragment key={idx}>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-12 h-12 sm:w-[2cm] sm:h-[2cm] border border-gray-400 bg-white shadow-sm rounded-sm"></div>
                      <p className="text-[10px] sm:text-xs text-center font-bold">تيشيرت {pair.tshirt} ({pair.quantity}ق)</p>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-12 h-12 sm:w-[2cm] sm:h-[2cm] border border-gray-400 bg-white shadow-sm rounded-sm"></div>
                      <p className="text-[10px] sm:text-xs text-center font-bold">بنطلون {pair.pants} ({pair.quantity}ق)</p>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="w-full sm:w-2/3 flex flex-col gap-4">
            <div className="border border-gray-400 p-3 sm:p-2 flex flex-col rounded">
              <h3 className="font-bold border-b border-gray-300 pb-1 mb-2 bg-gray-100 px-1 text-md">✂️ قسم القص</h3>
              <div className="flex flex-col gap-1 mb-1 border-b border-dashed border-gray-300 pb-1">
                <p className="text-sm font-bold text-red-700">المقاسات: {order.sizesSeries || '---'}</p>
                <p className="text-sm font-bold text-blue-700">الكمية: {order.totalQuantity}</p>
              </div>
              <div className="mb-1 border-b border-dashed border-gray-300 pb-2 mt-2 overflow-x-auto">
                <table className="w-full min-w-[300px] text-center text-[10px] sm:text-xs border-collapse border border-gray-400">
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
                      <td className="border border-gray-400 p-1 text-center" colSpan={2}>{order.totalQuantity} قطعة</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm min-h-[30px] whitespace-pre-wrap">{order.cuttingNotes || '---'}</p>
            </div>

            <div className="border border-gray-400 p-3 flex flex-col rounded">
              <div className="flex justify-between items-center border-b border-gray-300 pb-1 mb-2 bg-gray-100 px-1">
                <h3 className="font-bold text-lg">🧵 قسم المكن (التقفيل)</h3>
              </div>
              <p className="text-sm mb-2 whitespace-pre-wrap">{order.sewingNotes || 'ملاحظات المكن:'}</p>
              
              <div className="flex flex-col gap-4 overflow-x-auto pb-2">
                {/* T-Shirt Table */}
                <table className="w-full min-w-[400px] text-center border-collapse border border-gray-400 text-[10px] sm:text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-400 p-1 font-bold w-1/4">التيشيرت</th>
                      <th className="border border-gray-400 p-1 font-bold w-8">{sizeHeaders[0]}</th>
                      <th className="border border-gray-400 p-1 font-bold w-8">{sizeHeaders[1]}</th>
                      <th className="border border-gray-400 p-1 font-bold w-8">{sizeHeaders[2]}</th>
                      <th className="border border-gray-400 p-1 font-bold w-8">{sizeHeaders[3]}</th>
                      <th className="border border-gray-400 p-1 font-bold w-1/4">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tColors.length > 0 ? tColors.map((color: string, i: number) => color ? (
                      <tr key={i}>
                        <td className="border border-gray-400 p-1 font-bold bg-gray-50">{color}</td>
                        <td className="border border-gray-400 p-1"></td>
                        <td className="border border-gray-400 p-1"></td>
                        <td className="border border-gray-400 p-1"></td>
                        <td className="border border-gray-400 p-1"></td>
                        <td className="border border-gray-400 p-1"></td>
                      </tr>
                    ) : null) : null}
                    {/* Add empty rows */}
                    <tr><td className="border border-gray-400 h-5 p-1"></td><td className="border border-gray-400"></td><td className="border border-gray-400"></td><td className="border border-gray-400"></td><td className="border border-gray-400"></td><td className="border border-gray-400"></td></tr>
                    <tr><td className="border border-gray-400 h-5 p-1"></td><td className="border border-gray-400"></td><td className="border border-gray-400"></td><td className="border border-gray-400"></td><td className="border border-gray-400"></td><td className="border border-gray-400"></td></tr>
                  </tbody>
                </table>

                {/* Pants Table */}
                <table className="w-full min-w-[400px] text-center border-collapse border border-gray-400 text-[10px] sm:text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-400 p-1 font-bold w-1/4">البنطلون</th>
                      <th className="border border-gray-400 p-1 font-bold w-8">{sizeHeaders[0]}</th>
                      <th className="border border-gray-400 p-1 font-bold w-8">{sizeHeaders[1]}</th>
                      <th className="border border-gray-400 p-1 font-bold w-8">{sizeHeaders[2]}</th>
                      <th className="border border-gray-400 p-1 font-bold w-8">{sizeHeaders[3]}</th>
                      <th className="border border-gray-400 p-1 font-bold w-1/4">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pColors.length > 0 ? pColors.map((color: string, i: number) => color ? (
                      <tr key={i}>
                        <td className="border border-gray-400 p-1 font-bold bg-gray-50">{color}</td>
                        <td className="border border-gray-400 p-1"></td>
                        <td className="border border-gray-400 p-1"></td>
                        <td className="border border-gray-400 p-1"></td>
                        <td className="border border-gray-400 p-1"></td>
                        <td className="border border-gray-400 p-1"></td>
                      </tr>
                    ) : null) : null}
                    {/* Add empty rows */}
                    <tr><td className="border border-gray-400 h-5 p-1"></td><td className="border border-gray-400"></td><td className="border border-gray-400"></td><td className="border border-gray-400"></td><td className="border border-gray-400"></td><td className="border border-gray-400"></td></tr>
                    <tr><td className="border border-gray-400 h-5 p-1"></td><td className="border border-gray-400"></td><td className="border border-gray-400"></td><td className="border border-gray-400"></td><td className="border border-gray-400"></td><td className="border border-gray-400"></td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border border-gray-400 p-3 flex flex-col rounded">
              <h3 className="font-bold border-b border-gray-300 pb-1 mb-1 bg-gray-100 px-1 text-md">📝 ملاحظات عامة (تشطيب، مكواة، تعبئة)</h3>
              <p className="text-sm min-h-[50px] whitespace-pre-wrap">{order.generalNotes || '---'}</p>
            </div>
          </div>
        </div>
        


      </div>
      
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 5mm;
          }
          body {
            margin: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
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
