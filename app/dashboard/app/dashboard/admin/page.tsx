'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, LogOut, ShoppingBag, Activity } from 'lucide-react';
import BranchStockMonitor from '@/components/outlet/components/shared/BranchStockMonitor';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'monitor' | 'orders'>('monitor');

  return (
    <div className="min-h-screen bg-[#f8f9fd] text-slate-800 font-sans">
      <header className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 leading-tight">Admin Operasional</h1>
            <p className="text-xs text-slate-400 font-semibold">Pengawasan Inventori Cabang & Logistik</p>
          </div>
        </div>

        <button
          onClick={() => { localStorage.removeItem('baksoibu_active_staff'); router.push('/login'); }}
          className="p-2.5 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-red-600 shadow-xs"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 space-y-6">
        <BranchStockMonitor />
      </main>
    </div>
  );
}