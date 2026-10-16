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
  Search
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

export default function BranchStockMonitor() {
  const [dataList, setDataList] = useState<MovementRow[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [activeCategory, setActiveCategory] = useState<string>('Semua');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // State untuk form koreksi cepat per baris
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInitial, setEditInitial] = useState<number>(0);
  const [editRemaining, setEditRemaining] = useState<number>(0);

  const fetchLiveStockMovement = async () => {
    setLoading(true);
    try {
      // 1. Ambil daftar cabang
      const { data: locs } = await supabase.from('locations').select('*');
      if (locs) setLocations(locs);

      // 2. Ambil master items untuk memetakan kategori
      const { data: masterItems } = await supabase.from('items').select('name, category, uom');
      const itemMetaMap: Record<string, { category: string; uom: string }> = {};
      (masterItems || []).forEach((m) => {
        itemMetaMap[m.name] = {
          category: m.category || 'Lain-lain',
          uom: m.uom || 'Pcs',
        };
      });

      // 3. Ambil data stok cabang
      const { data: stocks, error: stockErr } = await supabase
        .from('branch_stocks')
        .select('*, locations(name)')
        .order('item_name');

      if (stockErr) throw stockErr;

      // 4. Ambil akumulasi penerimaan hari ini
      const today = new Date().toISOString().split('T')[0];
      const { data: recData } = await supabase
        .from('receptions')
        .select('item_name, quantity, location_id')
        .gte('created_at', `${today}T00:00:00Z`);

      // 5. Ambil data waste hari ini
      const { data: closingData } = await supabase
        .from('daily_closings')
        .select('item_name, waste_qty, location_id')
        .eq('closing_date', today);

      const computed: MovementRow[] = (stocks || []).map((s: any) => {
        const totalReceived = (recData || [])
          .filter((r) => r.location_id === s.location_id && r.item_name === s.item_name)
          .reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);

        const waste = (closingData || [])
          .filter((c) => c.location_id === s.location_id && c.item_name === s.item_name)
          .reduce((acc, curr) => acc + Number(curr.waste_qty || 0), 0);

        const init = Number(s.initial_stock || 0);
        const remain = Number(s.remaining_stock || 0);
        const usage = Math.max(0, init + totalReceived - remain - waste);
        const category = itemMetaMap[s.item_name]?.category || 'Lain-lain';

        return {
          id: s.id,
          item_name: s.item_name,
          category,
          location_id: s.location_id,
          location_name: s.locations?.name || 'Cabang',
          initial_stock: init,
          received_stock: totalReceived,
          remaining_stock: remain,
          waste_qty: waste,
          usage_qty: usage,
          unit: s.unit || itemMetaMap[s.item_name]?.uom || 'Pcs',
          updated_at: s.updated_at,
          updated_by: s.updated_by,
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
      const { error } = await supabase
        .from('branch_stocks')
        .update({
          initial_stock: editInitial,
          remaining_stock: editRemaining,
          updated_at: new Date().toISOString(),
          updated_by: 'Admin / Leader (Koreksi)',
        })
        .eq('id', row.id);

      if (error) throw error;
      setEditingId(null);
      fetchLiveStockMovement();
    } catch (err: any) {
      alert('Gagal menyimpan koreksi: ' + err.message);
    }
  };

  // Filter berdasarkan Cabang, Kategori, dan Kata Kunci Pencarian
  const filteredData = useMemo(() => {
    return dataList.filter((d) => {
      const matchLoc = selectedLocation === 'all' || d.location_id === selectedLocation;
      const matchCat = activeCategory === 'Semua' || d.category === activeCategory;
      const matchSearch = d.item_name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchLoc && matchCat && matchSearch;
    });
  }, [dataList, selectedLocation, activeCategory, searchTerm]);

  // Pengelompokan data per grup/kategori untuk header tabel
  const groupedData = useMemo(() => {
    const groups: Record<string, MovementRow[]> = {};
    filteredData.forEach((row) => {
      const cat = row.category || 'Lain-lain';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(row);
    });
    return groups;
  }, [filteredData]);

  // Ringkasan Total Insight
  const totalUsage = useMemo(
    () => filteredData.reduce((acc, curr) => acc + curr.usage_qty, 0),
    [filteredData]
  );
  const totalWaste = useMemo(
    () => filteredData.reduce((acc, curr) => acc + curr.waste_qty, 0),
    [filteredData]
  );

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
      {/* Header & Filter Cabang */}
      <div className="p-5 border-b border-neutral-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-200 text-amber-800">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-800">
              Insight & Monitor Pergerakan Stok Berkelompok
            </h2>
            <p className="text-xs text-neutral-500">
              Pantau pemakaian bahan, barang masuk, waste, dan atur stok awal per grup barang.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <MapPin className="absolute left-3 top-2.5 w-3.5 h-3.5 text-neutral-400" />
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
            className="p-2 text-neutral-600 hover:text-amber-800 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-200 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Ringkasan Insight Angka */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-neutral-50/70 border-b border-neutral-100 text-xs">
        <div className="bg-white p-3 rounded-xl border border-neutral-200">
          <span className="text-neutral-500 text-[11px] font-semibold">Total Item Tampil</span>
          <p className="text-base font-extrabold text-neutral-800 mt-0.5">{filteredData.length} Barang</p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-neutral-200">
          <span className="text-emerald-700 text-[11px] font-semibold flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5" /> Estimasi Total Terpakai
          </span>
          <p className="text-base font-extrabold text-emerald-800 mt-0.5">{totalUsage.toLocaleString()}</p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-neutral-200">
          <span className="text-red-700 text-[11px] font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Total Waste / Rusak
          </span>
          <p className="text-base font-extrabold text-red-700 mt-0.5">{totalWaste.toLocaleString()}</p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-neutral-200">
          <span className="text-amber-800 text-[11px] font-semibold">Koreksi & Stok Awal</span>
          <p className="text-[11px] text-neutral-600 mt-1">Klik ikon pensil untuk ubah stok awal/sisa</p>
        </div>
      </div>

      {/* Pencarian Cepat & Tombol Filter Grup Kategori */}
      <div className="p-4 space-y-3 border-b border-neutral-100">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari barang di monitor (misal: bakso halus, bumbu, plastik, kuah)..."
            className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-amber-900 text-white shadow-sm'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tabel Pergerakan Dikelompokkan Rapi */}
      <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-neutral-100/90 sticky top-0 border-b border-neutral-200 z-10 backdrop-blur-sm">
            <tr className="text-neutral-700 font-bold uppercase tracking-wider">
              <th className="py-2.5 px-3">Cabang & Barang</th>
              <th className="py-2.5 px-2 text-right">Stok Awal</th>
              <th className="py-2.5 px-2 text-right text-emerald-700">+ Masuk</th>
              <th className="py-2.5 px-2 text-right text-neutral-800">Sisa Fisik</th>
              <th className="py-2.5 px-2 text-right text-red-700">Waste</th>
              <th className="py-2.5 px-2 text-right font-extrabold text-amber-900 bg-amber-50/60">Pemakaian</th>
              <th className="py-2.5 px-3 text-center">Aksi / Koreksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 text-neutral-700">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-neutral-400">
                  Menghitung pergerakan stok per grup...
                </td>
              </tr>
            ) : Object.keys(groupedData).length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-neutral-400">
                  Tidak ada data barang yang sesuai filter.
                </td>
              </tr>
            ) : (
              Object.entries(groupedData).map(([groupName, rows]) => (
                <React.Fragment key={groupName}>
                  {/* Baris Pemisah Header Grup */}
                  <tr className="bg-amber-50/80 border-y border-amber-200/70">
                    <td colSpan={7} className="py-2 px-3 font-bold text-amber-900 uppercase tracking-wider text-[11px]">
                      📁 {groupName} ({rows.length} Barang)
                    </td>
                  </tr>

                  {/* Daftar Barang dalam Grup */}
                  {rows.map((row) => {
                    const isEditing = editingId === row.id;

                    return (
                      <tr key={row.id} className="hover:bg-neutral-50/70 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-neutral-800">{row.item_name}</div>
                          <div className="text-[10px] text-neutral-400 font-medium">
                            {row.location_name} • Satuan: {row.unit}
                          </div>
                        </td>

                        {/* Stok Awal (Bisa Diisi/Diedit) */}
                        <td className="py-2.5 px-2 text-right font-medium">
                          {isEditing ? (
                            <input
                              type="number"
                              step="any"
                              value={editInitial}
                              onChange={(e) => setEditInitial(parseFloat(e.target.value) || 0)}
                              className="w-16 px-1.5 py-0.5 border border-amber-500 rounded text-right text-xs font-bold bg-amber-50"
                            />
                          ) : (
                            <span className="font-semibold text-neutral-700">
                              {row.initial_stock} {row.unit}
                            </span>
                          )}
                        </td>

                        {/* Masuk */}
                        <td className="py-2.5 px-2 text-right font-semibold text-emerald-700">
                          +{row.received_stock}
                        </td>

                        {/* Sisa Fisik (Bisa Diedit jika ada koreksi) */}
                        <td className="py-2.5 px-2 text-right font-bold text-neutral-900">
                          {isEditing ? (
                            <input
                              type="number"
                              step="any"
                              value={editRemaining}
                              onChange={(e) => setEditRemaining(parseFloat(e.target.value) || 0)}
                              className="w-16 px-1.5 py-0.5 border border-amber-500 rounded text-right text-xs font-bold bg-amber-50"
                            />
                          ) : (
                            `${row.remaining_stock} ${row.unit}`
                          )}
                        </td>

                        {/* Waste */}
                        <td className="py-2.5 px-2 text-right font-semibold text-red-600">
                          {row.waste_qty > 0 ? `-${row.waste_qty}` :Berikut pembaruan komponen **`BranchStockMonitor.tsx`** yang sudah dikelompokkan berdasarkan **5 kategori barang** (Bakso & Olahan Frozen, Bahan Dapur & Bumbu, Sayur/Mie/Pelengkap, Minuman & Es, Kemasan & Operasional) lengkap dengan **fitur input stok awal langsung per baris**.

Buka file **`components/outlet/components/shared/BranchStockMonitor.tsx`**, hapus seluruh isinya, dan tempel kode utuh berikut:

```tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Activity, RefreshCw, MapPin, TrendingDown, AlertTriangle, Edit3, Check, X, Search } from 'lucide-react';

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

export default function BranchStockMonitor() {
  const [dataList, setDataList] = useState<MovementRow[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // State untuk form edit cepat
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInitial, setEditInitial] = useState<number>(0);
  const [editRemaining, setEditRemaining] = useState<number>(0);

  const fetchLiveStockMovement = async () => {
    setLoading(true);
    try {
      const { data: locs } = await supabase.from('locations').select('*');
      if (locs) setLocations(locs);

      // Ambil master item untuk referensi kategori
      const { data: masterItems } = await supabase.from('items').select('name, category');
      const categoryMap: Record<string, string> = {};
      (masterItems || []).forEach((m) => {
        categoryMap[m.name] = m.category || 'Lain-lain';
      });

      // Ambil data branch_stocks
      const { data: stocks, error: stockErr } = await supabase
        .from('branch_stocks')
        .select('*, locations(name)')
        .order('item_name');

      if (stockErr) throw stockErr;

      // Ambil penerimaan hari ini
      const today = new Date().toISOString().split('T')[0];
      const { data: recData } = await supabase
        .from('receptions')
        .select('item_name, quantity, location_id')
        .gte('created_at', `${today}T00:00:00Z`);

      // Ambil waste hari ini
      const { data: closingData } = await supabase
        .from('daily_closings')
        .select('item_name, waste_qty, location_id')
        .eq('closing_date', today);

      const computed: MovementRow[] = (stocks || []).map((s: any) => {
        const totalReceived = (recData || [])
          .filter((r) => r.location_id === s.location_id && r.item_name === s.item_name)
          .reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);

        const waste = (closingData || [])
          .filter((c) => c.location_id === s.location_id && c.item_name === s.item_name)
          .reduce((acc, curr) => acc + Number(curr.waste_qty || 0), 0);

        const init = Number(s.initial_stock || 0);
        const remain = Number(s.remaining_stock || 0);
        const usage = Math.max(0, init + totalReceived - remain - waste);

        return {
          id: s.id,
          item_name: s.item_name,
          category: categoryMap[s.item_name] || 'Lain-lain',
          location_id: s.location_id,
          location_name: s.locations?.name || 'Cabang',
          initial_stock: init,
          received_stock: totalReceived,
          remaining_stock: remain,
          waste_qty: waste,
          usage_qty: usage,
          unit: s.unit || 'Pcs',
          updated_at: s.updated_at,
          updated_by: s.updated_by,
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
      const { error } = await supabase
        .from('branch_stocks')
        .update({
          initial_stock: editInitial,
          remaining_stock: editRemaining,
          updated_at: new Date().toISOString(),
          updated_by: 'Leader / Admin (Koreksi)',
        })
        .eq('id', row.id);

      if (error) throw error;
      setEditingId(null);
      fetchLiveStockMovement();
    } catch (err: any) {
      alert('Gagal menyimpan koreksi: ' + err.message);
    }
  };

  // Filter berdasarkan cabang, kategori, dan pencarian
  const filteredData = useMemo(() => {
    return dataList.filter((item) => {
      const matchLoc = selectedLocation === 'all' || item.location_id === selectedLocation;
      const matchCat = activeCategory === 'Semua' || item.category === activeCategory;
      const matchSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchLoc && matchCat && matchSearch;
    });
  }, [dataList, selectedLocation, activeCategory, searchTerm]);

  // Kelompokkan per grup kategori
  const groupedData = useMemo(() => {
    const groups: Record<string, MovementRow[]> = {};
    filteredData.forEach((item) => {
      const cat = item.category || 'Lain-lain';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredData]);

  const totalUsage = filteredData.reduce((acc, curr) => acc + curr.usage_qty, 0);
  const totalWaste = filteredData.reduce((acc, curr) => acc + curr.waste_qty, 0);

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
      {/* Header & Filter Cabang */}
      <div className="p-5 border-b border-neutral-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-200 text-amber-800">
            <Activity className="w-5 h-5"/>
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-800">
              Insight & Monitor Pergerakan Stok Harian
            </h2>
            <p className="text-xs text-neutral-500">
              Pantau pemakaian bahan, barang masuk, waste, serta atur stok awal dan koreksi sisa fisik per grup.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <MapPin className="absolute left-3 top-2.5 w-3.5 h-3.5 text-neutral-400"/>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
            className="p-2 text-neutral-600 hover:text-amber-800 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-200 transition-colors"
          >
            <RefreshCw ${loading ''}`} 'animate-spin' : ? className="{`w-4" h-4/>
          </button>
        </div>
      </div>

      {/* Ringkasan Insight */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-neutral-50/70 border-b border-neutral-100 text-xs">
        <div className="bg-white p-3 rounded-xl border border-neutral-200">
          <span className="text-neutral-500 text-[11px] font-semibold">Total Item Dipantau</span>
          <p className="text-base font-extrabold text-neutral-800 mt-0.5">{filteredData.length} Barang</p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-neutral-200">
          <span className="text-emerald-700 text-[11px] font-semibold flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5"/> Total Estimasi Pemakaian
          </span>
          <p className="text-base font-extrabold text-emerald-800 mt-0.5">{totalUsage.toLocaleString()}</p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-neutral-200">
          <span className="text-red-700 text-[11px] font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5"/> Total Waste / Basi
          </span>
          <p className="text-base font-extrabold text-red-700 mt-0.5">{totalWaste.toLocaleString()}</p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-neutral-200">
          <span className="text-amber-800 text-[11px] font-semibold">Atur Stok Awal</span>
          <p className="text-[11px] text-neutral-600 mt-1">Klik ikon pensil di tiap baris barang</p>
        </div>
      </div>

      {/* Filter Pencarian & Tab Grup Kategori */}
      <div className="p-4 space-y-3 border-b border-neutral-100 bg-white">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400"/>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama barang di tabel monitor..."
            className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-amber-900 text-white shadow-sm'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tabel Pergerakan Stok Berkelompok */}
      <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-neutral-100/90 sticky top-0 border-b border-neutral-200 z-10 backdrop-blur-sm">
            <tr className="text-neutral-700 font-bold uppercase tracking-wider">
              <th className="py-3 px-3">Barang & Cabang</th>
              <th className="py-3 px-2 text-right">Stok Awal</th>
              <th className="py-3 px-2 text-right text-emerald-700">+ Masuk</th>
              <th className="py-3 px-2 text-right text-neutral-800">Sisa Fisik</th>
              <th className="py-3 px-2 text-right text-red-700">Waste</th>
              <th className="py-3 px-2 text-right font-extrabold text-amber-900 bg-amber-50/50">Pemakaian</th>
              <th className="py-3 px-3 text-center">Atur / Revisi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 text-neutral-700">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-neutral-400">
                  Menghitung pergerakan stok per kategori...
                </td>
              </tr>
            ) : Object.keys(groupedData).length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-neutral-400">
                  Tidak ada barang yang sesuai.
                </td>
              </tr>
            ) : (
              Object.entries(groupedData).map(([groupName, groupList]) => (
                <React.Fragment key="{groupName}">
                  {/* Pemisah Grup */}
                  <tr className="bg-amber-50/80 border-y border-amber-200/70">
                    <td colSpan={7} className="py-1.5 px-3 font-bold text-amber-950 uppercase tracking-wider text-[11px]">
                      📁 {groupName} ({groupList.length} item)
                    </td>
                  </tr>

                  {/* Baris Barang */}
                  {groupList.map((row) => {
                    const isEditing = editingId === row.id;

                    return (
                      <tr key={row.id} className="hover:bg-neutral-50/70 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-neutral-800">{row.item_name}</div>
                          <div className="text-[10px] text-neutral-400 font-medium">
                            {row.location_name} • Satuan: {row.unit}
                          </div>
                        </td>

                        {/* Stok Awal */}
                        <td className="py-2.5 px-2 text-right font-medium">
                          {isEditing ? (
                            <input
                              type="number"
                              step="any"
                              value={editInitial}
                              onChange={(e) => setEditInitial(parseFloat(e.target.value) || 0)}
                              className="w-16 px-1.5 py-0.5 border border-amber-500 rounded text-right text-xs font-bold"
                            />
                          ) : (
                            `${row.initial_stock} ${row.unit}`
                          )}
                        </td>

                        {/* Barang Masuk */}
                        <td className="py-2.5 px-2 text-right font-semibold text-emerald-700">
                          +{row.received_stock}
                        </td>

                        {/* Sisa Fisik */}
                        <td className="py-2.5 px-2 text-right font-bold text-neutral-900">
                          {isEditing ? (
                            <input
                              type="number"
                              step="any"
                              value={editRemaining}
                              onChange={(e) => setEditRemaining(parseFloat(e.target.value) || 0)}
                              className="w-16 px-1.5 py-0.5 border border-amber-500 rounded text-right text-xs font-bold"
                            />
                          ) : (
                            `${row.remaining_stock} ${row.unit}`
                          )}
                        </td>

                        {/* Waste */}
                        <td className="py-2.5 px-2 text-right font-semibold text-red-600">
                          {row.waste_qty > 0 ? `-${row.waste_qty}` : '0'}
                        </td>

                        {/* Pemakaian Riil */}
                        <td className="py-2.5 px-2 text-right font-extrabold text-amber-950 bg-amber-50/50">
                          {row.usage_qty} {row.unit}
                        </td>

                        {/* Tombol Aksi */}
                        <td className="py-2.5 px-3 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleSaveEdit(row)}
                                className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 shadow-sm"
                                title="Simpan Stok Awal & Sisa"
                              >
                                <Check className="w-3.5 h-3.5"/>
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1 bg-neutral-200 text-neutral-600 rounded hover:bg-neutral-300"
                                title="Batal"
                              >
                                <X className="w-3.5 h-3.5"/>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleStartEdit(row)}
                              className="p-1.5 text-neutral-400 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Input Stok Awal / Koreksi"
                            >
                              <Edit3 className="w-3.5 h-3.5"/>
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