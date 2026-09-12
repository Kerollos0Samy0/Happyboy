"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { factoryDepartments } from "../../../lib/departments";

export default function DepartmentDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const departmentId = params.departmentId as string;
  
  const [department, setDepartment] = useState<any>(null);

  useEffect(() => {
    const dept = factoryDepartments.find((d) => d.id === departmentId);
    if (!dept) {
      router.push("/factory/login");
    } else {
      setDepartment(dept);
    }
  }, [departmentId, router]);

  if (!department) return null;

  return (
    <div className="p-6">
      <div className="card w-full mb-6 bg-white shadow-sm p-6 rounded-xl border-t-4 border-t-primary">
        <h1 className="text-2xl font-bold text-gray-800">
          لوحة تحكم - {department.name}
        </h1>
        <p className="text-gray-500 mt-2">
          مرحباً بك في قسم {department.name}. من هنا يمكنك إدارة أوامر الشغل الخاصة بك.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Placeholder for Work Orders */}
        <div className="card p-6 bg-white shadow-sm rounded-xl border border-gray-100">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            📋 أوامر الشغل المطلوبة
          </h2>
          <div className="text-center py-10 bg-gray-50 rounded-lg text-gray-500">
            لا توجد أوامر شغل حالياً
          </div>
        </div>

        {/* If it's the warehouse, show the scanner shortcut */}
        {department.id === "fabric_warehouse" && (
          <div className="card p-6 bg-white shadow-sm rounded-xl border border-gray-100">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              📦 ماسح الأتواب (Scanner)
            </h2>
            <p className="text-gray-500 mb-4">
              استخدم الماسح لقراءة الباركود الخاص بأتواب القماش ومطابقتها مع أمر الشغل.
            </p>
            <button className="btn btn-primary w-full py-3">
              فتح شاشة الإسكان
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
