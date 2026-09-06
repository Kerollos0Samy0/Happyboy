"use client";

import { useEffect, useState } from "react";
import { db } from "../../../lib/firebase";
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { Calculator, X, Printer, Copy, Trash2, MoreVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import Link from "next/link";
import { useRouter } from "next/navigation";

const STAGES = [
  { id: 1, name: "??? ???????", bg: "bg-blue-50", border: "border-blue-200" },
  { id: 2, name: "????? ????", bg: "bg-indigo-50", border: "border-indigo-200" },
  { id: 3, name: "???? ????", bg: "bg-cyan-50", border: "border-cyan-200" },
  { id: 4, name: "??? ????", bg: "bg-teal-50", border: "border-teal-200" },
  { id: 5, name: "??? ?????", bg: "bg-emerald-50", border: "border-emerald-200" },
  { id: 6, name: "??? ??????? - ????", bg: "bg-green-50", border: "border-green-200" },
  { id: 7, name: "??? ???? ????????", bg: "bg-lime-50", border: "border-lime-200" },
  { id: 8, name: "??? ?????", bg: "bg-yellow-50", border: "border-yellow-200" },
  { id: 9, name: "??? ???????", bg: "bg-amber-50", border: "border-amber-200" },
  { id: 10, name: "??? ?????", bg: "bg-orange-50", border: "border-orange-200" },
  { id: 11, name: "??? ???????", bg: "bg-red-50", border: "border-red-200" },
  { id: 12, name: "??? ???????", bg: "bg-rose-50", border: "border-rose-200" },
  { id: 13, name: "??????? ????????", bg: "bg-pink-50", border: "border-pink-200" },
  { id: 14, name: "???? ?????????", bg: "bg-purple-50", border: "border-purple-200" }
];

export default function FactoryDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [costs, setCosts] = useState({ fabric: 0, printing: 0, accessories: 0, labor: 0 });
  const [savingCosts, setSavingCosts] = useState(false);
  const [isBrowser, setIsBrowser] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setIsBrowser(true);
    const q = query(collection(db, "factory_production_orders"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by orderIndex to preserve ranking if we have one, otherwise fallback to createdAt
      data.sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0));
      setOrders(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    // Same position, no changes
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const newStage = parseInt(destination.droppableId.replace('stage-', ''));
    
    // Find moving order
    const movingOrder = orders.find(o => o.id === draggableId);
    if (!movingOrder) return;

    // Optimistic UI update
    const newOrders = Array.from(orders);
    
    // Remove from old array index
    const fromIndex = newOrders.findIndex(o => o.id === draggableId);
    newOrders.splice(fromIndex, 1);
    
    // Modify stage
    movingOrder.currentStage = newStage;
    
    // Find all orders in the destination stage to compute new index
    const destStageOrders = newOrders.filter(o => o.currentStage === newStage);
    
    // Insert into destination at correct visual index
    // destination.index gives the index relative to the droppable
    let insertIndex = 0;
    if (destStageOrders.length === 0) {
      // First item
      insertIndex = newOrders.length;
    } else {
      if (destination.index >= destStageOrders.length) {
        // Append at end of dest column
        const lastItem = destStageOrders[destStageOrders.length - 1];
        insertIndex = newOrders.findIndex(o => o.id === lastItem.id) + 1;
      } else {
        // Insert before target item
        const targetItem = destStageOrders[destination.index];
        insertIndex = newOrders.findIndex(o => o.id === targetItem.id);
      }
    }
    
    newOrders.splice(insertIndex, 0, movingOrder);
    
    // Re-assign orderIndex for all items in that stage to ensure exact sorting
    const finalDestOrders = newOrders.filter(o => o.currentStage === newStage);
    
    // Update local state immediately for snappy feel
    setOrders(newOrders);
    
    try {
      // Update the moved document's stage and index
      await updateDoc(doc(db, "factory_production_orders", draggableId), {
        currentStage: newStage,
        orderIndex: destination.index
      });
      
      // Update other documents in the same column to preserve order
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
    if (!confirm('?? ???? ????? ??? ??????? ???? ????? ???? (???? ??????)?')) return;
    
    try {
      const { id, createdAt, ...orderData } = order;
      await addDoc(collection(db, 'factory_production_orders'), {
        ...orderData,
        modelName: order.modelName + ' (????)',
        currentStage: 1, // Start from beginning
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      alert('??? ??? ????? ???????');
    }
  };

  const handleDelete = async (id: string) => {
    setActiveMenuId(null);
    if (!confirm('?? ??? ????? ?? ??? ??? ??????? ??? ????????')) return;
    try {
      await deleteDoc(doc(db, 'factory_production_orders', id));
    } catch (err) {
      console.error(err);
      alert('??? ??? ????? ?????');
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
      await updateDoc(doc(db, "factory_production_orders", selectedOrder.id), {
        costs: costs
      });
      setSelectedOrder(null);
    } catch (err) {
      console.error(err);
      alert('??? ??? ????? ?????');
    } finally {
      setSavingCosts(false);
    }
  };

  if (loading || !isBrowser) {
    return <div className="p-20 text-center font-bold text-gray-500">???? ????? ???? ??????...</div>;
  }

  // Close menus when clicking outside
  const handleWrapperClick = () => {
    if (activeMenuId) setActiveMenuId(null);
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col" dir="rtl" onClick={handleWrapperClick}>
      <div className="mb-4 shrink-0">
        <h2 className="text-2xl font-bold text-gray-800">???? ?????? (???? ???????) ??</h2>
        <p className="text-gray-500 text-sm mt-1">???? ???? ?????????? ?? ???? ?????? ?????? (Drag & Drop) ??? ??????? ?? ??????? ??? ????.</p>
      </div>

      {/* Kanban Board Container */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar bg-gray-100 rounded-xl p-4 shadow-inner flex gap-4">
          {STAGES.map((stage) => {
            const stageOrders = orders.filter(o => o.currentStage === stage.id);
            const totalPieces = stageOrders.reduce((sum, o) => sum + (Number(o.totalQuantity) || 0), 0);

            return (
              <Droppable key={stage.id} droppableId={stage- + stage.id}>
                {(provided, snapshot) => (
                  <div 
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={shrink-0 w-64 rounded-xl border flex flex-col h-full   }
                  >
                    {/* Column Header */}
                    <div className="p-3 border-b border-black/5 flex justify-between items-center bg-black/5 rounded-t-xl shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="bg-gray-800 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full font-bold">{stage.id}</span>
                        <h3 className="font-bold text-gray-800 text-sm">{stage.name}</h3>
                      </div>
                      <span className="text-xs bg-white text-gray-600 px-2 py-0.5 rounded-full font-mono font-bold shadow-sm">{totalPieces} ?</span>
                    </div>

                    {/* Column Body - Cards */}
                    <div className="p-2 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2">
                      {stageOrders.length === 0 && !snapshot.isDraggingOver && (
                        <div className="text-center p-4 text-xs text-gray-400 mt-4">?? ???? ??? ??????</div>
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
                                className={g-white p-3 rounded-lg border border-gray-200 relative group transition shadow-sm }
                              >
                                
                                {/* Top Actions (3 dots menu) */}
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
                                    <div className="absolute top-6 left-0 bg-white border shadow-lg rounded-lg w-36 overflow-hidden z-20 flex flex-col">
                                      <Link href={/factory/production/print/ + order.id} className="text-right px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                                        <Printer size={14} /> ??? / ?????
                                      </Link>
                                      <button onClick={(e) => { e.stopPropagation(); handleDuplicate(order); }} className="text-right px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                                        <Copy size={14} /> ????? ???????
                                      </button>
                                      <button onClick={(e) => { e.stopPropagation(); handleDelete(order.id); }} className="text-right px-3 py-2 text-sm hover:bg-red-50 text-red-600 flex items-center gap-2">
                                        <Trash2 size={14} /> ??? ?????
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <div className="flex gap-3 mt-1">
                                  {order.modelImage && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={order.modelImage} alt="model" className="w-16 h-16 object-cover rounded border border-gray-100" />
                                  )}
                                  <div className="flex-1 min-w-0 pr-1">
                                    <h4 className="font-bold text-sm text-gray-800 truncate" title={order.modelName}>{order.modelName}</h4>
                                    <p className="text-xs text-gray-500 mb-1">??????: <strong>{order.totalQuantity}</strong></p>
                                    <p className="text-[10px] text-gray-400 font-mono">#{order.id.slice(-6).toUpperCase()}</p>
                                  </div>
                                </div>

                                {/* Cost Info inside card */}
                                {totalCost > 0 && (
                                  <div className="mt-2 bg-green-50 text-green-800 text-xs p-1.5 rounded flex justify-between items-center border border-green-100">
                                    <span>????????: {totalCost} ?</span>
                                    <span className="font-bold">??????: {costPerPiece} ?</span>
                                  </div>
                                )}

                                {/* Bottom Cost Button */}
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); openCostModal(order); }}
                                    className="w-full text-xs flex justify-center items-center gap-2 bg-blue-50 text-blue-700 px-2 py-1.5 rounded hover:bg-blue-100 transition font-bold"
                                  >
                                    <Calculator size={14} />
                                    ????????
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
      </DragDropContext>

      {/* Cost Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" dir="rtl">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Calculator size={18} className="text-blue-600" />
                ???? ????????
              </h3>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-red-500 transition">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-gray-100 p-3 rounded-lg mb-4 text-center">
                <p className="font-bold text-gray-700">{selectedOrder.modelName}</p>
                <p className="text-sm text-gray-500">?????? ?????????: {selectedOrder.totalQuantity} ????</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center border-b pb-2">
                  <label className="text-sm font-bold text-gray-700">????? ?????? (???????)</label>
                  <input type="number" value={costs.fabric || ''} onChange={(e) => setCosts({...costs, fabric: Number(e.target.value)})} className="w-32 p-1.5 border rounded text-left" />
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <label className="text-sm font-bold text-gray-700">????? ???????</label>
                  <input type="number" value={costs.printing || ''} onChange={(e) => setCosts({...costs, printing: Number(e.target.value)})} className="w-32 p-1.5 border rounded text-left" />
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <label className="text-sm font-bold text-gray-700">??????????? (????? ?????..)</label>
                  <input type="number" value={costs.accessories || ''} onChange={(e) => setCosts({...costs, accessories: Number(e.target.value)})} className="w-32 p-1.5 border rounded text-left" />
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <label className="text-sm font-bold text-gray-700">????? ??????? (?????)</label>
                  <input type="number" value={costs.labor || ''} onChange={(e) => setCosts({...costs, labor: Number(e.target.value)})} className="w-32 p-1.5 border rounded text-left" />
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg mt-4">
                <div className="flex justify-between font-bold text-blue-900 mb-1">
                  <span>????????:</span>
                  <span>{costs.fabric + costs.printing + costs.accessories + costs.labor} ?</span>
                </div>
                <div className="flex justify-between text-sm text-blue-700">
                  <span>????? ?????? ???????:</span>
                  <span>{((costs.fabric + costs.printing + costs.accessories + costs.labor) / selectedOrder.totalQuantity).toFixed(2)} ?</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t flex gap-2">
              <button onClick={saveCosts} disabled={savingCosts} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition">
                {savingCosts ? '???? ?????...' : '??? ????????'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{
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
      }</style>
    </div>
  );
}
