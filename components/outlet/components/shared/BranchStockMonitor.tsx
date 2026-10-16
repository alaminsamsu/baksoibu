'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Activity, 
  RefreshCw, 
  MapPin, 
  TrendingDown, 
  AlertTriangle, 
  Edit3, 
  Check, 
  X, 
  Search, 
  Layers, 
  Clock, 
  UserCheck,
  Flame,
  ShieldAlert,
  Sparkles
} from 'lucide-react';

interface MovementRow {
  id: string;
  item_name: string;
  category: string;
  location_id: string;
  location_name: string;
  initial_stock: number;
  received_stock: number;
  remaining_stock: number;
  waste_qty: number;
  usage_qty: number;
  unit: string;
  updated_at: string;
  updated_by: string;
}

const CATEGORY_ORDER = [
  'Semua',
  'Bakso & Olahan Frozen',
  'Bahan Dapur & Bumbu',
  'Sayur, Mie & Pelengkap',
  'Minuman & Es',
  'Kemasan & Operasional',
];

// Komponen Analitik Internal (Langsung menyatu agar tidak error import)
function StockUsageAnalyticsView({ data }: { data: MovementRow[] }) {
  const topUsedItems = useMemo(() => {
    return [...data]
      .filter((i) => i.usage_qty > 0)
      .sort((a, b) => b.usage_qty - a.usage_qty)
      .slice(0, 5);
  }, [data]);

  const highWasteItems = useMemo(() => {
    return [...data]
      .filter((i) => i.waste_qty > 0)
      .sort((a, b) => b.waste_qty - a.waste_qty)
      .slice(0, 3);
  }, [data]);

  const lowStockAlerts = useMemo(() => {
    return data.filter(
      (i) => i.remaining_stock <= 3 && (i.initial_stock > 0 || i.received_stock > 0)
    );
  }, [data]);

  const totalUsage = useMemo(() => data.reduce((acc, curr) => acc + curr.usage_qty, 0), [data]);
  const totalWaste = useMemo(() => data.reduce((acc, curr) => acc + curr.waste_qty, 0), [data]);
  const wastePercentage = totalUsage + totalWaste > 0 
    ? ((totalWaste / (totalUsage + totalWaste)) * 100).toFixed(1) 
    : '0.0';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-indigo-600" />
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
          Analisis Pemakaian & Efisiensi Bahan
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Top 5 Pemakaian */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-[#ff6f3c]" />
              <span className="text-xs font-bold text-slate-800">Top Pemakaian Hari Ini</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-[#ff6f3c]">
              Terlaris
            </span>
          </div>

          {topUsedItems.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">Belum ada pemakaian tercatat.</p>
          ) : (
            <div className="space-y-2.5">
              {topUsedItems.map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-700 truncate">{item.item_name}</span>
                  </div>
                  <span className="font-black text-indigo-600 shrink-0 ml-2">
                    {item.usage_qty} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rasio Waste */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-slate-800">Rasio Terbuang (Waste)</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              Number(wastePercentage) > 3 
                ? 'bg-red-50 text-red-600 border border-red-200' 
                : 'bg-emerald-50 text-emerald-600'
            }`}>
              {wastePercentage}%
            </span>
          </div>

          {highWasteItems.length === 0 ? (
            <div className="py-4 text-center">
              <span className="text-xs font-bold text-emerald-600">Zero Waste</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Tidak ada bahan basi/rusak hari ini.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {highWasteItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 truncate">{item.item_name}</span>
                  <span className="font-black text-red-600">
                    -{item.waste_qty} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stok Menipis */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-800">Perlu Restock</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {lowStockAlerts.length} item
            </span>
          </div>

          {lowStockAlerts.length === 0 ? (
            <div className="py-4 text-center">
              <span className="text-xs font-bold text-indigo-600">Stok Aman</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Seluruh sisa fisik aman.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {lowStockAlerts.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100">
                  <div className="truncate min-w-0 pr-2">
                    <div className="font-bold text-slate-800 truncate">{item.item_name}</div>
                    <div className="text-[9px] text-slate-400">{item.location_name}</div>
                  </div>
                  <span className="font-black text-amber-600 shrink-0">
                    Sisa {item.remaining_stock} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BranchStockMonitor() {
  const [dataList, setDataList] = useState<MovementRow[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInitial, setEditInitial] = useState<number>(0);
  const [editRemaining, setEditRemaining] = useState<number>(0);

  const fetchLiveStockMovement = async () => {
    setLoading(true);
    try {
      const { data: locs } = await supabase.from('locations').select('*');
      if (locs) setLocations(locs);

      const { data: masterItems } = await supabase.from('items').select('name, category, uom');
      const itemMetaMap: Record<string, { category: string; uom: string }> = {};
      (masterItems || []).forEach((m) => {
        itemMetaMap[m.name] = {
          category: m.category || 'Lain-lain',
          uom: m.uom || 'Pcs',
        };
      });

      const { data: stocks, error: stockErr } = await supabase
        .from('branch_stocks')
        .select('*, locations(name)')
        .order('item_name');

      if (stockErr) throw stockErr;

      const today = new Date().toISOString().split('T')[0];
      const { data: recData } = await supabase
        .from('receptions')
        .select('item_name, quantity, location_id')
        .gte('created_at', `${today}T00:00:00Z`);

      const { data: closingData } = await supabase
        .from('daily_closings')
        .select('item_name, remaining_stock, waste_qty, location_id, reported_by, created_at')
        .eq('closing_date', today);

      const computed: MovementRow[] = (stocks || []).map((s: any) => {
        const totalReceived = (recData || [])
          .filter((r) => r.location_id === s.location_id && r.item_name === s.item_name)
          .reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);

        const closingRecord = (closingData || []).find(
          (c) => c.location_id === s.location_id && c.item_name === s.item_name
        );

        const init = Number(s.initial_stock || 0);
        const remain = closingRecord !== undefined 
          ? Number(closingRecord.remaining_stock || 0) 
          : Number(s.remaining_stock || 0);

        const waste = closingRecord !== undefined ? Number(closingRecord.waste_qty || 0) : 0;
        const calculatedUsage = (init + totalReceived) - remain - waste;
        const usage = Math.max(0, calculatedUsage);

        return {
          id: s.id,
          item_name: s.item_name,
          category: itemMetaMap[s.item_name]?.category || 'Lain-lain',
          location_id: s.location_id,
          location_name: s.locations?.name || 'Cabang',
          initial_stock: init,
          received_stock: totalReceived,
          remaining_stock: remain,
          waste_qty: waste,
          usage_qty: usage,
          unit: s.unit || itemMetaMap[s.item_name]?.uom || 'Pcs',
          updated_at: closingRecord?.created_at || s.updated_at,
          updated_by: closingRecord?.reported_by || s.updated_by || 'Sistem',
        };
      });

      setDataList(computed);
    } catch (err) {
      console.error('Gagal memuat pergerakan stok:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveStockMovement();
  }, []);

  const handleStartEdit = (row: MovementRow) => {
    setEditingId(row.id);
    setEditInitial(row.initial_stock);
    setEditRemaining(row.remaining_stock);
  };

  const handleSaveEdit = async (row: MovementRow) => {
    try {
      const savedUserStr = localStorage.getItem('baksoibu_active_staff');
      let editorName = 'Petugas';
      if (savedUserStr) {
        try {
          const parsed = JSON.parse(savedUserStr);
          editorName = parsed.active_staff_name || parsed.username || 'Petugas';
        } catch (e) {}
      }

      const { error } = await supabase
        .from('branch_stocks')
        .update({
          initial_stock: editInitial,
          remaining_stock: editRemaining,
          updated_at: new Date().toISOString(),
          updated_by: `${editorName} (Koreksi)`,
        })
        .eq('id', row.id);

      if (error) throw error;
      setEditingId(null);
      fetchLiveStockMovement();
    } catch (err: any) {
      alert('Gagal menyimpan koreksi: ' + err.message);
    }
  };

  const filteredData = useMemo(() => {
    return dataList.filter((item) => {
      const matchLoc = selectedLocation === 'all' || item.location_id === selectedLocation;
      const matchCat = activeCategory === 'Semua' || item.category === activeCategory;
      const matchSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchLoc && matchCat && matchSearch;
    });
  }, [dataList, selectedLocation, activeCategory, searchTerm]);

  const groupedData = useMemo(() => {
    const groups: Record<string, MovementRow[]> = {};
    filteredData.forEach((item) => {
      const cat = item.category || 'Lain-lain';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredData]);

  const totalUsage = useMemo(
    () => filteredData.reduce((acc, curr) => acc + curr.usage_qty, 0),
    [filteredData]
  );
  const totalWaste = useMemo(
    () => filteredData.reduce((acc, curr) => acc + curr.waste_qty, 0),
    [filteredData]
  );

  return (
    <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm shadow-slate-200/50">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-200">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Monitor Pergerakan Stok & Analisa Bahan
            </h2>
            <p className="text-xs font-medium text-slate-400">
              Stok Awal + Masuk - Sisa Fisik (Closing) - Waste = Akumulasi Pemakaian.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <MapPin className="absolute left-3.5 top-3 w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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
            onClick={fetchLiveStockMovement}
            title="Refresh Data"
            className="p-2.5 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-2xl border border-slate-100 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-5 bg-[#fafbfe] border-b border-slate-100">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold">
            <span>Item Dipantau</span>
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <p className="text-xl font-black text-slate-900 mt-1">{filteredData.length}</p>
          <span className="text-[10px] text-slate-400 font-medium">Bahan aktif</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 text-[11px] font-bold">
            <span>Estimasi Terpakai</span>
            <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-xl font-black text-emerald-600 mt-1">{totalUsage.toLocaleString()}</p>
          <span className="text-[10px] text-slate-400 font-medium">Akumulasi pemakaian</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between text-[#ff6f3c] text-[11px] font-bold">
            <span>Total Waste</span>
            <AlertTriangle className="w-3.5 h-3.5 text-[#ff6f3c]" />
          </div>
          <p className="text-xl font-black text-[#ff6f3c] mt-1">{totalWaste.toLocaleString()}</p>
          <span className="text-[10px] text-slate-400 font-medium">Barang basi / sisa</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between text-indigo-600 text-[11px] font-bold">
            <span>Audit Trail</span>
            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <p className="text-xs font-black text-slate-800 mt-2">Pencatatan Otomatis</p>
          <span className="text-[10px] text-slate-400 font-medium">Nama petugas & waktu</span>
        </div>
      </div>

      {/* Kartu Analisa Internal */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/50">
        <StockUsageAnalyticsView data={filteredData} />
      </div>

      <div className="p-5 space-y-3 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari barang di tabel monitor..."
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto max-h-[34rem] overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-50/80 sticky top-0 border-b border-slate-100 z-10 backdrop-blur-sm">
            <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4">Nama Barang & Cabang</th>
              <th className="py-3 px-3 text-right">Stok Awal</th>
              <th className="py-3 px-3 text-right text-emerald-600">+ Masuk</th>
              <th className="py-3 px-3 text-right text-slate-900">Sisa Fisik (Closing)</th>
              <th className="py-3 px-3 text-right text-[#ff6f3c]">Waste</th>
              <th className="py-3 px-3 text-right font-black text-indigo-600 bg-indigo-50/40">Akumulasi Pemakaian</th>
              <th className="py-3 px-3">Petugas & Waktu Input</th>
              <th className="py-3 px-4 text-center">Koreksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                  Menghitung kalkulasi pergerakan stok...
                </td>
              </tr>
            ) : Object.keys(groupedData).length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                  Tidak ada barang yang cocok.
                </td>
              </tr>
            ) : (
              Object.entries(groupedData).map(([groupName, groupList]) => (
                <React.Fragment key={groupName}>
                  <tr className="bg-slate-50/50 border-y border-slate-100">
                    <td colSpan={8} className="py-2.5 px-4 font-black text-slate-700 uppercase tracking-wider text-[11px]">
                      • {groupName} <span className="text-slate-400 font-medium lowercase">({groupList.length} item)</span>
                    </td>
                  </tr>

                  {groupList.map((row) => {
                    const isEditing = editingId === row.id;
                    const formattedDate = row.updated_at 
                      ? new Date(row.updated_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
                      : '-';

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-extrabold text-slate-800">{row.item_name}</div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {row.location_name} • {row.unit}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right font-semibold">
                          {isEditing ? (
                            <input
                              type="number"
                              step="any"
                              value={editInitial}
                              onChange={(e) => setEditInitial(parseFloat(e.target.value) || 0)}
                              className="w-18 px-2 py-1 border border-indigo-500 rounded-xl text-right text-xs font-bold bg-white focus:outline-none ring-2 ring-indigo-500/20"
                            />
                          ) : (
                            <span className="text-slate-700">{row.initial_stock} {row.unit}</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right font-bold text-emerald-600">
                          +{row.received_stock}
                        </td>

                        <td className="py-3 px-3 text-right font-black text-slate-900">
                          {isEditing ? (
                            <input
                              type="number"
                              step="any"
                              value={editRemaining}
                              onChange={(e) => setEditRemaining(parseFloat(e.target.value) || 0)}
                              className="w-18 px-2 py-1 border border-indigo-500 rounded-xl text-right text-xs font-bold bg-white focus:outline-none ring-2 ring-indigo-500/20"
                            />
                          ) : (
                            `${row.remaining_stock} ${row.unit}`
                          )}
                        </td>

                        <td className="py-3 px-3 text-right font-bold text-[#ff6f3c]">
                          {row.waste_qty > 0 ? `-${row.waste_qty}` : '0'}
                        </td>

                        <td className="py-3 px-3 text-right font-black text-indigo-600 bg-indigo-50/40">
                          {row.usage_qty} {row.unit}
                        </td>

                        <td className="py-3 px-3">
                          <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                            <UserCheck className="w-3 h-3 text-emerald-600" />
                            <span>{row.updated_by}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{formattedDate}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleSaveEdit(row)}
                                className="p-1.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-sm transition-all"
                                title="Simpan Koreksi"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
                                title="Batal"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleStartEdit(row)}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                              title="Koreksi Angka"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}