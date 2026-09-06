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

  const activeOrders = [
    { id: 'PO-1001', model: 'سويت شيرت ولادي شتوي', status: 'التقفيل', progress: 60, total: 1000, completed: 600 },
    { id: 'PO-1002', model: 'بنطلون رياضي', status: 'القص', progress: 10, total: 2000, completed: 200 },
    { id: 'PO-1003', model: 'تيشيرت صيفي', status: 'المكابس', progress: 45, total: 1500, completed: 675 },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">إدارة الإنتاج والمصنع 🏭</h1>
          <p className="text-sm text-gray-500 mt-1">تتبع أوامر التشغيل، الأقسام، والتكاليف اليومية.</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
          <Plus size={18} />
          إصدار أمر تشغيل جديد
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border-r-4 border-blue-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500">الإنتاج اليومي</p>
              <h3 className="text-2xl font-bold mt-1">1,450 <span className="text-sm font-normal">قطعة</span></h3>
            </div>
            <TrendingUp className="text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border-r-4 border-green-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500">أوامر شغل نشطة</p>
              <h3 className="text-2xl font-bold mt-1">12</h3>
            </div>
            <Play className="text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border-r-4 border-orange-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500">متوسط التكلفة/القطعة</p>
              <h3 className="text-2xl font-bold mt-1">45 <span className="text-sm font-normal">ج.م</span></h3>
            </div>
            <span className="text-orange-500 bg-orange-100 px-2 py-1 rounded text-xs">اليوم</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border-r-4 border-purple-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500">عمالة اليوم</p>
              <h3 className="text-2xl font-bold mt-1">42 <span className="text-sm font-normal">عامل</span></h3>
            </div>
            <Clock className="text-purple-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Factory Flow - Left/Right Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-bold mb-4 border-b pb-2">خط سير العمليات (الأقسام)</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {departments.map((dept, index) => (
                <div key={dept.id} className="border rounded-lg p-4 flex flex-col items-center justify-center text-center hover:shadow-md transition cursor-pointer relative">
                  {index !== departments.length - 1 && (
                    <div className="hidden md:block absolute left-[-15px] top-1/2 transform -translate-y-1/2 text-gray-300">
                      ←
                    </div>
                  )}
                  <div className={`p-3 rounded-full mb-3 ${dept.color}`}>
                    <dept.icon size={24} />
                  </div>
                  <h3 className="font-semibold text-gray-800">{dept.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{dept.count} أوامر قيد التنفيذ</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-bold mb-4 border-b pb-2">أوامر التشغيل الحالية</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-gray-50 text-gray-600 text-sm">
                  <tr>
                    <th className="p-3 rounded-r-lg">رقم الأمر</th>
                    <th className="p-3">الموديل</th>
                    <th className="p-3">المرحلة الحالية</th>
                    <th className="p-3">التقدم</th>
                    <th className="p-3 rounded-l-lg">إجراء</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {activeOrders.map((order, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="p-3 font-semibold text-blue-600">{order.id}</td>
                      <td className="p-3">{order.model}</td>
                      <td className="p-3">
                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-medium">
                          {order.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-gray-200 rounded-full h-2 max-w-[100px]">
                            <div className="bg-green-500 h-2 rounded-full" style={{ width: `${order.progress}%` }}></div>
                          </div>
                          <span className="text-xs text-gray-500">{order.completed}/{order.total}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <button className="text-blue-500 hover:underline text-xs">التفاصيل</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
