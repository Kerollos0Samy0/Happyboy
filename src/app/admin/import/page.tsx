"use client";

import React, { useState } from "react";
import { db } from "../../../lib/firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import * as xlsx from "xlsx";
import { UploadCloud, CheckCircle, AlertTriangle } from "lucide-react";

export default function ImportExcelPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ updated: number; notFound: number } | null>(null);
  const [error, setError] = useState("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");
    setResult(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = xlsx.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const excelData = xlsx.utils.sheet_to_json<any>(worksheet);

        // Calculate total quantity per model
        const modelQuantities: Record<string, number> = {};
        for (const row of excelData) {
          if (row.Code && row['عدد القطع'] !== undefined) {
            const codeStr = String(row.Code);
            const modelNumber = codeStr.split('&')[0];
            if (!modelQuantities[modelNumber]) {
              modelQuantities[modelNumber] = 0;
            }
            modelQuantities[modelNumber] += parseInt(row['عدد القطع'], 10);
          }
        }

        // Update Firestore
        const snapshot = await getDocs(collection(db, "products"));
        let updated = 0;
        let notFound = 0;

        for (const productDoc of snapshot.docs) {
          const prodData = productDoc.data();
          const modelNumber = String(prodData.modelNumber);

          if (modelQuantities[modelNumber] !== undefined) {
            const newQuantity = modelQuantities[modelNumber];
            await updateDoc(doc(db, "products", productDoc.id), {
              quantity: newQuantity
            });
            updated++;
          } else {
            notFound++;
          }
        }

        setResult({ updated, notFound });
      } catch (err: any) {
        console.error(err);
        setError("حدث خطأ أثناء قراءة الملف أو تحديث البيانات: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6 text-slate-800">📥 تحديث المخزون من ملف Excel</h2>
      
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <p className="mb-4 text-slate-600">
          قم برفع ملف Excel (مثال: المخزن.xlsx) لتحديث كميات الموديلات في قاعدة البيانات تلقائياً بناءً على عمود `Code` و `عدد القطع`.
        </p>

        <div className="border-2 border-dashed border-slate-300 rounded-lg p-10 text-center hover:bg-slate-50 transition-colors">
          <UploadCloud className="mx-auto text-slate-400 mb-3" size={48} />
          <label className="cursor-pointer text-primary font-bold text-lg">
            اختر ملف Excel
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              onChange={handleFileUpload} 
              disabled={loading}
            />
          </label>
        </div>

        {loading && (
          <div className="mt-6 text-center text-slate-600 font-bold animate-pulse">
            جاري قراءة الملف وتحديث قاعدة البيانات... الرجاء الانتظار ⏳
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertTriangle /> {error}
          </div>
        )}

        {result && (
          <div className="mt-6 p-4 bg-green-50 text-green-800 border border-green-200 rounded-lg flex flex-col gap-2">
            <div className="flex items-center gap-2 font-bold text-lg">
              <CheckCircle /> تم تحديث المخزون بنجاح!
            </div>
            <ul className="list-disc list-inside mt-2">
              <li>تم تحديث كميات <strong>{result.updated}</strong> موديل.</li>
              <li>لم يتم العثور على <strong>{result.notFound}</strong> موديل في ملف Excel.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
