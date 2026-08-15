"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../../../lib/firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { Search, UserPlus, Plus, Trash2, Printer, CheckCircle } from "lucide-react";

interface Customer {
  id?: string;
  phone: string;
  name: string;
  brandName: string;
  customerType: string;
}

interface Product {
  id: string;
  name: string;
  modelNumber: string;
  price: number;
}

interface InvoiceItem {
  productId: string;
  name: string;
  modelNumber: string;
  price: number;
  quantity: number;
}

const CUSTOMER_TYPES = [
  "محلات حساب",
  "محلات مقابل",
  "عملاء خارجي",
  "عملاء مكاتب",
  "مجموعات محلات"
];

export default function FastInvoicePage() {
  const [phoneSearch, setPhoneSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  
  // New Customer Form State
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [newCustomerType, setNewCustomerType] = useState(CUSTOMER_TYPES[0]);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // Products & Invoice State
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Fetch products for the dropdown
  useEffect(() => {
    const q = query(collection(db, "products"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        prods.push({ id: doc.id, name: data.name, modelNumber: data.modelNumber, price: data.price });
      });
      setAvailableProducts(prods);
    });
    return () => unsubscribe();
  }, []);

  const handleSearchCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneSearch.trim()) return;
    
    setIsSearching(true);
    setShowNewCustomerForm(false);
    setCustomer(null);
    
    try {
      const q = query(collection(db, "customers"), where("phone", "==", phoneSearch.trim()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const custDoc = querySnapshot.docs[0];
        setCustomer({ id: custDoc.id, ...custDoc.data() } as Customer);
      } else {
        // Customer not found, show form to create new
        setShowNewCustomerForm(true);
      }
    } catch (error) {
      console.error("Error searching customer:", error);
      alert("حدث خطأ أثناء البحث عن العميل");
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newBrandName.trim()) return;
    
    setIsSavingCustomer(true);
    try {
      const newCustomerData = {
        phone: phoneSearch.trim(),
        name: newName.trim(),
        brandName: newBrandName.trim(),
        customerType: newCustomerType,
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, "customers"), newCustomerData);
      setCustomer({ id: docRef.id, ...newCustomerData });
      setShowNewCustomerForm(false);
    } catch (error) {
      console.error("Error creating customer:", error);
      alert("حدث خطأ أثناء تسجيل العميل الجديد");
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleAddItem = () => {
    if (!selectedProductId) return;
    
    const product = availableProducts.find(p => p.id === selectedProductId);
    if (!product) return;

    // Check if already in list
    const existingIndex = invoiceItems.findIndex(i => i.productId === selectedProductId);
    if (existingIndex >= 0) {
      const updated = [...invoiceItems];
      updated[existingIndex].quantity += selectedQuantity;
      setInvoiceItems(updated);
    } else {
      setInvoiceItems([...invoiceItems, {
        productId: product.id,
        name: product.name,
        modelNumber: product.modelNumber,
        price: product.price,
        quantity: selectedQuantity
      }]);
    }
    
    // Reset selection
    setSelectedProductId("");
    setSelectedQuantity(1);
  };

  const handleRemoveItem = (index: number) => {
    const updated = [...invoiceItems];
    updated.splice(index, 1);
    setInvoiceItems(updated);
  };

  const totalAmount = invoiceItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleSaveInvoice = async () => {
    if (!customer || invoiceItems.length === 0) {
      alert("يجب اختيار العميل وإضافة منتجات للفاتورة");
      return;
    }

    setIsSavingInvoice(true);
    setSuccessMessage("");
    try {
      const orderData = {
        customerId: customer.id,
        customerName: customer.name,
        brandName: customer.brandName,
        customerPhone: customer.phone,
        customerType: customer.customerType,
        items: invoiceItems,
        total: totalAmount,
        deposit: 0,
        status: "pending", // Appears as 'New' in the dashboard
        createdBy: auth.currentUser?.email || "unknown",
        createdAt: serverTimestamp(),
        source: "factory"
      };

      await addDoc(collection(db, "orders"), orderData);
      
      setSuccessMessage("تم حفظ الفاتورة بنجاح وإرسالها للتجهيز!");
      // Reset form
      setInvoiceItems([]);
      setPhoneSearch("");
      setCustomer(null);
      
      setTimeout(() => setSuccessMessage(""), 3000);
      
    } catch (error) {
      console.error("Error saving invoice:", error);
      alert("حدث خطأ أثناء حفظ الفاتورة");
    } finally {
      setIsSavingInvoice(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">إنشاء فاتورة سريعة</h2>
          <p className="text-gray-500 text-sm mt-1">قم بإدخال رقم العميل لإنشاء الطلب وإرساله للتجهيز</p>
        </div>
      </div>

      {successMessage && (
        <div className="bg-green-50 text-green-700 p-4 rounded-lg flex items-center gap-2 border border-green-200">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer Details */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center gap-2">
              <Search className="w-5 h-5 text-gray-400" />
              البحث عن عميل
            </h3>
            
            <form onSubmit={handleSearchCustomer} className="flex gap-2">
              <input 
                type="tel" 
                placeholder="رقم الموبايل..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={phoneSearch}
                onChange={(e) => setPhoneSearch(e.target.value)}
                required
              />
              <button 
                type="submit" 
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                disabled={isSearching}
              >
                {isSearching ? "..." : "بحث"}
              </button>
            </form>

            {/* Display Found Customer */}
            {customer && !showNewCustomerForm && (
              <div className="mt-6 bg-blue-50 border border-blue-100 p-4 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-lg text-blue-900">{customer.brandName}</h4>
                  <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full font-medium">
                    {customer.customerType}
                  </span>
                </div>
                <div className="text-sm text-gray-700 space-y-1">
                  <p><span className="text-gray-500">الاسم:</span> {customer.name}</p>
                  <p><span className="text-gray-500">الرقم:</span> {customer.phone}</p>
                </div>
              </div>
            )}

            {/* Display New Customer Form */}
            {showNewCustomerForm && (
              <div className="mt-6 border-t pt-4">
                <div className="flex items-center gap-2 mb-4 text-orange-600">
                  <UserPlus className="w-5 h-5" />
                  <h4 className="font-bold">عميل جديد</h4>
                </div>
                
                <form onSubmit={handleCreateCustomer} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">اسم العميل</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">اسم البراند / الشركة</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={newBrandName}
                      onChange={(e) => setNewBrandName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">نوع العميل</label>
                    <select 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={newCustomerType}
                      onChange={(e) => setNewCustomerType(e.target.value)}
                    >
                      {CUSTOMER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <button 
                    type="submit" 
                    className="w-full bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 transition text-sm font-medium mt-2"
                    disabled={isSavingCustomer}
                  >
                    {isSavingCustomer ? "جاري الحفظ..." : "تسجيل العميل"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Invoice Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">تفاصيل الفاتورة</h3>
            
            <div className={`transition-opacity ${!customer ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              {/* Add Item Row */}
              <div className="flex flex-wrap md:flex-nowrap gap-3 mb-6 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-gray-700 mb-1">المنتج</label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                  >
                    <option value="">-- اختر المنتج --</option>
                    {availableProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.modelNumber}) - {p.price} ج</option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <label className="block text-xs font-medium text-gray-700 mb-1">الكمية</label>
                  <input 
                    type="number" 
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    value={selectedQuantity}
                    onChange={(e) => setSelectedQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="flex items-end">
                  <button 
                    onClick={handleAddItem}
                    className="bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-900 transition flex items-center gap-1 h-[38px]"
                    disabled={!selectedProductId}
                  >
                    <Plus className="w-4 h-4" /> إضافة
                  </button>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto rounded-lg border border-gray-200 mb-6">
                <table className="w-full text-sm text-right">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-4 py-3 font-medium">المنتج</th>
                      <th className="px-4 py-3 font-medium">الموديل</th>
                      <th className="px-4 py-3 font-medium text-center">الكمية</th>
                      <th className="px-4 py-3 font-medium text-center">السعر</th>
                      <th className="px-4 py-3 font-medium text-center">الإجمالي</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                          لم يتم إضافة منتجات للفاتورة بعد
                        </td>
                      </tr>
                    ) : (
                      invoiceItems.map((item, idx) => (
                        <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3">{item.name}</td>
                          <td className="px-4 py-3 text-gray-500">{item.modelNumber}</td>
                          <td className="px-4 py-3 text-center font-medium">{item.quantity}</td>
                          <td className="px-4 py-3 text-center">{item.price} ج</td>
                          <td className="px-4 py-3 text-center font-bold text-blue-700">{item.price * item.quantity} ج</td>
                          <td className="px-4 py-3 text-center">
                            <button 
                              onClick={() => handleRemoveItem(idx)}
                              className="text-red-400 hover:text-red-600 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {invoiceItems.length > 0 && (
                    <tfoot className="bg-gray-50 font-bold border-t border-gray-200">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-left">الإجمالي الكلي:</td>
                        <td className="px-4 py-3 text-center text-lg text-green-600">{totalAmount} ج.م</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 border-t pt-4">
                <button 
                  onClick={handleSaveInvoice}
                  disabled={isSavingInvoice || invoiceItems.length === 0}
                  className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  {isSavingInvoice ? "جاري الحفظ..." : "حفظ وطباعة للتجهيز"}
                </button>
              </div>

            </div>
            
            {!customer && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl pointer-events-none">
                <div className="bg-white px-4 py-2 rounded-full shadow-sm text-sm text-gray-500 font-medium border border-gray-100">
                  يرجى البحث عن عميل أو تسجيله أولاً
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
