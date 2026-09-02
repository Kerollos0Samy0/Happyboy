
"use client";
import { useEffect, useState } from "react";
import { db } from "../../../../lib/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import Link from "next/link";
import { ArrowRight, Search, FileText } from "lucide-react";

interface LogEntry {
  id: string;
  productId: string;
  modelNumber: string;
  productName: string;
  colorName: string;
  change: number;
  newQuantity: number;
  reason: string;
  employeeName: string;
  createdAt: any;
}

export default function InventoryLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [daysFilter, setDaysFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const q = query(collection(db, "inventory_logs"), orderBy("createdAt", "desc"), limit(500));
        const snap = await getDocs(q);
        const fetchedLogs = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as LogEntry[];
        setLogs(fetchedLogs);
      } catch (err) {
        console.error("Error fetching logs", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const uniqueUsers = Array.from(new Set(logs.map(log => log.employeeName).filter(Boolean)));

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.modelNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.reason?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (userFilter !== 'all' && log.employeeName !== userFilter) return false;

    if (daysFilter !== 'all') {
      const logDate = log.createdAt?.toDate ? log.createdAt.toDate() : new Date();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (daysFilter === 'today') {
        const logDay = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());
        if (logDay.getTime() !== today.getTime()) return false;
      } else if (daysFilter === '7') {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        if (logDate < sevenDaysAgo) return false;
      } else if (daysFilter === '30') {
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        if (logDate < thirtyDaysAgo) return false;
      }
    }
    
    return true;
  });

  const totalAdded = filteredLogs.reduce((sum, log) => log.change > 0 ? sum + log.change : sum, 0);
  const totalDeducted = filteredLogs.reduce((sum, log) => log.change < 0 ? sum + Math.abs(log.change) : sum, 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-[family-name:var(--font-cairo)]" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-gray-900 flex items-center gap-2">
              <FileText className="text-blue-600" size={32} />
              سجل حركة المخزن
            </h1>
            <p className="text-gray-500 mt-2">تتبع حركات الدخول والخروج والتعديلات اليدوية</p>
          </div>
          <Link href="/admin/inventory" className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-lg text-gray-700 font-bold hover:bg-gray-50 transition-colors">
            <ArrowRight size={20} />
            العودة للمخزن
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center justify-between border-r-4 border-r-green-500">
            <div>
              <p className="text-gray-500 font-medium mb-1">إجمالي القطع المضافة</p>
              <p className="text-3xl font-black text-green-600">+{totalAdded}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center justify-between border-r-4 border-r-red-500">
            <div>
              <p className="text-gray-500 font-medium mb-1">إجمالي القطع المخصومة</p>
              <p className="text-3xl font-black text-red-600">-{totalDeducted}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative max-w-md w-full">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="ابحث برقم الموديل، اسم المنتج، أو السبب..."
              className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full md:w-auto px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
            >
              <option value="all">كل المستخدمين</option>
              {uniqueUsers.map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
            <select
              value={daysFilter}
              onChange={(e) => setDaysFilter(e.target.value)}
              className="w-full md:w-auto px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
            >
              <option value="all">كل الأيام</option>
              <option value="today">اليوم</option>
              <option value="7">آخر 7 أيام</option>
              <option value="30">آخر 30 يوم</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="p-4 font-bold text-gray-600">التاريخ</th>
                  <th className="p-4 font-bold text-gray-600">الموديل / المنتج</th>
                  <th className="p-4 font-bold text-gray-600">اللون</th>
                  <th className="p-4 font-bold text-gray-600 text-center">الحركة</th>
                  <th className="p-4 font-bold text-gray-600 text-center">الكمية بعد</th>
                  <th className="p-4 font-bold text-gray-600">السبب</th>
                  <th className="p-4 font-bold text-gray-600">بواسطة</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-8 text-center text-gray-500">جاري تحميل السجل...</td></tr>
                ) : filteredLogs.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-gray-500">لا توجد حركات مسجلة.</td></tr>
                ) : (
                  filteredLogs.map(log => {
                    const date = log.createdAt?.toDate ? log.createdAt.toDate() : new Date();
                    const isPositive = log.change > 0;
                    return (
                      <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="p-4 text-sm text-gray-600" dir="ltr">{date.toLocaleString("ar-EG")}</td>
                        <td className="p-4">
                          <p className="font-bold text-gray-900">{log.modelNumber}</p>
                          <p className="text-xs text-gray-500">{log.productName}</p>
                        </td>
                        <td className="p-4 font-medium text-gray-700">{log.colorName}</td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-black ${isPositive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {isPositive ? "+" : ""}{log.change}
                          </span>
                        </td>
                        <td className="p-4 text-center font-bold text-gray-800">{log.newQuantity}</td>
                        <td className="p-4 text-sm text-gray-600 font-medium">
                          {log.reason.includes("فاتورة") ? (
                            <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded">{log.reason}</span>
                          ) : (
                            <span className="text-orange-600 bg-orange-50 px-2 py-1 rounded">{log.reason}</span>
                          )}
                        </td>
                        <td className="p-4 text-sm font-bold text-purple-600">
                          {log.employeeName}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

