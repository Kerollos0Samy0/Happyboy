import React from 'react';

export default function SupervisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir="rtl">
      {/* بسيط: شريط علوي موحد لمشرفي الإنتاج */}
      <header className="bg-blue-600 text-white p-4 shadow-md flex justify-between items-center">
        <h1 className="text-xl font-bold">بوابة المشرفين - الإنتاج</h1>
        <div className="text-sm bg-blue-700 px-3 py-1 rounded-full">
          صالة الإنتاج
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
