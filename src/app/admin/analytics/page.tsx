"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query } from "firebase/firestore";
import { 
  TrendingUp, Users, Package, MapPin, 
  ChevronRight, BarChart2, Star, UserCheck, Store
} from "lucide-react";

const getCategoryName = (modelNumber: string) => {
  const num = parseInt(modelNumber, 10);
  if (isNaN(num)) return "أخرى";
  if (num >= 5 && num <= 90) return "بيبي ولادي";
  if (num >= 100 && num <= 299) return "وسط ولادي";
  if (num >= 300 && num <= 499) return "محير ولادي";
  if (num >= 500 && num <= 589) return "بيبي بناتي";
  if (num >= 590 && num <= 789) return "وسط بناتي";
  if (num >= 790 && num <= 999) return "محير بناتي";
  if (num >= 1000 && num <= 2999) return "رياضي";
  if (num >= 3000 && num <= 4999) return "سمر ولادي";
  if (num >= 5000 && num <= 6999) return "سمر بناتي";
  return "أخرى";
};

const getSizesCount = (name: string, modelNumber: string, sizes: string[] | undefined) => {
  const category = getCategoryName(modelNumber);
  if (category.includes("بيبي") || category.includes("وسط") || category.includes("محير") || category.includes("رياضي") || name.includes("بيبي") || name.includes("وسط") || name.includes("محير")) return 4;
  return sizes && sizes.length > 0 ? sizes.length : 1;
};

const getDisplayEmployee = (emailOrName: string | undefined) => {
  if (!emailOrName) return "غير معروف";
  if (emailOrName.includes("@")) {
    return emailOrName.split("@")[0];
  }
  return emailOrName;
};

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<"models" | "customers" | "employees" | "governorates" | "countries" | "branches">("models");

  const [allModels, setAllModels] = useState<any[]>([]);
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [allGovs, setAllGovs] = useState<any[]>([]);
  const [allCountries, setAllCountries] = useState<any[]>([]);
  const [allBranches, setAllBranches] = useState<any[]>([]);

  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user: any) => {
      if (!user) {
        router.push("/admin/login");
      } else {
        setUserEmail(user.email);
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (loading) return;

    const ordersQ = query(collection(db, "orders"));
    const unsubscribeOrders = onSnapshot(ordersQ, (snapshot: any) => {
      const modelSalesMap: Record<string, { count: number, name: string, totalRevenue: number }> = {};
      const customerMap: Record<string, { totalSpent: number, orderCount: number, phone: string }> = {};
      const govMap: Record<string, { count: number, totalRevenue: number }> = {};
      const countryMap: Record<string, { count: number, totalRevenue: number }> = {};
      const branchMap: Record<string, { count: number, totalRevenue: number }> = {};
      const employeeMap: Record<string, { totalSales: number, orderCount: number }> = {};

      snapshot.docs.forEach((doc: any) => {
        const order = doc.data();
        if (order.isDeleted) return;

        const orderTotal = Number(order.total) || 0;
        
        const branch = order.branch || "التجمع";
        if (!branchMap[branch]) {
          branchMap[branch] = { count: 0, totalRevenue: 0 };
        }
        branchMap[branch].count += 1;
        branchMap[branch].totalRevenue += orderTotal;

        if (order.customerName) {
          if (!customerMap[order.customerName]) {
            customerMap[order.customerName] = { totalSpent: 0, orderCount: 0, phone: order.customerPhone || "" };
          }
          customerMap[order.customerName].totalSpent += orderTotal;
          customerMap[order.customerName].orderCount += 1;
        }

        const country = order.customerCountry || "مصر";
        if (!countryMap[country]) {
          countryMap[country] = { count: 0, totalRevenue: 0 };
        }
        countryMap[country].count += 1;
        countryMap[country].totalRevenue += orderTotal;

        if (order.customerGovernorate && country === "مصر") {
          let govName = order.customerGovernorate.trim();
          
          const text = govName.replace(/ة/g, 'ه').replace(/[أإآ]/g, 'ا');
          
          if (text.includes("قاهره") || text.includes("مدينة نصر") || text.includes("مصر الجديده") || text.includes("تجمع") || text.includes("معادى") || text.includes("حلوان") || text.includes("شروق") || text.includes("رحاب") || text.includes("مدينتى") || text.includes("مرج") || text.includes("سلام") || text.includes("شبرا مصر")) govName = "القاهرة";
          else if (text.includes("اسكندريه") || text.includes("عجمى") || text.includes("برج العرب") || text.includes("سموحه") || text.includes("ميامى") || text.includes("سيدى بشر")) govName = "الإسكندرية";
          else if (text.includes("جيزه") || text.includes("اكتوبر") || text.includes("زايد") || text.includes("مهندسين") || text.includes("دقى") || text.includes("هرم") || text.includes("فيصل") || text.includes("عجوزه") || text.includes("امبابه")) govName = "الجيزة";
          else if (text.includes("قليوبيه") || text.includes("بنها") || text.includes("شبرا الخيمه") || text.includes("عبور") || text.includes("طوخ") || text.includes("قناطر") || text.includes("خانكه") || text.includes("قليوب")) govName = "القليوبية";
          else if (text.includes("بورسعيد") || text.includes("بور سعيد")) govName = "بورسعيد";
          else if (text.includes("سويس")) govName = "السويس";
          else if (text.includes("اسماعيليه")) govName = "الإسماعيلية";
          else if (text.includes("شرقيه") || text.includes("زقازيق") || text.includes("عاشر من رمضان") || text.includes("بلبيس") || text.includes("فاقوس") || text.includes("منيا القمح") || text.includes("ابو كبير")) govName = "الشرقية";
          else if (text.includes("دقهليه") || text.includes("منصوره") || text.includes("ميت غمر") || text.includes("سنبلاوين") || text.includes("دكرنس") || text.includes("بلقاس") || text.includes("طلخا") || text.includes("شربين")) govName = "الدقهلية";
          else if (text.includes("غربيه") || text.includes("طنطا") || text.includes("محله") || text.includes("زفتى") || text.includes("سمنود") || text.includes("كفر الزيات") || text.includes("قطور")) govName = "الغربية";
          else if (text.includes("منوفيه") || text.includes("شبين الكوم") || text.includes("سادات") || text.includes("اشمون") || text.includes("منوف") || text.includes("تلا") || text.includes("قويسنا") || text.includes("باجور")) govName = "المنوفية";
          else if (text.includes("كفر الشيخ") || text.includes("دسوق") || text.includes("بلطيم") || text.includes("فوه") || text.includes("حامول")) govName = "كفر الشيخ";
          else if (text.includes("بحيره") || text.includes("دمنهور") || text.includes("كفر الدوار") || text.includes("رشيد") || text.includes("ايتاى البارود") || text.includes("ابو المطامير") || text.includes("شبراخيت")) govName = "البحيرة";
          else if (text.includes("دمياط") || text.includes("فارسكور") || text.includes("زرقا") || text.includes("كفر سعد")) govName = "دمياط";
          else if (text.includes("مطروح") || text.includes("علمين") || text.includes("ضبعه")) govName = "مطروح";
          else if (text.includes("فيوم")) govName = "الفيوم";
          else if (text.includes("بنى سويف") || text.includes("بني سويف") || text.includes("واسطى") || text.includes("ببا")) govName = "بني سويف";
          else if (text.includes("منيا") || text.includes("مغاغه") || text.includes("بنى مزار") || text.includes("سمالوط") || text.includes("ملوى")) govName = "المنيا";
          else if (text.includes("اسيوط") || text.includes("ديروط") || text.includes("قوصيه") || text.includes("ابنوب") || text.includes("منفلوط")) govName = "أسيوط";
          else if (text.includes("سوهاج") || text.includes("اخميم") || text.includes("جرجا") || text.includes("طما") || text.includes("طهطا") || text.includes("بلينا")) govName = "سوهاج";
          else if (text.includes("قنا") || text.includes("نجع حمادى") || text.includes("قوص") || text.includes("دشنا")) govName = "قنا";
          else if (text.includes("اقصر") || text.includes("اسنا") || text.includes("ارمنت")) govName = "الأقصر";
          else if (text.includes("اسوان") || text.includes("ادفو") || text.includes("كوم امبو") || text.includes("دراو")) govName = "أسوان";
          else if (text.includes("وادى جديد") || text.includes("وادي جديد") || text.includes("خارجه") || text.includes("داخله")) govName = "الوادي الجديد";
          else if (text.includes("بحر احمر") || text.includes("بحر الأحمر") || text.includes("غردقه") || text.includes("سفاجا") || text.includes("قصير")) govName = "البحر الأحمر";
          else if (text.includes("شمال سينا") || text.includes("عريش")) govName = "شمال سيناء";
          else if (text.includes("جنوب سينا") || text.includes("شرم الشيخ") || text.includes("طور") || text.includes("دهب")) govName = "جنوب سيناء";

          if (!govMap[govName]) {
            govMap[govName] = { count: 0, totalRevenue: 0 };
          }
          govMap[govName].count += 1;
          govMap[govName].totalRevenue += orderTotal;
        }

        const empName = getDisplayEmployee(order.employeeName);
        if (empName && empName !== "غير معروف") {
          if (!employeeMap[empName]) {
            employeeMap[empName] = { totalSales: 0, orderCount: 0 };
          }
          employeeMap[empName].totalSales += orderTotal;
          employeeMap[empName].orderCount += 1;
        }

        if (Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            const qty = item.quantity || 1;
            const totalPieces = item.isSeri ? getSizesCount(item.name || "", item.modelNumber, item.sizes) * qty : qty;
            const itemRevenue = (Number(item.price) || 0) * qty;

            if (!modelSalesMap[item.modelNumber]) {
              modelSalesMap[item.modelNumber] = { count: 0, name: item.name, totalRevenue: 0 };
            }
            modelSalesMap[item.modelNumber].count += totalPieces;
            modelSalesMap[item.modelNumber].totalRevenue += itemRevenue;
          });
        }
      });

      setAllModels(Object.entries(modelSalesMap).sort((a, b) => b[1].count - a[1].count));
      setAllCustomers(Object.entries(customerMap).sort((a, b) => b[1].totalSpent - a[1].totalSpent));
      setAllGovs(Object.entries(govMap).sort((a, b) => b[1].count - a[1].count));
      setAllCountries(Object.entries(countryMap).sort((a, b) => b[1].count - a[1].count));
      setAllEmployees(Object.entries(employeeMap).sort((a, b) => b[1].totalSales - a[1].totalSales));
      setAllBranches(Object.entries(branchMap).sort((a, b) => b[1].count - a[1].count));
    });

    return () => unsubscribeOrders();
  }, [loading]);

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>جاري التحميل...</div>;
  }

  const isOwner = userEmail && (userEmail.toLowerCase().includes("ahmed001") || userEmail.toLowerCase().includes("hossam001"));
  if (!isOwner) {
    return <div style={{ padding: "3rem", textAlign: "center", color: "red", fontSize: "1.5rem", fontWeight: "bold" }}>غير مصرح لك برؤية هذه الصفحة.</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "2rem", width: "100%", fontFamily: "inherit" }} dir="rtl">
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <h1 style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: 0, color: "#1e293b", fontSize: "1.8rem" }}>
            <BarChart2 size={32} color="#8b5cf6" /> الإحصائيات الكاملة
          </h1>
          <button 
            onClick={() => router.push("/admin/dashboard")}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.2rem", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "0.5rem", color: "#475569", fontWeight: "bold", cursor: "pointer" }}
          >
            الرجوع للوحة التحكم <ChevronRight size={18} />
          </button>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem", background: "#fff", padding: "0.5rem", borderRadius: "0.75rem", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
          <button onClick={() => setActiveTab("models")} style={{ flex: 1, padding: "0.75rem 1rem", border: "none", borderRadius: "0.5rem", background: activeTab === "models" ? "#8b5cf6" : "transparent", color: activeTab === "models" ? "#fff" : "#475569", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}><Package size={18} /> الموديلات الأكثر مبيعاً</button>
          <button onClick={() => setActiveTab("customers")} style={{ flex: 1, padding: "0.75rem 1rem", border: "none", borderRadius: "0.5rem", background: activeTab === "customers" ? "#8b5cf6" : "transparent", color: activeTab === "customers" ? "#fff" : "#475569", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}><Star size={18} /> أفضل العملاء</button>
          <button onClick={() => setActiveTab("employees")} style={{ flex: 1, padding: "0.75rem 1rem", border: "none", borderRadius: "0.5rem", background: activeTab === "employees" ? "#8b5cf6" : "transparent", color: activeTab === "employees" ? "#fff" : "#475569", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}><UserCheck size={18} /> أداء الموظفين</button>
          <button onClick={() => setActiveTab("governorates")} style={{ flex: 1, padding: "0.75rem 1rem", border: "none", borderRadius: "0.5rem", background: activeTab === "governorates" ? "#8b5cf6" : "transparent", color: activeTab === "governorates" ? "#fff" : "#475569", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}><MapPin size={18} /> المحافظات</button>
          <button onClick={() => setActiveTab("countries")} style={{ flex: 1, padding: "0.75rem 1rem", border: "none", borderRadius: "0.5rem", background: activeTab === "countries" ? "#8b5cf6" : "transparent", color: activeTab === "countries" ? "#fff" : "#475569", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}><MapPin size={18} /> البلدان</button>
          <button onClick={() => setActiveTab("branches")} style={{ flex: 1, padding: "0.75rem 1rem", border: "none", borderRadius: "0.5rem", background: activeTab === "branches" ? "#8b5cf6" : "transparent", color: activeTab === "branches" ? "#fff" : "#475569", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}><Store size={18} /> الفروع</button>
        </div>

        <div style={{ background: "#fff", borderRadius: "1rem", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", overflowX: "auto" }}>
          {activeTab === "models" && (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right", minWidth: "600px" }}>
              <thead style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <tr>
                  <th style={{ padding: "1rem", color: "#64748b" }}>الترتيب</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>الموديل</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>الاسم</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>الكمية المباعة (قطع)</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>إجمالي المبيعات</th>
                </tr>
              </thead>
              <tbody>
                {allModels.map(([modelNumber, data], index) => (
                  <tr key={modelNumber} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "1rem", fontWeight: "bold", color: index < 3 ? "#8b5cf6" : "#94a3b8" }}>#{index + 1}</td>
                    <td style={{ padding: "1rem", fontWeight: "bold" }}>{modelNumber}</td>
                    <td style={{ padding: "1rem", color: "#475569" }}>{data.name}</td>
                    <td style={{ padding: "1rem" }}><span style={{ background: "#dbeafe", color: "#1e3a8a", padding: "0.25rem 0.75rem", borderRadius: "999px", fontWeight: "bold", fontSize: "0.85rem" }}>{data.count} قطعة</span></td>
                    <td style={{ padding: "1rem", fontWeight: "bold", color: "#10b981" }}>{data.totalRevenue.toLocaleString()} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "customers" && (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right", minWidth: "600px" }}>
              <thead style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <tr>
                  <th style={{ padding: "1rem", color: "#64748b" }}>الترتيب</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>العميل</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>رقم الهاتف</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>عدد الطلبات</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>إجمالي المشتريات</th>
                </tr>
              </thead>
              <tbody>
                {allCustomers.map(([name, data], index) => (
                  <tr key={name} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "1rem", fontWeight: "bold", color: index < 3 ? "#8b5cf6" : "#94a3b8" }}>#{index + 1}</td>
                    <td style={{ padding: "1rem", fontWeight: "bold" }}>{name}</td>
                    <td style={{ padding: "1rem", color: "#475569", direction: "ltr", textAlign: "right" }}>{data.phone}</td>
                    <td style={{ padding: "1rem" }}>{data.orderCount} طلبات</td>
                    <td style={{ padding: "1rem", fontWeight: "bold", color: "#10b981" }}>{data.totalSpent.toLocaleString()} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "employees" && (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right", minWidth: "600px" }}>
              <thead style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <tr>
                  <th style={{ padding: "1rem", color: "#64748b" }}>الترتيب</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>الموظف</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>عدد الطلبات المنفذة</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>إجمالي المبيعات</th>
                </tr>
              </thead>
              <tbody>
                {allEmployees.map(([name, data], index) => (
                  <tr key={name} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "1rem", fontWeight: "bold", color: index < 3 ? "#8b5cf6" : "#94a3b8" }}>#{index + 1}</td>
                    <td style={{ padding: "1rem", fontWeight: "bold" }}>{name}</td>
                    <td style={{ padding: "1rem" }}>{data.orderCount} طلبات</td>
                    <td style={{ padding: "1rem", fontWeight: "bold", color: "#10b981" }}>{data.totalSales.toLocaleString()} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "governorates" && (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right", minWidth: "600px" }}>
              <thead style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <tr>
                  <th style={{ padding: "1rem", color: "#64748b" }}>الترتيب</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>المحافظة</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>عدد الطلبات</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>إجمالي المبيعات</th>
                </tr>
              </thead>
              <tbody>
                {allGovs.map(([gov, data], index) => (
                  <tr key={gov} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "1rem", fontWeight: "bold", color: index < 3 ? "#8b5cf6" : "#94a3b8" }}>#{index + 1}</td>
                    <td style={{ padding: "1rem", fontWeight: "bold" }}>{gov}</td>
                    <td style={{ padding: "1rem" }}><span style={{ background: "#fee2e2", color: "#991b1b", padding: "0.25rem 0.75rem", borderRadius: "999px", fontWeight: "bold", fontSize: "0.85rem" }}>{data.count} طلب</span></td>
                    <td style={{ padding: "1rem", fontWeight: "bold", color: "#10b981" }}>{data.totalRevenue.toLocaleString()} ج.م</td>
                  </tr>
                ))}
              </tbody>
              <tfoot style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                <tr>
                  <td colSpan={2} style={{ padding: "1rem", fontWeight: "bold", textAlign: "left" }}>إجمالي الطلبات داخل مصر:</td>
                  <td style={{ padding: "1rem", fontWeight: "bold" }}>
                    <span style={{ background: "#dbeafe", color: "#1e3a8a", padding: "0.25rem 0.75rem", borderRadius: "999px", fontSize: "0.9rem" }}>
                      {allGovs.reduce((sum, [_, data]) => sum + data.count, 0)} طلب
                    </span>
                  </td>
                  <td style={{ padding: "1rem", fontWeight: "bold", color: "#10b981" }}>
                    {allGovs.reduce((sum, [_, data]) => sum + data.totalRevenue, 0).toLocaleString()} ج.م
                  </td>
                </tr>
              </tfoot>
            </table>
          )}

          {activeTab === "countries" && (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right", minWidth: "600px" }}>
              <thead style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <tr>
                  <th style={{ padding: "1rem", color: "#64748b" }}>الترتيب</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>البلد</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>عدد الطلبات</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>إجمالي المبيعات</th>
                </tr>
              </thead>
              <tbody>
                {allCountries.map(([country, data], index) => (
                  <tr key={country} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "1rem", fontWeight: "bold", color: index < 3 ? "#8b5cf6" : "#94a3b8" }}>#{index + 1}</td>
                    <td style={{ padding: "1rem", fontWeight: "bold" }}>{country}</td>
                    <td style={{ padding: "1rem" }}><span style={{ background: "#fee2e2", color: "#991b1b", padding: "0.25rem 0.75rem", borderRadius: "999px", fontWeight: "bold", fontSize: "0.85rem" }}>{data.count} طلب</span></td>
                    <td style={{ padding: "1rem", fontWeight: "bold", color: "#10b981" }}>{data.totalRevenue.toLocaleString()} ج.م</td>
                  </tr>
                ))}
              </tbody>
              <tfoot style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                <tr>
                  <td colSpan={2} style={{ padding: "1rem", fontWeight: "bold", textAlign: "left" }}>إجمالي الطلبات:</td>
                  <td style={{ padding: "1rem", fontWeight: "bold" }}>
                    <span style={{ background: "#dbeafe", color: "#1e3a8a", padding: "0.25rem 0.75rem", borderRadius: "999px", fontSize: "0.9rem" }}>
                      {allCountries.reduce((sum, [_, data]) => sum + data.count, 0)} طلب
                    </span>
                  </td>
                  <td style={{ padding: "1rem", fontWeight: "bold", color: "#10b981" }}>
                    {allCountries.reduce((sum, [_, data]) => sum + data.totalRevenue, 0).toLocaleString()} ج.م
                  </td>
                </tr>
              </tfoot>
            </table>
          )}

          {activeTab === "branches" && (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right", minWidth: "600px" }}>
              <thead style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <tr>
                  <th style={{ padding: "1rem", color: "#64748b" }}>الترتيب</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>الفرع</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>عدد الطلبات</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>إجمالي المبيعات</th>
                </tr>
              </thead>
              <tbody>
                {allBranches.map(([branch, data], index) => (
                  <tr key={branch} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "1rem", fontWeight: "bold", color: index < 3 ? "#8b5cf6" : "#94a3b8" }}>#{index + 1}</td>
                    <td style={{ padding: "1rem", fontWeight: "bold" }}>{branch}</td>
                    <td style={{ padding: "1rem" }}><span style={{ background: "#fee2e2", color: "#991b1b", padding: "0.25rem 0.75rem", borderRadius: "999px", fontWeight: "bold", fontSize: "0.85rem" }}>{data.count} طلب</span></td>
                    <td style={{ padding: "1rem", fontWeight: "bold", color: "#10b981" }}>{data.totalRevenue.toLocaleString()} ج.م</td>
                  </tr>
                ))}
              </tbody>
              <tfoot style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                <tr>
                  <td colSpan={2} style={{ padding: "1rem", fontWeight: "bold", textAlign: "left" }}>إجمالي الطلبات:</td>
                  <td style={{ padding: "1rem", fontWeight: "bold" }}>
                    <span style={{ background: "#dbeafe", color: "#1e3a8a", padding: "0.25rem 0.75rem", borderRadius: "999px", fontSize: "0.9rem" }}>
                      {allBranches.reduce((sum, [_, data]) => sum + data.count, 0)} طلب
                    </span>
                  </td>
                  <td style={{ padding: "1rem", fontWeight: "bold", color: "#10b981" }}>
                    {allBranches.reduce((sum, [_, data]) => sum + data.totalRevenue, 0).toLocaleString()} ج.م
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
