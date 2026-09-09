"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { BarChart3, Users, Calendar, Clock, Activity, Search } from 'lucide-react';
import Link from 'next/link';

type ProductivityLog = {
  id: string;
  date: string;
  type: string;
  modelNumber: string;
  lineId: string;
  amount: number;
  workerName: string;
  machine: string;
  operation: string;
  totalPausedSeconds: number;
  effectiveDurationSeconds: number;
  createdAt: string;
};

const LINES: Record<string, string> = {
  'line_1': 'خط تقفيل 1',
  'line_2': 'خط تقفيل 2',
  'line_3': 'خط تقفيل 3',
  'line_4': 'خط تقفيل 4',
};

export default function ProductivityReports() {
  const [logs, setLogs] = useState<ProductivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [lineFilter, setLineFilter] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [dateFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'factory_productivity_logs'), where('date', '==', dateFilter));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductivityLog));
      setLogs(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const filteredLogs = logs.filter(log => (lineFilter ? log.lineId === lineFilter : true));

  // Line Aggregation
  const lineStats = filteredLogs.reduce((acc, log) => {
    const line = log.lineId;
    if (!acc[line]) acc[line] = 0;
    acc[line] += log.amount;
    return acc;
  }, {} as Record<string, number>);

  // Worker Aggregation
  const workerStats = filteredLogs.reduce((acc, log) => {
    const op = log.operation || 'غير محدد';
    const key = `${log.workerName}_${log.lineId}_${op}`;
    if (!acc[key]) {
      acc[key] = {
        name: log.workerName,
        lineId: log.lineId,
        machine: log.machine,
        operation: op,
        totalAmount: 0,
        totalDurationSecs: 0,
      };
    }
    acc[key].totalAmount += log.amount;
    if (log.effectiveDurationSeconds) {
      acc[key].totalDurationSecs += log.effectiveDurationSeconds;
    }
    return acc;
  }, {} as Record<string, {name: string, lineId: string, machine: string, operation: string, totalAmount: number, totalDurationSecs: number}>);

  const formatDuration = (secs: number) => {
    if (!secs) return 'غير مسجل';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0) return `${h} ساعة ${m} دقيقة`;
    return `${m} دقيقة`;
  };

  const calculateRate = (amount: number, secs: number) => {
    if (!secs || secs === 0) return 'غير محدد';
    const hours = secs / 3600;
    return Math.round(amount / hours) + ' قطعة/ساعة';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 p-4 relative" dir="rtl">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-indigo-600 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2 mb-1">
            <BarChart3 className="text-indigo-600" /> تقارير الإنتاجية اليومية
          </h1>
          <p className="text-sm text-gray-500">تحليل إنتاج الخطوط والعمال لتسهيل حساب الحوافز والتقييم.</p>
        </div>
        <Link href="/" className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-bold transition shadow-sm">
          العودة للرئيسية
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm flex flex-wrap gap-4 items-end border border-gray-200">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><Calendar size={14}/> التاريخ</label>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-full p-2 border rounded-lg font-bold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><Activity size={14}/> الخط</label>
          <select value={lineFilter} onChange={e => setLineFilter(e.target.value)} className="w-full p-2 border rounded-lg font-bold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">كل الخطوط</option>
            {Object.entries(LINES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <button onClick={fetchLogs} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2 h-[42px] shadow-sm">
          <Search size={18} /> تحديث البيانات
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-indigo-600 font-bold animate-pulse">جاري جلب بيانات الإنتاجية...</div>
      ) : (
        <>
          {/* Line Totals Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(LINES).filter(([id]) => !lineFilter || id === lineFilter).map(([id, name]) => (
              <div key={id} className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-xl border border-indigo-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="absolute -left-4 -bottom-4 opacity-5"><BarChart3 size={100} /></div>
                  <h3 className="font-bold text-indigo-900 text-lg mb-2">{name}</h3>
                  <div className="text-3xl font-black text-indigo-600 mb-1">{lineStats[id] || 0} <span className="text-sm font-bold text-gray-500">قطعة</span></div>
                  <p className="text-xs text-indigo-400 font-bold mb-4">إجمالي إنتاج اليوم المنتهي</p>
                </div>
                <Link 
                  href={`/supervisor/dashboard?adminView=true&lineId=${id}`}
                  target="_blank"
                  className="bg-indigo-600 text-white font-bold text-sm py-2 px-4 rounded hover:bg-indigo-700 transition shadow-sm text-center w-full z-10 block"
                >
                  عرض اللوحة الحية 🔴
                </Link>
              </div>
            ))}
          </div>

          {/* Worker Stats Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b flex items-center gap-2">
              <Users className="text-indigo-600" size={20} />
              <h2 className="font-bold text-gray-800 text-lg">أداء العمال المفصل (حسب العملية)</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-gray-100 text-gray-600 text-sm">
                    <th className="p-3 whitespace-nowrap">العامل / الماكينة</th>
                    <th className="p-3 whitespace-nowrap">الخط</th>
                    <th className="p-3 whitespace-nowrap">العملية المنفذة</th>
                    <th className="p-3 whitespace-nowrap">إجمالي الإنتاج</th>
                    <th className="p-3 whitespace-nowrap">الوقت الفعلي للعمل</th>
                    <th className="p-3 whitespace-nowrap">معدل السرعة (بالساعة)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.values(workerStats).length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-gray-400 font-bold">لا توجد بيانات إنتاجية مسجلة لهذا اليوم.</td></tr>
                  ) : Object.values(workerStats).sort((a,b) => b.totalAmount - a.totalAmount).map((worker, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition">
                      <td className="p-3">
                        <div className="font-bold text-gray-900">{worker.name || 'بدون اسم'}</div>
                        <div className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded w-fit mt-1">{worker.machine || 'غير محدد'}</div>
                      </td>
                      <td className="p-3 text-sm font-bold text-gray-600">{LINES[worker.lineId] || worker.lineId}</td>
                      <td className="p-3 font-bold text-indigo-800">
                        {worker.operation}
                      </td>
                      <td className="p-3">
                        <span className="font-black text-lg text-blue-700">{worker.totalAmount}</span>
                        <span className="text-xs text-gray-500 mr-1">قطعة</span>
                      </td>
                      <td className="p-3 text-sm font-bold text-gray-600 flex items-center gap-1 mt-3">
                        <Clock size={14} className="text-orange-500" />
                        {formatDuration(worker.totalDurationSecs)}
                      </td>
                      <td className="p-3">
                        <span className="bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-full text-xs font-black whitespace-nowrap">
                          {calculateRate(worker.totalAmount, worker.totalDurationSecs)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
