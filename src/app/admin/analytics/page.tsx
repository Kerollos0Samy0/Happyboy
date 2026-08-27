"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query } from "firebase/firestore";
import { 
  TrendingUp, Users, Package, MapPin, 
  ChevronRight, BarChart2, Star, UserCheck
} from "lucide-react";

const getCategoryName = (modelNumber: string) => {
  const num = parseInt(modelNumber, 10);
  if (isNaN(num)) return "????";
  if (num >= 5 && num <= 90) return "???? ?????";
  if (num >= 100 && num <= 299) return "??? ?????";
  if (num >= 300 && num <= 499) return "???? ?????";
  if (num >= 500 && num <= 589) return "???? ?????";
  if (num >= 590 && num <= 789) return "??? ?????";
  if (num >= 790 && num <= 999) return "???? ?????";
  if (num >= 1000 && num <= 2999) return "?????";
  if (num >= 3000 && num <= 4999) return "??? ?????";
  if (num >= 5000 && num <= 6999) return "??? ?????";
  return "????";
};

const getSizesCount = (name: string, modelNumber: string, sizes: string[] | undefined) => {
  const category = getCategoryName(modelNumber);
  if (category.includes("????") || category.includes("???") || category.includes("????") || category.includes("?????") || name.includes("????") || name.includes("???") || name.includes("????")) return 4;
  return sizes && sizes.length > 0 ? sizes.length : 1;
};

const getDisplayEmployee = (emailOrName: string | undefined) => {
  if (!emailOrName) return "??? ?????";
  if (emailOrName.includes("@")) {
    return emailOrName.split("@")[0];
  }
  return emailOrName;
};

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<"models" | "customers" | "employees" | "governorates">("models");

  const [allModels, setAllModels] = useState<any[]>([]);
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [allGovs, setAllGovs] = useState<any[]>([]);

  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
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
    const unsubscribeOrders = onSnapshot(ordersQ, (snapshot) => {
      const modelSalesMap: Record<string, { count: number, name: string, totalRevenue: number }> = {};
      const customerMap: Record<string, { totalSpent: number, orderCount: number, phone: string }> = {};
      const govMap: Record<string, number> = {};
      const employeeMap: Record<string, { totalSales: number, orderCount: number }> = {};

      snapshot.docs.forEach(doc => {
        const order = doc.data();
        if (order.isDeleted) return;

        const orderTotal = Number(order.total) || 0;

        if (order.customerName) {
          if (!customerMap[order.customerName]) {
            customerMap[order.customerName] = { totalSpent: 0, orderCount: 0, phone: order.customerPhone || "" };
          }
          customerMap[order.customerName].totalSpent += orderTotal;
          customerMap[order.customerName].orderCount += 1;
        }

        if (order.customerGovernorate) {
          govMap[order.customerGovernorate] = (govMap[order.customerGovernorate] || 0) + 1;
        }

        const empName = getDisplayEmployee(order.employeeName);
        if (empName && empName !== "??? ?????") {
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
      setAllGovs(Object.entries(govMap).sort((a, b) => b[1] - a[1]));
      setAllEmployees(Object.entries(employeeMap).sort((a, b) => b[1].totalSales - a[1].totalSales));
    });

    return () => unsubscribeOrders();
  }, [loading]);

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>???? ???????...</div>;
  }

  const isOwner = userEmail && (userEmail.toLowerCase().includes("ahmed001") || userEmail.toLowerCase().includes("hossam001"));
  if (!isOwner) {
    return <div style={{ padding: "3rem", textAlign: "center", color: "red", fontSize: "1.5rem", fontWeight: "bold" }}>??? ???? ?? ????? ??? ??????.</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "2rem", width: "100%", fontFamily: "inherit" }} dir="rtl">
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <h1 style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: 0, color: "#1e293b", fontSize: "1.8rem" }}>
            <BarChart2 size={32} color="#8b5cf6" /> ?????????? ???????
          </h1>
          <button 
            onClick={() => router.push("/admin/dashboard")}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.2rem", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "0.5rem", color: "#475569", fontWeight: "bold", cursor: "pointer" }}
          >
            ?????? ????? ?????? <ChevronRight size={18} />
          </button>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem", background: "#fff", padding: "0.5rem", borderRadius: "0.75rem", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
          <button onClick={() => setActiveTab("models")} style={{ flex: 1, padding: "0.75rem 1rem", border: "none", borderRadius: "0.5rem", background: activeTab === "models" ? "#8b5cf6" : "transparent", color: activeTab === "models" ? "#fff" : "#475569", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}><Package size={18} /> ????????? ?????? ??????</button>
          <button onClick={() => setActiveTab("customers")} style={{ flex: 1, padding: "0.75rem 1rem", border: "none", borderRadius: "0.5rem", background: activeTab === "customers" ? "#8b5cf6" : "transparent", color: activeTab === "customers" ? "#fff" : "#475569", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}><Star size={18} /> ???? ???????</button>
          <button onClick={() => setActiveTab("employees")} style={{ flex: 1, padding: "0.75rem 1rem", border: "none", borderRadius: "0.5rem", background: activeTab === "employees" ? "#8b5cf6" : "transparent", color: activeTab === "employees" ? "#fff" : "#475569", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}><UserCheck size={18} /> ???? ????????</button>
          <button onClick={() => setActiveTab("governorates")} style={{ flex: 1, padding: "0.75rem 1rem", border: "none", borderRadius: "0.5rem", background: activeTab === "governorates" ? "#8b5cf6" : "transparent", color: activeTab === "governorates" ? "#fff" : "#475569", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}><MapPin size={18} /> ?????????</button>
        </div>

        <div style={{ background: "#fff", borderRadius: "1rem", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", overflowX: "auto" }}>
          {activeTab === "models" && (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right", minWidth: "600px" }}>
              <thead style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <tr>
                  <th style={{ padding: "1rem", color: "#64748b" }}>???????</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>???????</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>?????</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>?????? ??????? (???)</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>?????? ????????</th>
                </tr>
              </thead>
              <tbody>
                {allModels.map(([modelNumber, data], index) => (
                  <tr key={modelNumber} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "1rem", fontWeight: "bold", color: index < 3 ? "#8b5cf6" : "#94a3b8" }}>#{index + 1}</td>
                    <td style={{ padding: "1rem", fontWeight: "bold" }}>{modelNumber}</td>
                    <td style={{ padding: "1rem", color: "#475569" }}>{data.name}</td>
                    <td style={{ padding: "1rem" }}><span style={{ background: "#dbeafe", color: "#1e3a8a", padding: "0.25rem 0.75rem", borderRadius: "999px", fontWeight: "bold", fontSize: "0.85rem" }}>{data.count} ????</span></td>
                    <td style={{ padding: "1rem", fontWeight: "bold", color: "#10b981" }}>{data.totalRevenue.toLocaleString()} ?.?</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "customers" && (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right", minWidth: "600px" }}>
              <thead style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <tr>
                  <th style={{ padding: "1rem", color: "#64748b" }}>???????</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>??????</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>??? ??????</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>??? ???????</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>?????? ?????????</th>
                </tr>
              </thead>
              <tbody>
                {allCustomers.map(([name, data], index) => (
                  <tr key={name} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "1rem", fontWeight: "bold", color: index < 3 ? "#8b5cf6" : "#94a3b8" }}>#{index + 1}</td>
                    <td style={{ padding: "1rem", fontWeight: "bold" }}>{name}</td>
                    <td style={{ padding: "1rem", color: "#475569", direction: "ltr", textAlign: "right" }}>{data.phone}</td>
                    <td style={{ padding: "1rem" }}>{data.orderCount} ?????</td>
                    <td style={{ padding: "1rem", fontWeight: "bold", color: "#10b981" }}>{data.totalSpent.toLocaleString()} ?.?</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "employees" && (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right", minWidth: "600px" }}>
              <thead style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <tr>
                  <th style={{ padding: "1rem", color: "#64748b" }}>???????</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>??????</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>??? ??????? ???????</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>?????? ????????</th>
                </tr>
              </thead>
              <tbody>
                {allEmployees.map(([name, data], index) => (
                  <tr key={name} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "1rem", fontWeight: "bold", color: index < 3 ? "#8b5cf6" : "#94a3b8" }}>#{index + 1}</td>
                    <td style={{ padding: "1rem", fontWeight: "bold" }}>{name}</td>
                    <td style={{ padding: "1rem" }}>{data.orderCount} ?????</td>
                    <td style={{ padding: "1rem", fontWeight: "bold", color: "#10b981" }}>{data.totalSales.toLocaleString()} ?.?</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "governorates" && (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right", minWidth: "600px" }}>
              <thead style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <tr>
                  <th style={{ padding: "1rem", color: "#64748b" }}>???????</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>????????</th>
                  <th style={{ padding: "1rem", color: "#64748b" }}>??? ???????</th>
                </tr>
              </thead>
              <tbody>
                {allGovs.map(([gov, count], index) => (
                  <tr key={gov} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "1rem", fontWeight: "bold", color: index < 3 ? "#8b5cf6" : "#94a3b8" }}>#{index + 1}</td>
                    <td style={{ padding: "1rem", fontWeight: "bold" }}>{gov}</td>
                    <td style={{ padding: "1rem" }}><span style={{ background: "#fee2e2", color: "#991b1b", padding: "0.25rem 0.75rem", borderRadius: "999px", fontWeight: "bold", fontSize: "0.85rem" }}>{count} ???</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
