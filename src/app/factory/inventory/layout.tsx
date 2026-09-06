"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Scissors, Palette, Box } from 'lucide-react';

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { href: '/factory/inventory/fabric', label: 'مخزن القماش (أتواب)', icon: <Scissors size={18} /> },
    { href: '/factory/inventory/threads', label: 'مخزن الخيوط', icon: <Palette size={18} /> },
    { href: '/factory/inventory/accessories', label: 'مخزن الإكسسوارات', icon: <Box size={18} /> },
  ];

  return (
    <div className="w-full mx-auto space-y-6 pb-20" dir="rtl">
      
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-2 overflow-x-auto scrollbar-hide">
        {tabs.map(tab => {
          const isActive = pathname === tab.href;
          return (
            <Link 
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-sm transition-colors whitespace-nowrap ${isActive ? 'bg-green-100 text-green-800' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {tab.icon} {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="bg-transparent">
        {children}
      </div>

    </div>
  );
}
