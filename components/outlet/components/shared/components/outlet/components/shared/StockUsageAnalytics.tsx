'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  BarChart3, 
  MapPin, 
  Download, 
  RefreshCw, 
  Layers
} from 'lucide-react';

interface Props {
  user?: any;
  defaultLocationId?: string;
  hideLocationFilter?: boolean;
}

export default function StockUsageAnalytics({ user, defaultLocationId, hideLocationFilter = false }: Props) {
  const [dateRange, setDateRange] = useState<7 | 14 | 30>(7);
  const [selectedLoc, setSelectedLoc] = useState<string>(defaultLocationId || 'all');
  const [locations, setLocations] = useState<any[]>([]);
  
  const [branchStocks, setBranchStocks] = useState<any[]>([]);
  const [rawClosings, setRawClosings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (defaultLocationId) {
      setSelectedLoc(defaultLocationId);
    }
  }, [defaultLocationId]);

  // Ambil data lokasi outlet
  useEffect(() => {
    async function fetchLocations() {
      const { data } = await supabase.from('locations').select('id, name').order('name');
      if (data) setLocations(data);
    }
    fetchLocations();
  }, []);

  // Format YYYY-MM-DD standar WITA
  const formatDateKey = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Buat daftar tanggal kolom ke belakang
  const dateColumns = useMemo(() => {
    const cols: string[] = [];
    const today = new Date();
    for (let i = dateRange - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      cols.push(formatDateKey(d));
    }
    return cols;
  }, [dateRange]);

  // Fetch data riil dari branch_stocks & daily_closings
  const fetchData = async () => {
    setLoading(true);
    try {
      const startDate = dateColumns[0];
      const endDate = dateColumns[dateColumns.length - 1];

      // 1. Ambil Sisa Fisik Terkini dari branch_stocks
      let stockQuery = supabase.from('branch_stocks').select('*');
      if (selectedLoc !== 'all') {
        stockQuery = stockQuery.eq('location_id', selectedLoc);
      }
      const { data: stocks, error: stockErr } = await stockQuery;
      if (stockErr) throw stockErr;
      setBranchStocks(stocks || []);

      // 2. Ambil Riwayat Pemakaian dari daily_closings (membaca kolom 'terpakai')
      let cQuery = supabase
        .from('daily_closings')
        .select('item_name, closing_date, terpakai, remaining_stock, unit, category, location_id')
        .gte('closing_date', startDate)
        .lte('closing_date', endDate);

      if (selectedLoc !== 'all') {
        cQuery = cQuery.eq('location_id', selectedLoc);
      }
      const { data: closings, error: closingErr } = await cQuery;
      if (closingErr) throw closingErr;
      setRawClosings(closings || []);

    } catch (err: any) {
      console.error('Gagal mengambil data konsumsi:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange, selectedLoc, dateColumns]);

  // Standarisasi Kategori Baku
  const normalizeCategory = (rawCat?: string, itemName?: string) => {
    const cat = (rawCat || '').trim();
    const name = (itemName || '').toUpperCase();

    if (
      cat === 'Bahan Utama & Dapur' || 
      cat === 'Bahan Dapur & Bumbu' ||
      cat === 'Sayur, Mie & Pelengkap' ||
      cat === 'Bakso & Olahan Frozen' ||
      name.includes('AYAM') ||
      name.includes('BUMBU') ||
      name.includes('MASAKO') ||
      name.includes('GARAM') ||
      name.includes('LADAKU') ||
      name.includes('VITSIN') ||
      name.includes('MSG') ||
      name.includes('MINYAK') ||
      name.includes('TELUR') ||
      name.includes('BAKSO') ||
      name.includes('BIHUN') ||
      name.includes('BAWANG') ||
      name.includes('BURAS') ||
      name.includes('CUKA') ||
      name.includes('TAHU')
    ) {
      return 'Bahan Utama & Dapur';
    }

    if (cat === 'Kondimen & Pelengkap' || name.includes('KECAP') || name.includes('SAOS') || name.includes('SAUS') || name.includes('SAMBAL')) {
      return 'Kondimen & Pelengkap';
    }

    if (cat === 'Minuman & Es' || name.includes('TEH') || name.includes('AIR MINERAL') || name.includes('SIRUP')) {
      return 'Minuman & Es';
    }

    if (
      cat === 'Kemasan & Operasional' || 
      name.includes('SEDOTAN') || 
      name.includes('PIPET') || 
      name.includes('TISU') || 
      name.includes('TISSUE') || 
      name.includes('PLASTIK') || 
      name.includes('CUP') || 
      name.includes('KERTAS') ||
      name.includes('TALI')
    ) {
      return 'Kemasan & Operasional';
    }

    return 'Bahan Utama & Dapur';
  };

  // Olah & Kelompokkan Data Berdasarkan Kategori
  const groupedReportData = useMemo(() => {
    const itemMap: Record<string, {
      itemName: string;
      category: string;
      unit: string;
      latestStock: number;
      dailyUsage: Record<string, number>;
      totalUsed: number;
    }> = {};

    // 1. Inisialisasi dari branch_stocks
    branchStocks.forEach((st) => {
      const name = (st.item_name || '').toUpperCase().trim();
      if (!name) return;
      const normalizedCat = normalizeCategory(st.category, name);

      if (!itemMap[name]) {
        itemMap[name] = {
          itemName: name,
          category: normalizedCat,
          unit: st.unit || 'Pcs',
          latestStock: 0,
          dailyUsage: {},
          totalUsed: 0
        };
        dateColumns.forEach((d) => {
          itemMap[name].dailyUsage[d] = 0;
        });
      }
      itemMap[name].latestStock += Number(st.remaining_stock || 0);
    });

    // 2. Petakan nilai pemakaian dari daily_closings
    rawClosings.forEach((c) => {
      const name = (c.item_name || '').toUpperCase().trim();
      if (!name) return;

      if (!itemMap[name]) {
        const normalizedCat = normalizeCategory(c.category, name);
        itemMap[name] = {
          itemName: name,
          category: normalizedCat,
          unit: c.unit || 'Pcs',
          latestStock: 0,
          dailyUsage: {},
          totalUsed: 0
        };
        dateColumns.forEach((d) => {
          itemMap[name].dailyUsage[d] = 0;
        });
      }

      // Ambil nilai dari kolom 'terpakai'
      const val = Number(c.terpakai || 0);
      const cDate = String(c.closing_date).trim();

      if (itemMap[name].dailyUsage[cDate] !== undefined) {
        itemMap[name].dailyUsage[cDate] += val;
      }
      itemMap[name].totalUsed += val;
    });

    const activeDaysCount = dateColumns.length || 1;

    // Kelompokkan ke 4 Kategori Baku
    const groups: Record<string, any[]> = {
      'Bahan Utama & Dapur': [],
      'Kondimen & Pelengkap': [],
      'Minuman & Es': [],
      'Kemasan & Operasional': [],
    };

    Object.values(itemMap).forEach((item) => {
      const cat = groups[item.category] ? item.category : 'Bahan Utama & Dapur';
      const avg = item.totalUsed / activeDaysCount;
      groups[cat].push({
        ...item,
        averagePerDay: avg
      });
    });

    // Urutkan item A-Z di masing-masing kategori
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => a.itemName.localeCompare(b.itemName));
    });

    return groups;
  }, [branchStocks, rawClosings, dateColumns]);

  // Ekspor CSV Terkategori
  const handleDownloadCSV = () => {
    setDownloading(true);
    try {
      const locLabel = selectedLoc === 'all' 
        ? 'Semua_Cabang' 
        : locations.find((l) => l.id === selectedLoc)?.name || 'Cabang';

      const headers = [
        'Kategori Bahan',
        'Nama Bahan Baku',
        'Satuan',
        'Sisa Fisik Terakhir',
        ...dateColumns.map((d) => `TGL ${d.slice(5)}`),
        'Total Pemakaian',
        'Rata-rata / Hari'
      ];

      const rows: string[] = [];

      Object.entries(groupedReportData).forEach(([catName, items]) => {
        items.forEach((item) => {
          const rowData = [
            `"${catName}"`,
            `"${item.itemName}"`,
            `"${item.unit}"`,
            item.latestStock.toFixed(1),
            ...dateColumns.map((d) => (item.dailyUsage[d] || 0).toFixed(1)),
            item.totalUsed.toFixed(1),
            item.averagePerDay.toFixed(1)
          ];
          rows.push(rowData.join(';'));
        });
      });

      const csvContent = 'sep=;\r\n' + [headers.join(';'), ...rows].join('\r\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Laporan_Pemakaian_Bahan_${locLabel}_${dateRange}Hari.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-xs space-y-6 font-sans">
      {/* HEADER PANEL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              Laporan Pemakaian Harian Bahan Baku
            </h2>
            <p className="text-xs font-medium text-slate-400">
              Kuantitas konsumsi riil per tanggal closing dan rata-rata pemakaian berdasarkan hari aktif.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchData}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 transition-all"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleDownloadCSV}
            disabled={downloading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-xs transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading ? 'Menyiapkan...' : 'Download Rekap (.CSV)'}</span>
          </button>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
        <div>
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">
            RENTANG WAKTU
          </span>
          <div className="inline-flex bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            {([7, 14, 30] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDateRange(r)}
                className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                  dateRange === r ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {r} Hari
              </button>
            ))}
          </div>
        </div>

        {!hideLocationFilter && (
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">
              PILIH CABANG OUTLET
            </span>
            <div className="relative max-w-xs">
              <MapPin className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <select
                value={selectedLoc}
                onChange={(e) => setSelectedLoc(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none shadow-2xs"
              >
                <option value="all">Semua Cabang (Agregat)</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    Outlet {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* TABEL TERKATEGORI */}
      <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider bg-slate-50/90">
                <th className="py-3 px-4 min-w-[200px]">NAMA BAHAN & KATEGORI</th>
                <th className="py-3 px-3 text-right min-w-[100px]">SISA FISIK TERAKHIR</th>
                {dateColumns.map((d) => (
                  <th key={d} className="py-3 px-2 text-center min-w-[65px]">
                    TGL {d.slice(5)}
                  </th>
                ))}
                <th className="py-3 px-3 text-right font-black text-indigo-700 min-w-[95px]">TOTAL PAKAI</th>
                <th className="py-3 px-4 text-right font-black text-emerald-600 min-w-[110px]">RATA-RATA / HARI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-xs">
              {loading ? (
                <tr>
                  <td colSpan={dateColumns.length + 4} className="py-16 text-center text-slate-400 font-bold">
                    Memuat data analisa pemakaian bahan...
                  </td>
                </tr>
              ) : (
                Object.entries(groupedReportData).map(([catName, items]) => {
                  if (items.length === 0) return null;
                  return (
                    <React.Fragment key={catName}>
                      {/* HEADER SEKAT KATEGORI */}
                      <tr className="bg-indigo-50/60 border-y border-indigo-100/90">
                        <td 
                          colSpan={dateColumns.length + 4} 
                          className="py-2.5 px-4 font-black text-indigo-900 uppercase tracking-wider text-[11px]"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block"></span>
                              <span>{catName}</span>
                            </div>
                            <span className="text-[10px] font-bold text-indigo-500 normal-case tracking-normal">
                              {items.length} Bahan Baku Terdaftar
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* DAFTAR BARIS BAHAN */}
                      {items.map((row) => (
                        <tr key={row.itemName} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-extrabold text-slate-900 block leading-tight">{row.itemName}</span>
                            <span className="text-[10px] text-slate-400 font-bold block mt-0.5">{catName}</span>
                          </td>
                          <td className="py-3 px-3 text-right font-extrabold text-slate-700">
                            {row.latestStock.toFixed(1)} <span className="text-[10px] text-slate-400 font-normal">{row.unit}</span>
                          </td>
                          
                          {/* Kolom Tanggal Riil */}
                          {dateColumns.map((d) => {
                            const val = row.dailyUsage[d] || 0;
                            return (
                              <td 
                                key={d} 
                                className={`py-3 px-2 text-center text-xs ${
                                  val > 0 ? 'font-bold text-slate-800' : 'text-slate-300 font-normal'
                                }`}
                              >
                                {val.toFixed(1)}
                              </td>
                            );
                          })}

                          <td className="py-3 px-3 text-right font-black text-indigo-700">
                            {row.totalUsed.toFixed(1)} <span className="text-[10px] text-slate-400 font-normal">{row.unit}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-black text-emerald-600">
                            {row.averagePerDay.toFixed(1)} <span className="text-[9px] text-slate-400 font-normal">{row.unit}/hari</span>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}