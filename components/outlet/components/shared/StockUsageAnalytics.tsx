'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  BarChart3, 
  Download, 
  MapPin, 
  RefreshCw,
  Calendar
} from 'lucide-react';

interface Props {
  user?: any;
  defaultLocationId?: string;
  hideLocationFilter?: boolean;
}

export default function StockUsageAnalytics({ user, defaultLocationId, hideLocationFilter = false }: Props) {
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<string>(defaultLocationId || 'all');
  const [periodRange, setPeriodRange] = useState<'7' | '14' | '30'>('7');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [recordedDates, setRecordedDates] = useState<string[]>([]);

  useEffect(() => {
    async function fetchLocations() {
      const { data } = await supabase.from('locations').select('*');
      if (data) setLocations(data);
    }
    fetchLocations();
  }, []);

  const calculateDailyUsage = async () => {
    setLoading(true);
    try {
      const daysCount = parseInt(periodRange, 10);
      const now = new Date();
      const startDate = new Date();
      startDate.setDate(now.getDate() - daysCount);

      const startStr = startDate.toISOString().split('T')[0];
      const endStr = now.toISOString().split('T')[0];

      // 1. Ambil Master Items
      const { data: items } = await supabase.from('items').select('name, category, uom');

      // 2. Ambil Riwayat Closing Cabang
      let closingQuery = supabase
        .from('daily_closings')
        .select('item_name, remaining_stock, waste_qty, location_id, closing_date')
        .gte('closing_date', startStr)
        .lte('closing_date', endStr)
        .order('closing_date', { ascending: true });
      if (selectedLoc !== 'all') closingQuery = closingQuery.eq('location_id', selectedLoc);
      const { data: closingData } = await closingQuery;

      // 3. Ambil Riwayat Penerimaan Barang (Inflow)
      let recQuery = supabase
        .from('receptions')
        .select('item_name, quantity, location_id, created_at')
        .gte('created_at', `${startStr}T00:00:00+08:00`)
        .lte('created_at', `${endStr}T23:59:59+08:00`);
      if (selectedLoc !== 'all') recQuery = recQuery.eq('location_id', selectedLoc);
      const { data: recData } = await recQuery;

      // 4. Catat Tanggal Closing Aktif
      const uniqueDates = Array.from(new Set((closingData || []).map((c: any) => c.closing_date))).sort();
      setRecordedDates(uniqueDates);

      // Normalisasi Nama Bahan (Case-Insensitive)
      const itemMap = new Map<string, string>();
      (items || []).forEach((i) => itemMap.set(i.name.trim().toUpperCase(), i.name.trim()));
      (closingData || []).forEach((c: any) => {
        if (!itemMap.has(c.item_name.trim().toUpperCase())) {
          itemMap.set(c.item_name.trim().toUpperCase(), c.item_name.trim());
        }
      });

      const rows: any[] = [];

      itemMap.forEach((displayName, upperKey) => {
        const itemMeta = items?.find((i) => i.name.trim().toUpperCase() === upperKey);
        const category = itemMeta?.category || 'Bahan Baku';
        const uom = itemMeta?.uom || 'Pcs';

        const itemClosings = (closingData || []).filter((c: any) => c.item_name.trim().toUpperCase() === upperKey);
        const itemRecs = (recData || []).filter((r: any) => r.item_name.trim().toUpperCase() === upperKey);

        if (itemClosings.length === 0) return;

        // Hitung Pemakaian Tiap Tanggal Closing
        const dailyUsages: Record<string, number> = {};
        let totalUsage = 0;
        let activeDaysCount = 0;

        for (let i = 0; i < itemClosings.length; i++) {
          const curr = itemClosings[i];
          const currDate = curr.closing_date;
          const currRemaining = Number(curr.remaining_stock || 0);
          const currWaste = Number(curr.waste_qty || 0);

          // Inflow pada tanggal closing ini (WITA)
          const inToday = itemRecs
            .filter((r: any) => {
              const recDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date(r.created_at));
              return recDate === currDate;
            })
            .reduce((sum: number, r: any) => sum + Number(r.quantity || 0), 0);

          let usageToday = 0;
          if (i === 0) {
            // Hari pertama: pemakaian dihitung dari barang masuk dikurangi waste jika ada,
            // atau 0 jika belum ada titik closing pembanding sebelumnya
            usageToday = Math.max(0, inToday - currWaste);
          } else {
            // Hari kedua dst: (Sisa Kemarin + Masuk Hari Ini) - Sisa Hari Ini - Waste
            const prevRemaining = Number(itemClosings[i - 1].remaining_stock || 0);
            usageToday = Math.max(0, (prevRemaining + inToday) - currRemaining - currWaste);
          }

          dailyUsages[currDate] = usageToday;
          totalUsage += usageToday;
          activeDaysCount++;
        }

        // Rata-rata hanya dibagi jumlah hari aktif closing
        const avgDaily = activeDaysCount > 0 ? (totalUsage / activeDaysCount).toFixed(1) : '0';
        const latestClosing = itemClosings[itemClosings.length - 1];

        rows.push({
          itemName: displayName,
          category,
          uom,
          dailyUsages,
          totalUsage: totalUsage.toFixed(1),
          avgDaily,
          activeDaysCount,
          lastStock: Number(latestClosing?.remaining_stock || 0).toFixed(1)
        });
      });

      // Urutkan dari bahan dengan pemakaian total terbesar
      rows.sort((a, b) => Number(b.totalUsage) - Number(a.totalUsage));
      setAnalyticsData(rows);
    } catch (e: any) {
      console.error('Error calculateDailyUsage:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateDailyUsage();
  }, [selectedLoc, periodRange]);

  const handleDownloadCSV = () => {
    if (analyticsData.length === 0) return alert('Tidak ada data untuk diunduh.');
    setDownloading(true);

    try {
      const locLabel = selectedLoc === 'all' 
        ? 'Semua Cabang' 
        : locations.find((l) => l.id === selectedLoc)?.name || 'Cabang';

      const headers = [
        'Nama Bahan',
        'Kategori',
        'Satuan',
        'Sisa Fisik Terakhir',
        ...recordedDates.map((d) => `Tgl ${d}`),
        'Total Pakai',
        'Hari Aktif Closing',
        'Rata-rata/Hari'
      ];

      const rows = analyticsData.map((r) => [
        `"${r.itemName}"`,
        `"${r.category}"`,
        `"${r.uom}"`,
        r.lastStock,
        ...recordedDates.map((d) => r.dailyUsages[d] !== undefined ? r.dailyUsages[d].toFixed(1) : '0'),
        r.totalUsage,
        r.activeDaysCount,
        r.avgDaily
      ].join(';'));

      const csvContent = [headers.join(';'), ...rows].join('\r\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Pemakaian_Harian_${locLabel}_${periodRange}Hari.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-xs">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              Laporan Pemakaian Harian Bahan Baku
            </h2>
            <p className="text-xs font-medium text-slate-400">
              Kuantitas konsumsi riil per tanggal closing dan rata-rata pemakaian berdasarkan hari aktif.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={calculateDailyUsage}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl border border-slate-200 transition-all"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleDownloadCSV}
            disabled={downloading || loading || analyticsData.length === 0}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? 'Menyiapkan...' : 'Download Rekap (.CSV)'}</span>
          </button>
        </div>
      </div>

      {/* Filter Kontrol */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
            Rentang Waktu
          </label>
          <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-1 rounded-2xl border border-slate-100 text-xs font-extrabold">
            {(['7', '14', '30'] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setPeriodRange(days)}
                className={`py-2 rounded-xl transition-all ${
                  periodRange === days ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {days} Hari
              </button>
            ))}
          </div>
        </div>

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

      {/* Tabel Pemakaian Harian Langsung */}
      <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                <th className="py-3 px-4">Nama Bahan & Kategori</th>
                <th className="py-3 px-3 text-right">Sisa Fisik Terakhir</th>
                {recordedDates.map((d) => (
                  <th key={d} className="py-3 px-3 text-right bg-indigo-50/30 text-indigo-900 whitespace-nowrap">
                    Tgl {d.slice(5)} {/* Tampil MM-DD */}
                  </th>
                ))}
                <th className="py-3 px-3 text-right font-black text-slate-800">Total Pakai</th>
                <th className="py-3 px-4 text-right bg-emerald-50/50 text-emerald-900 font-black">Rata-Rata / Hari</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold">
              {loading ? (
                <tr>
                  <td colSpan={recordedDates.length + 4} className="py-12 text-center text-slate-400">
                    Memuat data pemakaian harian...
                  </td>
                </tr>
              ) : analyticsData.length === 0 ? (
                <tr>
                  <td colSpan={recordedDates.length + 4} className="py-12 text-center text-slate-400">
                    Belum ada data closing fisik pada rentang tanggal ini.
                  </td>
                </tr>
              ) : (
                analyticsData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-extrabold text-slate-900">{item.itemName}</div>
                      <div className="text-[10px] text-slate-400">{item.category}</div>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-500 font-bold">
                      {item.lastStock} <span className="text-[10px] font-normal">{item.uom}</span>
                    </td>
                    {recordedDates.map((d) => (
                      <td key={d} className="py-3 px-3 text-right font-bold text-indigo-700 bg-indigo-50/10">
                        {item.dailyUsages[d] !== undefined ? item.dailyUsages[d].toFixed(1) : '-'}
                      </td>
                    ))}
                    <td className="py-3 px-3 text-right font-black text-slate-900">
                      {item.totalUsage} <span className="text-[10px] font-normal text-slate-400">{item.uom}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-black bg-emerald-50/30 text-emerald-700">
                      {item.avgDaily} <span className="text-[10px] font-normal text-slate-400">{item.uom}/hari</span>
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