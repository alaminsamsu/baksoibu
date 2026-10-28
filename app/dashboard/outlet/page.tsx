'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Package, 
  Send, 
  Store, 
  Banknote, 
  LogOut, 
  User, 
  MapPin,
  ArrowLeft,
  BarChart3,
  BookOpen
} from 'lucide-react';

import ReceptionForm from '@/components/outlet/ReceptionForm';
import OrderRequestForm from '@/components/outlet/OrderRequestForm';
import DailyClosingForm from '@/components/outlet/DailyClosingForm';
import CashSettlementForm from '@/components/outlet/CashSettlementForm';
import LeaderSettlementMonitor from '@/components/outlet/LeaderSettlementMonitor';
import BranchStockMonitor from '@/components/outlet/components/shared/BranchStockMonitor';
import StaffAttendanceWidget from '@/components/hr/StaffAttendanceWidget';
import StockUsageAnalytics from '@/components/outlet/components/shared/StockUsageAnalytics';
import AdminOrderSummaryView from '@/components/outlet/AdminOrderSummaryView';
import OperationalKnowledgeBase from '@/components/shared/OperationalKnowledgeBase';

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

  // Cek Role Pengguna
  const rawRole = (currentUser?.role || currentUser?.role_name || '').toUpperCase();
  const isAdminOrOwner = rawRole.includes('ADMIN') || rawRole.includes('OWNER');
  const isLeaderOrCashier = rawRole.includes('KASIR') || rawRole.includes('LEADER') || isAdminOrOwner;
  const isLeaderOrOwner = rawRole.includes('LEADER') || isAdminOrOwner;

  return (
    <div className="min-h-screen bg-[#f8f9fd] text-slate-800 font-sans flex flex-col">
      {/* Header Bar */}
      <header className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between no-print">
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
        {/* Menu 1: Terima Barang Datang */}
        {activeForm === 'reception' && (
          <ReceptionForm 
            user={currentUser} 
            onBack={() => setActiveForm(null)} 
          />
        )}

        {/* Menu 2: Permintaan Belanja */}
        {activeForm === 'order' && (
          isAdminOrOwner ? (
            <AdminOrderSummaryView 
              user={currentUser} 
              onBack={() => setActiveForm(null)} 
            />
          ) : (
            <OrderRequestForm 
              user={currentUser} 
              onBack={() => setActiveForm(null)} 
            />
          )
        )}

        {/* Menu 3: Tutup Toko (Closing) */}
        {activeForm === 'closing' && (
          <DailyClosingForm 
            user={currentUser} 
            onBack={() => setActiveForm(null)} 
          />
        )}

        {/* Menu 4: Rekap Omset & Kas Kasir */}
        {activeForm === 'settlement' && isLeaderOrCashier && (
          <CashSettlementForm 
            user={currentUser} 
            onBack={() => setActiveForm(null)} 
          />
        )}

        {/* Menu 5: Analisis Pola Konsumsi */}
        {activeForm === 'analytics' && isLeaderOrOwner && (
          <div className="space-y-4">
            <button
              onClick={() => setActiveForm(null)}
              className="px-4 py-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 shadow-2xs transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Menu Utama</span>
            </button>
            <StockUsageAnalytics 
              user={currentUser} 
              defaultLocationId={currentUser?.location_id}
              hideLocationFilter={true} 
            />
          </div>
        )}

        {/* Menu 6: Panduan Operasional & Knowledge Base */}
        {activeForm === 'panduan' && (
          <div className="space-y-4">
            <button
              onClick={() => setActiveForm(null)}
              className="px-4 py-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 shadow-2xs transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Menu Utama</span>
            </button>
            <OperationalKnowledgeBase 
              userRole={currentUser?.role || 'CREW'} 
              userName={currentUser?.active_staff_name || 'Kru Outlet'} 
            />
          </div>
        )}

        {/* Tampilan Utama Dashboard Outlet */}
        {!activeForm && (
          <div className="space-y-6">
            <StaffAttendanceWidget 
              currentUser={currentUser} 
              locationId={currentUser?.location_id} 
            />

            {/* Menu Kartu Operasional Outlet: Responsive Grid Sesuai Peran */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${
              isLeaderOrOwner ? 'lg:grid-cols-3' : isLeaderOrCashier ? 'lg:grid-cols-3 sm:lg:grid-cols-5' : 'lg:grid-cols-4'
            } gap-3.5`}>
              
              {/* Kartu 1: Terima Barang */}
              <button
                type="button"
                onClick={() => setActiveForm('reception')}
                className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm shadow-slate-200/40 hover:border-indigo-200 hover:shadow-md transition-all text-left flex flex-col justify-between group min-h-[145px]"
              >
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm mb-3">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                    1. Terima Barang Datang
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Konfirmasi bahan tiba dari Dapur Pusat / Supplier
                  </p>
                </div>
              </button>

              {/* Kartu 2: Permintaan Belanja */}
              <button
                type="button"
                onClick={() => setActiveForm('order')}
                className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm shadow-slate-200/40 hover:border-blue-200 hover:shadow-md transition-all text-left flex flex-col justify-between group min-h-[145px]"
              >
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm mb-3">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                    2. Permintaan Belanja
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    {isAdminOrOwner 
                      ? 'Unduh & cetak lembar belanja inputan kru' 
                      : 'Pengadaan: Rumah Produksi, Pasar & Vendor'}
                  </p>
                </div>
              </button>

              {/* Kartu 3: Closing Toko */}
              <button
                type="button"
                onClick={() => setActiveForm('closing')}
                className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm shadow-slate-200/40 hover:border-orange-200 hover:shadow-md transition-all text-left flex flex-col justify-between group min-h-[145px]"
              >
                <div className="w-10 h-10 rounded-2xl bg-[#ff6f3c] text-white flex items-center justify-center shadow-sm mb-3">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-orange-600 transition-colors">
                    3. Form Tutup Toko (Closing)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Opname sisa fisik malam & bukti waste
                  </p>
                </div>
              </button>

              {/* Kartu 4 (Khusus Kasir / Leader / Owner): Rekap Omset Kasir */}
              {isLeaderOrCashier && (
                <button
                  type="button"
                  onClick={() => setActiveForm('settlement')}
                  className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm shadow-slate-200/40 hover:border-emerald-200 hover:shadow-md transition-all text-left flex flex-col justify-between group min-h-[145px]"
                >
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm mb-3">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                      4. Rekap Omset & Kas
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      Input modal, omset tunai, QRIS & laci kasir
                    </p>
                  </div>
                </button>
              )}

              {/* Kartu 5 (Khusus Leader / Owner): Pola Konsumsi */}
              {isLeaderOrOwner && (
                <button
                  type="button"
                  onClick={() => setActiveForm('analytics')}
                  className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm shadow-slate-200/40 hover:border-purple-200 hover:shadow-md transition-all text-left flex flex-col justify-between group min-h-[145px]"
                >
                  <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-sm mb-3">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-purple-600 transition-colors">
                      5. Pola Konsumsi
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      Rata-rata konsumsi weekdays vs weekend
                    </p>
                  </div>
                </button>
              )}

              {/* Kartu Buku Panduan & SOP: Menempati urutan 4 untuk Kru Biasa */}
              <button
                type="button"
                onClick={() => setActiveForm('panduan')}
                className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm shadow-slate-200/40 hover:border-amber-200 hover:shadow-md transition-all text-left flex flex-col justify-between group min-h-[145px]"
              >
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-sm mb-3">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-amber-600 transition-colors">
                    {isLeaderOrOwner ? '6. Buku Panduan & SOP' : isLeaderOrCashier ? '5. Buku Panduan & SOP' : '4. Buku Panduan & SOP'}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Product knowledge, job desk & aturan HR
                  </p>
                </div>
              </button>

            </div>

            {/* Rekap Omset Shift (Leader / Owner) */}
            {isLeaderOrOwner && (
              <div className="pt-1">
                <LeaderSettlementMonitor 
                  user={currentUser} 
                  locationId={currentUser?.location_id} 
                />
              </div>
            )}

            {/* Monitor Stok Berjalan */}
            <div className="pt-1">
              <BranchStockMonitor />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}