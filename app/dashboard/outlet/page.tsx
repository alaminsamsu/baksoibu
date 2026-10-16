'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  PackageCheck, 
  ShoppingBag, 
  Wallet, 
  Moon, 
  LogOut, 
  Store,
  Search,
  Sparkles,
  TrendingDown,
  ChevronRight,
  UserCheck
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
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fd]">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fd] text-slate-800 flex flex-col font-sans">
      {/* Top Floating Modern Navbar */}
      <header className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-200">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-slate-900 leading-none">
              Bakso Ibu
            </h1>
            <p className="text-[11px] font-semibold text-slate-400 mt-1">
              Outlet {user?.location_name || 'BTP'}
            </p>
          </div>
        </div>

        {/* Menu Pill Nav */}
        <div className="hidden md:flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm shadow-slate-200/60 border border-slate-100 text-xs font-bold text-slate-500">
          <button 
            onClick={() => setActiveTab('menu')}
            className={`px-3 py-1 rounded-full transition-all ${
              activeTab === 'menu' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:text-slate-800'
            }`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('reception')}
            className={`px-3 py-1 rounded-full transition-all ${
              activeTab === 'reception' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:text-slate-800'
            }`}
          >
            Terima Barang
          </button>
          <button 
            onClick={() => setActiveTab('order')}
            className={`px-3 py-1 rounded-full transition-all ${
              activeTab === 'order' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:text-slate-800'
            }`}
          >
            Order Malam
          </button>
          <button 
            onClick={() => setActiveTab('closing')}
            className={`px-3 py-1 rounded-full transition-all ${
              activeTab === 'closing' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:text-slate-800'
            }`}
          >
            Closing
          </button>
        </div>

        {/* User Info & Out */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs font-extrabold text-slate-900 leading-tight">
              {user?.active_staff_name || user?.username || 'Petugas'}
            </div>
            <span className="inline-block text-[10px] font-bold text-orange-500 uppercase tracking-wider">
              {user?.role || 'LEADER'}
            </span>
          </div>
          <button
            onClick={handleLogout}
            title="Keluar"
            className="w-9 h-9 rounded-2xl bg-white border border-slate-200/80 hover:bg-red-50 hover:border-red-200 text-slate-400 hover:text-red-600 flex items-center justify-center transition-all shadow-sm shadow-slate-200/40"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-4 space-y-6">
        {/* Konten Form Terbuka */}
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

        {/* Dashboard View */}
        {activeTab === 'menu' && (
          <>
            {/* Quick Action Pills (Sesuai Referensi Gambar) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Tombol 1: Indigo Bold */}
              <button
                type="button"
                onClick={() => setActiveTab('reception')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-3xl shadow-lg shadow-indigo-600/20 text-left transition-all group flex flex-col justify-between h-32"
              >
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                  <PackageCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold leading-tight">Terima Barang</h3>
                  <p className="text-[11px] text-indigo-200 mt-0.5">Barang Pusat & Luar</p>
                </div>
              </button>

              {/* Tombol 2: Vibrant Orange Bold */}
              <button
                type="button"
                onClick={() => setActiveTab('order')}
                className="bg-[#ff6f3c] hover:bg-[#f25c28] text-white p-4 rounded-3xl shadow-lg shadow-orange-500/20 text-left transition-all group flex flex-col justify-between h-32"
              >
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold leading-tight">Request Order</h3>
                  <p className="text-[11px] text-orange-100 mt-0.5">Order Stok Besok</p>
                </div>
              </button>

              {/* Tombol 3: Clean White Card */}
              <button
                type="button"
                onClick={() => setActiveTab('closing')}
                className="bg-white hover:bg-slate-50 text-slate-800 p-4 rounded-3xl border border-slate-100 shadow-sm shadow-slate-200/50 text-left transition-all group flex flex-col justify-between h-32"
              >
                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold leading-tight text-slate-900">Closing Malam</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Sisa Fisik & Waste</p>
                </div>
              </button>

              {/* Tombol 4: Clean White Card */}
              <button
                type="button"
                onClick={() => alert('Fitur catat kas kecil belanja pasar')}
                className="bg-white hover:bg-slate-50 text-slate-800 p-4 rounded-3xl border border-slate-100 shadow-sm shadow-slate-200/50 text-left transition-all group flex flex-col justify-between h-32"
              >
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold leading-tight text-slate-900">Belanja Kasir</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Kas Kecil & Nota</p>
                </div>
              </button>
            </div>

            {/* Banner Status Operasional Sesuai Gaya Pinterest */}
            <div className="bg-[#fff6ee] border border-orange-200/60 p-4 rounded-3xl flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#ff6f3c] text-white flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-[#d94814]">Status Operasional Hari Ini Aktif</p>
                  <p className="text-[11px] text-orange-950/70 font-medium">
                    Shift dipimpin oleh <strong className="text-slate-900">{user?.active_staff_name || user?.username || 'Leader'}</strong> di Outlet {user?.location_name || 'BTP'}.
                  </p>
                </div>
              </div>
              <div className="text-right hidden sm:block">
                <span className="text-xs font-black text-slate-900 bg-white px-3 py-1.5 rounded-full border border-orange-200/80 shadow-xs">
                  Sistem Realtime
                </span>
              </div>
            </div>

            {/* Dashboard Monitor Pergerakan Stok Berkelompok */}
            <div>
              <BranchStockMonitor />
            </div>
          </>
        )}
      </main>
    </div>
  );
}