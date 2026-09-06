"use client";

import React, { useState, useEffect } from 'react';
import { 
  Package, Scissors, Printer, Pocket, Stitch, Shirt, CheckCircle,
  TrendingUp, Clock, Play, Settings, Plus, ShoppingCart, Layers,
  Wand2, Copy, AlignVerticalSpaceAround, Archive, Store, Wind,
  Microscope, ScanBarcode, ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, where } from 'firebase/firestore';

const STAGES = [
  { id: 1, name: "قسم العينات", icon: Microscope, color: 'bg-gray-100 text-gray-700' },
  { id: 2, name: "اوردر قماش", icon: ShoppingCart, color: 'bg-blue-50 text-blue-600' },
  { id: 3, name: "مخزن قماش", icon: Package, color: 'bg-blue-100 text-blue-700' },
  { id: 4, name: "قسم القص", icon: Scissors, color: 'bg-orange-100 text-orange-700' },
  { id: 5, name: "قسم الفرز", icon: Layers, color: 'bg-yellow-100 text-yellow-700' },
  { id: 6, name: "قسم الطباعة - ليزر", icon: Printer, color: 'bg-purple-100 text-purple-700' },
  { id: 7, name: "قسم القص والتفريغ", icon: Wand2, color: 'bg-indigo-100 text-indigo-700' },
  { id: 8, name: "قسم الكبس", icon: Settings, color: 'bg-pink-100 text-pink-700' },
  { id: 9, name: "قسم التجويز", icon: Copy, color: 'bg-rose-100 text-rose-700' },
  { id: 10, name: "قسم المكن", icon: Shirt, color: 'bg-green-100 text-green-700' },
  { id: 11, name: "قسم التشطيب", icon: CheckCircle, color: 'bg-teal-100 text-teal-700' },
  { id: 12, name: "قسم المكواة", icon: Wind, color: 'bg-cyan-100 text-cyan-700' },
  { id: 13, name: "التعبئة والتكييس", icon: Archive, color: 'bg-emerald-100 text-emerald-700' },
  { id: 14, name: "مخزن الموديلات", icon: Store, color: 'bg-gray-100 text-gray-800' }
];

export default function FactoryProductionDashboard() {
  const [stats, setStats] = useState<Record<number, { orders: number, pieces: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const q = query(collection(db, 'factory_production_orders'));
        const snapshot = await getDocs(q);
        const newStats: Record<number, { orders: number, pieces: number }> = {};
        
        snapshot.forEach(doc => {
          const data = doc.data();
          // Skip completely finished orders that are archived, though normally we'd query this.
          // Let's count them if they are active in a stage. Stage 14 is the final warehouse.
          const stage = data.currentStage || 1;
          
          if (!newStats[stage]) newStats[stage] = { orders: 0, pieces: 0 };
          newStats[stage].orders += 1;
          newStats[stage].pieces += Number(data.totalQuantity) || 0;
        });
        
        setStats(newStats);
      } catch (err) {
        console.error("Error fetching stats", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, []);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border-b-4 border-blue-500">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">إدارة الموديلات والأوامر</h1>
          <p className="text-sm text-gray-500 mt-1">نظرة عامة على حالة المصنع ومتابعة أوامر التشغيل عبر الأقسام.</p>
        </div>
        <Link href="/factory/production/new" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-bold shadow-md">
          <Plus size={18} />
          إصدار أمر تشغيل جديد
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Factory Flow - Left/Right Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold mb-6 border-b pb-2 text-gray-800">خط سير العمليات (14 قسم) وحالة الأوامر</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {STAGES.map((dept) => {
                const deptStats = stats[dept.id] || { orders: 0, pieces: 0 };
                const hasWork = deptStats.orders > 0;
                
                return (
                  <div key={dept.id} className={`border rounded-xl p-4 flex flex-col items-center justify-center text-center transition relative ${hasWork ? 'bg-white shadow-md border-blue-200' : 'bg-gray-50 opacity-70 border-gray-100'}`}>
                    <div className={`p-3 rounded-full mb-3 ${dept.color} ${hasWork ? 'scale-110 shadow-sm' : ''} transition-transform`}>
                      <dept.icon size={24} />
                    </div>
                    <h3 className="font-bold text-gray-800 text-sm mb-2">{dept.name}</h3>
                    
                    {loading ? (
                      <div className="h-4 w-16 bg-gray-200 animate-pulse rounded mt-1"></div>
                    ) : hasWork ? (
                      <div className="bg-blue-50 w-full rounded p-1.5 border border-blue-100">
                        <p className="text-xs font-bold text-blue-700">{deptStats.orders} موديل</p>
                        <p className="text-[10px] font-bold text-blue-500">({deptStats.pieces.toLocaleString()} قطعة)</p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 font-medium">لا يوجد أوامر</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold mb-4 border-b pb-2 text-gray-800">إجراءات سريعة</h2>
            <div className="space-y-3">
              <Link href="/factory/dashboard" className="w-full text-right p-3 bg-gray-50 hover:bg-blue-50 rounded-lg transition border border-transparent hover:border-blue-100 flex items-center justify-between group">
                <span className="font-medium text-gray-700 group-hover:text-blue-700">لوحة الإنتاج (Kanban)</span>
                <ArrowRight size={16} className="text-gray-400 group-hover:text-blue-500" />
              </Link>
              <Link href="/factory/inventory" className="w-full text-right p-3 bg-gray-50 hover:bg-green-50 rounded-lg transition border border-transparent hover:border-green-100 flex items-center justify-between group">
                <span className="font-medium text-gray-700 group-hover:text-green-700">جرد المخازن</span>
                <Package size={16} className="text-gray-400 group-hover:text-green-500" />
              </Link>
            </div>
          </div>

          <div className="bg-blue-50 p-6 rounded-xl shadow-sm border border-blue-100">
            <h2 className="text-blue-800 font-bold mb-3 flex items-center gap-2">
              <CheckCircle size={18} /> إحصائيات سريعة
            </h2>
            <ul className="space-y-4">
              <li className="flex justify-between items-center border-b border-blue-100 pb-2">
                <span className="text-blue-900 text-sm">إجمالي الموديلات النشطة:</span>
                <span className="font-black text-blue-700">
                  {Object.values(stats).reduce((sum, s) => sum + s.orders, 0)}
                </span>
              </li>
              <li className="flex justify-between items-center border-b border-blue-100 pb-2">
                <span className="text-blue-900 text-sm">إجمالي القطع النشطة:</span>
                <span className="font-black text-blue-700">
                  {Object.values(stats).reduce((sum, s) => sum + s.pieces, 0).toLocaleString()}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
