'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Store, 
  LogOut, 
  PackageCheck, 
  ShoppingCart, 
  ClipboardList, 
  CheckCircle2, 
  Banknote,
  Activity
} from 'lucide-react';
import ReceptionForm from '@/components/outlet/ReceptionForm';
import ExpenseForm from '@/components/outlet/ExpenseForm';
import OrderRequestForm from '@/components/outlet/OrderRequestForm';
import DailyClosingForm from '@/components/outlet/DailyClosingForm';
import CashSettlementForm from '@/components/outlet/CashSettlementForm';
import BranchStockMonitor from '@/components/outlet/components/shared/BranchStockMonitor';

export default function OutletDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeView, setActiveView] = useState<'menu' | 'reception' | 'expense' | 'order' | 'closing' | 'settlement'>('menu');

  useEffect(() => {
    const saved = localStorage.getItem('baksoibu_active_staff');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('baksoibu_active_staff');
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-[#f8f9fd] text-slate-800 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-slate-900 leading-none">
              Bakso Ibu {user?.location_name ? `Outlet ${user.location_name}` : 'Outlet'}
            </h1>
            <p className="text-[11px] font-semibold text-slate-400 mt-1">
              Operasional Kasir, Dapur & Stok Cabang
            </p>
          </div>
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-extrabold text-slate-900 leading-tight">
              {user?.active_staff_name || 'Petugas Outlet'}
            </div>
            <span className="inline-block text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
              {user?.role || 'CREW'}
            </span>
          </div>
          <button
            onClick={handleLogout}
            title="Keluar"
            className="w-9 h-9 rounded-2xl bg-white border border-slate-200/80 hover:bg-red-50 hover:border-red-200 text-slate-400 hover:text-red-600 flex items-center justify-center transition-all shadow-xs"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-4 space-y-6">
        {/* TAMPILAN MENU UTAMA (5 KARTU OPERASIONAL) */}
        {activeView === 'menu' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* 1. Terima Barang */}
              <button
                onClick={() => setActiveView('reception')}
                className="bg-white p-5 rounded-3xl border border-slate-100 hover:border-indigo-500/30 transition-all text-left shadow-xs hover:shadow-md hover:shadow-indigo-500/5 group flex flex-col justify-between"
              >
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 group-hover:text-indigo-600 transition-colors">
                    1. Terima Barang Datang
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    Konfirmasi kedatangan bahan dari Dapur Pusat / belanja luar.
                  </p>
                </div>
              </button>

              {/* 2. Belanja Pasar */}
              <button
                onClick={() => setActiveView('expense')}
                className="bg-white p-5 rounded-3xl border border-slate-100 hover:border-indigo-500/30 transition-all text-left shadow-xs hover:shadow-md hover:shadow-indigo-500/5 group flex flex-col justify-between"
              >
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 group-hover:text-emerald-600 transition-colors">
                    2. Kas Kecil & Belanja Pasar
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    Catat nota pengeluaran belanja sayur/bumbu lokal.
                  </p>
                </div>
              </button>

              {/* 3. Request Order */}
              <button
                onClick={() => setActiveView('order')}
                className="bg-white p-5 rounded-3xl border border-slate-100 hover:border-indigo-500/30 transition-all text-left shadow-xs hover:shadow-md hover:shadow-indigo-500/5 group flex flex-col justify-between"
              >
                <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 group-hover:text-blue-600 transition-colors">
                    3. Request Order Malam
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    Ajukan kebutuhan stok bakso & bumbu ke Dapur Pusat.
                  </p>
                </div>
              </button>

              {/* 4. Closing Tutup Toko */}
              <button
                onClick={() => setActiveView('closing')}
                className="bg-white p-5 rounded-3xl border border-slate-100 hover:border-orange-500/30 transition-all text-left shadow-xs hover:shadow-md hover:shadow-orange-500/5 group flex flex-col justify-between"
              >
                <div className="w-11 h-11 rounded-2xl bg-orange-50 text-[#ff6f3c] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 group-hover:text-[#ff6f3c] transition-colors">
                    4. Form Tutup Toko (Closing)
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    Opname sisa fisik etalase & catat barang waste + foto.
                  </p>
                </div>
              </button>

              {/* 5. Rekap Omset & Setoran */}
              <button
                onClick={() => setActiveView('settlement')}
                className="bg-white p-5 rounded-3xl border border-slate-100 hover:border-emerald-500/30 transition-all text-left shadow-xs hover:shadow-md hover:shadow-emerald-500/5 group flex flex-col justify-between"
              >
                <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 group-hover:text-teal-600 transition-colors">
                    5. Rekap Omset & Setoran Kas
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    Tutup kasir, hitung uang cash, QRIS & bukti setor.
                  </p>
                </div>
              </button>
            </div>

            {/* Tabel Monitor Stok Cabang Ini */}
            <div>
              <BranchStockMonitor />
            </div>
          </div>
        )}

        {/* TAMPILAN FORM MASING-MASING */}
        {activeView === 'reception' && (
          <ReceptionForm user={user} onBack={() => setActiveView('menu')} />
        )}
        {activeView === 'expense' && (
          <ExpenseForm user={user} onBack={() => setActiveView('menu')} />
        )}
        {activeView === 'order' && (
          <OrderRequestForm user={user} onBack={() => setActiveView('menu')} />
        )}
        {activeView === 'closing' && (
          <DailyClosingForm user={user} onBack={() => setActiveView('menu')} />
        )}
        {activeView === 'settlement' && (
          <CashSettlementForm user={user} onBack={() => setActiveView('menu')} />
        )}
      </main>
    </div>
  );
}