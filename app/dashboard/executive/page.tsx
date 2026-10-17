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
  AlertCircle, 
  ExternalLink,
  Download
} from 'lucide-react';
import BranchStockMonitor from '@/components/outlet/components/shared/BranchStockMonitor';

interface SettlementRecord {
  id: string;
  location_id: string;
  settlement_date: string;
  shift?: string;
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
  locations?: { name: string };
}

export default function ExecutiveDashboard() {
  const router = useRouter();
  const [locations, setLocations] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'omset' | 'stok'>('omset');
  
  const [filterMode, setFilterMode] = useState<'today' | 'weekly' | 'monthly' | 'custom'>('today');
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloading, setDownloading] = useState<boolean>(false);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      const { data: locs } = await supabase.from('locations').select('*').order('name');
      if (locs) setLocations(locs);

      let query = supabase
        .from('cash_settlements')
        .select('*, locations(name)')
        .order('settlement_date', { ascending: false });

      const today = new Date();
      if (filterMode === 'today') {
        const todayStr = today.toISOString().split('T')[0];
        query = query.eq('settlement_date', todayStr);
      } else if (filterMode === 'weekly') {
        const past7 = new Date();
        past7.setDate(today.getDate() - 7);
        query = query.gte('settlement_date', past7.toISOString().split('T')[0]);
      } else if (filterMode === 'monthly') {
        const past30 = new Date();
        past30.setDate(today.getDate() - 30);
        query = query.gte('settlement_date', past30.toISOString().split('T')[0]);
      } else if (filterMode === 'custom') {
        query = query.eq('settlement_date', customDate);
      }

      if (selectedLocation !== 'all') {
        query = query.eq('location_id', selectedLocation);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (data) setSettlements(data);
    } catch (err) {
      console.error('Gagal mengambil data keuangan:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancialData();
  }, [filterMode, customDate, selectedLocation]);

  const handleLogout = () => {
    localStorage.removeItem('baksoibu_active_staff');
    router.push('/login');
  };

  const metrics = useMemo(() => {
    const totalOmset = settlements.reduce((acc, curr) => acc + Number(curr.total_omset || 0), 0);
    const totalCash = settlements.reduce((acc, curr) => acc + Number(curr.cash_nominal || 0), 0);
    const totalQris = settlements.reduce((acc, curr) => acc + Number(curr.qris_nominal || 0), 0);
    const totalOnline = settlements.reduce((acc, curr) => acc + Number(curr.online_nominal || 0), 0);
    const totalDiff = settlements.reduce((acc, curr) => acc + Number(curr.cash_difference || 0), 0);
    return { totalOmset, totalCash, totalQris, totalOnline, totalDiff };
  }, [settlements]);

  const handleDownloadOmsetReport = () => {
    setDownloading(true);
    try {
      if (settlements.length === 0) {
        alert('Tidak ada data omset pada filter ini untuk diunduh.');
        return;
      }

      const headers = [
        'Tanggal',
        'Outlet',
        'Shift',
        'Kasir Pelapor',
        'Modal Awal Laci',
        'Tunai (Cash)',
        'QRIS / Transfer',
        'GrabFood',
        'GoFood',
        'ShopeeFood',
        'Pengeluaran Kas Kecil',
        'Rincian Pengeluaran',
        'Total Omset Bersih',
        'Uang Fisik di Laci/Disetor',
        'Selisih Kas',
        'Catatan Kasir'
      ];

      const csvRows = settlements.map((item) => {
        const shiftLabel = item.shift === 'SHIFT_2' ? 'Shift 2' : 'Shift 1';
        return [
          `"${item.settlement_date}"`,
          `"${item.locations?.name || 'Outlet'}"`,
          `"${shiftLabel}"`,
          `"${item.reported_by || '-'}"`,
          Number(item.opening_cash || 0),
          Number(item.cash_nominal || 0),
          Number(item.qris_nominal || 0),
          Number(item.grab_nominal || 0),
          Number(item.gofood_nominal || 0),
          Number(item.shopee_nominal || 0),
          Number(item.expense_nominal || 0),
          `"${(item.expense_notes || '-').replace(/"/g, '""')}"`,
          Number(item.total_omset || 0),
          Number(item.actual_cash_deposited || 0),
          Number(item.cash_difference || 0),
          `"${(item.notes || '-').replace(/"/g, '""')}"`
        ].join(';');
      });

      const csvContent = [headers.join(';'), ...csvRows].join('\r\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const todayStr = new Date().toISOString().split('T')[0];
      link.setAttribute('href', url);
      link.setAttribute('download', `Rekap_Omset_BaksoIbu_${filterMode}_${todayStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert('Gagal mendownload rekap omset: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fd] text-slate-800 font-sans flex flex-col">
      <header className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#ff6f3c] to-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-slate-900 leading-none">
              Bakso Ibu Executive Owner
            </h1>
            <p className="text-[11px] font-semibold text-slate-400 mt-1">
              Pantauan Omset Kasir, Performa Finansial & Inventori
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-xs border border-slate-100 text-xs font-bold text-slate-500">
          <button
            onClick={() => setActiveTab('omset')}
            className={`px-3.5 py-1 rounded-full transition-all flex items-center gap-1.5 ${
              activeTab === 'omset' ? 'bg-[#ff6f3c] text-white shadow-sm' : 'hover:text-slate-800'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Laporan Omset
          </button>
          <button
            onClick={() => setActiveTab('stok')}
            className={`px-3.5 py-1 rounded-full transition-all flex items-center gap-1.5 ${
              activeTab === 'stok' ? 'bg-[#ff6f3c] text-white shadow-sm' : 'hover:text-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Pengawasan Stok
          </button>
        </div>

        <button
          onClick={handleLogout}
          title="Keluar"
          className="w-9 h-9 rounded-2xl bg-white border border-slate-200/80 hover:bg-red-50 hover:border-red-200 text-slate-400 hover:text-red-600 flex items-center justify-center transition-all shadow-xs"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-4 space-y-6">
        {activeTab === 'stok' ? (
          <div>
            <BranchStockMonitor />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Filter Bar & Tombol Unduh */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm shadow-slate-200/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setFilterMode('today')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    filterMode === 'today' ? 'bg-white text-[#ff6f3c] shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('weekly')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    filterMode === 'weekly' ? 'bg-white text-[#ff6f3c] shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  7 Hari (Mingguan)
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('monthly')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    filterMode === 'monthly' ? 'bg-white text-[#ff6f3c] shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  30 Hari (Bulanan)
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('custom')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    filterMode === 'custom' ? 'bg-white text-[#ff6f3c] shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Pilih Kalender
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
                  onClick={fetchFinancialData}
                  className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-100 transition-colors"
                  title="Segarkan Data"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>

                <button
                  onClick={handleDownloadOmsetReport}
                  disabled={downloading || settlements.length === 0}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 transition-all"
                  title="Unduh Rekap Spreadsheet"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{downloading ? 'Mengunduh...' : 'Unduh Rekap (.CSV)'}</span>
                </button>
              </div>
            </div>

            {/* 4 Kartu Metrik Keuangan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
                <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold">
                  <span>Total Omset Bersih</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-black text-slate-900 mt-2">
                  Rp {metrics.totalOmset.toLocaleString('id-ID')}
                </p>
                <span className="text-[10px] text-slate-400 font-medium">Akumulasi seluruh transaksi</span>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
                <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold">
                  <span>Total Uang Tunai (Cash)</span>
                  <Banknote className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-black text-emerald-700 mt-2">
                  Rp {metrics.totalCash.toLocaleString('id-ID')}
                </p>
                <span className="text-[10px] text-slate-400 font-medium">Penjualan tunai kasir</span>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
                <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold">
                  <span>QRIS & Delivery App</span>
                  <QrCode className="w-4 h-4 text-indigo-600" />
                </div>
                <p className="text-2xl font-black text-indigo-600 mt-2">
                  Rp {(metrics.totalQris + metrics.totalOnline).toLocaleString('id-ID')}
                </p>
                <span className="text-[10px] text-slate-400 font-medium">
                  QRIS: Rp {metrics.totalQris.toLocaleString('id-ID')} • App: Rp {metrics.totalOnline.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
                <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold">
                  <span>Selisih Fisik Laci</span>
                  <AlertCircle className={`w-4 h-4 ${metrics.totalDiff < 0 ? 'text-red-500' : 'text-emerald-500'}`} />
                </div>
                <p className={`text-2xl font-black mt-2 ${metrics.totalDiff < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                  {metrics.totalDiff < 0 ? `-Rp ${Math.abs(metrics.totalDiff).toLocaleString('id-ID')}` : `Rp ${metrics.totalDiff.toLocaleString('id-ID')}`}
                </p>
                <span className="text-[10px] text-slate-400 font-medium">
                  {metrics.totalDiff === 0 ? 'Klop (Tidak ada selisih)' : metrics.totalDiff < 0 ? 'Terdapat uang laci kurang' : 'Kelebihan kas'}
                </span>
              </div>
            </div>

            {/* Tabel Rincian Data Tutup Kas */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm shadow-slate-200/40 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-black text-slate-900">Rincian Laporan Setoran Kasir Harian</h2>
                  <p className="text-xs text-slate-400">Modal awal, rincian pembayaran (Tunai, QRIS, Grab, GoFood, Shopee), dan fisik laci.</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 bg-orange-50 text-[#ff6f3c] rounded-full">
                  {settlements.length} Laporan Ditemukan
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-3">Tanggal & Outlet</th>
                      <th className="py-3 px-2">Kasir / Shift</th>
                      <th className="py-3 px-2 text-right text-indigo-700">Modal Kas</th>
                      <th className="py-3 px-2 text-right">Cash</th>
                      <th className="py-3 px-2 text-right">QRIS</th>
                      <th className="py-3 px-2 text-right text-emerald-700">Grab</th>
                      <th className="py-3 px-2 text-right text-red-600">GoFood</th>
                      <th className="py-3 px-2 text-right text-[#ff6f3c]">Shopee</th>
                      <th className="py-3 px-2 text-right text-orange-600">Pengeluaran</th>
                      <th className="py-3 px-3 text-right font-black text-slate-900">Total Omset</th>
                      <th className="py-3 px-2 text-right">Fisik Laci</th>
                      <th className="py-3 px-2 text-center">Selisih</th>
                      <th className="py-3 px-3 text-center">Bukti</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {loading ? (
                      <tr>
                        <td colSpan={13} className="py-12 text-center text-slate-400 font-medium">
                          Memuat data laporan setoran...
                        </td>
                      </tr>
                    ) : settlements.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="py-12 text-center text-slate-400 font-medium">
                          Tidak ada rekaman omset pada periode atau tanggal yang dipilih.
                        </td>
                      </tr>
                    ) : (
                      settlements.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-extrabold text-slate-900">{item.locations?.name || 'Cabang'}</div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              {new Date(item.settlement_date).toLocaleDateString('id-ID', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <div className="font-semibold text-slate-800">{item.reported_by}</div>
                            <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 mt-0.5">
                              {item.shift === 'SHIFT_2' ? 'Shift 2' : 'Shift 1'}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right font-bold text-indigo-700">
                            Rp {Number(item.opening_cash || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-2 text-right font-semibold text-slate-800">
                            Rp {Number(item.cash_nominal || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-2 text-right font-semibold text-slate-800">
                            Rp {Number(item.qris_nominal || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-2 text-right font-semibold text-emerald-700">
                            Rp {Number(item.grab_nominal || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-2 text-right font-semibold text-red-600">
                            Rp {Number(item.gofood_nominal || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-2 text-right font-semibold text-[#ff6f3c]">
                            Rp {Number(item.shopee_nominal || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-2 text-right font-semibold text-orange-600">
                            {Number(item.expense_nominal || 0) > 0 
                              ? `-Rp ${Number(item.expense_nominal).toLocaleString('id-ID')}` 
                              : 'Rp 0'}
                          </td>
                          <td className="py-3 px-3 text-right font-black text-[#ff6f3c] bg-orange-50/30">
                            Rp {Number(item.total_omset || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-2 text-right font-bold text-slate-900">
                            Rp {Number(item.actual_cash_deposited || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-2 text-center">
                            {Number(item.cash_difference || 0) === 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                                Pas
                              </span>
                            ) : Number(item.cash_difference || 0) < 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-50 text-red-600">
                                -Rp {Math.abs(Number(item.cash_difference)).toLocaleString('id-ID')}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-600">
                                +Rp {Number(item.cash_difference).toLocaleString('id-ID')}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {item.proof_photo_url ? (
                              <a
                                href={item.proof_photo_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl font-bold text-[10px] transition-colors"
                              >
                                <span>Struk</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ) : (
                              <span className="text-[10px] text-slate-300 font-medium">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}