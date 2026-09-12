"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "../../../lib/firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy } from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";

interface Roll {
  id: string;
  code: string;
  color: string;
  amount: number;
  unit: string;
  fabricType: string;
  status: string;
  createdAt?: any;
}

export default function FabricInventoryPage() {
  const router = useRouter();
  
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [color, setColor] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [unit, setUnit] = useState("كيلو");
  const [fabricType, setFabricType] = useState("ميلتون");
  
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");
  
  // Modal for barcode printing
  const [printRoll, setPrintRoll] = useState<Roll | null>(null);

  useEffect(() => {
    fetchRolls();
  }, []);

  const fetchRolls = async () => {
    try {
      // Get all rolls that are in stock
      const q = query(collection(db, "factory_fabric_rolls"), where("status", "==", "in_stock"));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Roll));
      // Sort in JS since we don't want to require an index for status + createdAt right away
      data.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setRolls(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!color.trim() || !amount) {
      setError("يرجى إدخال اللون والكمية");
      return;
    }
    
    setIsAdding(true);
    setError("");
    
    try {
      // Generate a unique 8-digit code
      const code = Math.floor(10000000 + Math.random() * 90000000).toString();
      
      const newRoll = {
        code,
        color: color.trim(),
        amount: Number(amount),
        unit,
        fabricType,
        status: "in_stock",
        createdAt: serverTimestamp(),
      };
      
      const docRef = await addDoc(collection(db, "factory_fabric_rolls"), newRoll);
      const rollWithId = { ...newRoll, id: docRef.id } as Roll;
      
      setRolls([rollWithId, ...rolls]);
      setColor("");
      setAmount("");
      
      // Auto-open print modal for the new roll
      setPrintRoll(rollWithId);
      
    } catch (err) {
      setError("حدث خطأ أثناء إضافة التوب");
    } finally {
      setIsAdding(false);
    }
  };

  const handlePrintBarcode = () => {
    window.print();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Hide header and UI when printing */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          #print-section, #print-section * { visibility: visible; }
          #print-section { position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; }
          .no-print { display: none !important; }
        }
      `}} />

      <div className="flex justify-between items-center mb-6 no-print">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          ➕ إضافة وإدارة أتواب القماش
        </h1>
        <button 
          onClick={() => router.back()}
          className="btn bg-gray-200 text-gray-700 font-bold px-4 py-2 rounded-lg"
        >
          رجوع
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
        {/* Form to add roll */}
        <div className="card p-6 bg-white shadow-sm rounded-xl border-t-4 border-t-green-500 h-fit">
          <h2 className="text-xl font-bold mb-4">تسجيل توب جديد</h2>
          <form onSubmit={handleAddRoll} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">نوع القماش</label>
              <select className="input w-full" value={fabricType} onChange={(e) => setFabricType(e.target.value)}>
                <option value="ميلتون">ميلتون</option>
                <option value="سنجل">سنجل</option>
                <option value="بيكة">بيكة</option>
                <option value="جبردين">جبردين</option>
                <option value="وتر بروف">وتر بروف</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">لون التوب</label>
              <input 
                type="text" 
                className="input w-full" 
                placeholder="مثال: أسود، أزرق زهرى..." 
                value={color}
                onChange={(e) => setColor(e.target.value)}
                required
              />
            </div>
            
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-sm font-bold text-gray-700 mb-1">الكمية (الوزن)</label>
                <input 
                  type="number" 
                  step="0.1"
                  className="input w-full text-left" 
                  placeholder="0.0" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                />
              </div>
              <div className="w-1/3">
                <label className="block text-sm font-bold text-gray-700 mb-1">الوحدة</label>
                <select className="input w-full" value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="كيلو">كيلو</option>
                  <option value="متر">متر</option>
                  <option value="توب">توب</option>
                </select>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm font-bold">{error}</p>}

            <button 
              type="submit" 
              disabled={isAdding}
              className="btn bg-green-600 hover:bg-green-700 text-white font-bold w-full mt-2"
            >
              {isAdding ? "جاري الإضافة..." : "تسجيل التوب وإصدار باركود"}
            </button>
          </form>
        </div>

        {/* List of current stock */}
        <div className="lg:col-span-2 card p-6 bg-white shadow-sm rounded-xl border border-gray-100">
          <h2 className="text-xl font-bold mb-4">الرصيد الحالي بالمخزن ({rolls.length} توب)</h2>
          
          {loading ? (
            <p className="text-gray-500">جاري التحميل...</p>
          ) : rolls.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 rounded-lg text-gray-500">
              لا توجد أتواب مسجلة حالياً
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="p-3">الكود</th>
                    <th className="p-3">النوع</th>
                    <th className="p-3">اللون</th>
                    <th className="p-3">الكمية</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {rolls.map((roll) => (
                    <tr key={roll.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-bold">{roll.code}</td>
                      <td className="p-3">{roll.fabricType}</td>
                      <td className="p-3 font-bold text-blue-700">{roll.color}</td>
                      <td className="p-3">{roll.amount} {roll.unit}</td>
                      <td className="p-3 text-center">
                        <button 
                          onClick={() => setPrintRoll(roll)}
                          className="text-xs bg-gray-800 text-white px-3 py-1 rounded hover:bg-black"
                        >
                          طباعة الباركود
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Print Modal */}
      {printRoll && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 no-print">
          <div className="bg-white p-8 rounded-xl max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-center">معاينة التيكت</h2>
            
            {/* The actual element that will be printed */}
            <div id="print-section" className="border-4 border-black p-6 w-[80mm] h-[60mm] flex flex-col items-center justify-center bg-white mx-auto">
              <h3 className="font-black text-xl mb-1">{printRoll.fabricType}</h3>
              <p className="font-bold text-2xl mb-2">{printRoll.color}</p>
              
              <div className="my-2">
                <QRCodeSVG value={printRoll.code} size={90} />
              </div>
              
              <p className="font-mono font-bold text-lg">{printRoll.code}</p>
              <p className="font-bold text-lg mt-1 border-t-2 border-black pt-1 w-full text-center">
                {printRoll.amount} {printRoll.unit}
              </p>
            </div>

            <div className="flex gap-4 mt-8">
              <button 
                onClick={handlePrintBarcode}
                className="btn bg-blue-600 text-white flex-1 py-2 font-bold"
              >
                🖨️ طباعة
              </button>
              <button 
                onClick={() => setPrintRoll(null)}
                className="btn bg-gray-200 text-gray-700 flex-1 py-2 font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
