"use client";

import { useEffect, useState } from "react";
import { db } from "../../../lib/firebase";
import { collection, query, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { Calculator, X, ChevronRight, ChevronLeft } from "lucide-react";

const STAGES = [
  "قسم العينات",
  "اوردر قماش",
  "مخزن قماش",
  "قسم القص",
  "قسم الفرز",
  "قسم الطباعة - ليزر",
  "قسم القص والتفريغ",
  "قسم الكبس",
  "قسم التجويز",
  "قسم المكن",
  "قسم التشطيب",
  "قسم المكواة",
  "التعبئة والتكييس",
  "مخزن الموديلات"
];

interface ProductionOrder {
  id: string;
  modelName: string;
  totalQuantity: number;
  modelImage?: string;
  currentStage: number; // 1 to 14
  status: string;
  costs?: {
    fabric: number;
    printing: number;
    accessories: number;
    labor: number;
  };
  createdAt: any;
}

export default function FactoryKanbanBoard() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Cost Modal State
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);
  const [costs, setCosts] = useState({ fabric: 0, printing: 0, accessories: 0, labor: 0 });
  const [savingCosts, setSavingCosts] = useState(false);

  useEffect(() => {
    // Fetch from new collection
    const q = query(collection(db, "factory_production_orders"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ProductionOrder[];
      setOrders(fetched);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const moveOrder = async (orderId: string, currentStage: number, direction: 'next' | 'prev') => {
    let newStage = direction === 'next' ? currentStage + 1 : currentStage - 1;
    if (newStage < 1 || newStage > 14) return;

    try {
      await updateDoc(doc(db, "factory_production_orders", orderId), {
        currentStage: newStage
      });
    } catch (error) {
      console.error("Error moving order", error);
      alert("حدث خطأ أثناء نقل الأمر");
    }
  };

  const openCostModal = (order: ProductionOrder) => {
    setSelectedOrder(order);
    setCosts({
      fabric: order.costs?.fabric || 0,
      printing: order.costs?.printing || 0,
      accessories: order.costs?.accessories || 0,
      labor: order.costs?.labor || 0,
    });
  };

  const saveCosts = async () => {
    if (!selectedOrder) return;
    setSavingCosts(true);
    try {
      await updateDoc(doc(db, "factory_production_orders", selectedOrder.id), {
        costs
      });
      setSelectedOrder(null);
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء حفظ التكاليف");
    }
    setSavingCosts(false);
  };

  if (loading) {
    return <div className="p-10 text-center font-bold text-gray-500">جاري تحميل حركة المصنع...</div>;
  }

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col" dir="rtl">
      <div className="mb-4 shrink-0">
        <h2 className="text-2xl font-bold text-gray-800">حركة المصنع (لوحة الإنتاج) 🏭</h2>
        <p className="text-gray-500 text-sm mt-1">تتبع مسار الموديلات عبر الـ 14 مرحلة وحساب تكاليفها.</p>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 flex gap-4 overflow-x-auto pb-4 custom-scrollbar items-start">
        {STAGES.map((stageName, index) => {
          const stageNumber = index + 1;
          const stageOrders = orders.filter(o => o.currentStage === stageNumber);
          const totalPieces = stageOrders.reduce((sum, o) => sum + (Number(o.totalQuantity) || 0), 0);

          return (
            <div key={stageNumber} className="min-w-[240px] max-w-[240px] flex flex-col bg-gray-100 rounded-xl max-h-full border border-gray-200 shrink-0">
              {/* Column Header */}
              <div className="p-3 bg-gray-200 rounded-t-xl border-b border-gray-300 flex justify-between items-center sticky top-0">
                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                  <span className="bg-gray-800 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">{stageNumber}</span>
                  {stageName}
                </h3>
                <div className="bg-white text-blue-800 px-2 py-0.5 rounded text-xs font-bold shadow-sm" title="إجمالي القطع في هذا القسم">
                  {totalPieces} ق
                </div>
              </div>

              {/* Cards Container */}
              <div className="p-2 flex flex-col gap-3 overflow-y-auto custom-scrollbar flex-1">
                {stageOrders.length === 0 ? (
                  <p className="text-center text-gray-400 text-xs mt-4 mb-4">لا يوجد شغل حالياً</p>
                ) : (
                  stageOrders.map(order => {
                    const totalCost = (order.costs?.fabric || 0) + (order.costs?.printing || 0) + (order.costs?.accessories || 0) + (order.costs?.labor || 0);
                    const costPerPiece = totalCost > 0 ? (totalCost / order.totalQuantity).toFixed(2) : 0;

                    return (
                      <div key={order.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 relative group transition hover:shadow-md">
                        <div className="flex gap-3">
                          {order.modelImage && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={order.modelImage} alt="model" className="w-16 h-16 object-cover rounded border border-gray-100" />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm text-gray-800 truncate" title={order.modelName}>{order.modelName}</h4>
                            <p className="text-xs text-gray-500 mb-1">الكمية: <strong>{order.totalQuantity}</strong></p>
                            <p className="text-[10px] text-gray-400 font-mono">#{order.id.slice(-6).toUpperCase()}</p>
                          </div>
                        </div>

                        {/* Cost Info inside card */}
                        {totalCost > 0 && (
                          <div className="mt-2 bg-green-50 text-green-800 text-xs p-1.5 rounded flex justify-between items-center border border-green-100">
                            <span>إجمالي: {totalCost} ج</span>
                            <span className="font-bold">القطعة: {costPerPiece} ج</span>
                          </div>
                        )}

                        {/* Actions Container */}
                        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                          <div className="flex gap-1">
                            <button onClick={() => moveOrder(order.id, stageNumber, 'prev')} disabled={stageNumber === 1} className="p-1 text-gray-400 hover:text-gray-800 disabled:opacity-30 bg-gray-50 rounded">
                              <ChevronRight size={16} />
                            </button>
                            <button onClick={() => moveOrder(order.id, stageNumber, 'next')} disabled={stageNumber === 14} className="p-1 text-gray-400 hover:text-gray-800 disabled:opacity-30 bg-gray-50 rounded">
                              <ChevronLeft size={16} />
                            </button>
                          </div>
                          
                          <button 
                            onClick={() => openCostModal(order)}
                            className="text-xs flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 transition"
                          >
                            <Calculator size={12} />
                            التكاليف
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cost Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" dir="rtl">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Calculator size={18} className="text-blue-600" />
                حساب التكاليف
              </h3>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-red-500 transition">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-gray-100 p-3 rounded-lg mb-4 text-center">
                <p className="font-bold text-gray-700">{selectedOrder.modelName}</p>
                <p className="text-sm text-gray-500">الكمية المستهدفة: {selectedOrder.totalQuantity} قطعة</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center border-b pb-2">
                  <label className="text-sm font-bold text-gray-700">تكلفة القماش (بالجنيه)</label>
                  <input type="number" value={costs.fabric || ''} onChange={(e) => setCosts({...costs, fabric: Number(e.target.value)})} className="w-32 p-1.5 border rounded text-left" />
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <label className="text-sm font-bold text-gray-700">تكلفة الطباعة</label>
                  <input type="number" value={costs.printing || ''} onChange={(e) => setCosts({...costs, printing: Number(e.target.value)})} className="w-32 p-1.5 border rounded text-left" />
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <label className="text-sm font-bold text-gray-700">الإكسسوارات (سوست، كاردون..)</label>
                  <input type="number" value={costs.accessories || ''} onChange={(e) => setCosts({...costs, accessories: Number(e.target.value)})} className="w-32 p-1.5 border rounded text-left" />
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <label className="text-sm font-bold text-gray-700">تكلفة العمالة (تقريبي)</label>
                  <input type="number" value={costs.labor || ''} onChange={(e) => setCosts({...costs, labor: Number(e.target.value)})} className="w-32 p-1.5 border rounded text-left" />
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg mt-4">
                <div className="flex justify-between font-bold text-blue-900 mb-1">
                  <span>الإجمالي:</span>
                  <span>{costs.fabric + costs.printing + costs.accessories + costs.labor} ج</span>
                </div>
                <div className="flex justify-between text-sm text-blue-700">
                  <span>تكلفة القطعة الواحدة:</span>
                  <span>{((costs.fabric + costs.printing + costs.accessories + costs.labor) / selectedOrder.totalQuantity).toFixed(2)} ج</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t flex gap-2">
              <button onClick={saveCosts} disabled={savingCosts} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition">
                {savingCosts ? 'جاري الحفظ...' : 'حفظ التكاليف'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 14px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 8px;
          box-shadow: inset 0 0 5px rgba(0,0,0,0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #94a3b8;
          border-radius: 8px;
          border: 3px solid #f1f5f9;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: #64748b;
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
