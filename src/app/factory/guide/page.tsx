"use client";

import React from 'react';
import { ShieldCheck, Clock, QrCode, Factory, Shirt, Package, CheckCircle, ArrowLeft, Scissors, Users, BarChart3, Workflow } from 'lucide-react';
import Link from 'next/link';

export default function FactoryGuidePage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans" dir="rtl">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-cyan-800 to-cyan-600 text-white py-16 px-4 text-center shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        <div className="relative z-10 max-w-4xl mx-auto">
          <Factory size={64} className="mx-auto mb-4 text-cyan-200" />
          <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">دليل التشغيل الذكي</h1>
          <p className="text-xl md:text-2xl font-medium text-cyan-100">نظام إدارة مصنع <span className="font-black text-white">Happy Boy & Girl</span></p>
          <p className="mt-4 max-w-2xl mx-auto text-sm md:text-base text-cyan-50">
            تحول رقمي شامل لضمان دقة الحسابات، سرعة الإنتاج، والرقابة الصارمة على الخامات والعمالة.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-8 relative z-20 space-y-8">
        
        {/* Section 1: For Management */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
            <BarChart3 className="text-white" size={28} />
            <h2 className="text-2xl font-bold text-white">لصاحب العمل والإدارة العليا</h2>
          </div>
          <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-red-50 p-6 rounded-xl border border-red-100 text-center">
              <ShieldCheck size={40} className="mx-auto text-red-600 mb-3" />
              <h3 className="font-bold text-gray-800 mb-2">رقابة صارمة للخامات</h3>
              <p className="text-sm text-gray-600">تسليم وتسلم رقمي بين مخزن القماش وقسم القص. لا يمكن هدر أو ضياع أي أمتار دون تسجيلها بالسيستم.</p>
            </div>
            <div className="bg-cyan-50 p-6 rounded-xl border border-cyan-100 text-center">
              <Clock size={40} className="mx-auto text-cyan-600 mb-3" />
              <h3 className="font-bold text-gray-800 mb-2">الإنتاجية بالثانية</h3>
              <p className="text-sm text-gray-600">استبعاد أوقات توقف العمال (البريك) وحساب "وقت التشغيل الفعلي" لإصدار تقارير كفاءة دقيقة بالقرش.</p>
            </div>
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 text-center">
              <Workflow size={40} className="mx-auto text-blue-600 mb-3" />
              <h3 className="font-bold text-gray-800 mb-2">رؤية حية للمصنع</h3>
              <p className="text-sm text-gray-600">لوحة تحكم (Dashboard) تعرض لك مكان كل موديل في أي لحظة، لتعرف أين يقف الإنتاج وأين التعطيل.</p>
            </div>
          </div>
        </div>

        {/* Section 2: Flow */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-slate-800 px-6 py-4 flex items-center gap-3">
            <Factory className="text-white" size={28} />
            <h2 className="text-2xl font-bold text-white">دورة العمل الآلية (Workflow)</h2>
          </div>
          <div className="p-6 md:p-8">
            <div className="flex flex-wrap justify-center gap-4 text-sm font-bold">
              <div className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-full"><Package size={16}/> أوامر التشغيل</div>
              <ArrowLeft className="text-slate-300 my-auto hidden md:block" />
              <div className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-full"><Scissors size={16}/> قص وطباعة</div>
              <ArrowLeft className="text-slate-300 my-auto hidden md:block" />
              <div className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-full"><Shirt size={16}/> صالة المكن</div>
              <ArrowLeft className="text-slate-300 my-auto hidden md:block" />
              <div className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-full"><CheckCircle size={16}/> تشطيب وتعبئة</div>
            </div>
            <div className="mt-6 bg-slate-50 p-4 rounded-lg border border-slate-200 text-slate-700 text-sm leading-relaxed">
              <p className="mb-2"><strong>حسابات إنتاجية ذكية:</strong> النظام يفهم الفروق الفنية بين الأقسام:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-600">
                <li>يحاسب قسم <strong>الطباعة</strong> بـ (المتر).</li>
                <li>يحاسب قسم <strong>المكن</strong> بـ (عملية تفصيلية زي تركيب 1200 كم).</li>
                <li>يحاسب قسم <strong>التعبئة والمخزن</strong> بـ (عدد الأطقم).</li>
                <li>يحاسب <strong>باقي الأقسام</strong> بـ (إجمالي القطع - تيشيرت + بنطلون).</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Section 3: Supervisors (Scanner) */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-cyan-600 px-6 py-4 flex items-center gap-3">
            <QrCode className="text-white" size={28} />
            <h2 className="text-2xl font-bold text-white">دليل التشغيل لرؤساء الأقسام (الماسح الضوئي)</h2>
          </div>
          <div className="p-6 md:p-8">
            <p className="text-gray-600 mb-6 font-medium">كل قسم يستلم الشغل بـ (إسكان) ويسلمه بـ (إسكان). لا حاجة لترك الموبايل مفتوح طوال العمل.</p>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="relative border-r-4 border-cyan-500 pr-6">
                <div className="absolute -right-3 top-0 bg-cyan-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm">1</div>
                <h3 className="text-xl font-bold text-cyan-800 mb-3">بدء العمل (الاستلام)</h3>
                <ol className="space-y-2 text-gray-700 text-sm">
                  <li>1. افتح شاشة <strong className="text-cyan-700">الماسح الضوئي</strong>.</li>
                  <li>2. اختر قسمك من القائمة العلوية.</li>
                  <li>3. قم بعمل Scan لباركود الموديل.</li>
                  <li>4. اضغط <strong className="text-green-600">بدء العمل ⏱️</strong> (هنا يبدأ العداد).</li>
                  <li className="text-cyan-600 font-bold mt-2">💡 الآن يمكنك إغلاق الموبايل والذهاب للعمل.</li>
                </ol>
              </div>
              
              <div className="relative border-r-4 border-red-500 pr-6">
                <div className="absolute -right-3 top-0 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm">2</div>
                <h3 className="text-xl font-bold text-red-800 mb-3">إنهاء وتسجيل الإنتاجية</h3>
                <ol className="space-y-2 text-gray-700 text-sm">
                  <li>1. بعد الانتهاء، افتح الماسح الضوئي مرة أخرى.</li>
                  <li>2. قم بعمل Scan لنفس الباركود.</li>
                  <li>3. سيتعرف النظام أنك قيد العمل، ويظهر لك شاشة الإنتاجية.</li>
                  <li>4. أدخل التفاصيل (كم متر؟ وجه واحد أم وجهين؟).</li>
                  <li>5. اضغط <strong className="text-red-600">إنهاء المرحلة وتسليم ✅</strong>.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Sewing Supervisors */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-indigo-600 px-6 py-4 flex items-center gap-3">
            <Users className="text-white" size={28} />
            <h2 className="text-2xl font-bold text-white">دليل التشغيل لمشرفي خطوط المكن (الخياطة)</h2>
          </div>
          <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 items-center">
            <div className="flex-1 space-y-4">
              <h3 className="text-xl font-bold text-indigo-800">الصندوق المجمع (Shared Pool) 🧵</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                بمجرد وصول أي موديل لـ "قسم المكن"، يظهر فوراً في صندوق الوارد لـ <strong>جميع مشرفي الخطوط</strong> في نفس الوقت.
              </p>
              <ul className="list-none space-y-3 text-sm text-gray-700">
                <li className="flex items-center gap-2"><CheckCircle size={16} className="text-indigo-500"/> المشرف يختار الموديل من الصندوق المشترك.</li>
                <li className="flex items-center gap-2"><CheckCircle size={16} className="text-indigo-500"/> يحدد اسم العملية والكمية (مثال: تركيب 1200 كم).</li>
                <li className="flex items-center gap-2"><CheckCircle size={16} className="text-indigo-500"/> يرسل المهمة للعامل (سنجر أو أوفر) ويبدأ العداد.</li>
                <li className="flex items-center gap-2"><CheckCircle size={16} className="text-indigo-500"/> يمكن لأكثر من خط العمل على نفس الموديل معاً لسرعة الإنجاز.</li>
              </ul>
            </div>
            <div className="w-full md:w-1/3 bg-indigo-50 p-6 rounded-xl border border-indigo-100 text-center">
              <div className="text-indigo-800 font-black text-4xl mb-2">100%</div>
              <div className="text-sm font-bold text-indigo-600">دقة حسابات</div>
              <p className="text-xs text-indigo-500 mt-2">لا يتم الاعتماد على كمية الموديل الإجمالية، بل على عدد العمليات الفعلية لكل عامل.</p>
            </div>
          </div>
        </div>
        
        <div className="text-center pt-4 pb-8">
          <Link href="/factory/dashboard" className="inline-flex items-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-700 transition shadow-lg">
            الذهاب إلى لوحة حركة المصنع
            <ArrowLeft size={18} />
          </Link>
        </div>

      </div>
    </div>
  );
}
