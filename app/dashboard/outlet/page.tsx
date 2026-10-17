'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Package, 
  Wallet, 
  Send, 
  Store, 
  Banknote, 
  LogOut, 
  User, 
  MapPin 
} from 'lucide-react';

import ReceptionForm from '@/components/outlet/ReceptionForm';
import ExpenseForm from '@/components/outlet/ExpenseForm';
import OrderRequestForm from '@/components/outlet/OrderRequestForm';
import DailyClosingForm from '@/components/outlet/DailyClosingForm';
import CashSettlementForm from '@/components/outlet/CashSettlementForm';
import BranchStockMonitor from '@/components/outlet/components/shared/BranchStockMonitor';
import StaffAttendanceWidget from '@/components/hr/StaffAttendanceWidget';

export default function OutletDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeForm, setActiveForm] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('baksoibu_active_staff');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setCurrentUser(u);
      } catch (e) {
        console.error(e);
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('baksoibu_active_staff');
    router.push('/login');
  };

  const isLeaderOrCashier = currentUser?.role === 'KASIR' || currentUser?.role === 'LEADER';

  return (
    <div className="min-h-screen bg-[#f8f9fd] text-slate-800 font-sans flex flex-col">
      {/* Header Bar */}
      <header className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#ff6f3c] to-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-slate-900 leading-none">
              Bakso Ibu Outlet
            </h1>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mt-1">
              <MapPin className="w-3 h-3 text-[#ff6f3c]" />
              <span>{currentUser?.location_name || 'Outlet Cabang'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-xs border border-slate-100 text-xs font-bold text-slate-600">
            <User className="w-3.5 h-3.5 text-indigo-600" />
            <span>{currentUser?.active_staff_name || currentUser?.username || 'Kru'}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase font-black">
              {currentUser?.role || 'CREW'}
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

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-4 space-y-6">
        {/* Render Form Aktif jika ada menu diklik */}
        {activeForm === 'reception' && (
          <ReceptionForm 
            user={currentUser} 
            onBack={() => setActiveForm(null)} 
          />
        )}

        {activeForm === 'expense' && (
          <ExpenseForm 
            user={currentUser} 
            onBack={() => setActiveForm(null)} 
          />
        )}

        {activeForm === 'order' && (
          <OrderRequestForm 
            user={currentUser} 
            onBack={() => setActiveForm(null)} 
          />
        )}

        {activeForm === 'closing' && (
          <DailyClosingForm 
            user={currentUser} 
            onBack={() => setActiveForm(null)} 
          />
        )}

        {activeForm === 'settlement' && isLeaderOrCashier && (
          <CashSettlementForm 
            user={currentUser} 
            onBack={() => setActiveForm(null)} 
          />
        )}

        {/* Tampilan Utama Dashboard Outlet */}
        {!activeForm && (
          <div className="space-y-6">
            {/* WIDGET PRESENSI (CHECK-IN / CHECK-OUT) */}
            <StaffAttendanceWidget 
              currentUser={currentUser} 
              locationId={currentUser?.location_id} 
            />

            {/* 5 Menu Kartu Operasional */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* Menu 1: Terima Barang */}
              <button
                type="button"
                onClick={() => setActiveForm('reception')}
                className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm shadow-slate-200/40 hover:border-indigo-200 hover:shadow-md transition-all text-left flex flex-col justify-between group"
              >
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm mb-3">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                    1. Terima Barang Datang
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Konfirmasi bahan tiba dari Dapur Pusat / Supplier
                  </p>
                </div>
              </button>

              {/* Menu 2: Belanja Kas Kecil */}
              <button
                type="button"
                onClick={() => setActiveForm('expense')}
                className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm shadow-slate-200/40 hover:border-amber-200 hover:shadow-md transition-all text-left flex flex-col justify-between group"
              >
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-sm mb-3">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-amber-600 transition-colors">
                    2. Kas Kecil & Belanja Pasar
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Catat pengeluaran belanja darurat lokal & nota
                  </p>
                </div>
              </button>

              {/* Menu 3: Request Order Malam */}
              <button
                type="button"
                onClick={() => setActiveForm('order')}
                className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm shadow-slate-200/40 hover:border-blue-200 hover:shadow-md transition-all text-left flex flex-col justify-between group"
              >
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm mb-3">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                    3. Request Order Malam
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Pengadaan besok: Rumah Produksi, Pasar & Vendor
                  </p>
                </div>
              </button>

              {/* Menu 4: Form Tutup Toko */}
              <button
                type="button"
                onClick={() => setActiveForm('closing')}
                className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm shadow-slate-200/40 hover:border-orange-200 hover:shadow-md transition-all text-left flex flex-col justify-between group"
              >
                <div className="w-10 h-10 rounded-2xl bg-[#ff6f3c] text-white flex items-center justify-center shadow-sm mb-3">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-orange-600 transition-colors">
                    4. Form Tutup Toko (Closing)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Opname sisa fisik malam & foto bukti waste
                  </p>
                </div>
              </button>

              {/* Menu 5: Rekap Omset (Hanya Kasir & Leader) */}
              {isLeaderOrCashier && (
                <button
                  type="button"
                  onClick={() => setActiveForm('settlement')}
                  className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm shadow-slate-200/40 hover:border-emerald-200 hover:shadow-md transition-all text-left flex flex-col justify-between group"
                >
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm mb-3">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                      5. Rekap Omset & Kas Kasir
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Modal laci, total bill, omset tunai, Grab, Gojek & Shopee
                    </p>
                  </div>
                </button>
              )}
            </div>

            {/* Monitor Pergerakan Stok Lokal */}
            <div className="pt-2">
              <BranchStockMonitor />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}