'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  Package, 
  Send, 
  Store, 
  Banknote, 
  LogOut, 
  User, 
  MapPin,
  ShoppingBag,
  ArrowLeft,
  Calendar,
  Printer,
  Download,
  RefreshCw,
  CheckCircle2,
  Clock
} from 'lucide-react';

import ReceptionForm from '@/components/outlet/ReceptionForm';
import DailyClosingForm from '@/components/outlet/DailyClosingForm';
import CashSettlementForm from '@/components/outlet/CashSettlementForm';
import LeaderSettlementMonitor from '@/components/outlet/LeaderSettlementMonitor';
import BranchStockMonitor from '@/components/outlet/components/shared/BranchStockMonitor';
import StaffAttendanceWidget from '@/components/hr/StaffAttendanceWidget';

// ==========================================
// SUB-KOMPONEN: REKAP & UNDUH PERMINTAAN BELANJA
// ==========================================
function InlineOrderSummaryView({ user, onBack }: { user?: any; onBack: () => void }) {
  const effectiveLocationId = user?.location_id || 'all';
  const todayWita = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());

  const [orderFilterDate, setOrderFilterDate] = useState<string>(todayWita);
  const [selectedLoc, setSelectedLoc] = useState<string>(effectiveLocationId);
  const [locations, setLocations] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data: locs } = await supabase.from('locations').select('*');
      if (locs) setLocations(locs);

      let query = supabase
        .from('order_requests')
        .select('*, locations(name)')
        .gte('created_at', `${orderFilterDate}T00:00:00Z`)
        .lte('created_at', `${orderFilterDate}T23:59:59Z`)
        .order('created_at', { ascending: false });

      if (selectedLoc !== 'all') {
        query = query.eq('location_id', selectedLoc);
      }

      const { data, error } = await query;
      if (error) throw error;
      setOrders(data || []);
    } catch (err: any) {
      console.error('Gagal mengambil pesanan:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [orderFilterDate, selectedLoc]);

  const groupedOrders = useMemo(() => {
    const groups: Record<string, any[]> = {};
    orders.forEach((o) => {
      const vendor = o.target_type || o.source_type || 'RUMAH PRODUKSI';
      if (!groups[vendor]) groups[vendor] = [];
      groups[vendor].push(o);
    });
    return groups;
  }, [orders]);

  const stats = useMemo(() => {
    const total = orders.length;
    const direct = orders.filter((o) => o.is_ordered_by_leader || o.status === 'ORDERED_BY_LEADER').length;
    return {
      total,
      direct,
      needAdmin: total - direct
    };
  }, [orders]);

  const handlePrint = () => {
    if (orders.length === 0) return alert('Tidak ada data belanja.');
    window.print();
  };

  const handleDownloadCSV = () => {
    if (orders.length === 0) return alert('Tidak ada data belanja.');
    setDownloading(true);
    try {
      const headers = ['Tanggal', 'Outlet', 'Vendor', 'Nama Barang', 'Qty', 'Satuan', 'Status', 'Catatan'];
      const rows = orders.map((o) => {
        const isLeader = o.is_ordered_by_leader || o.status === 'ORDERED_BY_LEADER';
        return [
          `"${orderFilterDate}"`,
          `"${o.locations?.name || 'Cabang'}"`,
          `"${o.target_type || o.source_type || 'RUMAH PRODUKSI'}"`,
          `"${o.item_name}"`,
          Number(o.quantity || 0),
          `"${o.unit || 'Pcs'}"`,
          `"${isLeader ? 'SUDAH DIORDER LEADER' : 'PERLU DIBELI ADMIN'}"`,
          `"${(o.notes || '').replace(/"/g, '""')}"`
        ].join(';');
      });

      const csvContent = [headers.join(';'), ...rows].join('\r\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Permintaan_Belanja_${orderFilterDate}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-sm shadow-slate-200/50 space-y-5 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-all mr-1"
            title="Kembali"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <ShoppingBag className="w-5 h-5 text-indigo-600" />
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              Rekap Permintaan Belanja & Pengadaan
            </h2>
            <p className="text-xs font-medium text-slate-400">
              Daftar rekap kebutuhan bahan dari cabang yang siap diunduh dan dicetak.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={orderFilterDate}
              onChange={(e) => setOrderFilterDate(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
            />
          </div>

          <div className="relative">
            <MapPin className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedLoc}
              onChange={(e) => setSelectedLoc(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Outlet</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchOrders}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200"
            title="Segarkan"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handlePrint}
            disabled={orders.length === 0}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-40"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak / PDF</span>
          </button>

          <button
            onClick={handleDownloadCSV}
            disabled={downloading || orders.length === 0}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading ? '...' : 'Export Excel/CSV'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden">
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Permintaan</span>
          <span className="text-xl font-black text-slate-900 mt-1 block">{stats.total} item</span>
        </div>

        <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100">
          <span className="text-[10px] font-bold text-emerald-700 uppercase block flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Sudah Diorder Leader
          </span>
          <span className="text-xl font-black text-emerald-700 mt-1 block">{stats.direct} item</span>
        </div>

        <div className="p-4 bg-orange-50/60 rounded-2xl border border-orange-100">
          <span className="text-[10px] font-bold text-[#ff6f3c] uppercase block flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#ff6f3c]" /> Perlu Dibeli / Diorder Admin
          </span>
          <span className="text-xl font-black text-[#ff6f3c] mt-1 block">{stats.needAdmin} item</span>
        </div>
      </div>

      <div className="hidden print:block pb-3 mb-3 border-b border-slate-300">
        <h1 className="text-base font-black uppercase text-slate-900">
          DAFTAR BELANJA & PENGADAAN BAKSO IBU ({orderFilterDate})
        </h1>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-slate-400">
          Memuat rekap belanjaan...
        </div>
      ) : orders.length === 0 ? (
        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <p className="text-xs font-bold text-slate-700">Belum ada permintaan belanja pada tanggal {orderFilterDate}.</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Kru belum memasukkan kebutuhan bahan untuk tanggal ini.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedOrders).map(([vendorName, groupItems]) => (
            <div key={vendorName} className="rounded-2xl border border-slate-100 overflow-hidden shadow-2xs print:border-slate-300">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span className="font-black text-xs uppercase text-slate-800 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-indigo-600" />
                  {vendorName}
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {groupItems.length} item
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 bg-white">
                      <th className="py-2 px-3 print:w-8">Cek</th>
                      <th className="py-2 px-3">Nama Barang</th>
                      <th className="py-2 px-3">Outlet</th>
                      <th className="py-2 px-3 text-right">Kuantitas</th>
                      <th className="py-2 px-3 text-center">Status</th>
                      <th className="py-2 px-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {groupItems.map((item) => {
                      const isLeader = item.is_ordered_by_leader || item.status === 'ORDERED_BY_LEADER';
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3">
                            <div className="w-3.5 h-3.5 rounded border border-slate-300 flex items-center justify-center text-[9px] text-slate-500 font-bold">
                              {isLeader ? '✓' : ''}
                            </div>
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-800">{item.item_name}</td>
                          <td className="py-2 px-3 text-slate-500 text-[11px]">{item.locations?.name || '-'}</td>
                          <td className="py-2 px-3 text-right font-black text-indigo-600">
                            {item.quantity} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              isLeader ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-600'
                            }`}>
                              {isLeader ? '✓ Diorder Leader' : 'Perlu Beli'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-400 text-[11px]">{item.notes || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// HALAMAN UTAMA DASHBOARD OUTLET
// ==========================================
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

  const rawRole = (currentUser?.role || currentUser?.role_name || '').toUpperCase();
  const isLeaderOrCashier = rawRole.includes('KASIR') || rawRole.includes('LEADER') || rawRole.includes('ADMIN') || rawRole.includes('OWNER');
  const isLeaderOrOwner = rawRole.includes('LEADER') || rawRole.includes('ADMIN') || rawRole.includes('OWNER');

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
        {/* Menu 1: Terima Barang */}
        {activeForm === 'reception' && (
          <ReceptionForm 
            user={currentUser} 
            onBack={() => setActiveForm(null)} 
          />
        )}

        {/* Menu 2: Permintaan Belanja (Langsung Output Rekap & Unduh) */}
        {activeForm === 'order' && (
          <InlineOrderSummaryView 
            user={currentUser} 
            onBack={() => setActiveForm(null)} 
          />
        )}

        {/* Menu 3: Tutup Toko */}
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

        {/* Tampilan Utama Dashboard Outlet */}
        {!activeForm && (
          <div className="space-y-6">
            <StaffAttendanceWidget 
              currentUser={currentUser} 
              locationId={currentUser?.location_id} 
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
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
                    2. Permintaan Belanja
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Rekap belanjaan, cetak PDF checklist & export Excel
                  </p>
                </div>
              </button>

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
                    3. Form Tutup Toko (Closing)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Opname sisa fisik malam & foto bukti waste
                  </p>
                </div>
              </button>

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
                      4. Rekap Omset & Kas Kasir
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Input modal, total omset tunai, QRIS & uang laci
                    </p>
                  </div>
                </button>
              )}
            </div>

            {isLeaderOrOwner && (
              <div className="pt-1">
                <LeaderSettlementMonitor 
                  user={currentUser} 
                  locationId={currentUser?.location_id} 
                />
              </div>
            )}

            <div className="pt-1">
              <BranchStockMonitor />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}