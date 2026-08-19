"use client";

import { useState, useEffect } from "react";
import { db } from "../../../lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  runTransaction,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { auth } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { detectBranch } from "../../../lib/location";
import { Plus, Trash2, Search, ShoppingCart, Send } from "lucide-react";

/* ───────── types ───────── */
interface ProductColor {
  name: string;
  barcode: string;
}

interface Product {
  id: string;
  modelNumber: string;
  name: string;
  price: number;
  sizes: string[];
  colors: ProductColor[];
  barcodes: string[];
  quantity: number;
  isDeleted?: boolean;
}

interface OrderItem {
  cartItemId: string;
  id: string;
  name: string;
  modelNumber: string;
  price: number;
  selectedColor: string;
  sizes: string[];
  isSeri: boolean;
  quantity: number;
}

/* colour-selection helper kept in state while building an item */
interface ColorSelection {
  colorName: string;
  checked: boolean;
  qty: number;
}


interface Customer {
  id: string;
  name: string;
  phone: string;
  brandName?: string;
  governorate?: string;
  address?: string;
  isDeleted?: boolean;
}

const getCategoryName = (modelNumber: string) => {
  const num = parseInt(modelNumber, 10);
  if (isNaN(num)) return "أخرى";
  if (num >= 5 && num <= 90) return "بيبي ولادي";
  if (num >= 100 && num <= 150) return "وسط ولادي";
  if (num >= 300 && num <= 350) return "محير ولادي";
  if (num >= 500 && num <= 589) return "بيبي بناتي";
  if (num >= 590 && num <= 690) return "وسط بناتي";
  if (num >= 790 && num <= 890) return "محير بناتي";
  return "أخرى";
};

/* ═══════════════════════════════════════════════════════════════ */
export default function CreateOrderPage() {
  /* ── search state ── */
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [modelInput, setModelInput] = useState("");
  const [searchError, setSearchError] = useState("");
  const [foundProduct, setFoundProduct] = useState<Product | null>(null);
  const [colorSelections, setColorSelections] = useState<ColorSelection[]>([]);

  /* ── order items ── */
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  /* ── customer info ── */
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerBrand, setCustomerBrand] = useState("");
  const [customerGovernorate, setCustomerGovernorate] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [deposit, setDeposit] = useState("");
  const [discountPercentage, setDiscountPercentage] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);

  
  /* ── customer dropdown state ── */
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  /* ── submit state ── */
  const [submitting, setSubmitting] = useState(false);
  const [successOrderNumber, setSuccessOrderNumber] = useState<string | null>(null);

  /* ── employee stats ── */
  const [employeeStats, setEmployeeStats] = useState({ pending: 0, paid: 0, cancelled: 0, total: 0 });

  /* ─────────────────── on mount ─────────────────── */
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsSnap, customersSnap] = await Promise.all([
          getDocs(collection(db, "products")),
          getDocs(collection(db, "customers"))
        ]);
        const productsList = productsSnap.docs
          .map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<Product, "id">)
          }))
          .filter(p => !p.isDeleted);
        setAllProducts(productsList);

        const customersList = customersSnap.docs
          .map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<Customer, "id">)
          }))
          .filter(c => !c.isDeleted);
        setAllCustomers(customersList);
      } catch (err) {
        console.error("Error fetching data", err);
      } finally {
        setProductsLoading(false);
      }
    };
    fetchData();

    // Fetch employee stats
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const empName = user.displayName || user.email || "Unknown";
          const q = query(collection(db, "orders"), where("employeeName", "==", empName));
          const snap = await getDocs(q);
          let pending = 0, paid = 0, cancelled = 0;
          snap.forEach(doc => {
            const data = doc.data();
            if (data.status === "pending") pending++;
            else if (data.status === "paid") paid++;
            else if (data.status === "cancelled") cancelled++;
          });
          setEmployeeStats({ pending, paid, cancelled, total: snap.size });
        } catch(err) {
          console.error("Error fetching employee stats", err);
        }
      }
    });

    return () => unsub();
  }, []);

  /* ─────────────────── helpers ─────────────────── */
  const calculateItemTotal = (item: OrderItem) => {
    if (item.isSeri && item.sizes && item.sizes.length > 0) {
      return item.price * item.sizes.length * item.quantity;
    }
    return item.price * item.quantity;
  };

  const total = orderItems.reduce((acc, item) => acc + calculateItemTotal(item), 0);
  const depositNum = Number(deposit) || 0;
  const discountNum = Number(discountPercentage) || 0;
  const discountValue = (total * discountNum) / 100;
  const finalTotal = total - discountValue;
  const remaining = finalTotal - depositNum;

  /* ─────────────────── search (Dropdown) ─────────────────── */
  const handleProductSelect = (val: string) => {
    setModelInput(val);
    if (!val) {
      setFoundProduct(null);
      setColorSelections([]);
      return;
    }

    const prod = allProducts.find(p => `${p.modelNumber} - ${p.name}` === val || p.modelNumber === val);
    
    if (prod) {
      setFoundProduct(prod);
      setColorSelections(
        prod.colors.map((c) => ({
          colorName: c.name,
          checked: false,
          qty: 1,
        }))
      );
      setSearchError("");
    } else {
      setFoundProduct(null);
      setColorSelections([]);
    }
  };

  /* ─────────────────── add selected colours to order ─────────────────── */
  const handleAddToOrder = () => {
    if (!foundProduct) return;

    const selected = colorSelections.filter((c) => c.checked && c.qty > 0);
    if (selected.length === 0) return;

    const newItems: OrderItem[] = selected.map((sel) => ({
      cartItemId: `${foundProduct.id}_${sel.colorName}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      id: foundProduct.id,
      name: foundProduct.name,
      modelNumber: foundProduct.modelNumber,
      price: foundProduct.price,
      selectedColor: sel.colorName,
      sizes: foundProduct.sizes,
      isSeri: true,
      quantity: sel.qty,
    }));

    setOrderItems((prev) => [...prev, ...newItems]);
    setFoundProduct(null);
    setColorSelections([]);
    setModelInput("");
  };

  /* ─────────────────── remove item ─────────────────── */
  const removeItem = (cartItemId: string) => {
    setOrderItems((prev) => prev.filter((i) => i.cartItemId !== cartItemId));
  };


  const handleCustomerNameChange = (val: string) => {
    setCustomerName(val);
    setShowCustomerDropdown(true);
  };

  const handleSelectCustomer = (cust: Customer) => {
    setCustomerName(cust.name || "");
    setCustomerPhone(cust.phone || "");
    const isOffice = cust.name?.includes("مكتب") || cust.brandName?.includes("مكتب");
    setCustomerBrand(isOffice ? "" : (cust.brandName || ""));
    setCustomerGovernorate(cust.governorate || "");
    setCustomerAddress(cust.address || "");
    setShowCustomerDropdown(false);
  };

  const filteredCustomers = customerName.trim() === "" 
    ? [] 
    : allCustomers.filter(c => c.name && c.name.toLowerCase().includes(customerName.toLowerCase()));

  /* ─────────────────── auto-fetch customer ─────────────────── */
  const handlePhoneBlur = async () => {
    const trimmedPhone = customerPhone.trim();
    if (!trimmedPhone || trimmedPhone.length < 8) return;

    setIsSearchingCustomer(true);
    try {
      const q = query(collection(db, "customers"), where("phone", "==", trimmedPhone));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const custData = snap.docs[0].data();
        if (custData.name && !customerName) setCustomerName(custData.name);
        const isOffice = custData.name?.includes("مكتب") || custData.brandName?.includes("مكتب");
        if (custData.brandName && !customerBrand && !isOffice) setCustomerBrand(custData.brandName);
        if (custData.governorate && !customerGovernorate) setCustomerGovernorate(custData.governorate);
        if (custData.address && !customerAddress) setCustomerAddress(custData.address);
      }
    } catch (err) {
      console.error("Error fetching customer", err);
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  /* ─────────────────── submit order ─────────────────── */
  const handleSubmit = async () => {
    if (orderItems.length === 0) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      alert("يرجى إدخال اسم العميل ورقم الهاتف");
      return;
    }

    setSubmitting(true);

    try {
      const counterRef = doc(db, "counters", "orders");
      let newOrderNumber = 1;

      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        if (!counterDoc.exists()) {
          transaction.set(counterRef, { current: 1 });
          newOrderNumber = 1;
        } else {
          newOrderNumber = counterDoc.data().current + 1;
          transaction.update(counterRef, { current: newOrderNumber });
        }
      });

      const formattedOrderNumber = String(newOrderNumber).padStart(5, "0");

      const branchName = await detectBranch(auth.currentUser?.email);

      await addDoc(collection(db, "orders"), {
        orderNumber: formattedOrderNumber,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerBrand: customerBrand.trim(),
        customerGovernorate: customerGovernorate.trim(),
        customerAddress: customerAddress.trim(),
        deliveryDate,
        deposit: depositNum,
        discountPercentage: discountNum,
        items: orderItems,
        total,
        status: "pending",
        branch: branchName,
        employeeName: auth.currentUser?.displayName || auth.currentUser?.email || "Unknown",
        createdAt: serverTimestamp(),
      });

      setSuccessOrderNumber(formattedOrderNumber);
      setOrderItems([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerBrand("");
      setCustomerGovernorate("");
      setCustomerAddress("");
      setDeposit("");
      setDiscountPercentage("");
      setDeliveryDate("");
    } catch (error) {
      console.error("Error creating order:", error);
      alert("حدث خطأ أثناء إنشاء الطلب");
    } finally {
      setSubmitting(false);
    }
  };

  /* ─────────────────── reset after success ─────────────────── */
  const handleNewOrder = () => {
    setSuccessOrderNumber(null);
    setModelInput("");
    setFoundProduct(null);
    setColorSelections([]);
    setSearchError("");
  };

  /* ═══════════════════════════ SUCCESS SCREEN ═══════════════════════════ */
  if (successOrderNumber) {
    return (
      <div
        style={{
          marginLeft: "calc(-50vw + 50%)",
          marginRight: "calc(-50vw + 50%)",
          width: "100vw",
          padding: "1.5rem",
          background: "#f1f5f9",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className="card animate-fade-in"
          style={{ maxWidth: 480, width: "100%", textAlign: "center" }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "#d1fae5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.5rem",
              fontSize: 40,
            }}
          >
            ✓
          </div>
          <h2 style={{ color: "var(--success)", marginBottom: "0.5rem" }}>
            تم إنشاء الطلب بنجاح!
          </h2>
          <p style={{ fontSize: "1.25rem", marginBottom: "2rem" }}>
            رقم الطلب:{" "}
            <strong style={{ color: "var(--primary)", fontSize: "1.5rem" }}>
              {successOrderNumber}
            </strong>
          </p>
          <button className="btn btn-primary" onClick={handleNewOrder} style={{ width: "100%" }}>
            <Plus size={18} />
            إنشاء طلب جديد
          </button>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════ MAIN UI ═══════════════════════════ */
  return (
    <div
      style={{
        marginLeft: "calc(-50vw + 50%)",
        marginRight: "calc(-50vw + 50%)",
        width: "100vw",
        padding: "1.5rem",
        background: "#f1f5f9",
        minHeight: "100vh",
      }}
    >
      {/* ── page header ── */}
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <ShoppingCart size={28} color="var(--primary)" />
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>إنشاء طلب جديد</h1>
        </div>

        {/* Employee Stats */}
        {employeeStats.total > 0 && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ padding: "0.4rem 0.8rem", borderRadius: "9999px", background: "#0f172a", color: "#fff", fontWeight: "bold", fontSize: "0.85rem" }}>
              إجمالي طلباتي: {employeeStats.total}
            </span>
            <span style={{ padding: "0.4rem 0.8rem", borderRadius: "9999px", background: "#fef3c7", color: "#b45309", fontWeight: "bold", fontSize: "0.85rem" }}>
              قيد الانتظار: {employeeStats.pending}
            </span>
            <span style={{ padding: "0.4rem 0.8rem", borderRadius: "9999px", background: "#d1fae5", color: "#065f46", fontWeight: "bold", fontSize: "0.85rem" }}>
              تم الدفع: {employeeStats.paid}
            </span>
            <span style={{ padding: "0.4rem 0.8rem", borderRadius: "9999px", background: "#fee2e2", color: "#991b1b", fontWeight: "bold", fontSize: "0.85rem" }}>
              ملغي: {employeeStats.cancelled}
            </span>
          </div>
        )}
      </div>

      {/* ── two-column layout ── */}
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.5rem",
          alignItems: "start",
        }}
        className="create-order-grid"
      >
        {/* ╔═══════════ LEFT: Order Items Builder ═══════════╗ */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* ── search card ── */}
          <div className="card">
            <h3 style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Search size={20} />
              بحث بالموديل
            </h3>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                list="products-datalist"
                className="input"
                placeholder={productsLoading ? "جاري تحميل الموديلات..." : "اختر أو ابحث برقم الموديل..."}
                value={modelInput}
                onChange={(e) => handleProductSelect(e.target.value)}
                disabled={productsLoading}
                style={{ flex: 1 }}
              />
              <datalist id="products-datalist">
                {allProducts.map((p) => (
                  <option key={p.id} value={`${p.modelNumber} - ${p.name}`} />
                ))}
              </datalist>
            </div>

            {searchError && (
              <p style={{ color: "var(--danger)", marginTop: "0.75rem", marginBottom: 0 }}>
                {searchError}
              </p>
            )}
          </div>

          {/* ── found product card ── */}
          {foundProduct && (
            <div className="card animate-fade-in">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "1rem",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <div>
                  <h3 style={{ margin: 0 }}>{foundProduct.name}</h3>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
                    موديل: {foundProduct.modelNumber}
                  </p>
                </div>
                <span
                  style={{
                    background: "var(--primary-light)",
                    color: "var(--primary)",
                    fontWeight: 700,
                    padding: "0.25rem 0.75rem",
                    borderRadius: "var(--radius-full)",
                    fontSize: "1rem",
                  }}
                >
                  {foundProduct.price} ج.م
                </span>
              </div>

              {/* sizes */}
              <p style={{ fontSize: "0.875rem", marginBottom: "0.75rem" }}>
                المقاسات:{" "}
                <strong>{foundProduct.sizes.join(" - ")}</strong>
              </p>

              {/* colours */}
              <h4 style={{ marginBottom: "0.5rem" }}>اختر الألوان والكمية:</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {colorSelections.map((sel, idx) => (
                  <div
                    key={sel.colorName}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.5rem 0.75rem",
                      border: sel.checked ? "2px solid var(--primary)" : "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      background: sel.checked ? "var(--primary-light)" : "transparent",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={sel.checked}
                      onChange={(e) => {
                        setColorSelections((prev) => {
                          const copy = [...prev];
                          copy[idx] = { ...copy[idx], checked: e.target.checked };
                          return copy;
                        });
                      }}
                      style={{ width: 18, height: 18, cursor: "pointer", accentColor: "var(--primary)" }}
                    />
                    <span style={{ flex: 1, fontWeight: 600 }}>{sel.colorName}</span>
                    {sel.checked && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <label style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>ثري:</label>
                        <input
                          type="number"
                          min={1}
                          value={sel.qty}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value) || 1);
                            setColorSelections((prev) => {
                              const copy = [...prev];
                              copy[idx] = { ...copy[idx], qty: val };
                              return copy;
                            });
                          }}
                          className="input"
                          style={{ width: 70, padding: "0.35rem 0.5rem", textAlign: "center" }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                className="btn btn-primary"
                onClick={handleAddToOrder}
                disabled={!colorSelections.some((c) => c.checked)}
                style={{ width: "100%", marginTop: "1rem" }}
              >
                <Plus size={18} />
                إضافة للطلب
              </button>
            </div>
          )}

          {/* ── current order items list ── */}
          <div className="card">
            <h3 style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <ShoppingCart size={20} />
              عناصر الطلب
              {orderItems.length > 0 && (
                <span
                  style={{
                    background: "var(--primary)",
                    color: "#fff",
                    borderRadius: "var(--radius-full)",
                    padding: "0.1rem 0.55rem",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    marginRight: "0.25rem",
                  }}
                >
                  {orderItems.length}
                </span>
              )}
            </h3>

            {orderItems.length > 0 && (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                {Object.entries(
                  orderItems.reduce((acc, item) => {
                    const cat = getCategoryName(item.modelNumber);
                    acc[cat] = (acc[cat] || 0) + item.quantity;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([catName, count]) => (
                  <span key={catName} style={{ background: "var(--surface-hover)", padding: "0.25rem 0.75rem", borderRadius: "9999px", fontSize: "0.8rem", fontWeight: "bold", border: "1px solid var(--border)" }}>
                    {catName}: {count}
                  </span>
                ))}
              </div>
            )}

            {orderItems.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "2rem 1rem",
                  color: "var(--text-muted)",
                }}
              >
                <ShoppingCart size={40} style={{ marginBottom: "0.5rem", opacity: 0.3 }} />
                <p style={{ margin: 0 }}>لم يتم إضافة عناصر بعد</p>
                <p style={{ margin: 0, fontSize: "0.85rem" }}>ابحث عن منتج بالموديل لإضافته</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {orderItems.map((item) => (
                  <div
                    key={item.cartItemId}
                    className="animate-fade-in"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      gap: "0.75rem",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, marginBottom: "0.15rem" }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        موديل {item.modelNumber} · {item.selectedColor} · {item.quantity} ثري
                      </div>
                      <div
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          color: "var(--success)",
                          marginTop: "0.25rem",
                        }}
                      >
                        {calculateItemTotal(item)} ج.م
                      </div>
                    </div>
                    <button
                      className="btn"
                      onClick={() => removeItem(item.cartItemId)}
                      style={{
                        background: "#fee2e2",
                        color: "var(--danger)",
                        padding: "0.4rem",
                        borderRadius: "var(--radius-md)",
                        minWidth: 36,
                        minHeight: 36,
                      }}
                      title="حذف"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}

                {/* running total */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.75rem 1rem",
                    background: "var(--primary-light)",
                    borderRadius: "var(--radius-md)",
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    marginTop: "0.25rem",
                  }}
                >
                  <span>الإجمالي</span>
                  <span style={{ color: "var(--primary)" }}>{total} ج.م</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ╔═══════════ RIGHT: Customer Info + Submit ═══════════╗ */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* ── customer info card ── */}
          <div className="card">
            <h3 style={{ marginBottom: "1rem" }}>بيانات العميل</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* name */}
              <div style={{ position: "relative" }}>
                <label style={{ display: "block", marginBottom: "0.35rem", fontWeight: 600, fontSize: "0.9rem" }}>
                  اسم العميل <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  className="input"
                  type="text"
                  placeholder="أدخل اسم العميل"
                  value={customerName}
                  onChange={(e) => handleCustomerNameChange(e.target.value)}
                  onFocus={() => setShowCustomerDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                />
                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div style={{ 
                    position: "absolute", 
                    top: "100%", 
                    left: 0, 
                    right: 0, 
                    background: "white", 
                    border: "1px solid var(--border)", 
                    borderRadius: "var(--radius-md)", 
                    boxShadow: "var(--shadow-md)", 
                    zIndex: 10,
                    maxHeight: "200px",
                    overflowY: "auto",
                    marginTop: "4px"
                  }}>
                    {filteredCustomers.map(cust => (
                      <div 
                        key={cust.id} 
                        style={{ padding: "10px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", background: "white", transition: "background 0.2s" }}
                        onClick={() => handleSelectCustomer(cust)}
                        onMouseDown={(e) => e.preventDefault()} 
                        onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "white"}
                      >
                        <div style={{ fontWeight: "bold" }}>{cust.name}</div>
                        <div style={{ fontSize: "0.8rem", color: "gray" }}>{cust.phone} {cust.brandName ? `- ${cust.brandName}` : ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* phone */}
              <div>
                <label style={{ display: "block", marginBottom: "0.35rem", fontWeight: 600, fontSize: "0.9rem" }}>
                  رقم الهاتف <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  className="input"
                  type="tel"
                  placeholder="أدخل رقم الهاتف"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  onBlur={handlePhoneBlur}
                />
                {isSearchingCustomer && (
                  <span style={{ fontSize: "0.8rem", color: "var(--primary)", marginTop: "0.25rem", display: "block" }}>
                    جاري البحث عن العميل...
                  </span>
                )}
              </div>

              {/* brand */}
              <div>
                <label style={{ display: "block", marginBottom: "0.35rem", fontWeight: 600, fontSize: "0.9rem" }}>
                  البراند / المحل
                </label>
                <input
                  className="input"
                  type="text"
                  placeholder="اختياري"
                  value={customerBrand}
                  onChange={(e) => setCustomerBrand(e.target.value)}
                />
              </div>

              {/* governorate & address */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.35rem", fontWeight: 600, fontSize: "0.9rem" }}>
                    المحافظة
                  </label>
                  <input
                    className="input"
                    type="text"
                    placeholder="اختياري"
                    value={customerGovernorate}
                    onChange={(e) => setCustomerGovernorate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "0.35rem", fontWeight: 600, fontSize: "0.9rem" }}>
                    العنوان التفصيلي
                  </label>
                  <input
                    className="input"
                    type="text"
                    placeholder="اختياري"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                  />
                </div>
              </div>

              {/* deposit + delivery date side by side */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.35rem", fontWeight: 600, fontSize: "0.9rem" }}>
                    ميعاد التسليم
                  </label>
                  <input
                    className="input"
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", marginBottom: "0.35rem", fontWeight: 600, fontSize: "0.9rem" }}>
                      العربون (ج.م)
                    </label>
                    <input
                      className="input"
                      type="number"
                      placeholder="0"
                      value={deposit}
                      onChange={(e) => setDeposit(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", marginBottom: "0.35rem", fontWeight: 600, fontSize: "0.9rem" }}>
                      خصم (%)
                    </label>
                    <input
                      className="input"
                      type="number"
                      placeholder="0"
                      min="0"
                      max="100"
                      value={discountPercentage}
                      onChange={(e) => setDiscountPercentage(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── order summary card ── */}
          <div className="card">
            <h3 style={{ marginBottom: "1rem" }}>ملخص الطلب</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.95rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>عدد العناصر</span>
                <span style={{ fontWeight: 600 }}>{orderItems.length}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>الإجمالي</span>
                <span style={{ fontWeight: 600 }}>{total} ج.م</span>
              </div>
              {discountNum > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>الخصم ({discountNum}%)</span>
                  <span style={{ fontWeight: 600, color: "var(--success)" }}>- {discountValue} ج.م</span>
                </div>
              )}
              {depositNum > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>العربون المدفوع</span>
                  <span style={{ fontWeight: 600, color: "var(--warning)" }}>- {depositNum} ج.م</span>
                </div>
              )}
              <div style={{ borderTop: "1px solid var(--border)", margin: "0.5rem 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.2rem", fontWeight: 700, color: "var(--primary)" }}>
                <span>المتبقي</span>
                <span>{remaining} ج.م</span>
              </div>
              {depositNum > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>العربون</span>
                    <span style={{ fontWeight: 600, color: "var(--warning)" }}>
                      - {depositNum} ج.م
                    </span>
                  </div>
                  <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "0.25rem 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700 }}>المتبقي</span>
                    <span style={{ fontWeight: 700, color: "var(--primary)", fontSize: "1.1rem" }}>
                      {remaining} ج.م
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── submit button ── */}
          <button
            className="btn btn-secondary"
            onClick={handleSubmit}
            disabled={submitting || orderItems.length === 0 || !customerName.trim() || !customerPhone.trim()}
            style={{
              width: "100%",
              padding: "1rem",
              fontSize: "1.1rem",
              opacity:
                submitting || orderItems.length === 0 || !customerName.trim() || !customerPhone.trim()
                  ? 0.5
                  : 1,
              cursor:
                submitting || orderItems.length === 0 || !customerName.trim() || !customerPhone.trim()
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            <Send size={20} />
            {submitting ? "جاري إنشاء الطلب..." : "إنشاء الطلب"}
          </button>
        </div>
      </div>

      {/* ── responsive: stack columns on mobile ── */}
      <style>{`
        @media (max-width: 768px) {
          .create-order-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
