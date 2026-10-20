'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  MapPin, 
  TrendingUp, 
  RefreshCw,
  Layers,
  ArrowUpRight
} from 'lucide-react';

interface Props {
  user?: any;
  defaultLocationId?: string;
  hideLocationFilter?: boolean; // True jika dibuka oleh Leader cabang tertentu saja
}

export default function StockUsageAnalytics({ user, defaultLocationId, hideLocationFilter = false }: Props) {
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<string>(defaultLocationId || 'all');
  const [periodRange, setPeriodRange] = useState<'7' | '30' | 'this_month' | 'last_month'>('30');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);

  // 1. Ambil Data Lokasi
  useEffect(() => {
    async function fetchLocations() {
      const { data } = await supabase.from('locations').select('*');
      if (data) setLocations(data);
    }
    fetchLocations();
  }, []);

  // 2. Kalkulasi Data Pemakaian
  const calculateAnalytics = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate = new Date();
      let endDate = new Date();

      if (periodRange === '7') {
        startDate.setDate(now.getDate() - 7);
      } else if (periodRange === '30') {
        startDate.setDate(now.getDate() - 30);
      } else if (periodRange === 'this_month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (periodRange === 'last_month') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      }

      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      // Ambil Master Items
      const { data: items } = await supabase.from('items').select('name, category, uom');

      // Ambil Data Penerimaan (Inflow)
      let recQuery = supabase
        .from('receptions')
        .select('item_name, quantity, location_id, created_at')
        .gte('created_at', `${startStr}T00:00:00Z`)
        .lte('created_at', `${endStr}T23:59:59Z`);
      if (selectedLoc !== 'all') recQuery = recQuery.eq('location_id', selectedLoc);
      const { data: recData } = await recQuery;

      // Ambil Data Closing & Waste Harian
      let closingQuery = supabase
        .from('daily_closings')
        .select('item_name, remaining_stock, waste_qty, location_id, closing_date')
        .gte('closing_date', startStr)
        .lte('closing_date', endStr);
      if (selectedLoc !== 'all') closingQuery = closingQuery.eq('location_id', selectedLoc);
      const { data: closingData } = await closingQuery;

      // Ambil Stok Awal Cabang
      let stockQuery = supabase.from('branch_stocks').select('*, locations(name)');
      if (selectedLoc !== 'all') stockQuery = stockQuery.eq('location_id', selectedLoc);
      const { data: stocks } = await stockQuery;

      // Kelompokkan Tanggal ke Weekdays vs Weekend
      // Weekdays: Senin(1) - Kamis(4) | Weekend: Jumat(5) - Minggu(0)
      const dateSet = new Set<string>();
      let cur = new Date(startDate);
      while (cur <= endDate) {
        dateSet.add(cur.toISOString().split('T')[0]);
        cur.setDate(cur.getDate() + 1);
      }

      let weekdaysCount = 0;
      let weekendCount = 0;
      dateSet.forEach((dStr) => {
        const day = new Date(dStr).getDay();
        if (day === 0 || day === 5 || day === 6) weekendCount++;
        else weekdaysCount++;
      });

      const totalDays = weekdaysCount + weekendCount || 1;

      // Rekapitulasi per bahan
      const rows: any[] = [];
      const distinctItems = Array.from(new Set([
        ...(stocks || []).map((s: any) => s.item_name),
        ...(closingData || []).map((c: any) => c.item_name)
      ]));

      distinctItems.forEach((itemName) => {
        const itemMeta = items?.find((i) => i.name === itemName);
        const itemCategory = itemMeta?.category || 'Lain-lain';
        const uom = itemMeta?.uom || 'Pcs';

        // Filter record item ini
        const relevantClosings = (closingData || []).filter((c: any) => c.item_name === itemName);
        const relevantRecs = (recData || []).filter((r: any) => r.item_name === itemName);

        let totalUsage = 0;
        let weekdayUsage = 0;
        let weekendUsage = 0;

        // Hitung pemakaian harian berdasar closing
        relevantClosings.forEach((c: any) => {
          const cDate = new Date(c.closing_date);
          const day = cDate.getDay();
          const isWeekend = day === 0 || day === 5 || day === 6;

          // Estimasi pemakaian hari tersebut: barang masuk hari itu + waste
          const inToday = relevantRecs
            .filter((r: any) => r.created_at.startsWith(c.closing_date))
            .reduce((sum: number, cur: any) => sum + Number(cur.quantity || 0), 0);

          const estimatedDailyUse = Math.max(0, inToday - Number(c.waste_qty || 0));

          totalUsage += estimatedDailyUse;
          if (isWeekend) weekendUsage += estimatedDailyUse;
          else weekdayUsage += estimatedDailyUse;
        });

        // Jika data harian belum spesifik, hitung dari rumus agregat
        if (totalUsage === 0) {
          const totalIn = relevantRecs.reduce((sum: number, cur: any) => sum + Number(cur.quantity || 0), 0);
          const totalWaste = relevantClosings.reduce((sum: number, cur: any) => sum + Number(cur.waste_qty || 0), 0);
          totalUsage = Math.max(0, totalIn - totalWaste);
          
          // Estimasi proporsi umum F&B: 40% weekdays, 60% weekend
          weekdayUsage = totalUsage * (weekdaysCount / (weekdaysCount + weekendCount * 1.5 || 1));
          weekendUsage = totalUsage - weekdayUsage;
        }

        const avgDaily = (totalUsage / totalDays).toFixed(1);
        const avgWeekday = (weekdayUsage / (weekdaysCount || 1)).toFixed(1);
        const avgWeekend = (weekendUsage / (weekendCount || 1)).toFixed(1);

        const surgePercent = Number(avgWeekday) > 0 
          ? (((Number(avgWeekend) - Number(avgWeekday)) / Number(avgWeekday)) * 100).toFixed(0)
          : '0';

        rows.push({
          itemName,
          category: itemCategory,
          uom,
          totalUsage: totalUsage.toFixed(1),
          avgDaily,
          avgWeekday,
          avgWeekend,
          surgePercent: Number(surgePercent)
        });
      });

      // Urutkan dari pemakaian terbesar
      rows.sort((a, b) => Number(b.totalUsage) - Number(a.totalUsage));
      setAnalyticsData(rows);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateAnalytics();
  }, [selectedLoc, periodRange]);

  // Export File CSV / Excel
  const handleDownloadCSV = () => {
    if (analyticsData.length === 0) return alert('Tidak ada data analisis untuk diunduh.');
    setDownloading(true);

    try {
      const locLabel = selectedLoc === 'all' 
        ? 'Semua Cabang' 
        : locations.find((l) => l.id === selectedLoc)?.name || 'Cabang';

      const headers = [
        'Nama Cabang',
        'Kategori Bahan',
        'Nama Bahan Baku',
        'Total Pemakaian Periode',
        'Rata-Rata Harian (All Days)',
        'Rata-Rata Weekdays (Senin-Kamis)',
        'Rata-Rata Weekend (Jumat-Minggu)',
        'Lonjakan Weekend (%)',
        'Satuan'
      ];

      const rows = analyticsData.map((r) => [
        `"${locLabel}"`,
        `"${r.category}"`,
        `"${r.itemName}"`,
        r.totalUsage,
        r.avgDaily,
        r.avgWeekday,
        r.avgWeekend,
        `"${r.surgePercent}%"`,
        `"${r.uom}"`
      ].join(';'));

      const csvContent = [headers.join(';'), ...rows].join('\r\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Analisis_Konsumsi_Harian_${locLabel}_${periodRange}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-sm shadow-slate-200/50 space-y-6">
      {/* Header Widget */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-xs">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              Analisis Pola Konsumsi Harian Bahan Baku
            </h2>
            <p className="text-xs font-medium text-slate-400">
              Kalkulasi rata-rata kebutuhan harian: pemisahan otomatis pola Weekdays (Senin–Kamis) vs Weekend (Jumat–Minggu).
            </p>
          </div>
        </div>

        {/* Tombol Aksi Unduh */}
        <button
          onClick={handleDownloadCSV}
          disabled={downloading || loading || analyticsData.length === 0}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>{downloading ? 'Menyiapkan File...' : 'Download Rekap Pola Konsumsi (.CSV)'}</span>
        </button>
      </div>

      {/* Filter Kontrol */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Pilihan Periode Waktu */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
            Pilihan Periode Analisis
          </label>
          <div className="grid grid-cols-2 gap-1.5 bg-slate-50 p-1 rounded-2xl border border-slate-100 text-xs font-extrabold">
            <button
              type="button"
              onClick={() => setPeriodRange('7')}
              className={`py-2 rounded-xl transition-all ${
                periodRange === '7' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              7 Hari Terakhir
            </button>
            <button
              type="button"
              onClick={() => setPeriodRange('30')}
              className={`py-2 rounded-xl transition-all ${
                periodRange === '30' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              30 Hari Terakhir
            </button>
          </div>
        </div>

        {/* Filter Bulan Kalender */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
            Bulan Kalender
          </label>
          <div className="grid grid-cols-2 gap-1.5 bg-slate-50 p-1 rounded-2xl border border-slate-100 text-xs font-extrabold">
            <button
              type="button"
              onClick={() => setPeriodRange('this_month')}
              className={`py-2 rounded-xl transition-all ${
                periodRange === 'this_month' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => setPeriodRange('last_month')}
              className={`py-2 rounded-xl transition-all ${
                periodRange === 'last_month' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Bulan Kemarin
            </button>
          </div>
        </div>

        {/* Filter Cabang Outlet (Bisa disembunyikan untuk Leader) */}
        {!hideLocationFilter && (
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
              Pilih Cabang Outlet
            </label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <select
                value={selectedLoc}
                onChange={(e) => setSelectedLoc(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">Semua Cabang (Agregat)</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    Outlet {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Tabel Rincian Pola Konsumsi */}
      <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                <th className="py-3 px-4">Nama Bahan & Kategori</th>
                <th className="py-3 px-3 text-right">Total Pakai</th>
                <th className="py-3 px-3 text-right">Rata-Rata / Hari</th>
                <th className="py-3 px-3 text-right bg-blue-50/40 text-blue-800">Senin–Kamis (Weekdays)</th>
                <th className="py-3 px-3 text-right bg-orange-50/40 text-orange-800">Jumat–Minggu (Weekend)</th>
                <th className="py-3 px-4 text-center">Lonjakan Weekend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Menganalisis pola konsumsi bahan...
                  </td>
                </tr>
              ) : analyticsData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Belum ada rekaman stok pada periode ini.
                  </td>
                </tr>
              ) : (
                analyticsData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-extrabold text-slate-900">{item.itemName}</div>
                      <div className="text-[10px] text-slate-400">{item.category}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-black text-slate-800">
                      {item.totalUsage} <span className="text-[10px] font-normal text-slate-400">{item.uom}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-black text-indigo-600">
                      {item.avgDaily} <span className="text-[10px] font-normal text-slate-400">{item.uom}/hr</span>
                    </td>
                    <td className="py-3 px-3 text-right font-black bg-blue-50/20 text-blue-900">
                      {item.avgWeekday} <span className="text-[10px] font-normal text-slate-400">{item.uom}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-black bg-orange-50/20 text-[#ff6f3c]">
                      {item.avgWeekend} <span className="text-[10px] font-normal text-slate-400">{item.uom}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full text-[10px] font-black ${
                        item.surgePercent > 20
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : item.surgePercent > 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {item.surgePercent > 0 && <ArrowUpRight className="w-3 h-3" />}
                        {item.surgePercent > 0 ? `+${item.surgePercent}%` : `${item.surgePercent}%`}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}