'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Users,
  Store,
  Printer,
  CheckCircle2,
  Clock
} from 'lucide-react';
import BranchStockMonitor from '@/components/outlet/components/shared/BranchStockMonitor';
import LiveExecutiveSummary from '@/components/hr/LiveExecutiveSummary';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'monitor' | 'rekap' | 'live_hr'>('orders');
  const [orderRequests, setOrderRequests] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLoc, setSelectedLoc] = useState('all');
  const [loading, setLoading] = useState(true);

  // Tanggal default operasional (WITA)
  const todayWita = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());
  const [orderFilterDate, setOrderFilterDate] = useState<string>(todayWita);

  // State untuk Fitur Download Rekap
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly'>('weekly');
  const [downloadingUsage, setDownloadingUsage] = useState(false);
  const [downloadingOrders, setDownloadingOrders] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('baksoibu_active_staff');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
    fetchOrdersAndLocations();
  }, [orderFilterDate]);

  const fetchOrdersAndLocations = async () => {
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

      const { data: orders } = await query;
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

  // Filter Order berdasarkan Cabang
  const filteredOrders = useMemo(() => {
    if (selectedLoc === 'all') return orderRequests;
    return orderRequests.filter((o) => o.location_id === selectedLoc);
  }, [orderRequests, selectedLoc]);

  // Kelompokkan Pesanan Berdasarkan Vendor / Supplier
  const groupedOrdersByVendor = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredOrders.forEach((o) => {
      const vendor = o.target_type || o.source_type || 'RUMAH PRODUKSI';
      if (!groups[vendor]) groups[vendor] = [];
      groups[vendor].push(o);
    });
    return groups;
  }, [filteredOrders]);

  // Statistik Order Harian
  const orderStats = useMemo(() => {
    const totalItems = filteredOrders.length;
    const orderedByLeaderCount = filteredOrders.filter((o) => o.is_ordered_by_leader || o.status === 'ORDERED_BY_LEADER').length;
    const needAdminActionCount = totalItems - orderedByLeaderCount;
    return {
      totalItems,
      orderedByLeaderCount,
      needAdminActionCount
    };
  }, [filteredOrders]);

  // 1. Download CSV Rekap Permintaan Belanja
  const handleDownloadOrderCSV = () => {
    if (filteredOrders.length === 0) {
      alert('Tidak ada permintaan belanja pada tanggal yang dipilih.');
      return;
    }
    setDownloadingOrders(true);
    try {
      const headers = [
        'Tanggal Request',
        'Outlet Cabang',
        'Vendor / Supplier',
        'Nama Bahan / Barang',
        'Jumlah Qty',
        'Satuan',
        'Status Pemesanan',
        'Dipesan Oleh Leader?',
        'Petugas Pengaju',
        'Catatan'
      ];

      const rows = filteredOrders.map((o) => {
        const isLeader = o.is_ordered_by_leader || o.status === 'ORDERED_BY_LEADER';
        return [
          `"${new Date(o.created_at).toLocaleDateString('id-ID')}"`,
          `"${o.locations?.name || 'Cabang'}"`,
          `"${o.target_type || o.source_type || 'RUMAH PRODUKSI'}"`,
          `"${o.item_name}"`,
          Number(o.quantity || 0),
          `"${o.unit || 'Pcs'}"`,
          `"${isLeader ? 'SUDAH DIORDER LEADER' : 'PERLU DIBELI ADMIN'}"`,
          `"${isLeader ? 'YA' : 'TIDAK'}"`,
          `"${o.requested_by || '-'}"`,
          `"${(o.notes || '').replace(/"/g, '""')}"`
        ].join(';');
      });

      const csvContent = [headers.join(';'), ...rows].join('\r\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Permintaan_Belanja_BaksoIbu_${orderFilterDate}_${selectedLoc}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloadingOrders(false);
    }
  };

  // 2. Cetak / Simpan PDF Lembar Kerja Checklist Belanja
  const handlePrintWorksheet = () => {
    if (filteredOrders.length === 0) {
      alert('Tidak ada daftar belanja untuk dicetak pada tanggal ini.');
      return;
    }
    window.print();
  };

  // 3. Download CSV Rekap Pemakaian Bahan Baku
  const handleDownloadUsageReport = async () => {
    setDownloadingUsage(true);
    try {
      const now = new Date();
      const pastDays = periodType === 'weekly' ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(now.getDate() - pastDays);
      const startDateStr = startDate.toISOString().split('T')[0];
      const todayStr = now.toISOString().split('T')[0];

      const { data: items } = await supabase.from('items').select('name, category, uom');
      
      let stockQuery = supabase.from('branch_stocks').select('*, locations(name)');
      if (selectedLoc !== 'all') {
        stockQuery = stockQuery.eq('location_id', selectedLoc);
      }
      const { data: stocks } = await stockQuery;

      let recQuery = supabase
        .from('receptions')
        .select('item_name, quantity, location_id')
        .gte('created_at', `${startDateStr}T00:00:00Z`);
      if (selectedLoc !== 'all') {
        recQuery = recQuery.eq('location_id', selectedLoc);
      }
      const { data: recData } = await recQuery;

      let closingQuery = supabase
        .from('daily_closings')
        .select('item_name, remaining_stock, waste_qty, location_id, closing_date')
        .gte('closing_date', startDateStr);
      if (selectedLoc !== 'all') {
        closingQuery = closingQuery.eq('location_id', selectedLoc);
      }
      const { data: closingData } = await closingQuery;

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
      link.href = url;
      link.download = `Rekap_Pemakaian_BaksoIbu_${periodType === 'weekly' ? 'Mingguan' : 'Bulanan'}_${todayStr}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert('Gagal mendownload rekap: ' + err.message);
    } finally {
      setDownloadingUsage(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fd] text-slate-800 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-200">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-slate-900 leading-none">
              Bakso Ibu Admin Operasional
            </h1>
            <p className="text-[11px] font-semibold text-slate-400 mt-1">
              Pusat Pengadaan, Rekap Pemakaian & Kontrol Stok
            </p>
          </div>
        </div>

        {/* 4 Tab Navigasi Admin */}
        <div className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm shadow-slate-200/60 border border-slate-100 text-xs font-bold text-slate-500 overflow-x-auto">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-1 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'orders' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:text-slate-800'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Permintaan Belanja
          </button>

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
            Download Rekap Pemakaian
          </button>
        </div>

        {/* User Info & Logout */}
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
        
        {/* TAB 1: PERMINTAAN BELANJA (REKAP OUTPUT SIAP DOWNLOAD / PRINT) */}
        {activeTab === 'orders' && (
          <div className="space-y-5">
            {/* Filter & Action Bar */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm shadow-slate-200/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-indigo-600" />
                  Rekap Permintaan Belanja & Pengadaan
                </h2>
                <p className="text-xs font-medium text-slate-400">
                  Unduh atau cetak daftar belanjaan yang diajukan oleh seluruh cabang outlet.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                {/* Filter Tanggal */}
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="date"
                    value={orderFilterDate}
                    onChange={(e) => setOrderFilterDate(e.target.value)}
                    className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                    title="Tanggal Belanja"
                  />
                </div>

                {/* Filter Lokasi */}
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
                  onClick={fetchOrdersAndLocations}
                  className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200"
                  title="Segarkan Data"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>

                {/* Tombol Print / Simpan PDF */}
                <button
                  onClick={handlePrintWorksheet}
                  disabled={filteredOrders.length === 0}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
                  title="Cetak atau Simpan PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak / PDF</span>
                </button>

                {/* Tombol Download CSV */}
                <button
                  onClick={handleDownloadOrderCSV}
                  disabled={downloadingOrders || filteredOrders.length === 0}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{downloadingOrders ? 'Menyiapkan...' : 'Export Excel/CSV'}</span>
                </button>
              </div>
            </div>

            {/* Kartu Ringkasan Status Belanja */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden">
              <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Permintaan</span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  {orderStats.totalItems} <span className="text-xs font-normal text-slate-400">item barang</span>
                </span>
                <span className="text-[10px] text-slate-400">Kebutuhan tanggal {orderFilterDate}</span>
              </div>

              <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Sudah Diorder Leader
                </span>
                <span className="text-xl font-black text-emerald-700 mt-1 block">
                  {orderStats.orderedByLeaderCount} <span className="text-xs font-normal text-emerald-600">item</span>
                </span>
                <span className="text-[10px] text-emerald-600 font-medium">Tidak perlu dibelikan Admin</span>
              </div>

              <div className="p-4 bg-orange-50/60 rounded-2xl border border-orange-100">
                <span className="text-[10px] font-bold text-[#ff6f3c] uppercase block flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#ff6f3c]" /> Perlu Dibeli / Diorder Admin
                </span>
                <span className="text-xl font-black text-[#ff6f3c] mt-1 block">
                  {orderStats.needAdminActionCount} <span className="text-xs font-normal text-orange-400">item</span>
                </span>
                <span className="text-[10px] text-orange-500 font-medium">Harus disiapkan Dapur/Pasar/Admin</span>
              </div>
            </div>

            {/* HEADER KHUSUS MODE CETAK / PRINT LEMBAR KERJA */}
            <div className="hidden print:block pb-4 mb-4 border-b border-slate-300">
              <h1 className="text-lg font-black uppercase text-slate-900">
                LEMBAR KERJA PENGADAAN & BELANJA BAKSO IBU
              </h1>
              <div className="text-xs text-slate-600 flex justify-between mt-1">
                <span>Tanggal Belanja: <strong>{orderFilterDate}</strong></span>
                <span>Outlet: <strong>{selectedLoc === 'all' ? 'Seluruh Cabang' : locations.find(l => l.id === selectedLoc)?.name}</strong></span>
                <span>Dicetak pada: {new Date().toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* TABEL PENGELOMPOKAN PER VENDOR / SUPPLIER */}
            {loading ? (
              <div className="bg-white p-12 text-center rounded-3xl border border-slate-100 text-xs text-slate-400 font-bold">
                Memuat rekap permintaan belanja...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-3xl border border-dashed border-slate-200 space-y-1">
                <p className="text-xs font-bold text-slate-700">Belum ada permintaan belanja pada tanggal {orderFilterDate}.</p>
                <p className="text-[11px] text-slate-400">Kru outlet belum mengirim rekap kebutuhan bahan untuk tanggal ini.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedOrdersByVendor).map(([vendorName, items]) => (
                  <div key={vendorName} className="bg-white rounded-3xl border border-slate-100 shadow-2xs overflow-hidden print:border-slate-300 print:shadow-none">
                    {/* Header Vendor */}
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-indigo-600" />
                        <span className="font-black text-xs uppercase text-slate-800 tracking-wider">
                          {vendorName}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-500">
                        {items.length} item pengadaan
                      </span>
                    </div>

                    {/* Rincian Item */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                            <th className="py-2.5 px-4 print:w-10">Cek</th>
                            <th className="py-2.5 px-4">Nama Barang</th>
                            <th className="py-2.5 px-4">Cabang</th>
                            <th className="py-2.5 px-4 text-right">Jumlah (Qty)</th>
                            <th className="py-2.5 px-4 text-center">Status Pemesanan</th>
                            <th className="py-2.5 px-4">Catatan Outlet</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {items.map((item) => {
                            const isLeader = item.is_ordered_by_leader || item.status === 'ORDERED_BY_LEADER';
                            return (
                              <tr key={item.id} className="hover:bg-slate-50/50">
                                {/* Kotak Centang Fisik saat dicetak / bawa pasar */}
                                <td className="py-2.5 px-4">
                                  <div className="w-4 h-4 rounded border border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                                    {isLeader ? '✓' : ''}
                                  </div>
                                </td>
                                <td className="py-2.5 px-4 font-bold text-slate-900">
                                  {item.item_name}
                                </td>
                                <td className="py-2.5 px-4 text-slate-600">
                                  {item.locations?.name || 'Cabang'}
                                </td>
                                <td className="py-2.5 px-4 text-right font-black text-indigo-700">
                                  {item.quantity} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                                </td>
                                <td className="py-2.5 px-4 text-center">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                    isLeader 
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                      : 'bg-orange-50 text-orange-600 border border-orange-200'
                                  }`}>
                                    {isLeader ? '✓ Sudah Diorder Leader' : 'Belum (Admin Beli)'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                                  {item.notes ? `"${item.notes}"` : '-'}
                                </td>
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
        )}

        {/* TAB 2: MONITOR STOK */}
        {activeTab === 'monitor' && (
          <div className="space-y-6">
            <LiveExecutiveSummary />
            <BranchStockMonitor />
          </div>
        )}

        {/* TAB 3: LIVE PRESENSI STAF KHUSUS OWNER/ADMIN */}
        {activeTab === 'live_hr' && (
          <LiveExecutiveSummary />
        )}

        {/* TAB 4: DOWNLOAD REKAP PEMAKAIAN BAHAN BAKU */}
        {activeTab === 'rekap' && (
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
                onClick={handleDownloadUsageReport}
                disabled={downloadingUsage}
                className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black rounded-2xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>
                  {downloadingUsage
                    ? 'Sedang Menyiapkan & Mengunduh File...'
                    : `Unduh Rekap ${periodType === 'weekly' ? 'Mingguan' : 'Bulanan'} (.CSV / Excel)`}
                </span>
              </button>
              <p className="text-center text-[11px] text-slate-400 font-medium mt-3">
                File .csv dapat langsung dibuka di Microsoft Excel, Apple Numbers, atau diimpor ke Google Sheets.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}