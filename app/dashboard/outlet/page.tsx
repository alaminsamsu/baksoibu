'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  PackageCheck, 
  ShoppingBag, 
  Wallet, 
  Moon, 
  LogOut, 
  Store
} from 'lucide-react';

import ReceptionForm from '@/components/outlet/ReceptionForm';
import OrderRequestForm from '@/components/outlet/OrderRequestForm';
import DailyClosingForm from '@/components/outlet/DailyClosingForm';
import BranchStockMonitor from '@/components/outlet/components/shared/BranchStockMonitor';

export default function OutletDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'menu' | 'reception' | 'order' | 'closing'>('menu');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Ambil session kru aktif dari localStorage
    const savedStaff = localStorage.getItem('baksoibu_active_staff');
    if (savedStaff) {
      try {
        setUser(JSON.parse(savedStaff));
      } catch (e) {
        console.error(e);
      }
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('baksoibu_active_staff');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#5c2a18] text-white">
        <p className="text-sm font-semibold animate-pulse">Memuat data outlet...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfaf8] flex flex-col">
      {/* Header Bar */}
      <header className="bg-[#5c2a18] text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-900/60 border border-amber-700/50 flex items-center justify-center shadow-inner">
            <Store className="w-5 h-5 text-amber-200" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-wide text-amber-50">BAKSO IBU</h1>
            <p className="text-xs text-amber-200/80 font-medium">
              Outlet {user?.location_name || 'BTP'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-bold text-amber-100">
              {user?.active_staff_name || user?.username || 'Petugas'}
            </p>
            <span className="inline-block px-2 py-0.5 bg-amber-800 text-[10px] font-black tracking-wider uppercase text-amber-200 rounded">
              {user?.role || 'LEADER'}
            </span>
          </div>

          <button
            onClick={handleLogout}
            title="Keluar"
            className="p-2 hover:bg-amber-800 rounded-xl transition-colors text-amber-200 hover:text-white"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Tampilan Form Sesuai Tab yang Dipilih */}
        {activeTab === 'reception' && (
          <ReceptionForm 
            user={user} 
            locationId={user?.location_id}
            staffName={user?.active_staff_name || user?.username}
            onBack={() => setActiveTab('menu')} 
          />
        )}

        {activeTab === 'order' && (
          <OrderRequestForm 
            user={user} 
            locationId={user?.location_id}
            staffName={user?.active_staff_name || user?.username}
            onBack={() => setActiveTab('menu')} 
          />
        )}

        {activeTab === 'closing' && (
          <DailyClosingForm 
            user={user} 
            locationId={user?.location_id}
            staffName={user?.active_staff_name || user?.username}
            onBack={() => setActiveTab('menu')} 
          />
        )}

        {/* Menu Utama (4 Kartu Operasional) */}
        {activeTab === 'menu' && (
          <>
            {/* Banner Operasional */}
            <div className="bg-[#5c2a18] text-white p-5 rounded-2xl shadow-sm">
              <h2 className="text-base font-bold text-amber-100">Operasional Harian</h2>
              <p className="text-xs text-amber-200/80 mt-1 font-medium">
                Petugas aktif: <strong className="text-white">{user?.active_staff_name || user?.username || 'Petugas'}</strong> (Outlet {user?.location_name || 'BTP'})
              </p>
            </div>

            {/* Grid 4 Menu */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1. Terima Barang */}
              <button
                type="button"
                onClick={() => setActiveTab('reception')}
                className="bg-white p-5 rounded-2xl border border-neutral-200 hover:border-amber-400 hover:shadow-md transition-all text-left group flex items-start gap-4"
              >
                <div className="p-3 bg-blue-50 text-blue-700 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-800 group-hover:text-amber-900 transition-colors">
                    1. Terima Barang Datang
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    Konfirmasi fisik kiriman olahan dari Dapur Pusat atau belanja luar.
                  </p>
                </div>
              </button>

              {/* 2. Belanja Pasar (Kasir) */}
              <button
                type="button"
                onClick={() => alert('Fitur catat kas kecil belanja pasar')}
                className="bg-white p-5 rounded-2xl border border-neutral-200 hover:border-amber-400 hover:shadow-md transition-all text-left group flex items-start gap-4"
              >
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-800 group-hover:text-amber-900 transition-colors">
                    2. Belanja Pasar (Kasir)
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    Catat kas kecil dan upload foto nota belanjaan.
                  </p>
                </div>
              </button>

              {/* 3. Request Order Malam */}
              <button
                type="button"
                onClick={() => setActiveTab('order')}
                className="bg-white p-5 rounded-2xl border border-neutral-200 hover:border-amber-400 hover:shadow-md transition-all text-left group flex items-start gap-4"
              >
                <div className="p-3 bg-amber-50 text-amber-800 rounded-xl group-hover:bg-amber-800 group-hover:text-white transition-colors">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-800 group-hover:text-amber-900 transition-colors">
                    3. Request Order Malam
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    Permintaan stok bakso & bumbu untuk dikirim besok.
                  </p>
                </div>
              </button>

              {/* 4. Form Tutup Toko */}
              <button
                type="button"
                onClick={() => setActiveTab('closing')}
                className="bg-white p-5 rounded-2xl border border-neutral-200 hover:border-amber-400 hover:shadow-md transition-all text-left group flex items-start gap-4"
              >
                <div className="p-3 bg-purple-50 text-purple-700 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-800 group-hover:text-amber-900 transition-colors">
                    4. Form Tutup Toko
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    Hitung sisa fisik kulkas/panci & catat barang basi (waste).
                  </p>
                </div>
              </button>
            </div>

            {/* Komponen Monitor Pergerakan Stok & Insight Harian */}
            <div className="pt-2">
              <BranchStockMonitor />
            </div>
          </>
        )}
      </main>
    </div>
  );
}