'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  BarChart3, 
  RefreshCw, 
  Download, 
  MapPin, 
  Layers 
} from 'lucide-react';

interface Props {
  user?: any;
  defaultLocationId?: string | number;
  hideLocationFilter?: boolean;
}

interface ItemUsageRow {
  itemName: string;
  category: string;
  unit: string;
  lastStock: number;
  dailyUsage: Record<string, number>;
  totalUsage: number;
  avgUsage: number;
}

const CATEGORY_ORDER = [
  'Bahan Utama & Dapur',
  'Kondimen & Pelengkap',
  'Minuman & Es',
  'Kemasan & Operasional'
];

export default function StockUsageAnalytics({ user, defaultLocationId, hideLocationFilter }: Props) {
  const [daysRange, setDaysRange] = useState<number>(7);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [usageRows, setUsageRows] = useState<ItemUsageRow[]>([]);
  const [dateColumns, setDateColumns] = useState<string[]>([]);
  const [activeDaysCount, setActiveDaysCount] = useState<number>(1);

  // Fungsi pembersih desimal agar tidak muncul angka panjang (cth: 2.30000000000003 jadi 2.3)
  const formatQty = (num: number) => {
    if (num === 0) return '0.0';
    const rounded = Math.round(num * 10) / 10;
    return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
  };

  const cleanLocationName = (name?: string) => {
    if (!name) return 'Outlet';
    return `Outlet ${name.replace(/^outlet\s+/i, '').trim()}`;
  };

  const cleanName = (name?: string) => {
    return (name || '').trim().toUpperCase().replace(/\s+/g, ' ');
  };

  const normalizeCategory = (rawCat?: string, itemName?: string) => {
    const cat = (rawCat || '').trim();
    const name = cleanName(itemName);

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
      name.includes('TAHU') ||
      name.includes('DAUN') ||
      name.includes('JERUK') ||
      name.includes('KOL') ||
      name.includes('KACANG') ||
      name.includes('KERUPUK')
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

  useEffect(() => {
    async function loadLocations() {
      const { data } = await supabase.from('locations').select('id, name').order('name');
      if (data) {
        setLocations(data);
        if (defaultLocationId) {
          setSelectedLocation(String(defaultLocationId));
        } else if (data.length > 0 && selectedLocation === 'all') {
          setSelectedLocation(String(data[0].id));
        }
      }
    }
    loadLocations();
  }, [defaultLocationId]);

  const fetchUsageAnalytics = async () => {
    setLoading(true);
    try {
      const dates: string[] = [];
      const now = new Date();
      for (let i = daysRange - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(d);
        dates.push(dStr);
      }
      setDateColumns(dates);

      const startDate = dates[0];
      const endDate = dates[dates.length - 1];

      const { data: masterItems } = await supabase
        .from('items')
        .select('name, category, uom')
        .order('name');

      let query = supabase
        .from('daily_closings')
        .select('item_name, closing_date, terpakai, remaining_stock, unit, location_id')
        .gte('closing_date', startDate)
        .lte('closing_date', endDate);

      if (selectedLocation !== 'all') {
        query = query.eq('location_id', selectedLocation);
      }

      const { data: closingData, error } = await query;
      if (error) throw error;

      const recordedDates = new Set<string>();
      (closingData || []).forEach((c) => {
        if (c.closing_date && Number(c.terpakai || 0) >= 0) {
          recordedDates.add(c.closing_date);
        }
      });

      const effectiveActiveDays = Math.max(1, recordedDates.size);
      setActiveDaysCount(effectiveActiveDays);

      const itemMap: Record<string, ItemUsageRow> = {};

      (masterItems || []).forEach((item) => {
        const cName = cleanName(item.name);
        itemMap[cName] = {
          itemName: cName,
          category: normalizeCategory(item.category, item.name),
          unit: item.uom || 'Pcs',
          lastStock: 0,
          dailyUsage: {},
          totalUsage: 0,
          avgUsage: 0
        };
        dates.forEach((d) => {
          itemMap[cName].dailyUsage[d] = 0;
        });
      });

      (closingData || []).forEach((row) => {
        const cName = cleanName(row.item_name);
        if (!itemMap[cName]) {
          itemMap[cName] = {
            itemName: cName,
            category: normalizeCategory(undefined, row.item_name),
            unit: row.unit || 'Pcs',
            lastStock: 0,
            dailyUsage: {},
            totalUsage: 0,
            avgUsage: 0
          };
          dates.forEach((d) => {
            itemMap[cName].dailyUsage[d] = 0;
          });
        }

        const date = row.closing_date;
        const used = Number(row.terpakai || 0);

        if (itemMap[cName].dailyUsage[date] !== undefined) {
          // Bulatkan penjumlahan ke 1 desimal untuk mencegah bug desimal JS
          itemMap[cName].dailyUsage[date] = Math.round((itemMap[cName].dailyUsage[date] + used) * 10) / 10;
        }

        if (date === endDate || row.remaining_stock !== null) {
          itemMap[cName].lastStock = Math.round(Number(row.remaining_stock || 0) * 10) / 10;
          itemMap[cName].unit = row.unit || itemMap[cName].unit;
        }
      });

      const rows: ItemUsageRow[] = Object.values(itemMap).map((row) => {
        const total = Object.values(row.dailyUsage).reduce((sum, v) => sum + v, 0);
        const cleanTotal = Math.round(total * 10) / 10;
        const avg = Math.round(cleanTotal / effectiveActiveDays);

        return {
          ...row,
          totalUsage: cleanTotal,
          avgUsage: avg
        };
      });

      setUsageRows(rows);
    } catch (err: any) {
      console.error('Gagal mengambil analitik pemakaian:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsageAnalytics();
  }, [daysRange, selectedLocation]);

  const groupedData = useMemo(() => {
    const groups: Record<string, ItemUsageRow[]> = {
      'Bahan Utama & Dapur': [],
      'Kondimen & Pelengkap': [],
      'Minuman & Es': [],
      'Kemasan & Operasional': [],
    };

    usageRows.forEach((row) => {
      const cat = groups[row.category] ? row.category : 'Bahan Utama & Dapur';
      groups[cat].push(row);
    });

    const ordered: { category: string; items: ItemUsageRow[] }[] = [];
    CATEGORY_ORDER.forEach((cat) => {
      if (groups[cat] && groups[cat].length > 0) {
        groups[cat].sort((a, b) => a.itemName.localeCompare(b.itemName));
        ordered.push({ category: cat, items: groups[cat] });
      }
    });

    return ordered;
  }, [usageRows]);

  const formatDateHeader = (dStr: string) => {
    const parts = dStr.split('-');
    if (parts.length === 3) {
      return `TGL ${parts[1]}-${parts[2]}`;
    }
    return dStr;
  };

  const handleExportCSV = () => {
    if (usageRows.length === 0) return;
    const headers = [
      'Kategori',
      'Nama Bahan Baku',
      'Satuan',
      'Sisa Fisik Terakhir',
      ...dateColumns.map((d) => formatDateHeader(d)),
      'Total Terpakai',
      'Rata-rata / Hari'
    ];

    const rows: string[] = [];
    groupedData.forEach(({ category, items }) => {
      items.forEach((item) => {
        const row = [
          `"${category}"`,
          `"${item.itemName}"`,
          `"${item.unit}"`,
          formatQty(item.lastStock),
          ...dateColumns.map((d) => formatQty(item.dailyUsage[d] || 0)),
          formatQty(item.totalUsage),
          item.avgUsage
        ];
        rows.push(row.join(';'));
      });
    });

    const csvContent = [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laporan_Konsumsi_Harian_${daysRange}Hari.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-xs space-y-6 font-sans">
      
      {/* Header Widget */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              Laporan Pemakaian Harian Bahan Baku
            </h2>
            <p className="text-xs font-medium text-slate-400">
              Kuantitas konsumsi riil per tanggal closing • Rata-rata dihitung dari <b>{activeDaysCount} hari aktif</b> closing (dibulatkan).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchUsageAnalytics}
            className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-500"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Rekap (.CSV)</span>
          </button>
        </div>
      </div>

      {/* Filter Kontrol */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
            Bentang Waktu
          </label>
          <div className="inline-flex p-1 bg-slate-100 rounded-2xl">
            {[7, 14, 30].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDaysRange(r)}
                className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${
                  daysRange === r
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r} Hari
              </button>
            ))}
          </div>
        </div>

        {!hideLocationFilter && (
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
              Pilih Cabang Outlet
            </label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
              >
                <option value="all">Semua Outlet (Agregat)</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {cleanLocationName(loc.name)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Tabel Matriks Konsumsi */}
      <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto max-h-[38rem] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 sticky top-0 border-b border-slate-100 z-10 backdrop-blur-xs">
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 min-w-[200px] sticky left-0 bg-slate-50/90 z-20">NAMA BAHAN & KATEGORI</th>
                <th className="py-3 px-3 text-center min-w-[90px]">SISA FISIK TERAKHIR</th>
                {dateColumns.map((d) => (
                  <th key={d} className="py-3 px-3 text-center min-w-[75px]">
                    {formatDateHeader(d)}
                  </th>
                ))}
                <th className="py-3 px-3 text-right min-w-[90px] font-black text-indigo-900 bg-indigo-50/40">
                  TOTAL PAKAI
                </th>
                <th className="py-3 px-4 text-right min-w-[110px] font-black text-emerald-700 bg-emerald-50/60">
                  RATA-RATA / HARI
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={dateColumns.length + 4} className="py-16 text-center text-slate-400 font-bold">
                    Memuat data konsumsi harian...
                  </td>
                </tr>
              ) : groupedData.length === 0 ? (
                <tr>
                  <td colSpan={dateColumns.length + 4} className="py-16 text-center text-slate-400 font-bold">
                    Tidak ada data pemakaian untuk cabang & bentang waktu ini.
                  </td>
                </tr>
              ) : (
                groupedData.map(({ category, items }) => (
                  <React.Fragment key={category}>
                    <tr className="bg-indigo-50/60 border-y border-indigo-100/90">
                      <td 
                        colSpan={dateColumns.length + 4} 
                        className="py-2.5 px-4 font-black text-indigo-900 uppercase tracking-wider text-[11px]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block"></span>
                            <span>{category}</span>
                          </div>
                          <span className="text-[10px] font-bold text-indigo-500 normal-case tracking-normal">
                            {items.length} Bahan Baku Terdaftar
                          </span>
                        </div>
                      </td>
                    </tr>

                    {items.map((row) => (
                      <tr key={row.itemName} className="hover:bg-slate-50/60 transition-colors">
                        {/* Nama Barang */}
                        <td className="py-2.5 px-4 sticky left-0 bg-white hover:bg-slate-50/60 z-10 border-r border-slate-100">
                          <div className="font-extrabold text-slate-900 uppercase leading-tight">
                            {row.itemName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            {row.category}
                          </div>
                        </td>

                        {/* Sisa Fisik Terakhir */}
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                          {formatQty(row.lastStock)}{' '}
                          <span className="text-[10px] text-slate-400 font-normal">{row.unit}</span>
                        </td>

                        {/* Kolom Tanggal: Angka dibatasi maksimal 1 desimal ringkas */}
                        {dateColumns.map((d) => {
                          const val = row.dailyUsage[d] || 0;
                          return (
                            <td 
                              key={d} 
                              className={`py-2.5 px-3 text-center font-bold ${
                                val > 0 ? 'text-slate-800' : 'text-slate-300 font-normal'
                              }`}
                            >
                              {val > 0 ? formatQty(val) : '0.0'}
                            </td>
                          );
                        })}

                        {/* Total Terpakai */}
                        <td className="py-2.5 px-3 text-right font-black text-indigo-900 bg-indigo-50/20">
                          {formatQty(row.totalUsage)}{' '}
                          <span className="text-[10px] text-slate-400 font-normal">{row.unit}</span>
                        </td>

                        {/* Rata-Rata / Hari (Bulat Utuh) */}
                        <td className="py-2.5 px-4 text-right font-black text-emerald-700 bg-emerald-50/40">
                          <span className="text-sm">
                            {row.avgUsage}
                          </span>{' '}
                          <span className="text-[10px] text-emerald-600 font-normal">
                            {row.unit}/hari
                          </span>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}