'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  Briefcase, 
  LogOut, 
  ShoppingBag, 
  Activity, 
  RefreshCw,
  MapPin,
  Download,
  Calendar,
  FileSpreadsheet,
  Users
} from 'lucide-react';
import BranchStockMonitor from '@/components/outlet/components/shared/BranchStockMonitor';
import LiveExecutiveSummary from '@/components/hr/LiveExecutiveSummary';
import StockUsageAnalytics from '@/components/outlet/components/shared/StockUsageAnalytics';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'monitor' | 'rekap' | 'orders' | 'live_hr'>('monitor');
  const [orderRequests, setOrderRequests] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLoc, setSelectedLoc] = useState('all');
  const [loading, setLoading] = useState(true);

  // State untuk Fitur Download Rekap
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly'>('weekly');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('baksoibu_active_staff');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data: locs } = await supabase.from('locations').select('*');
      if (locs) setLocations(locs);

      const { data: orders } = await supabase
        .from('order_requests')
        .select('*, locations(name)')
        .order('created_at', { ascending: false });

      if (orders) setOrderRequests(orders);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('baksoibu_active_staff');
    router.push('/login');
  };

  // Fungsi Export / Download CSV Rekap Pemakaian
  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      const now = new Date();
      const pastDays = periodType === 'weekly' ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(now.getDate() - pastDays);
      const startDateStr = startDate.toISOString().split('T')[0];
      const todayStr = now.toISOString().split('T')[0];

      // 1. Ambil Data Master Items & Stocks
      const { data: items } = await supabase.from('items').select('name, category, uom');
      
      let stockQuery = supabase.from('branch_stocks').select('*, locations(name)');
      if (selectedLoc !== 'all') {
        stockQuery = stockQuery.eq('location_id', selectedLoc);
      }
      const { data: stocks } = await stockQuery;

      // 2. Ambil Total Masuk dalam Rentang Periode
      let recQuery = supabase
        .from('receptions')
        .select('item_name, quantity, location_id')
        .gte('created_at', `${startDateStr}T00:00:00Z`);
      if (selectedLoc !== 'all') {
        recQuery = recQuery.eq('location_id', selectedLoc);
      }
      const { data: recData } = await recQuery;

      // 3. Ambil Data Closing & Waste dalam Rentang Periode
      let closingQuery = supabase
        .from('daily_closings')
        .select('item_name, remaining_stock, waste_qty, location_id, closing_date')
        .gte('closing_date', startDateStr);
      if (selectedLoc !== 'all') {
        closingQuery = closingQuery.eq('location_id', selectedLoc);
      }
      const { data: closingData } = await closingQuery;

      // 4. Hitung Rekap per Barang
      const reportRows: any[] = [];

      (stocks || []).forEach((s: any) => {
        const itemIn = (recData || [])
          .filter((r) => r.location_id === s.location_id && r.item_name === s.item_name)
          .reduce((sum, curr) => sum + Number(curr.quantity || 0), 0);

        const itemWaste = (closingData || [])
          .filter((c) => c.location_id === s.location_id && c.item_name === s.item_name)
          .reduce((sum, curr) => sum + Number(curr.waste_qty || 0), 0);

        const latestClosing = (closingData || [])
          .filter((c) => c.location_id === s.location_id && c.item_name === s.item_name)
          .sort((a, b) => b.closing_date.localeCompare(a.closing_date))[0];

        const initialStock = Number(s.initial_stock || 0);
        const closingStock = latestClosing ? Number(latestClosing.remaining_stock || 0) : Number(s.remaining_stock || 0);
        
        const usage = Math.max(0, (initialStock + itemIn) - closingStock - itemWaste);

        reportRows.push({
          cabang: s.locations?.name || 'Cabang',
          item: s.item_name,
          kategori: items?.find(i => i.name === s.item_name)?.category || 'Lain-lain',
          stokAwal: initialStock,
          totalMasuk: itemIn,
          sisaClosing: closingStock,
          totalWaste: itemWaste,
          totalPemakaian: usage,
          satuan: s.unit || 'Pcs'
        });
      });

      // 5. Susun Header & Isi CSV
      const headers = [
        'Nama Cabang',
        'Kategori',
        'Nama Bahan/Barang',
        'Stok Awal Periode',
        'Total Masuk',
        'Sisa Fisik Terakhir',
        'Total Waste (Basi/Rusak)',
        'Akumulasi Pemakaian Riil',
        'Satuan'
      ];

      const csvContent = [
        headers.join(';'),
        ...reportRows.map(r => 
          `"${r.cabang}";"${r.kategori}";"${r.item}";${r.stokAwal};${r.totalMasuk};${r.sisaClosing};${r.totalWaste};${r.totalPemakaian};"${r.satuan}"`
        )
      ].join('\r\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `Rekap_Pemakaian_BaksoIbu_${periodType === 'weekly' ? 'Mingguan' : 'Bulanan'}_${todayStr}.csv`;
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert('Gagal mendownload rekap: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const filteredOrders = selectedLoc === 'all'
    ? orderRequests
    : orderRequests.filter((o) => o.location_id === selectedLoc);

  return (
    <div className="min-h-screen bg-[#f8f9fd] text-slate-800 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-200">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-slate-900 leading-none">
              Bakso Ibu Admin Operasional
            </h1>
            <p className="text-[11px] font-semibold text-slate-400 mt-1">
              Pusat Pengawasan Stok, Koreksi & Download Rekap
            </p>
          </div>
        </div>

        {/* 4 Tab Navigasi Admin */}
        <div className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm shadow-slate-200/60 border border-slate-100 text-xs font-bold text-slate-500 overflow-x-auto">
          <button
            onClick={() => setActiveTab('monitor')}
            className={`px-3.5 py-1 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'monitor' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:text-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Monitor Stok
          </button>

          <button
            onClick={() => setActiveTab('live_hr')}
            className={`px-3.5 py-1 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'live_hr' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Live Presensi Staf
          </button>

          <button
            onClick={() => setActiveTab('rekap')}
            className={`px-3.5 py-1 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'rekap' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Download Rekap
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-1 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'orders' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:text-slate-800'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Order Masuk
          </button>
        </div>

        {/* User Info & Out */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-extrabold text-slate-900 leading-tight">
              {user?.active_staff_name || 'Admin'}
            </div>
            <span className="inline-block text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
              {user?.role || 'ADMIN'}
            </span>
          </div>
          <button
            onClick={handleLogout}
            title="Keluar"
            className="w-9 h-9 rounded-2xl bg-white border border-slate-200/80 hover:bg-red-50 hover:border-red-200 text-slate-400 hover:text-red-600 flex items-center justify-center transition-all shadow-sm"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-4 space-y-6">
        {/* TAB MONITOR STOK */}
        {activeTab === 'monitor' && (
          <div className="space-y-6">
            <LiveExecutiveSummary />
            <BranchStockMonitor />
          </div>
        )}

        {/* TAB LIVE PRESENSI STAF KHUSUS OWNER/ADMIN */}
        {activeTab === 'live_hr' && (
          <LiveExecutiveSummary />
        )}

        {/* TAB KHUSUS DOWNLOAD REKAP PEMAKAIAN & ANALISIS POLA KONSUMSI */}
        {activeTab === 'rekap' && (
          <div className="space-y-6">
            {/* Widget Analisis Rata-rata Konsumsi Harian & Weekdays vs Weekend */}
            <StockUsageAnalytics user={user} />

            <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-sm shadow-slate-200/50 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">
                      Download Rekap Pemakaian Bahan Baku
                    </h2>
                    <p className="text-xs font-medium text-slate-400">
                      Ekspor data pemakaian, barang masuk, dan waste ke format Excel / CSV.
                    </p>
                  </div>
                </div>
              </div>

              {/* Panel Pengaturan Ekspor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Pilihan Periode */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3">
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
                    1. Pilih Rentang Waktu Rekap
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPeriodType('weekly')}
                      className={`py-3 px-4 rounded-xl text-xs font-extrabold border transition-all ${
                        periodType === 'weekly'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      📅 7 Hari (Mingguan)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriodType('monthly')}
                      className={`py-3 px-4 rounded-xl text-xs font-extrabold border transition-all ${
                        periodType === 'monthly'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      🗓️ 30 Hari (Bulanan)
                    </button>
                  </div>
                </div>

                {/* Pilihan Cabang */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3">
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
                    2. Pilih Cabang Outlet
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                    <select
                      value={selectedLoc}
                      onChange={(e) => setSelectedLoc(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="all">Semua Cabang (Laporan Gabungan)</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          Outlet {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Tombol Ekspor */}
              <div className="pt-2">
                <button
                  onClick={handleDownloadReport}
                  disabled={downloading}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black rounded-2xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {downloading
                      ? 'Sedang Menyiapkan & Mengunduh File...'
                      : `Unduh Rekap ${periodType === 'weekly' ? 'Mingguan' : 'Bulanan'} (.CSV / Excel)`}
                  </span>
                </button>
                <p className="text-center text-[11px] text-slate-400 font-medium mt-3">
                  File .csv dapat langsung dibuka di Microsoft Excel, Apple Numbers, atau diimpor ke Google Sheets.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB LOG ORDER MASUK */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm shadow-slate-200/50 space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Log Permintaan Masuk dari Seluruh Cabang
                </h2>
                <p className="text-xs text-slate-400">
                  Pantau pesanan bahan dan petugas cabang yang mengirim permintaan.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={selectedLoc}
                    onChange={(e) => setSelectedLoc(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
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
                  className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-100"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Waktu & Outlet</th>
                    <th className="py-3 px-3">Petugas Pengaju</th>
                    <th className="py-3 px-3">Nama Barang</th>
                    <th className="py-3 px-3 text-right">Jumlah</th>
                    <th className="py-3 px-3 text-center">Status Produksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 font-medium">
                        Memuat data pesanan...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 font-medium">
                        Belum ada order masuk dari outlet.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-extrabold text-slate-800">
                            {ord.locations?.name || 'Outlet'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(ord.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-700">
                          {ord.requested_by || 'Petugas Outlet'}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">{ord.item_name}</td>
                        <td className="py-3 px-3 text-right font-black text-indigo-600">
                          {ord.quantity} {ord.unit}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            ord.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : ord.status === 'processing'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-orange-50 text-orange-600 border border-orange-200'
                          }`}>
                            {ord.status || 'pending'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}