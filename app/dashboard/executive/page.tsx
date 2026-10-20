'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  Crown, 
  LogOut, 
  DollarSign, 
  Calendar, 
  QrCode, 
  Banknote, 
  Activity, 
  RefreshCw, 
  MapPin, 
  TrendingUp, 
  Download,
  ShoppingBag,
  Store,
  Receipt,
  Users,
  Wallet,
  BarChart3
} from 'lucide-react';
import BranchStockMonitor from '@/components/outlet/components/shared/BranchStockMonitor';
import LiveExecutiveSummary from '@/components/hr/LiveExecutiveSummary';
import StockUsageAnalytics from '@/components/outlet/components/shared/StockUsageAnalytics';

interface SettlementRecord {
  id: string;
  location_id: string;
  settlement_date: string;
  shift?: string;
  total_bills?: number;
  opening_cash?: number;
  cash_nominal: number;
  qris_nominal: number;
  online_nominal: number;
  grab_nominal?: number;
  gofood_nominal?: number;
  shopee_nominal?: number;
  expense_nominal?: number;
  expense_notes?: string;
  total_omset: number;
  actual_cash_deposited: number;
  cash_difference: number;
  proof_photo_url: string | null;
  notes: string | null;
  reported_by: string;
  created_at?: string;
  locations?: { name: string };
}

interface ClosingRecord {
  id: string;
  location_id: string;
  closing_date: string;
  item_name: string;
  remaining_stock: number;
  waste_qty: number;
  unit: string;
  reported_by: string;
  photo_url?: string;
  created_at: string;
  locations?: { name: string };
}

interface OrderRequestRecord {
  id: string;
  location_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  source_type?: string;
  target_type?: string;
  requested_by?: string;
  created_at: string;
  locations?: { name: string };
}

interface StockItem {
  id: string;
  location_id: string;
  item_name: string;
  remaining_stock: number;
  unit: string;
  locations?: { name: string };
}

export default function ExecutiveOwnerDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [locations, setLocations] = useState<any[]>([]);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'konsumsi' | 'hr' | 'stok'>('overview');
  
  const [filterMode, setFilterMode] = useState<'today' | 'weekly' | 'monthly' | 'custom'>('today');
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [closings, setClosings] = useState<ClosingRecord[]>([]);
  const [orders, setOrders] = useState<OrderRequestRecord[]>([]);
  const [currentStocks, setCurrentStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloading, setDownloading] = useState<boolean>(false);

  useEffect(() => {
    const sessionStr = localStorage.getItem('baksoibu_active_staff');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        setCurrentUser(session);
        if ((session.role || '').toUpperCase() === 'HR') {
          router.push('/dashboard/hr');
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }
    fetchAllExecutiveData();
  }, [filterMode, customDate, selectedLocation]);

  const fetchAllExecutiveData = async () => {
    setLoading(true);
    try {
      const { data: locs } = await supabase.from('locations').select('*').order('name');
      if (locs) setLocations(locs);

      const today = new Date();
      let startDateStr = today.toISOString().split('T')[0];
      let endDateStr = startDateStr;

      if (filterMode === 'weekly') {
        const past7 = new Date();
        past7.setDate(today.getDate() - 7);
        startDateStr = past7.toISOString().split('T')[0];
      } else if (filterMode === 'monthly') {
        const past30 = new Date();
        past30.setDate(today.getDate() - 30);
        startDateStr = past30.toISOString().split('T')[0];
      } else if (filterMode === 'custom') {
        startDateStr = customDate;
        endDateStr = customDate;
      }

      let sQuery = supabase
        .from('cash_settlements')
        .select('*, locations(name)')
        .gte('settlement_date', startDateStr)
        .lte('settlement_date', endDateStr)
        .order('settlement_date', { ascending: false });

      if (selectedLocation !== 'all') {
        sQuery = sQuery.eq('location_id', selectedLocation);
      }
      const { data: sData } = await sQuery;
      if (sData) setSettlements(sData);

      let cQuery = supabase
        .from('daily_closings')
        .select('*, locations(name)')
        .gte('closing_date', startDateStr)
        .lte('closing_date', endDateStr);

      if (selectedLocation !== 'all') {
        cQuery = cQuery.eq('location_id', selectedLocation);
      }
      const { data: cData } = await cQuery;
      if (cData) setClosings(cData);

      let oQuery = supabase
        .from('order_requests')
        .select('*, locations(name)')
        .gte('created_at', `${startDateStr}T00:00:00Z`)
        .order('created_at', { ascending: false });

      if (selectedLocation !== 'all') {
        oQuery = oQuery.eq('location_id', selectedLocation);
      }
      const { data: oData } = await oQuery;
      if (oData) setOrders(oData);

      let stQuery = supabase
        .from('branch_stocks')
        .select('*, locations(name)');
      if (selectedLocation !== 'all') {
        stQuery = stQuery.eq('location_id', selectedLocation);
      }
      const { data: stData } = await stQuery;
      if (stData) setCurrentStocks(stData);

    } catch (err) {
      console.error('Gagal mengambil data Owner Dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('baksoibu_active_staff');
    router.push('/login');
  };

  const kpi = useMemo(() => {
    const totalOmset = settlements.reduce((acc, curr) => acc + Number(curr.total_omset || 0), 0);
    const totalBills = settlements.reduce((acc, curr) => acc + Number(curr.total_bills || 0), 0);
    const aov = totalBills > 0 ? Math.round(totalOmset / totalBills) : 0;
    
    const totalCashIn = settlements.reduce((acc, curr) => acc + Number(curr.cash_nominal || 0), 0);
    const totalExpense = settlements.reduce((acc, curr) => acc + Number(curr.expense_nominal || 0), 0);
    const netCashFlow = totalCashIn - totalExpense;

    const totalCashDiff = settlements.reduce((acc, curr) => acc + Number(curr.cash_difference || 0), 0);
    const totalWasteUnits = closings.reduce((acc, curr) => acc + Number(curr.waste_qty || 0), 0);

    return {
      totalOmset,
      totalBills,
      aov,
      totalCashIn,
      totalExpense,
      netCashFlow,
      totalCashDiff,
      totalWasteUnits
    };
  }, [settlements, closings]);

  const paymentBreakdown = useMemo(() => {
    const cash = settlements.reduce((acc, curr) => acc + Number(curr.cash_nominal || 0), 0);
    const qris = settlements.reduce((acc, curr) => acc + Number(curr.qris_nominal || 0), 0);
    const grab = settlements.reduce((acc, curr) => acc + Number(curr.grab_nominal || 0), 0);
    const gofood = settlements.reduce((acc, curr) => acc + Number(curr.gofood_nominal || 0), 0);
    const shopee = settlements.reduce((acc, curr) => acc + Number(curr.shopee_nominal || 0), 0);
    return { cash, qris, grab, gofood, shopee };
  }, [settlements]);

  const outletComparison = useMemo(() => {
    const compMap: Record<string, { name: string; omset: number; bills: number; cashDiff: number; wasteCount: number; expense: number }> = {};
    
    settlements.forEach((s) => {
      const locName = s.locations?.name || 'Cabang';
      if (!compMap[locName]) {
        compMap[locName] = { name: locName, omset: 0, bills: 0, cashDiff: 0, wasteCount: 0, expense: 0 };
      }
      compMap[locName].omset += Number(s.total_omset || 0);
      compMap[locName].bills += Number(s.total_bills || 0);
      compMap[locName].cashDiff += Number(s.cash_difference || 0);
      compMap[locName].expense += Number(s.expense_nominal || 0);
    });

    closings.forEach((c) => {
      const locName = c.locations?.name || 'Cabang';
      if (compMap[locName]) {
        compMap[locName].wasteCount += Number(c.waste_qty || 0);
      }
    });

    return Object.values(compMap);
  }, [settlements, closings]);

  const expenseLogs = useMemo(() => {
    return settlements
      .filter((s) => Number(s.expense_nominal || 0) > 0)
      .map((s) => ({
        id: s.id,
        date: s.settlement_date,
        outlet: s.locations?.name || 'Cabang',
        shift: s.shift === 'SHIFT_2' ? 'Shift 2' : 'Shift 1',
        cashier: s.reported_by || 'Kasir',
        nominal: Number(s.expense_nominal || 0),
        notes: s.expense_notes || 'Tanpa catatan'
      }));
  }, [settlements]);

  const handleDownloadReport = () => {
    setDownloading(true);
    try {
      if (settlements.length === 0) {
        alert('Tidak ada data pada periode ini untuk diunduh.');
        return;
      }
      const headers = [
        'Tanggal',
        'Outlet',
        'Shift',
        'Pelapor',
        'Modal Kas',
        'Tunai',
        'QRIS',
        'Grab',
        'GoFood',
        'Shopee',
        'Pengeluaran',
        'Catatan Pengeluaran',
        'Total Omset',
        'Total Bill',
        'Fisik Laci',
        'Selisih'
      ];

      const rows = settlements.map((s) => [
        `"${s.settlement_date}"`,
        `"${s.locations?.name || 'Outlet'}"`,
        `"${s.shift === 'SHIFT_2' ? 'Shift 2' : 'Shift 1'}"`,
        `"${s.reported_by || '-'}"`,
        Number(s.opening_cash || 0),
        Number(s.cash_nominal || 0),
        Number(s.qris_nominal || 0),
        Number(s.grab_nominal || 0),
        Number(s.gofood_nominal || 0),
        Number(s.shopee_nominal || 0),
        Number(s.expense_nominal || 0),
        `"${(s.expense_notes || '').replace(/"/g, '""')}"`,
        Number(s.total_omset || 0),
        Number(s.total_bills || 0),
        Number(s.actual_cash_deposited || 0),
        Number(s.cash_difference || 0)
      ].join(';'));

      const csvContent = [headers.join(';'), ...rows].join('\r\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Executive_Report_BaksoIbu_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fd] text-slate-800 font-sans flex flex-col">
      {/* Top Header */}
      <header className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#ff6f3c] to-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-slate-900 leading-none">
              Bakso Ibu Executive Control
            </h1>
            <p className="text-[11px] font-semibold text-slate-400 mt-1">
              Pusat Kendali Bisnis, Finansial & Pemantauan Operasional
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-white p-1 rounded-2xl border border-slate-200/80 shadow-xs text-xs font-bold overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'overview' ? 'bg-[#ff6f3c] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              Executive KPI
            </button>
            <button
              onClick={() => setActiveTab('konsumsi')}
              className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'konsumsi' ? 'bg-[#ff6f3c] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Pola Konsumsi
            </button>
            <button
              onClick={() => setActiveTab('hr')}
              className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'hr' ? 'bg-[#ff6f3c] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Live Presensi Tim
            </button>
            <button
              onClick={() => setActiveTab('stok')}
              className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'stok' ? 'bg-[#ff6f3c] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Monitor Stok
            </button>
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 space-y-6">
        {/* TAB KHUSUS POLA KONSUMSI BAHAN (WEEKDAYS VS WEEKEND) */}
        {activeTab === 'konsumsi' && (
          <div>
            <StockUsageAnalytics user={currentUser} />
          </div>
        )}

        {/* TAB KHUSUS MONITOR STOK */}
        {activeTab === 'stok' && (
          <div>
            <BranchStockMonitor />
          </div>
        )}

        {/* TAB KHUSUS LIVE PRESENSI TIM */}
        {activeTab === 'hr' && (
          <div className="space-y-6">
            <LiveExecutiveSummary />
          </div>
        )}

        {/* TAB OVERVIEW UTAMA */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <LiveExecutiveSummary />

            {/* Filter Bar Finansial & Omset */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1 rounded-2xl border border-slate-100 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setFilterMode('today')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    filterMode === 'today' ? 'bg-white text-[#ff6f3c] shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('weekly')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    filterMode === 'weekly' ? 'bg-white text-[#ff6f3c] shadow-xs' : 'text-slate-500'
                  }`}
                >
                  7 Hari
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('monthly')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    filterMode === 'monthly' ? 'bg-white text-[#ff6f3c] shadow-xs' : 'text-slate-500'
                  }`}
                >
                  30 Hari
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('custom')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    filterMode === 'custom' ? 'bg-white text-[#ff6f3c] shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Pilih Tanggal
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                {filterMode === 'custom' && (
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                    />
                  </div>
                )}

                <div className="relative flex-1 md:w-44">
                  <MapPin className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                  >
                    <option value="all">Semua Cabang</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={fetchAllExecutiveData}
                  className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-100 transition-colors"
                  title="Segarkan Data"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>

                <button
                  onClick={handleDownloadReport}
                  disabled={downloading || settlements.length === 0}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{downloading ? '...' : 'Export CSV'}</span>
                </button>
              </div>
            </div>

            {/* KPI UTAMA */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Omset</span>
                <p className="text-lg font-black text-slate-900 mt-1">Rp {kpi.totalOmset.toLocaleString('id-ID')}</p>
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5 mt-0.5">
                  <TrendingUp className="w-3 h-3" /> Penjualan
                </span>
              </div>

              <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Transaksi</span>
                <p className="text-lg font-black text-indigo-600 mt-1">{kpi.totalBills.toLocaleString('id-ID')}</p>
                <span className="text-[10px] text-slate-400 font-medium">Struk terbit</span>
              </div>

              <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
                <span className="text-[10px] font-bold text-rose-500 block uppercase">Pengeluaran</span>
                <p className="text-lg font-black text-rose-600 mt-1">Rp {kpi.totalExpense.toLocaleString('id-ID')}</p>
                <span className="text-[10px] text-rose-400 font-medium">Belanja operasional</span>
              </div>

              <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Kas Bersih (Net)</span>
                <p className="text-lg font-black text-emerald-700 mt-1">Rp {kpi.netCashFlow.toLocaleString('id-ID')}</p>
                <span className="text-[10px] text-slate-400 font-medium">Tunai - kas kecil</span>
              </div>

              <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Selisih Kas Laci</span>
                <p className={`text-lg font-black mt-1 ${kpi.totalCashDiff < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                  {kpi.totalCashDiff < 0 ? `-Rp ${Math.abs(kpi.totalCashDiff).toLocaleString('id-ID')}` : `Rp ${kpi.totalCashDiff.toLocaleString('id-ID')}`}
                </p>
                <span className="text-[10px] text-slate-400 font-medium">{kpi.totalCashDiff === 0 ? 'Klop' : 'Perlu cek kasir'}</span>
              </div>

              <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Waste Fisik</span>
                <p className="text-lg font-black text-[#ff6f3c] mt-1">{kpi.totalWasteUnits.toLocaleString('id-ID')}</p>
                <span className="text-[10px] text-slate-400 font-medium">Item terbuang</span>
              </div>
            </div>

            {/* PERBANDINGAN OUTLET & CARA BAYAR */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-xs font-black uppercase text-slate-800">Perbandingan Kinerja Outlet</h3>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">BTP vs Perintis</span>
                </div>

                {outletComparison.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Belum ada transaksi pada periode ini.</p>
                ) : (
                  <div className="space-y-3">
                    {outletComparison.map((out) => (
                      <div key={out.name} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-sm text-slate-900">{out.name}</span>
                          <span className="font-black text-sm text-[#ff6f3c]">Rp {out.omset.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 border-t border-slate-200/60">
                          <div>
                            <span className="text-slate-400 block">Total Struk:</span>
                            <span className="font-bold text-slate-700">{out.bills} Struk</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Pengeluaran:</span>
                            <span className="font-bold text-rose-600">Rp {out.expense.toLocaleString('id-ID')}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Selisih Kas:</span>
                            <span className={`font-bold ${out.cashDiff < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                              {out.cashDiff === 0 ? 'Pas' : `Rp ${out.cashDiff.toLocaleString('id-ID')}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-black uppercase text-slate-800">Komposisi Pembayaran</h3>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">Tunai vs Non-Tunai</span>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-slate-700">Tunai / Cash</span>
                    </div>
                    <span className="font-black text-slate-900">Rp {paymentBreakdown.cash.toLocaleString('id-ID')}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-indigo-600" />
                      <span className="font-bold text-slate-700">QRIS / Transfer</span>
                    </div>
                    <span className="font-black text-indigo-700">Rp {paymentBreakdown.qris.toLocaleString('id-ID')}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-emerald-700" />
                      <span className="font-bold text-emerald-700">GrabFood</span>
                    </div>
                    <span className="font-black text-slate-900">Rp {paymentBreakdown.grab.toLocaleString('id-ID')}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-red-600" />
                      <span className="font-bold text-red-600">GoFood</span>
                    </div>
                    <span className="font-black text-slate-900">Rp {paymentBreakdown.gofood.toLocaleString('id-ID')}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-[#ff6f3c]" />
                      <span className="font-bold text-[#ff6f3c]">ShopeeFood</span>
                    </div>
                    <span className="font-black text-slate-900">Rp {paymentBreakdown.shopee.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* TABEL RINCIAN PENGELUARAN UNTUK OWNER */}
            {expenseLogs.length > 0 && (
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-rose-600" />
                    <h3 className="text-xs font-black uppercase text-slate-800">
                      Rincian Pengeluaran Kasir & Nota ({expenseLogs.length} Transaksi)
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">
                    Kas Keluar Cabang
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                        <th className="py-2.5 px-3">Tanggal & Cabang</th>
                        <th className="py-2.5 px-3">Shift & Kasir</th>
                        <th className="py-2.5 px-3 text-right">Nominal</th>
                        <th className="py-2.5 px-3">Keperluan / Catatan Nota</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {expenseLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-800">{log.outlet}</div>
                            <div className="text-[10px] text-slate-400">{log.date}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-700">{log.shift}</span>
                            <div className="text-[10px] text-slate-400">{log.cashier}</div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-rose-600">
                            -Rp {log.nominal.toLocaleString('id-ID')}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            <span className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 text-[11px] block sm:inline-block">
                              "{log.notes}"
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}