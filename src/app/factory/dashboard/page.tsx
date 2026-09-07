"use client";

import { useEffect, useState } from "react";
import { db } from "../../../lib/firebase";
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { Edit, Calculator, X, Printer, Copy, Trash2, MoreVertical, SplitSquareHorizontal, Plus, Minus } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import Link from "next/link";
import { useRouter } from "next/navigation";

const STAGES = [
  { id: 1, name: "قسم العينات", bg: "bg-blue-50", border: "border-blue-200" },
  { id: 2, name: "اوردر قماش", bg: "bg-indigo-50", border: "border-indigo-200" },
  { id: 3, name: "مخزن قماش", bg: "bg-cyan-50", border: "border-cyan-200" },
  { id: 4, name: "قسم القص", bg: "bg-teal-50", border: "border-teal-200" },
  { id: 5, name: "قسم الفرز", bg: "bg-emerald-50", border: "border-emerald-200" },
  { id: 6, name: "قسم الطباعة - ليزر", bg: "bg-green-50", border: "border-green-200" },
  { id: 7, name: "قسم القص والتفريغ", bg: "bg-lime-50", border: "border-lime-200" },
  { id: 8, name: "قسم الكبس", bg: "bg-yellow-50", border: "border-yellow-200" },
  { id: 9, name: "قسم التجويز", bg: "bg-amber-50", border: "border-amber-200" },
  { id: 10, name: "قسم المكن", bg: "bg-orange-50", border: "border-orange-200" },
  { id: 11, name: "قسم التشطيب", bg: "bg-red-50", border: "border-red-200" },
  { id: 12, name: "قسم المكواة", bg: "bg-rose-50", border: "border-rose-200" },
  { id: 13, name: "التعبئة والتكييس", bg: "bg-pink-50", border: "border-pink-200" },
  { id: 14, name: "مخزن الموديلات", bg: "bg-purple-50", border: "border-purple-200" }
];

export default function FactoryDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [costs, setCosts] = useState({ fabric: 0, printing: 0, accessories: 0, labor: 0 });
  const [savingCosts, setSavingCosts] = useState(false);
  const [isBrowser, setIsBrowser] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  // Split Feature State
  const [splitOrder, setSplitOrder] = useState<any | null>(null);
  const [splitRows, setSplitRows] = useState<{color: string, quantity: string}[]>([]);
  const [splitting, setSplitting] = useState(false);

  const router = useRouter();

  useEffect(() => {
    setIsBrowser(true);
    const q = query(collection(db, "factory_production_orders"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0));
      setOrders(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    
    const newStage = parseInt(destination.droppableId.replace('stage-', ''));
    const movingOrder = orders.find(o => o.id === draggableId);
    if (!movingOrder) return;

    const newOrders = Array.from(orders);
    const fromIndex = newOrders.findIndex(o => o.id === draggableId);
    newOrders.splice(fromIndex, 1);
    movingOrder.currentStage = newStage;
    
    const destStageOrders = newOrders.filter(o => o.currentStage === newStage);
    let insertIndex = 0;
    if (destStageOrders.length === 0) {
      insertIndex = newOrders.length;
    } else {
      if (destination.index >= destStageOrders.length) {
        const lastItem = destStageOrders[destStageOrders.length - 1];
        insertIndex = newOrders.findIndex(o => o.id === lastItem.id) + 1;
      } else {
        const targetItem = destStageOrders[destination.index];
        insertIndex = newOrders.findIndex(o => o.id === targetItem.id);
      }
    }
    
    newOrders.splice(insertIndex, 0, movingOrder);
    const finalDestOrders = newOrders.filter(o => o.currentStage === newStage);
    setOrders(newOrders);
    
    try {
      await updateDoc(doc(db, "factory_production_orders", draggableId), {
        currentStage: newStage,
        orderIndex: destination.index
      });
      finalDestOrders.forEach((o, idx) => {
        if (o.id !== draggableId && o.orderIndex !== idx) {
          updateDoc(doc(db, "factory_production_orders", o.id), { orderIndex: idx });
        }
      });
    } catch (err) {
      console.error("Error moving order: ", err);
    }
  };

  const handleDuplicate = async (order: any) => {
    setActiveMenuId(null);
    if (!confirm('هل تريد تكرار هذا الموديل بأمر تشغيل جديد (نسخة مطابقة)؟')) return;
    try {
      const { id, createdAt, ...orderData } = order;
      await addDoc(collection(db, 'factory_production_orders'), {
        ...orderData,
        modelName: order.modelName + ' (نسخة)',
        currentStage: 1, 
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء التكرار');
    }
  };

  const handleDelete = async (id: string) => {
    setActiveMenuId(null);
    if (!confirm('هل أنت متأكد من حذف أمر التشغيل هذا نهائياً؟')) return;
    try {
      await deleteDoc(doc(db, 'factory_production_orders', id));
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الحذف');
    }
  };

  const openCostModal = (order: any) => {
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
      await updateDoc(doc(db, "factory_production_orders", selectedOrder.id), { costs });
      setSelectedOrder(null);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الحفظ');
    } finally {
      setSavingCosts(false);
    }
  };

  // --- Split Functions ---
  const openSplitModal = (order: any) => {
    setActiveMenuId(null);
    setSplitOrder(order);
    let colors = [''];
    if (order.fabricColor) {
      colors = order.fabricColor.split(/[،,-]/).map((c: string) => c.trim()).filter((c: string) => c);
    }
    if (colors.length > 0) {
      setSplitRows(colors.map((c: string) => ({ color: c, quantity: '' })));
    } else {
      setSplitRows([{ color: '', quantity: '' }]);
    }
  };

  const addSplitRow = () => {
    setSplitRows([...splitRows, { color: '', quantity: '' }]);
  };

  const removeSplitRow = (idx: number) => {
    const newRows = [...splitRows];
    newRows.splice(idx, 1);
    setSplitRows(newRows);
  };

  const handleSplitSubmit = async () => {
    if (!splitOrder) return;
    
    const totalSplit = splitRows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
    if (totalSplit !== Number(splitOrder.totalQuantity)) {
      alert(`إجمالي الكميات الموزعة (${totalSplit}) لا يساوي الكمية الأصلية للأمر (${splitOrder.totalQuantity} قطعة). الرجاء مراجعة الأرقام.`);
      return;
    }

    if (splitRows.some(r => !r.color.trim() || !r.quantity)) {
      alert('الرجاء إدخال اسم اللون والكمية لجميع الصفوف');
      return;
    }

    setSplitting(true);
    try {
      const { id, createdAt, ...originalData } = splitOrder;

      // Create a new order for each color
      for (const row of splitRows) {
        await addDoc(collection(db, 'factory_production_orders'), {
          ...originalData,
          modelName: `${originalData.modelName} - ${row.color}`,
          totalQuantity: Number(row.quantity),
          originalOrderId: originalData.originalOrderId || splitOrder.id,
          isSplitChild: true,
          createdAt: serverTimestamp(),
        });
      }

      // Delete the original
      await deleteDoc(doc(db, 'factory_production_orders', splitOrder.id));

      setSplitOrder(null);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تقسيم أمر التشغيل');
    } finally {
      setSplitting(false);
    }
  };
  // ----------------------

  if (loading || !isBrowser) {
    return <div className="p-20 text-center font-bold text-gray-500">جاري تحميل حركة المصنع...</div>;
  }

  const handleWrapperClick = () => {
    if (activeMenuId) setActiveMenuId(null);
  };

  return (
    <div className="h-[calc(100vh-150px)] flex flex-col" dir="rtl" onClick={handleWrapperClick}>
      <div className="mb-4 shrink-0 flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">حركة المصنع (لوحة الإنتاج) 🏭</h2>
          <p className="text-gray-500 text-sm mt-1">تتبع مسار الموديلات، قم بسحب وإسقاط الكروت (Drag & Drop) بين الأقسام أو ترتيبها كما تشاء.</p>
        </div>
        <Link 
          href="/factory/production/new" 
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-blue-700 transition flex items-center gap-2"
        >
          <span className="text-xl leading-none">+</span> إصدار أمر تشغيل
        </Link>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar pb-3">
          <div className="bg-gray-100 rounded-xl p-4 shadow-inner flex gap-4 h-full min-w-max">
            {STAGES.map((stage) => {
              const stageOrders = orders.filter(o => o.currentStage === stage.id);
              const totalPieces = stageOrders.reduce((sum, o) => sum + (Number(o.totalQuantity) || 0), 0);

            return (
              <Droppable key={stage.id} droppableId={`stage-${stage.id}`}>
                {(provided, snapshot) => (
                  <div 
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`shrink-0 w-64 rounded-xl border flex flex-col h-fit max-h-full ${stage.bg} ${stage.border} ${snapshot.isDraggingOver ? 'ring-2 ring-blue-400' : ''}`}
                  >
                    <div className="p-3 border-b border-black/5 flex justify-between items-center bg-black/5 rounded-t-xl shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="bg-gray-800 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full font-bold">{stage.id}</span>
                        <h3 className="font-bold text-gray-800 text-sm">{stage.name}</h3>
                      </div>
                      <span className="text-xs bg-white text-gray-600 px-2 py-0.5 rounded-full font-mono font-bold shadow-sm">{totalPieces} ق</span>
                    </div>

                    <div className="p-2 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2">
                      {stageOrders.length === 0 && !snapshot.isDraggingOver && (
                        <div className="text-center p-4 text-xs text-gray-400 mt-4">لا يوجد شغل حالياً</div>
                      )}

                      {stageOrders.map((order, index) => {
                        const totalCost = (order.costs?.fabric || 0) + (order.costs?.printing || 0) + (order.costs?.accessories || 0) + (order.costs?.labor || 0);
                        const costPerPiece = totalCost > 0 ? (totalCost / order.totalQuantity).toFixed(2) : 0;

                        return (
                          <Draggable key={order.id} draggableId={order.id} index={index}>
                            {(provided, snapshot) => (
                              <div 
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`bg-white p-3 rounded-lg border border-gray-200 relative group transition shadow-sm ${snapshot.isDragging ? 'shadow-2xl ring-2 ring-blue-500 rotate-2' : 'hover:shadow-md'}`}
                              >
                                
                                <div className="absolute top-2 left-2 z-10">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuId(activeMenuId === order.id ? null : order.id);
                                    }}
                                    className="text-gray-400 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100"
                                  >
                                    <MoreVertical size={16} />
                                  </button>
                                  
                                  {activeMenuId === order.id && (
                                    <div className="absolute top-6 left-0 bg-white border shadow-lg rounded-lg w-32 overflow-hidden z-50 flex flex-col">
                                      <Link
                                        href={`/factory/production/print/${order.id}`}
                                        className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                                        role="menuitem"
                                      >
                                        <Printer size={13} />
                                        عرض / طباعة
                                      </Link>
                                      
                                      <Link
                                        href={`/factory/production/edit/${order.id}`}
                                        className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                                        role="menuitem"
                                      >
                                        <Edit size={13} />
                                        تعديل
                                      </Link>
                                      
                                      {/* Split Button */}
                                      <button onClick={(e) => { e.stopPropagation(); openSplitModal(order); }} className="text-right px-2 py-1.5 text-xs font-semibold hover:bg-gray-50 flex items-center gap-2">
                                        <SplitSquareHorizontal size={13} className="text-blue-600" /> تقسيم الألوان
                                      </button>

                                      <button onClick={(e) => { e.stopPropagation(); handleDuplicate(order); }} className="text-right px-2 py-1.5 text-xs font-semibold hover:bg-gray-50 flex items-center gap-2 border-t">
                                        <Copy size={13} className="text-gray-600" /> تكرار الموديل
                                      </button>
                                      <button onClick={(e) => { e.stopPropagation(); handleDelete(order.id); }} className="text-right px-2 py-1.5 text-xs font-semibold hover:bg-red-50 text-red-600 flex items-center gap-2 border-t">
                                        <Trash2 size={14} /> حذف نهائي
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <div className="flex gap-3 mt-1">
                                  {order.modelImage && (
                                    <img src={order.modelImage} alt="model" className="w-16 h-16 object-cover rounded border border-gray-100" />
                                  )}
                                  <div className="flex-1 min-w-0 pr-1">
                                    <h4 className="font-bold text-sm text-gray-800 truncate" title={order.modelName}>{order.modelName}</h4>
                                    <p className="text-xs text-gray-500 mb-1">الكمية: <strong>{order.totalQuantity}</strong></p>
                                    <p className="text-[10px] text-gray-400 font-mono mb-1">#{order.id.slice(-6).toUpperCase()}</p>
                                    {order.lastWorkerName && (
                                      <p className="text-[11px] text-blue-600 font-bold truncate bg-blue-50 px-1 py-0.5 rounded w-fit" title={order.lastWorkerName}>
                                        👤 {order.lastWorkerName}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {totalCost > 0 && (
                                  <div className="mt-2 bg-green-50 text-green-800 text-xs p-1.5 rounded flex justify-between items-center border border-green-100">
                                    <span>الإجمالي: {totalCost} ج</span>
                                    <span className="font-bold">القطعة: {costPerPiece} ج</span>
                                  </div>
                                )}

                                <div className="mt-3 pt-3 border-t border-gray-100">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); openCostModal(order); }}
                                    className="w-full text-xs flex justify-center items-center gap-2 bg-blue-50 text-blue-700 px-2 py-1.5 rounded hover:bg-blue-100 transition font-bold"
                                  >
                                    <Calculator size={14} />
                                    التكاليف
                                  </button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
          </div>
        </div>
      </DragDropContext>

      {/* Split Modal */}
      {splitOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" dir="rtl">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <SplitSquareHorizontal size={20} className="text-blue-600" />
                فصل أمر التشغيل حسب الألوان
              </h3>
              <button onClick={() => setSplitOrder(null)} className="text-gray-400 hover:text-red-500 transition">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex flex-col gap-2">
                <p className="font-bold text-gray-800">الموديل: {splitOrder.modelName}</p>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">الألوان المذكورة مسبقاً:</span>
                  <span className="font-bold text-gray-900">{splitOrder.fabricColor || 'لا يوجد'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">الكمية الإجمالية للأمر:</span>
                  <span className="font-bold text-blue-700 text-lg">{splitOrder.totalQuantity} قطعة</span>
                </div>
              </div>

              <p className="text-sm text-gray-500">قم بتوزيع الكمية الإجمالية على الألوان لتكوين أوامر تشغيل منفصلة على اللوحة لكل لون (لن يتم التأثير على الورقة المطبوعة).</p>

              <div className="space-y-3 mt-4">
                {splitRows.map((row, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <div className="flex-1">
                      <input 
                        type="text" 
                        placeholder="اسم اللون (مثال: أحمر)" 
                        value={row.color}
                        onChange={(e) => {
                          const newRows = [...splitRows];
                          newRows[idx].color = e.target.value;
                          setSplitRows(newRows);
                        }}
                        className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="w-32">
                      <input 
                        type="number" 
                        placeholder="الكمية" 
                        value={row.quantity}
                        onChange={(e) => {
                          const newRows = [...splitRows];
                          newRows[idx].quantity = e.target.value;
                          setSplitRows(newRows);
                        }}
                        className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {splitRows.length > 1 && (
                      <button onClick={() => removeSplitRow(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded">
                        <Minus size={20} />
                      </button>
                    )}
                  </div>
                ))}
                
                <button onClick={addSplitRow} className="text-blue-600 text-sm font-bold flex items-center gap-1 hover:underline mt-2">
                  <Plus size={16} /> إضافة لون آخر
                </button>
              </div>

              {/* Status footer inside modal */}
              {(() => {
                const totalSplit = splitRows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
                const isMatch = totalSplit === Number(splitOrder.totalQuantity);
                return (
                  <div className={`mt-4 p-3 rounded text-sm font-bold flex justify-between ${isMatch ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    <span>إجمالي الموزع: {totalSplit}</span>
                    <span>المتبقي: {Number(splitOrder.totalQuantity) - totalSplit}</span>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 bg-gray-50 border-t flex gap-2">
              <button 
                onClick={handleSplitSubmit} 
                disabled={splitting || splitRows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0) !== Number(splitOrder.totalQuantity)} 
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {splitting ? 'جاري التقسيم...' : <><SplitSquareHorizontal size={18} /> تقسيم الأمر الآن</>}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <label className="text-sm font-bold text-gray-700">تكلفة القماش (بالكامل)</label>
                  <input type="number" value={costs.fabric || ''} onChange={(e) => setCosts({...costs, fabric: Number(e.target.value)})} className="w-32 p-1.5 border rounded text-left" />
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <label className="text-sm font-bold text-gray-700">تكلفة الطباعة</label>
                  <input type="number" value={costs.printing || ''} onChange={(e) => setCosts({...costs, printing: Number(e.target.value)})} className="w-32 p-1.5 border rounded text-left" />
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <label className="text-sm font-bold text-gray-700">الإكسسوارات (سوست، كرتون..)</label>
                  <input type="number" value={costs.accessories || ''} onChange={(e) => setCosts({...costs, accessories: Number(e.target.value)})} className="w-32 p-1.5 border rounded text-left" />
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <label className="text-sm font-bold text-gray-700">تكلفة العمالة (تقفيل)</label>
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
