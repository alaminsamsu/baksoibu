'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, PackageCheck, Wallet, ClipboardList, CheckCircle2, Building2, LogOut, UserCheck } from 'lucide-react';
import ReceptionForm from '@/components/outlet/ReceptionForm';
import ExpenseForm from '@/components/outlet/ExpenseForm';
import OrderRequestForm from '@/components/outlet/OrderRequestForm';
import DailyClosingForm from '@/components/outlet/DailyClosingForm';

export default function OutletDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeMenu, setActiveMenu] = useState<'home' | 'reception' | 'expense' | 'ro' | 'closing'>('home');

  useEffect(() => {
    const saved = localStorage.getItem('bakso_ibu_user');
    if (!saved) {
      router.push('/login');
      return;
    }
    const parsed = JSON.parse(saved);
    setUser(parsed);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('bakso_ibu_user');
    router.push('/login');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      <header className="bg-amber-900 text-white shadow-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-800 border border-amber-700 flex items-center justify-center">
              <Store className="w-5 h-5 text-amber-100" />
            </div>
            <div>
              <h1 className="font-black text-base text-white leading-tight">BAKSO IBU</h1>
              <p className="text-[11px] text-amber-300 flex items-center gap-1">
                <Building2 className="w-3 h-3" /> {user.locations?.name || 'Outlet Cabang'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right">
              <span className="text-xs font-bold block text-white flex items-center gap-1 justify-end">
                <UserCheck className="w-3.5 h-3.5 text-amber-300" /> {user.active_staff_name || user.username}
              </span>
              <span className="text-[10px] uppercase bg-amber-800 px-2 py-0.5 rounded text-amber-200 font-semibold">{user.role}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 bg-amber-800 hover:bg-amber-700 text-amber-200 rounded-xl transition-colors"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-5">
        {activeMenu === 'home' && (
          <>
            <div className="bg-gradient-to-r from-amber-900 to-amber-950 text-white p-5 rounded-2xl shadow-sm">
              <h2 className="text-lg font-black">Operasional Harian</h2>
              <p className="text-xs text-amber-200 mt-1">
                Petugas aktif: <strong className="text-white">{user.active_staff_name || user.username}</strong> ({user.locations?.name})
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => setActiveMenu('reception')}
                className="bg-white p-5 rounded-2xl border border-gray-200 hover:border-amber-600 shadow-sm cursor-pointer space-y-3"
              >
                <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">1. Terima Barang Datang</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Konfirmasi fisik kiriman olahan dari Dapur Pusat.</p>
                </div>
              </div>

              <div
                onClick={() => setActiveMenu('expense')}
                className="bg-white p-5 rounded-2xl border border-gray-200 hover:border-amber-600 shadow-sm cursor-pointer space-y-3"
              >
                <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">2. Belanja Pasar (Kasir)</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Catat kas kecil dan upload foto nota belanjaan.</p>
                </div>
              </div>

              <div
                onClick={() => setActiveMenu('ro')}
                className="bg-white p-5 rounded-2xl border border-gray-200 hover:border-amber-600 shadow-sm cursor-pointer space-y-3"
              >
                <div className="w-10 h-10 bg-orange-100 text-orange-700 rounded-xl flex items-center justify-center">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">3. Request Order Malam</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Permintaan stok bakso & bumbu untuk dikirim besok.</p>
                </div>
              </div>

              <div
                onClick={() => setActiveMenu('closing')}
                className="bg-white p-5 rounded-2xl border border-gray-200 hover:border-amber-600 shadow-sm cursor-pointer space-y-3"
              >
                <div className="w-10 h-10 bg-purple-100 text-purple-700 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">4. Form Tutup Toko</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Hitung sisa fisik kulkas/panci & catat barang basi.</p>
                </div>
              </div>
            </div>
          </>
        )}

        {activeMenu === 'reception' && <ReceptionForm user={user} onBack={() => setActiveMenu('home')} />}
        {activeMenu === 'expense' && <ExpenseForm user={user} onBack={() => setActiveMenu('home')} />}
        {activeMenu === 'ro' && <OrderRequestForm user={user} onBack={() => setActiveMenu('home')} />}
        {activeMenu === 'closing' && <DailyClosingForm user={user} onBack={() => setActiveMenu('home')} />}
      </main>
    </div>
  );
}