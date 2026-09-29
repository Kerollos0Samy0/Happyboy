'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Search, Package, ShoppingBag, MapPin, Camera } from 'lucide-react';
import CameraScanner from '../../../components/CameraScanner';

export default function GeneralInquiryPage() {
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [resultType, setResultType] = useState<'fabric' | 'order' | 'roll' | null>(null);
  
  // Fabric Results
  const [fabricResults, setFabricResults] = useState<{
    color: string;
    type: string;
    count: number;
    weight: number;
    rolls: any[];
  } | null>(null);

  // Order Results
  const [orderResult, setOrderResult] = useState<any>(null);

  // Single Roll Results
  const [rollResult, setRollResult] = useState<any>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto focus scanner input
    inputRef.current?.focus();
  }, []);

  const fixArabicBarcode = (text: string) => {
    const map: Record<string, string> = {
      'ض': 'q', 'ص': 'w', 'ث': 'e', 'ق': 'r', 'ف': 't', 'غ': 'y', 'ع': 'u', 'ه': 'i', 'خ': 'o', 'ح': 'p', 'ج': '[', 'د': ']',
      'ش': 'a', 'س': 's', 'ي': 'd', 'ب': 'f', 'ل': 'g', 'ا': 'h', 'ت': 'j', 'ن': 'k', 'م': 'l', 'ك': ';', 'ط': '\'',
      'ئ': 'z', 'ء': 'x', 'ؤ': 'c', 'ر': 'v', 'لا': 'b', 'ى': 'n', 'ة': 'm', 'و': ',', 'ز': '.', 'ظ': '/',
      'َ': 'Q', 'ً': 'W', 'ُ': 'E', 'ٌ': 'R', 'لإ': 'T', 'إ': 'Y', '‘': 'U', '÷': 'I', '×': 'O', '؛': 'P', 
      'ِ': 'A', 'ٍ': 'S', ']': 'D', '[': 'F', 'لأ': 'G', 'أ': 'H', 'ـ': 'J', '،': 'K', '/': 'L', 
      '~': 'Z', 'ْ': 'X', '}': 'C', '{': 'V', 'لآ': 'B', 'آ': 'N', '’': 'M', '؟': '?'
    };
    
    let result = '';
    for (let i = 0; i < text.length; i++) {
      if (i < text.length - 1) {
        const doubleChar = text.substring(i, i + 2);
        if (map[doubleChar]) {
          result += map[doubleChar];
          i++;
          continue;
        }
      }
      result += map[text[i]] || text[i];
    }
    return result;
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    setLoading(true);
    setError('');
    setResultType(null);
    setFabricResults(null);
    setOrderResult(null);

    try {
      const val = fixArabicBarcode(barcode.trim());
      
      // 1. Is it a COLOR card barcode? (e.g., COLOR-En-Ye)
      if (val.startsWith('COLOR-')) {
        let codePart = val.replace('COLOR-', '');
        
        // Find rolls that start with this codePart (e.g., 'En-Ye')
        const q = query(
          collection(db, 'factory_fabric_rolls'),
          where('status', '==', 'in_stock')
        );
        const snap = await getDocs(q);
        
        const matchingRolls = snap.docs
          .map(d => d.data())
          .filter(r => r.code?.startsWith(codePart));

        if (matchingRolls.length === 0) {
          setError('لا توجد أتواب متاحة في المخزن مطابقة لهذه الكارتلة.');
        } else {
          const colorName = matchingRolls[0].color;
          const fabricType = matchingRolls[0].type;
          const count = matchingRolls.length;
          const weight = matchingRolls.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

          setFabricResults({
            color: colorName,
            type: fabricType,
            count,
            weight,
            rolls: matchingRolls.slice(0, 10) // Show up to 10 sample rolls
          });
          setResultType('fabric');
        }
      } 
      // 2. Otherwise, treat as an ORDER barcode (shortId)
      else {
        const q = query(
          collection(db, 'factory_production_orders'),
          where('shortId', '==', val)
        );
        const snap = await getDocs(q);

        if (snap.empty) {
          // Maybe it's a specific fabric roll?
          const qRoll = query(
            collection(db, 'factory_fabric_rolls'),
            where('code', '==', val)
          );
          const snapRoll = await getDocs(qRoll);
          
          if (!snapRoll.empty) {
            const roll = snapRoll.docs[0].data();
            setRollResult(roll);
            setResultType('roll');
          } else {
            setError('الباركود غير مسجل في النظام. تأكد من صحة الباركود.');
          }
        } else {
          setOrderResult(snap.docs[0].data());
          setResultType('order');
        }
      }
    } catch (err: any) {
      setError('حدث خطأ أثناء الاستعلام: ' + err.message);
    }
    
    setLoading(false);
    setBarcode('');
    inputRef.current?.focus();
  };

  const getOrderStatusDisplay = (status: string) => {
    switch(status) {
      case 'new': return { label: 'انتظار القص', color: 'bg-blue-100 text-blue-800' };
      case 'cutting': return { label: 'في القص', color: 'bg-orange-100 text-orange-800' };
      case 'printing': return { label: 'في الطباعة', color: 'bg-purple-100 text-purple-800' };
      case 'pressing': return { label: 'في المكبس', color: 'bg-yellow-100 text-yellow-800' };
      case 'pairing': return { label: 'في التزويج', color: 'bg-teal-100 text-teal-800' };
      case 'sewing': return { label: 'في الخياطة', color: 'bg-pink-100 text-pink-800' };
      case 'completed': return { label: 'مكتمل (المخزن)', color: 'bg-green-100 text-green-800' };
      default: return { label: status, color: 'bg-gray-100 text-gray-800' };
    }
  };

  const statusFlow = ['new', 'cutting', 'printing', 'pressing', 'pairing', 'sewing', 'completed'];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-black text-gray-800 flex items-center justify-center gap-3">
          <Search className="text-blue-600" size={32} />
          الاستعلام العام
        </h1>
        <p className="text-gray-500 mt-2">
          امسح باركود <strong>كارتلة اللون</strong> لمعرفة الرصيد المتاح، أو باركود <strong>أمر الشغل</strong> لمعرفة حالته ومكانه.
        </p>
      </div>

      <form onSubmit={handleScan} className="mb-10">
        <div className="relative max-w-2xl mx-auto shadow-sm flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCamera(true)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-5 rounded-2xl border-2 border-gray-200 transition flex items-center justify-center shrink-0"
            title="مسح بالكاميرا"
          >
            <Camera size={28} />
          </button>
          
          <div className="relative flex-1">
            <input 
              ref={inputRef}
              type="text" 
              placeholder="امسح الباركود هنا (سكانر)..." 
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="w-full text-center text-2xl p-5 border-2 border-blue-200 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition"
              autoFocus
            />
            <button 
              type="submit" 
              disabled={loading || !barcode}
              className="absolute left-3 top-3 bottom-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-6 font-bold rounded-xl transition"
            >
              {loading ? 'جاري البحث...' : 'استعلام'}
            </button>
          </div>
        </div>
      </form>

      {showCamera && (
        <CameraScanner
          onScan={(text) => {
            setBarcode(text);
            setShowCamera(false);
            // We use setTimeout to allow the state to update, then submit the form programmatically
            setTimeout(() => {
              if (inputRef.current?.form) {
                inputRef.current.form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
              }
            }, 100);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-6 rounded-2xl text-center font-bold text-lg border border-red-100 mb-8 animate-fade-in shadow-sm">
          {error}
        </div>
      )}

      {/* FABRIC RESULT */}
      {resultType === 'fabric' && fabricResults && (
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden animate-fade-in border border-gray-100">
          <div className="bg-gradient-to-r from-green-600 to-emerald-500 p-6 text-white text-center">
            <Package size={48} className="mx-auto mb-3 opacity-90" />
            <h2 className="text-2xl font-black mb-1">رصيد المخزن: {fabricResults.color}</h2>
            <p className="text-green-50 font-medium text-lg">{fabricResults.type}</p>
          </div>
          
          <div className="p-8">
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="bg-green-50 border border-green-100 rounded-2xl p-6 text-center">
                <p className="text-green-800 font-bold mb-1">عدد الأتواب المتاحة</p>
                <p className="text-4xl font-black text-green-600">{fabricResults.count} <span className="text-xl">توب</span></p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 text-center">
                <p className="text-blue-800 font-bold mb-1">الوزن الإجمالي المتاح</p>
                <p className="text-4xl font-black text-blue-600">{fabricResults.weight.toFixed(1)} <span className="text-xl">كجم</span></p>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-bold text-gray-700 mb-4">أكواد الأتواب (أول 10):</h3>
              <div className="flex flex-wrap gap-2">
                {fabricResults.rolls.map(r => (
                  <span key={r.code} className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200">
                    {r.code} ({r.amount}{r.unit})
                  </span>
                ))}
                {fabricResults.count > 10 && (
                  <span className="bg-gray-50 text-gray-400 px-3 py-1.5 rounded-lg text-sm font-medium">
                    + {fabricResults.count - 10} أتواب أخرى...
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ORDER RESULT */}
      {resultType === 'order' && orderResult && (
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden animate-fade-in border border-gray-100">
          <div className="bg-gradient-to-r from-blue-700 to-indigo-600 p-6 text-white text-center">
            <ShoppingBag size={48} className="mx-auto mb-3 opacity-90" />
            <h2 className="text-2xl font-black mb-1">أمر تشغيل: {orderResult.shortId}</h2>
            <p className="text-blue-100 font-medium text-lg">{orderResult.modelName}</p>
          </div>
          
          <div className="p-8">
            <div className="flex items-center justify-center gap-2 mb-8 text-xl font-bold">
              <MapPin className="text-gray-400" />
              الموقع الحالي: 
              <span className={`px-4 py-1.5 rounded-full ${getOrderStatusDisplay(orderResult.status).color}`}>
                {getOrderStatusDisplay(orderResult.status).label}
              </span>
            </div>

            <div className="relative mb-10 pb-10 overflow-x-auto">
              <div className="flex items-center justify-between min-w-[600px] relative px-4">
                <div className="absolute top-1/2 left-8 right-8 h-1 bg-gray-200 -z-10 -translate-y-1/2 rounded-full"></div>
                {statusFlow.map((s, idx) => {
                  const currentIndex = statusFlow.indexOf(orderResult.status || 'new');
                  const isPast = idx < currentIndex;
                  const isCurrent = idx === currentIndex;
                  
                  return (
                    <div key={s} className="flex flex-col items-center gap-3 bg-white px-2 relative">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-4 transition-all ${
                        isPast ? 'bg-blue-600 border-blue-200 text-white' : 
                        isCurrent ? 'bg-orange-500 border-orange-200 text-white scale-125 shadow-lg' : 
                        'bg-gray-100 border-gray-200 text-gray-400'
                      }`}>
                        {idx + 1}
                      </div>
                      <span className={`text-xs font-bold ${
                        isCurrent ? 'text-orange-600' : 
                        isPast ? 'text-blue-600' : 'text-gray-400'
                      }`}>
                        {getOrderStatusDisplay(s).label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-6 rounded-2xl border border-gray-100">
              <div>
                <p className="text-sm text-gray-500 mb-1">الكمية المستهدفة</p>
                <p className="font-bold text-lg text-gray-800">{orderResult.totalQuantity} قطعة</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">تاريخ الإصدار</p>
                <p className="font-bold text-lg text-gray-800">
                  {orderResult.createdAt?.toDate ? orderResult.createdAt.toDate().toLocaleDateString('ar-EG') : '---'}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-500 mb-1">تفاصيل الألوان</p>
                <p className="font-medium text-gray-700">{orderResult.colors}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE ROLL RESULT */}
      {resultType === 'roll' && rollResult && (
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden animate-fade-in border border-gray-100">
          <div className="bg-gradient-to-r from-orange-600 to-amber-500 p-6 text-white text-center">
            <Package size={48} className="mx-auto mb-3 opacity-90" />
            <h2 className="text-2xl font-black mb-1">توب قماش: {rollResult.code}</h2>
            <p className="text-orange-50 font-medium text-lg">{rollResult.type} - {rollResult.color}</p>
          </div>
          
          <div className="p-8">
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-6 text-center">
                <p className="text-orange-800 font-bold mb-1">الوزن / الكمية</p>
                <p className="text-4xl font-black text-orange-600">{rollResult.amount} <span className="text-xl">{rollResult.unit}</span></p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center flex flex-col justify-center items-center">
                <p className="text-gray-500 font-bold mb-1">حالة التوب</p>
                {rollResult.status === 'in_stock' ? (
                  <span className="bg-green-100 text-green-800 px-4 py-1.5 rounded-full font-bold text-lg">متاح في المخزن</span>
                ) : rollResult.status === 'reserved' ? (
                  <span className="bg-yellow-100 text-yellow-800 px-4 py-1.5 rounded-full font-bold text-lg">محجوز لأمر تشغيل</span>
                ) : rollResult.status === 'used' ? (
                  <span className="bg-red-100 text-red-800 px-4 py-1.5 rounded-full font-bold text-lg">تم استخدامه</span>
                ) : (
                  <span className="bg-gray-200 text-gray-800 px-4 py-1.5 rounded-full font-bold text-lg">{rollResult.status || 'غير معروف'}</span>
                )}
              </div>
            </div>

            {rollResult.usedInOrder && (
              <div className="border-t pt-6 text-center">
                <p className="text-gray-500 font-bold mb-2">مرتبط بأمر شغل:</p>
                <span className="inline-block bg-blue-50 text-blue-700 px-6 py-2 rounded-xl text-xl font-black border border-blue-100">
                  {rollResult.usedInOrder}
                </span>
                <p className="text-sm text-gray-400 mt-3">امسح باركود أمر الشغل لمعرفة مكانه في المصنع</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
