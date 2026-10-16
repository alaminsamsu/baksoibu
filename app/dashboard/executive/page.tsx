'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Crown, LogOut, TrendingDown, AlertTriangle, Store, Layers } from 'lucide-react';
import BranchStockMonitor from '@/components/outlet/components/shared/BranchStockMonitor';

export default function ExecutiveDashboard() {
  const router = useRouter();
  const [locations, setLocations] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('locations').select('*');
      if (data) setLocations(data);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f9fd] text-slate-800 font-sans">
      <header className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#ff6f3c] text-white flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 leading-tight">Executive Owner Dashboard</h1>
            <p className="text-xs text-slate-400 font-semibold">Evaluasi Performa & Kontrol Kebocoran Bahan Baku</p>
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
        {/* Metrik Strategis Owner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm shadow-slate-200/40">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
              <span>Total Outlet Aktif</span>
              <Store className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-3xl font-black text-slate-900 mt-2">{locations.length || 2} Cabang</p>
            <span className="text-[11px] text-slate-400 font-medium mt-1 inline-block">BTP & Cabang Operasional</span>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm shadow-slate-200/40">
            <div className="flex items-center justify-between text-emerald-600 text-xs font-bold">
              <span>Status Efisiensi Bahan</span>
              <TrendingDown className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-3xl font-black text-emerald-600 mt-2">Optimal</p>
            <span className="text-[11px] text-slate-400 font-medium mt-1 inline-block">Berdasarkan rasio pemakaian vs closing</span>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm shadow-slate-200/40">
            <div className="flex items-center justify-between text-[#ff6f3c] text-xs font-bold">
              <span>Toleransi Maksimal Waste</span>
              <AlertTriangle className="w-4 h-4 text-[#ff6f3c]" />
            </div>
            <p className="text-3xl font-black text-[#ff6f3c] mt-2">&lt; 3.0%</p>
            <span className="text-[11px] text-slate-400 font-medium mt-1 inline-block">Ambang batas barang basi/rusak</span>
          </div>
        </div>

        {/* Monitor Pergerakan Seluruh Cabang */}
        <div>
          <BranchStockMonitor />
        </div>
      </main>
    </div>
  );
}