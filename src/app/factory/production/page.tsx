"use client";

import React, { useState } from 'react';
import { 
  Package, 
  Scissors, 
  Printer, 
  Pocket, 
  Stitch, 
  Shirt, 
  CheckCircle,
  TrendingUp,
  Clock,
  Play,
  Settings,
  Plus,
  ShoppingCart,
  Layers,
  Wand2,
  Copy,
  AlignVerticalSpaceAround,
  Archive,
  Store,
  Wind
} from 'lucide-react';
import Link from 'next/link';

export default function FactoryProductionDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  // Updated 13 stages of the factory
  const departments = [
    { id: 'fabric_order', name: 'اوردر قماش', icon: ShoppingCart, count: 2, color: 'bg-blue-50 text-blue-600' },
    { id: 'fabric_warehouse', name: 'مخزن قماش', icon: Package, count: 120, color: 'bg-blue-100 text-blue-700' },
    { id: 'cutting', name: 'قسم القص', icon: Scissors, count: 5, color: 'bg-orange-100 text-orange-700' },
    { id: 'sorting', name: 'قسم الفرز', icon: Layers, count: 4, color: 'bg-yellow-100 text-yellow-700' },
    { id: 'printing_laser', name: 'قسم الطباعة والليزر', icon: Printer, count: 3, color: 'bg-purple-100 text-purple-700' },
    { id: 'peeling', name: 'قسم القص والتفريغ', icon: Wand2, count: 2, color: 'bg-indigo-100 text-indigo-700' },
    { id: 'pressing', name: 'قسم الكبس', icon: Settings, count: 6, color: 'bg-pink-100 text-pink-700' },
    { id: 'pairing', name: 'قسم التجويز', icon: Copy, count: 3, color: 'bg-rose-100 text-rose-700' },
    { id: 'sewing', name: 'قسم المكن', icon: Shirt, count: 15, color: 'bg-green-100 text-green-700' },
    { id: 'finishing', name: 'قسم التشطيب', icon: CheckCircle, count: 8, color: 'bg-teal-100 text-teal-700' },
    { id: 'ironing', name: 'قسم المكواه', icon: Wind, count: 4, color: 'bg-cyan-100 text-cyan-700' },
    { id: 'packing', name: 'قسم التعبئة والتكييس', icon: Archive, count: 10, color: 'bg-emerald-100 text-emerald-700' },
    { id: 'models_warehouse', name: 'مخزن الموديلات', icon: Store, count: 450, color: 'bg-gray-100 text-gray-800' },
  ];

  // لا نضع بيانات وهمية بناءً على طلبك - استعداداً للموسم الجديد
  const activeOrders: any[] = [];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border-b-4 border-blue-500">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">إدارة الإنتاج والمصنع 🏭</h1>
          <p className="text-sm text-gray-500 mt-1">النظام جاهز لاستقبال أوامر تشغيل الموسم الجديد بناءً على صور الموديلات.</p>
        </div>
        <Link href="/factory/production/new" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-bold shadow-md">
          <Plus size={18} />
          إصدار أمر تشغيل بصورة الموديل
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Factory Flow - Left/Right Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-bold mb-4 border-b pb-2">خط سير العمليات (الأقسام 13)</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {departments.map((dept, index) => (
                <div key={dept.id} className="border rounded-lg p-3 flex flex-col items-center justify-center text-center opacity-80 hover:opacity-100 transition relative bg-gray-50">
                  <div className={`p-2 rounded-full mb-2 ${dept.color}`}>
                    <dept.icon size={20} />
                  </div>
                  <h3 className="font-semibold text-gray-700 text-sm">{dept.name}</h3>
                  <p className="text-xs text-gray-400 mt-1">مستعد للموسم</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h2 className="text-lg font-bold">أوامر التشغيل الحالية (الموسم الجديد)</h2>
            </div>
            <div className="overflow-x-auto text-center py-10 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <Layers size={48} className="mx-auto text-gray-300 mb-3" />
              <h3 className="text-gray-500 font-semibold mb-1">لا يوجد أوامر تشغيل حتى الآن</h3>
              <p className="text-gray-400 text-sm">اضغط على "إصدار أمر تشغيل بصورة الموديل" لبدء الموسم</p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-bold mb-4 border-b pb-2">إجراءات سريعة</h2>
            <div className="space-y-2">
              <button className="w-full text-right p-3 bg-gray-50 hover:bg-blue-50 rounded-lg transition border border-transparent hover:border-blue-100 flex items-center justify-between">
                <span>تكويد توب قماش جديد</span>
                <Package size={16} className="text-gray-400" />
              </button>
              <button className="w-full text-right p-3 bg-gray-50 hover:bg-blue-50 rounded-lg transition border border-transparent hover:border-blue-100 flex items-center justify-between">
                <span>مسح باركود عامل (Scan)</span>
                <CheckCircle size={16} className="text-gray-400" />
              </button>
              <button className="w-full text-right p-3 bg-gray-50 hover:bg-blue-50 rounded-lg transition border border-transparent hover:border-blue-100 flex items-center justify-between">
                <span>تقرير حساب التكلفة (اليومية)</span>
                <TrendingUp size={16} className="text-gray-400" />
              </button>
            </div>
          </div>

          <div className="bg-blue-50 p-6 rounded-lg shadow-sm border border-blue-100">
            <h2 className="text-blue-800 font-bold mb-2">تنبيهات النظام</h2>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2 text-blue-900">
                <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></span>
                <span>قسم المكابس عليه ضغط متأخر (أمر PO-1003).</span>
              </li>
              <li className="flex items-start gap-2 text-blue-900">
                <span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0"></span>
                <span>توب قماش سويت شيرت أحمر قرب ينفد (باقي 20 متر).</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
