"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '../../../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CheckCircle, AlertCircle, ArrowRight, Printer } from 'lucide-react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';

const getColorCode = (colorName: string) => {
  if (!colorName) return '#ffffff';
  const name = colorName.toLowerCase();
  if (name.includes('اسود') || name.includes('أسود')) return '#000000';
  if (name.includes('ابيض') || name.includes('أبيض')) return '#ffffff';
  if (name.includes('احمر') || name.includes('أحمر')) return '#ff0000';
  if (name.includes('نبيتي')) return '#800000';
  if (name.includes('طوبي')) return '#B22222';
  if (name.includes('بطيخي')) return '#FC6C85';
  if (name.includes('فوشيا')) return '#FF00FF';
  if (name.includes('كشمير')) return '#D1B399';
  if (name.includes('بمبي') || name.includes('روز') || name.includes('بينك')) return '#FFC0CB';
  if (name.includes('موف')) return '#E0B0FF';
  if (name.includes('بنفسجي')) return '#800080';
  if (name.includes('كحلي')) return '#000080';
  if (name.includes('ازرق') || name.includes('أزرق') || name.includes('زهري')) return '#0000FF';
  if (name.includes('لبني') || name.includes('سماوي')) return '#ADD8E6';
  if (name.includes('فيروزي')) return '#40E0D0';
  if (name.includes('جنزاري')) return '#008B8B';
  if (name.includes('زيتي')) return '#4B5320';
  if (name.includes('مينت') || name.includes('منت')) return '#3EB489';
  if (name.includes('اخضر') || name.includes('أخضر')) return '#008000';
  if (name.includes('مستردة') || name.includes('مسطردة')) return '#E3A857';
  if (name.includes('اصفر') || name.includes('أصفر')) return '#FFFF00';
  if (name.includes('برتقالي') || name.includes('اورانج')) return '#FFA500';
  if (name.includes('هافان')) return '#B5651D';
  if (name.includes('جملي')) return '#C19A6B';
  if (name.includes('بني')) return '#8B4513';
  if (name.includes('بيج')) return '#F5F5DC';
  if (name.includes('شاركول')) return '#36454F';
  if (name.includes('رمادي') || name.includes('رصاصي')) return '#808080';
  if (name.includes('سيمون')) return '#FA8072';
  if (name.includes('كافيه')) return '#D2B48C';
  if (name.includes('زيتوني')) return '#808000';
  return '#ffffff';
};

export default function PrintProductionOrderPage() {
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

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="p-20 text-center text-gray-500 font-bold">جاري تحميل أمر التشغيل...</div>;
  }

  if (error || !order) {
    return (
      <div className="max-w-xl mx-auto p-10 bg-red-50 text-red-600 rounded-xl mt-10 text-center shadow">
        <AlertCircle size={48} className="mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-4">{error}</h2>
        <Link href="/factory/dashboard" className="bg-white px-4 py-2 rounded shadow text-gray-800">العودة للوحة</Link>
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
    <div className="max-w-4xl mx-auto space-y-4 pb-20" dir="rtl">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm print:hidden">
        <Link href="/factory/dashboard" className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600">
          <ArrowRight size={24} />
        </Link>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2">
            <Printer size={18} /> طباعة أمر التشغيل
          </button>
        </div>
      </div>

      <div className="bg-white p-8 shadow-lg print:shadow-none print:p-4 w-full mx-auto flex flex-col" style={{ minHeight: '287mm' }}>
        
        <div className="border-4 border-gray-800 p-4 mb-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h1 className="text-3xl font-black mb-2 text-gray-900">أمر تشغيل</h1>
              <div className="grid grid-cols-2 gap-4 mt-4 text-lg">
                <div className="font-bold border-b border-gray-300 pb-1">الموديل: <span className="font-normal">{order.modelName}</span></div>
                <div className="font-bold border-b border-gray-300 pb-1">التصنيف: <span className="font-normal">{order.sizesSeries || '---'}</span></div>
                <div className="font-bold border-b border-gray-300 pb-1">الكمية: <span className="font-normal">{order.totalQuantity} قطعة</span></div>
                <div className="font-bold border-b border-gray-300 pb-1">التاريخ: <span className="font-normal">{order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('ar-EG') : new Date().toLocaleDateString('ar-EG')}</span></div>
              </div>
            </div>
            
            <div className="flex flex-col items-center border-r-2 pr-4 ml-4 gap-2">
              <div className="flex gap-4">
                <QRCodeSVG value={typeof window !== 'undefined' ? `${window.location.origin}/public/order/${order.id}` : ''} size={64} />
              </div>
              <Barcode value={order.id} format="CODE128B" width={1} height={40} fontSize={12} displayValue={false} margin={0} />
              <span className="text-[10px] font-mono mt-1 text-gray-500">{order.id}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-6 flex-1">


          <div className="w-1/3 flex flex-col">
            <div className="border-2 border-gray-400 h-64 relative flex items-center justify-center p-2 mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {order.modelImage ? <img src={order.modelImage} alt="Model" className="w-full h-full object-contain" /> : <div className="text-gray-400">لا توجد صورة</div>}
            </div>
            <div className="border border-gray-400 p-2 bg-gray-50 flex-1 flex flex-col">
              <h3 className="font-bold border-b pb-1 mb-2 text-lg">مخزن القماش</h3>
              <p className="text-sm mb-2"><strong>النوع:</strong> {order.fabricType || '---'}</p>
              <p className="text-sm mb-2"><strong>المورد:</strong> {order.fabricSupplier || '---'}</p>

              <div className="grid grid-cols-2 gap-4 mt-auto pt-4">
                {colorPairs?.filter((pair: any) => pair.quantity).map((pair: any, idx: number) => (
                  <React.Fragment key={idx}>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-[2cm] h-[2cm] border-2 border-gray-400 shadow-sm" style={{ backgroundColor: getColorCode(pair.tshirt), WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}></div>
                      <p className="text-xs text-center font-bold">تيشيرت {pair.tshirt} ({pair.quantity}ق)</p>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-[2cm] h-[2cm] border-2 border-gray-400 shadow-sm" style={{ backgroundColor: getColorCode(pair.pants), WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}></div>
                      <p className="text-xs text-center font-bold">بنطلون {pair.pants} ({pair.quantity}ق)</p>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="w-2/3 grid grid-cols-2 gap-2 h-fit">
            <div className="border border-gray-400 p-2 flex flex-col col-span-2">
              <h3 className="font-bold border-b border-gray-300 pb-1 mb-2 bg-gray-100 px-1 text-md">✂️ قسم القص</h3>
              <div className="flex flex-col gap-1 mb-1 border-b border-dashed border-gray-300 pb-1">
                <p className="text-sm font-bold text-red-700">المقاسات: {order.sizesSeries || '---'}</p>
                <p className="text-sm font-bold text-blue-700">الكمية: {order.totalQuantity}</p>
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
                      <td className="border border-gray-400 p-1 text-center" colSpan={2}>{order.totalQuantity} قطعة</td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>

            <div className="border border-gray-400 p-3 flex flex-col col-span-2">
              <div className="flex justify-between items-center border-b border-gray-300 pb-1 mb-2 bg-gray-100 px-1">
                <h3 className="font-bold text-lg">🧵 قسم المكن (التقفيل)</h3>
              </div>
              <p className="text-sm mb-2 whitespace-pre-wrap">{order.sewingNotes || 'ملاحظات المكن:'}</p>
              
              <div className="flex flex-col gap-4">
                {/* T-Shirt Table */}
                <table className="w-full text-center border-collapse border border-gray-400 text-xs">
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
                <table className="w-full text-center border-collapse border border-gray-400 text-xs">
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

            <div className="border border-gray-400 p-2 col-span-2 flex flex-col flex-1">
              <h3 className="font-bold border-b border-gray-300 pb-1 mb-1 bg-gray-100 px-1 text-md">📝 ملاحظات عامة</h3>
              <p className="text-sm min-h-[80px] whitespace-pre-wrap">{order.generalNotes || '---'}</p>
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
