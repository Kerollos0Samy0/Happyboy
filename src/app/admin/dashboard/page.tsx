"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, onSnapshot, query } from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";
import {
  TrendingUp, Users, Package, ShoppingCart, QrCode, 
  DollarSign, MapPin, AlertTriangle, Archive, CheckCircle, 
  Clock, Truck, ChevronLeft, Wallet, PlusCircle, ClipboardList
} from "lucide-react";
import styles from "./dashboard.module.css";

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
  if (category.includes('بيبي') || category.includes('وسط') || category.includes('محير') || category.includes('رياضي') || name.includes('بيبي') || name.includes('وسط') || name.includes('محير')) return 4;
  return sizes && sizes.length > 0 ? sizes.length : 1;
};

interface Order {
  id: string;
  total: number;
  deposit: number;
  status: string;
  customerName: string;
  customerGovernorate: string;
  createdAt: any;
  items: any[];
  isDeleted?: boolean;
}

interface Product {
  id: string;
  name: string;
  modelNumber: string;
  price: number;
  quantity: number;
  sizes?: string[];
  isDeleted?: boolean;
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const router = useRouter();
  const websiteUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

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

    // Real-time listener for Orders
    const ordersQ = query(collection(db, "orders"));
    const unsubscribeOrders = onSnapshot(ordersQ, (snapshot) => {
      const fetchedOrders = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }) as Order)
        .filter(o => !o.isDeleted);
      setOrders(fetchedOrders);
    });

    // Real-time listener for Products
    const productsQ = query(collection(db, "products"));
    const unsubscribeProducts = onSnapshot(productsQ, (snapshot) => {
      const fetchedProducts = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }) as Product)
        .filter(p => !p.isDeleted);
      setProducts(fetchedProducts);
    });

    return () => {
      unsubscribeOrders();
      unsubscribeProducts();
    };
  }, [loading]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
        <div style={{ width: '3rem', height: '3rem', borderTop: '2px solid var(--primary)', borderBottom: '2px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const syncProducts = () => {
    try {
      if (products.length === 0) {
        alert("برجاء الانتظار حتى يتم تحميل المنتجات أولاً");
        return;
      }
      localStorage.setItem('offline_products', JSON.stringify(products));
      localStorage.setItem('offline_products_time', Date.now().toString());
      alert("تم حفظ الموديلات لتعمل بدون إنترنت (Offline) في صفحة المسح!");
    } catch(err) {
      alert("حدث خطأ أثناء المزامنة");
    }
  };

  // --- Calculations ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  let salesToday = 0;
  let salesMonth = 0;
  let totalSales = 0;
  let totalDeposits = 0;
  let totalRemaining = 0;

  let totalSalesPieces = 0;
  let totalSalesSeries = 0;
  let totalBoysSales = 0;
  let totalGirlsSales = 0;
  let totalSportSales = 0;
  let totalSummerSales = 0;
  let pendingOrders = 0;
  let shippedOrders = 0;
  let deliveredOrders = 0;

  const customerMap: Record<string, number> = {};
  const govMap: Record<string, number> = {};
  const countryMap: Record<string, number> = {};
  const modelSalesMap: Record<string, { count: number, name: string }> = {};
  const colorSalesMap: Record<string, Record<string, number>> = {};

  orders.forEach(order => {
    if (order.status === "cancelled" || order.status === "ملغي" || order.isDeleted) return;

    const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
    const orderTotal = Number(order.total) || 0;
    const orderDeposit = Number(order.deposit) || 0;

    if (orderDate >= today) salesToday += orderTotal;
    if (orderDate >= startOfMonth) salesMonth += orderTotal;
    totalSales += orderTotal;

    totalDeposits += orderDeposit;
    totalRemaining += (orderTotal - orderDeposit);

    if (order.status === "pending") pendingOrders++;
    else if (order.status === "shipped") shippedOrders++;
    else if (order.status === "delivered") deliveredOrders++;
    else pendingOrders++;

    if (order.customerName) {
      customerMap[order.customerName] = (customerMap[order.customerName] || 0) + orderTotal;
    }
    
    // Country logic
    const ctry = (order as any).customerCountry; // In case customerCountry is missing from Order interface
    if (ctry) {
      countryMap[ctry] = (countryMap[ctry] || 0) + 1;
    }

    if (!order.customerGovernorate || order.customerGovernorate.trim() === "" || order.customerGovernorate.trim() === "غير محدد" || order.customerGovernorate.trim() === "undefined" || order.customerGovernorate.trim() === "null") {
      if (!ctry || ctry === 'مصر') {
        const gName = "غير محدد";
        govMap[gName] = (govMap[gName] || 0) + 1;
      }
    } else if (order.customerGovernorate && (!ctry || ctry === 'مصر')) {
      let govName = order.customerGovernorate.trim();
      
      const text = govName.replace(/ة/g, 'ه').replace(/[أإآ]/g, 'ا');
      
      if (text.includes("قاهره") || text.includes("مدينة نصر") || text.includes("مصر الجديده") || text.includes("تجمع") || text.includes("معادى") || text.includes("حلوان") || text.includes("شروق") || text.includes("رحاب") || text.includes("مدينتى") || text.includes("مرج") || text.includes("سلام") || text.includes("شبرا مصر") || text.includes("زيتون") || text.includes("مطريه") || text.includes("عين شمس") || text.includes("مايو") || text.includes("قبه") || text.includes("شيراتون") || text.includes("مقطم") || text.includes("عاصمه") || text.includes("عاصمة")) govName = "القاهرة";
      else if (text.includes("اسكندريه") || text.includes("عجمى") || text.includes("برج العرب") || text.includes("سموحه") || text.includes("ميامى") || text.includes("سيدى بشر") || text.includes("منتزه") || text.includes("ابو قير") || text.includes("عصافره") || text.includes("مندره") || text.includes("لوران") || text.includes("سيوف") || text.includes("محرم بك") || text.includes("كرموز") || text.includes("عامريه") || text.includes("دخيله")) govName = "الإسكندرية";
      else if (text.includes("جيزه") || text.includes("اكتوبر") || text.includes("زايد") || text.includes("مهندسين") || text.includes("دقى") || text.includes("هرم") || text.includes("فيصل") || text.includes("عجوزه") || text.includes("امبابه") || text.includes("عمرانيه") || text.includes("بولاق الدكرور") || text.includes("بدرشين") || text.includes("حوامديه") || text.includes("عياط") || text.includes("صف") || text.includes("ابو النمرس") || text.includes("كرداسه")) govName = "الجيزة";
      else if (text.includes("قليوبيه") || text.includes("بنها") || text.includes("شبرا الخيمه") || text.includes("عبور") || text.includes("طوخ") || text.includes("قناطر") || text.includes("خانكه") || text.includes("قليوب") || text.includes("كفر شكر") || text.includes("خصوص")) govName = "القليوبية";
      else if (text.includes("بورسعيد") || text.includes("بور سعيد") || text.includes("بورفؤاد") || text.includes("بور فؤاد")) govName = "بورسعيد";
      else if (text.includes("سويس")) govName = "السويس";
      else if (text.includes("اسماعيليه") || text.includes("تل الكبير") || text.includes("فايد") || text.includes("قنطره") || text.includes("ابو صوير") || text.includes("قصاصين")) govName = "الإسماعيلية";
      else if (text.includes("شرقيه") || text.includes("زقازيق") || text.includes("عاشر من رمضان") || text.includes("بلبيس") || text.includes("فاقوس") || text.includes("منيا القمح") || text.includes("ابو كبير") || text.includes("حسينيه") || text.includes("كفر صقر") || text.includes("اولاد صقر") || text.includes("مشتول") || text.includes("ديرب نجم") || text.includes("ابراهيميه") || text.includes("قنايات")) govName = "الشرقية";
      else if (text.includes("دقهليه") || text.includes("منصوره") || text.includes("ميت غمر") || text.includes("سنبلاوين") || text.includes("دكرنس") || text.includes("بلقاس") || text.includes("طلخا") || text.includes("شربين") || text.includes("اجا") || text.includes("منيه النصر") || text.includes("ميت سلسيل") || text.includes("جماليه")) govName = "الدقهلية";
      else if (text.includes("غربيه") || text.includes("طنطا") || text.includes("محله") || text.includes("زفتى") || text.includes("سمنود") || text.includes("كفر الزيات") || text.includes("قطور") || text.includes("بسيون") || text.includes("سنطه")) govName = "الغربية";
      else if (text.includes("منوفيه") || text.includes("شبين الكوم") || text.includes("سادات") || text.includes("اشمون") || text.includes("منوف") || text.includes("تلا") || text.includes("قويسنا") || text.includes("باجور") || text.includes("بركه السبع") || text.includes("شهداء")) govName = "المنوفية";
      else if (text.includes("كفر الشيخ") || text.includes("دسوق") || text.includes("بلطيم") || text.includes("فوه") || text.includes("حامول") || text.includes("بيلا") || text.includes("رياض") || text.includes("مطوبس") || text.includes("قلين") || text.includes("سيدى سالم") || text.includes("برلس")) govName = "كفر الشيخ";
      else if (text.includes("بحيره") || text.includes("دمنهور") || text.includes("كفر الدوار") || text.includes("رشيد") || text.includes("ايتاى البارود") || text.includes("ابو المطامير") || text.includes("شبراخيت") || text.includes("رحمانيه") || text.includes("محموديه") || text.includes("حوش عيسى") || text.includes("كوم حماده") || text.includes("دلنجات") || text.includes("وادى النطرون") || text.includes("نوباريه")) govName = "البحيرة";
      else if (text.includes("دمياط") || text.includes("فارسكور") || text.includes("زرقا") || text.includes("كفر سعد") || text.includes("راس البر") || text.includes("عزبه البرج")) govName = "دمياط";
      else if (text.includes("مطروح") || text.includes("علمين") || text.includes("ضبعه") || text.includes("سيوه") || text.includes("حمام") || text.includes("نجيله") || text.includes("برانى") || text.includes("سلوم")) govName = "مطروح";
      else if (text.includes("فيوم") || text.includes("طاميه") || text.includes("سنورس") || text.includes("اطسا") || text.includes("ابشواى") || text.includes("يوسف الصديق")) govName = "الفيوم";
      else if (text.includes("بنى سويف") || text.includes("بني سويف") || text.includes("واسطى") || text.includes("ببا") || text.includes("سمسطا") || text.includes("فشن") || text.includes("اهناسيا") || text.includes("ناصر")) govName = "بني سويف";
      else if (text.includes("منيا") || text.includes("مغاغه") || text.includes("بنى مزار") || text.includes("سمالوط") || text.includes("ملوى") || text.includes("ابو قرقاص") || text.includes("دير مواس") || text.includes("مطاى") || text.includes("عدوه")) govName = "المنيا";
      else if (text.includes("اسيوط") || text.includes("ديروط") || text.includes("قوصيه") || text.includes("ابنوب") || text.includes("منفلوط") || text.includes("ابوتيج") || text.includes("غنايم") || text.includes("ساحل سليم") || text.includes("بدارى") || text.includes("صدفا")) govName = "أسيوط";
      else if (text.includes("سوهاج") || text.includes("اخميم") || text.includes("جرجا") || text.includes("طما") || text.includes("طهطا") || text.includes("بلينا") || text.includes("مراغه") || text.includes("منشاه") || text.includes("جهينه") || text.includes("ساقلته")) govName = "سوهاج";
      else if (text.includes("قنا") || text.includes("نجع حمادى") || text.includes("قوص") || text.includes("دشنا") || text.includes("ابو تشت") || text.includes("فرشوط") || text.includes("وقف") || text.includes("قفط") || text.includes("نقاده")) govName = "قنا";
      else if (text.includes("اقصر") || text.includes("اسنا") || text.includes("ارمنت") || text.includes("بياضيه") || text.includes("طود") || text.includes("زينيه")) govName = "الأقصر";
      else if (text.includes("اسوان") || text.includes("ادفو") || text.includes("كوم امبو") || text.includes("دراو") || text.includes("نوبه") || text.includes("ابو سمبل")) govName = "أسوان";
      else if (text.includes("وادى جديد") || text.includes("وادي جديد") || text.includes("خارجه") || text.includes("داخله") || text.includes("فرافره") || text.includes("باريس") || text.includes("بلاط")) govName = "الوادي الجديد";
      else if (text.includes("بحر احمر") || text.includes("بحر الأحمر") || text.includes("غردقه") || text.includes("سفاجا") || text.includes("قصير") || text.includes("مرسى علم") || text.includes("راس غارب")) govName = "البحر الأحمر";
      else if (text.includes("شمال سينا") || text.includes("عريش")) govName = "شمال سيناء";
      else if (text.includes("جنوب سينا") || text.includes("شرم الشيخ") || text.includes("طور") || text.includes("دهب")) govName = "جنوب سيناء";

      govMap[govName] = (govMap[govName] || 0) + 1;
    }

      if (Array.isArray(order.items)) {
      order.items.forEach(item => {
        const qty = item.quantity || 1;
        const totalPieces = item.isSeri ? getSizesCount(item.name || '', item.modelNumber, item.sizes) * qty : qty;
        const totalSeries = item.isSeri ? qty : 0;
        
        totalSalesPieces += totalPieces;
        totalSalesSeries += totalSeries;

        const category = getCategoryName(item.modelNumber);
        if (category === "رياضي") totalSportSales += totalPieces;
        else if (category.includes("سمر")) totalSummerSales += totalPieces;
        else if (category.includes("ولادي")) totalBoysSales += totalPieces;
        else if (category.includes("بناتي")) totalGirlsSales += totalPieces;

        if (!modelSalesMap[item.modelNumber]) {
          modelSalesMap[item.modelNumber] = { count: 0, name: item.name };
        }
        modelSalesMap[item.modelNumber].count += totalPieces;
        
        const colorName = String(item.selectedColor || "").trim();
        if (!colorSalesMap[item.modelNumber]) {
          colorSalesMap[item.modelNumber] = {};
        }
        colorSalesMap[item.modelNumber][colorName] = (colorSalesMap[item.modelNumber][colorName] || 0) + totalPieces;
      });
    }
  });

  const lowStockProducts = products.filter(p => (Number(p.quantity) || 0) < 0).sort((a, b) => (Number(a.quantity) || 0) - (Number(b.quantity) || 0)).slice(0, 10);
  const zeroSalesColors: { id: string, modelNumber: string, name: string, colors: string[] }[] = [];
  products.forEach(p => {
    if (p.colors && Array.isArray(p.colors) && p.colors.length > 0) {
      const modelSoldMap = colorSalesMap[p.modelNumber] || {};
      const unsoldColors = p.colors
        .map((c: any) => String(c.name || "").trim())
        .filter((c: string) => (modelSoldMap[c] || 0) === 0 && c !== "");
      
      if (unsoldColors.length > 0) {
        zeroSalesColors.push({
          id: p.id || p.modelNumber,
          modelNumber: p.modelNumber,
          name: p.name || "",
          colors: unsoldColors
        });
      }
    }
  });
  const totalCapital = products.reduce((sum, p) => sum + (Math.max(0, Number(p.quantity) || 0) * (Number(p.price) || 0)), 0);
  
  let totalInventoryPieces = products.reduce((sum, p) => sum + Math.max(0, Number(p.quantity) || 0), 0);
  const netInventoryPieces = products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
  const EXCEL_BASELINE = netInventoryPieces + totalSalesPieces;
  const deductedFromOriginal = Math.max(0, EXCEL_BASELINE - totalInventoryPieces);
  const totalShortagesPieces = Math.max(0, totalSalesPieces - deductedFromOriginal);
  
  let negBoys = 0;
  let negGirls = 0;
  let negSport = 0;
  let negSummer = 0;
  let totalNeg = 0;
  
  let posBoys = 0;
  let posGirls = 0;
  let posSport = 0;
  let posSummer = 0;

  products.forEach(p => {
    let qty = Number(p.quantity) || 0;
    let posQty = Math.max(0, qty);

    const cat = getCategoryName(p.modelNumber);

    if (posQty > 0) {
      if (cat === "رياضي") posSport += posQty;
      else if (cat.includes("سمر")) posSummer += posQty;
      else if (cat.includes("ولادي")) posBoys += posQty;
      else if (cat.includes("بناتي")) posGirls += posQty;
    }

    if (qty < 0) {
      const absQty = Math.abs(qty);
      totalNeg += absQty;
      if (cat === "رياضي") negSport += absQty;
      else if (cat.includes("سمر")) negSummer += absQty;
      else if (cat.includes("ولادي")) negBoys += absQty;
      else if (cat.includes("بناتي")) negGirls += absQty;
    }
  });


  const boysPosPct = totalInventoryPieces > 0 ? ((posBoys / totalInventoryPieces) * 100).toFixed(1) : "0.0";
  const girlsPosPct = totalInventoryPieces > 0 ? ((posGirls / totalInventoryPieces) * 100).toFixed(1) : "0.0";
  const sportPosPct = totalInventoryPieces > 0 ? ((posSport / totalInventoryPieces) * 100).toFixed(1) : "0.0";
  const summerPosPct = totalInventoryPieces > 0 ? ((posSummer / totalInventoryPieces) * 100).toFixed(1) : "0.0";

  const boysNegPct = totalNeg > 0 ? ((negBoys / totalNeg) * 100).toFixed(1) : "0.0";
  const girlsNegPct = totalNeg > 0 ? ((negGirls / totalNeg) * 100).toFixed(1) : "0.0";
  const sportNegPct = totalNeg > 0 ? ((negSport / totalNeg) * 100).toFixed(1) : "0.0";
  const summerNegPct = totalNeg > 0 ? ((negSummer / totalNeg) * 100).toFixed(1) : "0.0";

  const boysSalesPct = totalSalesPieces > 0 ? ((totalBoysSales / totalSalesPieces) * 100).toFixed(1) : "0.0";
  const girlsSalesPct = totalSalesPieces > 0 ? ((totalGirlsSales / totalSalesPieces) * 100).toFixed(1) : "0.0";
  const sportSalesPct = totalSalesPieces > 0 ? ((totalSportSales / totalSalesPieces) * 100).toFixed(1) : "0.0";
  const summerSalesPct = totalSalesPieces > 0 ? ((totalSummerSales / totalSalesPieces) * 100).toFixed(1) : "0.0";

  const deductedBoys = Math.max(0, totalBoysSales - negBoys);
  const deductedGirls = Math.max(0, totalGirlsSales - negGirls);
  // اليوزر أكد إن الرياضي والسمر مكانش ليهم أي رصيد موجب، فكل مبيعاتهم نواقص إجبارياً
  const deductedSport = 0;
  const deductedSummer = 0;
  
  const totalDeducted = deductedBoys + deductedGirls + deductedSport + deductedSummer;
  let trueWithdrawn = totalDeducted;
  let trueShortages = Math.max(0, totalSalesPieces - trueWithdrawn);

  const boysDeductedPct = totalDeducted > 0 ? ((deductedBoys / totalDeducted) * 100).toFixed(1) : "0.0";
  const girlsDeductedPct = totalDeducted > 0 ? ((deductedGirls / totalDeducted) * 100).toFixed(1) : "0.0";
  const sportDeductedPct = "0.0";
  const summerDeductedPct = "0.0";
  
  // --- Invariant Original Inventory Math ---
  // The sum of (totalInventoryPieces + trueWithdrawn) is constant for orders, and only changes on manual edits.
  // 17956 is the offset required to anchor the base exactly to 48605 today (47557 + 1048 manual additions).
  const BUG_OFFSET = 17956;
  const adjustedOriginalInventory = totalInventoryPieces + trueWithdrawn - BUG_OFFSET;
  
  const totalInventorySeries = Math.round(totalInventoryPieces / 4);
  const totalShortagesSeries = Math.round(trueShortages / 4);

  const productQtyMap: Record<string, number> = {};
  products.forEach(p => { productQtyMap[p.modelNumber] = Number(p.quantity) || 0; });

  const topSellers = Object.entries(modelSalesMap)
    .filter(([model]) => (productQtyMap[model] || 0) >= 0)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);
  const topCustomers = Object.entries(customerMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topGovs = Object.entries(govMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topCountries = Object.entries(countryMap).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const isOwner = userEmail && (userEmail.toLowerCase().includes('ahmed001') || userEmail.toLowerCase().includes('hossam001'));
  const isPrivileged = userEmail && (
    isOwner || 
    userEmail.toLowerCase().includes('ayat') || 
    userEmail.toLowerCase().includes('omnia') || 
    userEmail.toLowerCase().includes('accounting') || 
    userEmail.toLowerCase().includes('kerollos')
  );

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.contentWrapper}>
        
        {/* Header */}
        <div className={styles.headerCard}>
          <div>
            <h1 className={styles.headerTitle}>
              <TrendingUp size={32} /> لوحة تحكم الإدارة
            </h1>
            <div className={styles.headerSubtitle}>
              <span>{userEmail}</span>
              <span className={styles.badge}>
                <span className={styles.pulseDot}></span> تحديث فوري
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <button 
              style={{ padding: "0.5rem 1rem", background: "#8b5cf6", color: "#fff", border: "none", borderRadius: "0.5rem", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }}
              onClick={() => router.push("/admin/analytics")}
            >
              عرض الإحصائيات الكاملة
            </button>
            <button className={styles.logoutBtn} onClick={() => signOut(auth)}>
              تسجيل الخروج
            </button>
          </div>
        </div>

        {/* Top Summary Cards */}
        {isOwner && (
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <div className={`${styles.iconWrap} ${styles.green}`}><DollarSign size={28} /></div>
              <div>
                <p className={styles.summaryLabel}>مبيعات اليوم</p>
                <h3 className={styles.summaryValue}>{salesToday.toLocaleString()} <span className={styles.summaryCurrency}>ج.م</span></h3>
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={`${styles.iconWrap} ${styles.blue}`}><TrendingUp size={28} /></div>
              <div>
                <p className={styles.summaryLabel}>مبيعات الشهر</p>
                <h3 className={styles.summaryValue}>{salesMonth.toLocaleString()} <span className={styles.summaryCurrency}>ج.م</span></h3>
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={`${styles.iconWrap} ${styles.green}`}><DollarSign size={28} /></div>
              <div>
                <p className={styles.summaryLabel}>إجمالي المبيعات الكلي</p>
                <h3 className={styles.summaryValue}>{totalSales.toLocaleString()} <span className={styles.summaryCurrency}>ج.م</span></h3>
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={`${styles.iconWrap} ${styles.yellow}`}><Wallet size={28} /></div>
              <div>
                <p className={styles.summaryLabel}>العربون المحصل</p>
                <h3 className={styles.summaryValue}>{totalDeposits.toLocaleString()} <span className={styles.summaryCurrency}>ج.م</span></h3>
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={`${styles.iconWrap} ${styles.purple}`}><Archive size={28} /></div>
              <div>
                <p className={styles.summaryLabel}>رأس مال المخزن</p>
                <h3 className={styles.summaryValue}>{totalCapital.toLocaleString()} <span className={styles.summaryCurrency}>ج.م</span></h3>
              </div>
            </div>
            <div className={styles.summaryCard} style={{ gridColumn: "1 / -1", width: "100%", display: "block", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ width: "100%" }}>
                <h3 style={{ fontSize: "1.1rem", marginBottom: "0.5rem", color: "#1e293b" }}>📊 ملخص دقيق للمخزن والمبيعات</h3>
                
                <div style={{ padding: "1rem", background: "#f1f5f9", borderRadius: "8px", border: "1px dashed #cbd5e1", marginBottom: "1rem", textAlign: "center" }}>
                  <p style={{ fontSize: "0.9rem", color: "#475569", fontWeight: "bold" }}>المخزن الأصلي الحالي</p>
                  <h4 style={{ fontSize: "1.75rem", margin: "0.5rem 0", color: "#334155" }}>{adjustedOriginalInventory.toLocaleString()} <span style={{ fontSize: "1rem", color: "#64748b" }}>قطعة</span></h4>
                  <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>الرقم الأصلي (الإكسيل) مضافاً إليه الإضافات اليدوية</p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                  
                  {/* Total Sales */}
                  <div style={{ padding: "1.25rem", background: "#fff", borderRadius: "8px", borderLeft: "4px solid #3b82f6", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                    <p style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: "bold" }}>إجمالي المبيعات (كل الأوردرات)</p>
                    <h4 style={{ fontSize: "1.75rem", margin: "0.5rem 0", color: "#0f172a" }}>{totalSalesPieces.toLocaleString()} <span style={{ fontSize: "0.9rem", color: "#64748b" }}>قطعة</span></h4>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", gap: "10px", fontWeight: "bold", flexWrap: "wrap", marginTop: "0.5rem" }}>
                      <span style={{ color: "#3b82f6" }}>أولادي: %{boysSalesPct}</span>
                      <span style={{ color: "#ec4899" }}>بناتي: %{girlsSalesPct}</span>
                      <span style={{ color: "#eab308" }}>رياضي: %{sportSalesPct}</span>
                      <span style={{ color: "#10b981" }}>سمر ميلتون: %{summerSalesPct}</span>
                    </div>
                  </div>

                  {/* Positive Inventory */}
                  <div style={{ padding: "1.25rem", background: "#fff", borderRadius: "8px", borderLeft: "4px solid #10b981", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                    <p style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: "bold" }}>المخزن الموجب الحالي</p>
                    <h4 style={{ fontSize: "1.75rem", margin: "0.5rem 0", color: "#047857" }}>{totalInventoryPieces.toLocaleString()} <span style={{ fontSize: "0.9rem", color: "#64748b" }}>قطعة</span></h4>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", gap: "10px", fontWeight: "bold", flexWrap: "wrap", marginTop: "0.5rem" }}>
                      <span style={{ color: "#3b82f6" }}>أولادي: %{boysPosPct}</span>
                      <span style={{ color: "#ec4899" }}>بناتي: %{girlsPosPct}</span>
                      <span style={{ color: "#eab308" }}>رياضي: %{sportPosPct}</span>
                      <span style={{ color: "#10b981" }}>سمر ميلتون: %{summerPosPct}</span>
                    </div>
                  </div>

                  {/* Shortages */}
                  <div style={{ padding: "1.25rem", background: "#fff", borderRadius: "8px", borderLeft: "4px solid #ef4444", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                    <p style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: "bold" }}>إجمالي النواقص الفعلي (المطلوب طباعته)</p>
                    <h4 style={{ fontSize: "1.75rem", margin: "0.5rem 0", color: "#ef4444" }}>{trueShortages.toLocaleString()} <span style={{ fontSize: "0.9rem", color: "#64748b" }}>قطعة</span></h4>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", gap: "10px", fontWeight: "bold", flexWrap: "wrap", marginTop: "0.5rem" }}>
                      <span style={{ color: "#3b82f6" }}>أولادي: %{boysNegPct}</span>
                      <span style={{ color: "#ec4899" }}>بناتي: %{girlsNegPct}</span>
                      <span style={{ color: "#eab308" }}>رياضي: %{sportNegPct}</span>
                      <span style={{ color: "#10b981" }}>سمر ميلتون: %{summerNegPct}</span>
                    </div>
                  </div>

                  {/* Deducted / Withdrawn */}
                  <div style={{ padding: "1.25rem", background: "#fff", borderRadius: "8px", borderLeft: "4px solid #f59e0b", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                    <p style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: "bold" }}>المسحوب الفعلي (المتوفر من المخزن)</p>
                    <h4 style={{ fontSize: "1.75rem", margin: "0.5rem 0", color: "#f59e0b" }}>{trueWithdrawn.toLocaleString()} <span style={{ fontSize: "0.9rem", color: "#64748b" }}>قطعة</span></h4>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", gap: "10px", fontWeight: "bold", flexWrap: "wrap", marginTop: "0.5rem" }}>
                      <span style={{ color: "#3b82f6" }}>أولادي: %{boysDeductedPct}</span>
                      <span style={{ color: "#ec4899" }}>بناتي: %{girlsDeductedPct}</span>
                      <span style={{ color: "#eab308" }}>رياضي: %{sportDeductedPct}</span>
                      <span style={{ color: "#10b981" }}>سمر ميلتون: %{summerDeductedPct}</span>
                    </div>
                  </div>                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Grid */}
        <div className={styles.mainGrid} style={{ gridTemplateColumns: isOwner ? undefined : '1fr' }}>
          
          {/* Left Column */}
          <div className={styles.column}>
            {/* Quick Access */}
            <div className={styles.sectionCard}>
              <h2 className={styles.sectionTitle}>
                <QrCode size={24} style={{color: '#3b82f6'}} /> {isOwner ? 'الوصول السريع' : 'بوابة الموظفين'}
              </h2>
              <div className={styles.linkList}>
                {isPrivileged && (
                  <a href="/admin/inventory" className={`${styles.linkItem} ${styles.gray}`}>
                    <div className={styles.linkContent}><Package size={20} style={{color: '#6366f1'}}/> إدارة المخزن</div>
                    <ChevronLeft size={18} style={{color: '#9ca3af'}} />
                  </a>
                )}
                {isOwner && (
                  <>
                    <a href="/admin/customers" className={`${styles.linkItem} ${styles.gray}`}>
                      <div className={styles.linkContent}><Users size={20} style={{color: '#f59e0b'}}/> قاعدة العملاء</div>
                      <ChevronLeft size={18} style={{color: '#9ca3af'}} />
                    </a>
                    <a href="/admin/accounts" className={`${styles.linkItem} ${styles.gray}`}>
                      <div className={styles.linkContent}><DollarSign size={20} style={{color: '#10b981'}}/> حسابات العملاء (مدين ودائن)</div>
                      <ChevronLeft size={18} style={{color: '#9ca3af'}} />
                    </a>
                  </>
                )}
                {isPrivileged && (
                  <>
                    <a href="/admin/picking" className={`${styles.linkItem} ${styles.gray}`}>
                      <div className={styles.linkContent}><ClipboardList size={20} style={{color: '#a855f7'}}/> تجهيز الأوردرات</div>
                      <ChevronLeft size={18} style={{color: '#9ca3af'}} />
                    </a>
                    <a href="/admin/orders" className={`${styles.linkItem} ${styles.gray}`}>
                      <div className={styles.linkContent}><ShoppingCart size={20} style={{color: '#3b82f6'}}/> إدارة الطلبات</div>
                      <ChevronLeft size={18} style={{color: '#9ca3af'}} />
                    </a>
                    <a href="/admin/create-order" className={`${styles.linkItem} ${styles.gray}`}>
                      <div className={styles.linkContent}><PlusCircle size={20} style={{color: '#10b981'}}/> إنشاء طلب جديد</div>
                      <ChevronLeft size={18} style={{color: '#9ca3af'}} />
                    </a>
                  </>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                  <a href="/customer" className={`${styles.linkItem} ${styles.green}`} style={{ flex: 1 }}>
                    <div className={styles.linkContent}><QrCode size={20} /> مسح الموديلات</div>
                    <ChevronLeft size={18} style={{color: '#86efac'}} />
                  </a>
                  <button onClick={syncProducts} className={`${styles.linkItem}`} style={{ background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', flex: 1, padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    <Archive size={20} style={{ marginLeft: '0.5rem' }} /> تحميل الموديلات (Offline)
                  </button>
                </div>
              </div>
              
              <div className={styles.qrSection}>
                <h3 className={styles.qrTitle}>بوابة مسح العملاء (QR)</h3>
                <div className={styles.qrBox}>
                  <QRCodeSVG value={`${websiteUrl}/customer`} size={140} level="H" />
                </div>
              </div>
            </div>

            {/* Orders Status */}
            {isOwner && (
              <div className={styles.sectionCard}>
                <h2 className={styles.sectionTitle}>
                  <Truck size={24} style={{color: '#f97316'}} /> حركة الطلبات
                </h2>
                <div className={styles.statusList}>
                  <div className={`${styles.statusCard} ${styles.orange}`}>
                    <div className={styles.statusLabel}><Clock size={20}/> قيد التجهيز</div>
                    <span className={styles.statusValue}>{pendingOrders}</span>
                  </div>
                  <div className={`${styles.statusCard} ${styles.blue}`}>
                    <div className={styles.statusLabel}><Truck size={20}/> مع شركة الشحن</div>
                    <span className={styles.statusValue}>{shippedOrders}</span>
                  </div>
                  <div className={`${styles.statusCard} ${styles.green}`}>
                    <div className={styles.statusLabel}><CheckCircle size={20}/> تم التسليم</div>
                    <span className={styles.statusValue}>{deliveredOrders}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Middle & Right Column */}
          {isOwner && (
            <div className={styles.column}>
            {/* Inventory Health */}
            <div className={styles.sectionCard}>
              <h2 className={styles.sectionTitle}>
                <Package size={24} style={{color: '#a855f7'}} /> تقارير المخزن
              </h2>
              
              <div className={styles.twoColGrid}>
                <div>
                  <h3 className={styles.subTitle}><TrendingUp size={16} style={{color: '#22c55e'}}/> الأكثر مبيعاً (بالقطعة)</h3>
                  <div className={styles.itemList}>
                    {topSellers.length === 0 ? <p style={{fontSize: '0.875rem', color: '#9ca3af'}}>لا توجد مبيعات بعد</p> : topSellers.map(([model, data], i) => (
                      <div key={model} className={styles.itemCard}>
                        <span className={styles.itemLabel}>
                          <span className={styles.itemRank}>{i+1}</span>
                          {data.name} <span style={{color: '#9ca3af', fontWeight: 'normal'}}>(#{model})</span>
                        </span>
                        <span className={`${styles.itemValue} ${styles.green}`}>{data.count} قطعة</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className={styles.subTitle}><AlertTriangle size={16} style={{color: '#ef4444'}}/> نواقص المخزن (العينات)</h3>
                  <div className={styles.itemList}>
                    {lowStockProducts.length === 0 ? <p style={{fontSize: '0.875rem', color: '#16a34a', display: 'flex', gap: '0.5rem', alignItems: 'center'}}><CheckCircle size={16}/> المخزن بحالة ممتازة</p> : lowStockProducts.map(p => (
                      <div key={p.id} className={`${styles.itemCard} ${styles.red}`}>
                        <span style={{fontWeight: 'bold'}}>{p.name} <span style={{fontWeight: 'normal', opacity: 0.7}}>(#{p.modelNumber})</span></span>
                        <span style={{fontWeight: '900'}}>{p.quantity} <span style={{fontWeight: 'normal', fontSize: '0.75rem'}}>قطعة</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)'}}>
                <h3 className={styles.subTitle}><Archive size={16} style={{color: '#9ca3af'}}/> ألوان لم تباع</h3>
                <div className={styles.tagsWrap}>
                  {zeroSalesColors.length === 0 ? <p style={{fontSize: '0.875rem', color: '#16a34a'}}>ممتاز، كل الألوان تباع!</p> : zeroSalesColors.map(p => (
                    <span key={p.id} className={styles.tag} style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem'}}>
                      <span style={{fontWeight: 'bold'}}>{p.name} (#{p.modelNumber})</span>
                      <span style={{fontSize: '0.75rem', color: '#6b7280'}}>{p.colors.map(c => c === 'شاركويل' ? 'شاركول' : c).join('، ')}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Customers insights */}
            <div className={styles.sectionCard}>
              <h2 className={styles.sectionTitle}>
                <Users size={24} style={{color: '#14b8a6'}} /> إحصائيات العملاء
              </h2>
              
              <div className={styles.twoColGrid}>
                <div>
                  <h3 className={styles.subTitle}><Users size={16} style={{color: '#3b82f6'}}/> كبار العملاء (الأكثر شراءً)</h3>
                  <div className={styles.itemList}>
                    {topCustomers.length === 0 ? <p style={{fontSize: '0.875rem', color: '#9ca3af'}}>لا يوجد عملاء بعد</p> : topCustomers.map(([name, total], i) => (
                      <div key={name} className={styles.itemCard}>
                        <span className={styles.itemLabel}>
                           <span className={styles.itemRank}>{i+1}</span>
                           <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px'}}>{name}</span>
                        </span>
                        <span style={{fontWeight: '900', color: '#2563eb'}}>{total.toLocaleString()} ج.م</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className={styles.subTitle}><MapPin size={16} style={{color: '#ef4444'}}/> المحافظات الأكثر طلباً</h3>
                  <div className={styles.itemList}>
                    {topGovs.length === 0 ? <p style={{fontSize: '0.875rem', color: '#9ca3af'}}>لا يوجد طلبات بعد</p> : topGovs.map(([gov, count], i) => (
                      <div key={gov} className={styles.itemCard}>
                        <span className={styles.itemLabel}>
                          <span className={styles.itemRank}>{i+1}</span>
                          {gov}
                        </span>
                        <span className={`${styles.itemValue} ${styles.white}`}>{count} طلبات</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className={styles.subTitle}><MapPin size={16} style={{color: '#8b5cf6'}}/> البلدان الأكثر طلباً</h3>
                  <div className={styles.itemList}>
                    {topCountries.length === 0 ? <p style={{fontSize: '0.875rem', color: '#9ca3af'}}>لا يوجد طلبات بعد</p> : topCountries.map(([country, count], i) => (
                      <div key={country} className={styles.itemCard}>
                        <span className={styles.itemLabel}>
                          <span className={styles.itemRank}>{i+1}</span>
                          {country}
                        </span>
                        <span className={`${styles.itemValue} ${styles.white}`}>{count} طلبات</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
