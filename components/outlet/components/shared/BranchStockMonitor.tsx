'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Activity, 
  RefreshCw, 
  MapPin, 
  Edit3, 
  Check, 
  X, 
  Search, 
  Layers, 
  Clock, 
  UserCheck, 
  Lock,
  Calendar,
  AlertTriangle,
  TrendingDown
} from 'lucide-react';

interface RowItem {
  id: string;
  item_name: string;
  category: string;
  location_id: string;
  location_name: string;
  stok_awal: number;
  stok_masuk: number;
  terpakai: number;
  waste_qty: number;
  current_stock: number;
  unit: string;
  reported_by?: string;
  updated_at?: string;
}

const CATEGORY_ORDER = [
  'Bahan Utama & Dapur',
  'Kondimen & Pelengkap',
  'Minuman & Es',
  'Kemasan & Operasional'
];

export default function BranchStockMonitor() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [dataList, setDataList] = useState<RowItem[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Metrik Waste Bulanan
  const [monthlyWasteStats, setMonthlyWasteStats] = useState<{
    wasteQty: number;
    usedQty: number;
    wasteRate: number;
  }>({ wasteQty: 0, usedQty: 0, wasteRate: 0 });

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());
  });

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editInitial, setEditInitial] = useState<number>(0);
  const [editReceived, setEditReceived] = useState<number>(0);
  const [editUsage, setEditUsage] = useState<number>(0);
  const [editWaste, setEditWaste] = useState<number>(0);

  useEffect(() => {
    const saved = localStorage.getItem('baksoibu_active_staff');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setCurrentUser(u);
        if (u.location_id && (u.role === 'LEADER' || u.role === 'CREW' || u.role === 'KASIR')) {
          setSelectedLocation(String(u.location_id));
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const isLeader = currentUser?.role === 'LEADER';
  const isAdmin = currentUser?.role === 'ADMIN';
  const isOwner = currentUser?.role === 'OWNER';
  const isCrew = currentUser?.role === 'CREW' || currentUser?.role === 'KASIR';
  const canEdit = isLeader || isAdmin || isOwner;

  const cleanName = (name?: string) => {
    return (name || '').trim().toUpperCase().replace(/\s+/g, ' ');
  };

  // Normalisasi Kategori Identik dengan Laporan Pemakaian Harian
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

  const fetchLiveStockMovement = async () => {
    setLoading(true);
    try {
      const { data: locData } = await supabase.from('locations').select('id, name');
      if (locData) setLocations(locData);

      const { data: masterItems } = await supabase.from('items').select('name, category');

      let branchQuery = supabase.from('branch_stocks').select('*, locations(name)').limit(2000);
      if ((isLeader || isCrew) && currentUser?.location_id) {
        branchQuery = branchQuery.eq('location_id', currentUser.location_id);
      } else if (selectedLocation !== 'all') {
        branchQuery = branchQuery.eq('location_id', selectedLocation);
      }

      const { data: stocks, error: stockErr } = await branchQuery;
      if (stockErr) throw stockErr;

      const currDateObj = new Date(selectedDate + 'T00:00:00');
      const prevDateObj = new Date(currDateObj);
      prevDateObj.setDate(prevDateObj.getDate() - 1);
      const yesterdayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(prevDateObj);

      const { data: yesterdayClosings } = await supabase
        .from('daily_closings')
        .select('item_name, remaining_stock, location_id')
        .eq('closing_date', yesterdayStr)
        .limit(2000);

      const { data: moveData } = await supabase
        .from('stock_movements')
        .select('item_name, quantity, location_id, created_at, movement_type')
        .limit(3000);

      const todayMoves = (moveData || []).filter((m) => {
        if (!m.created_at) return false;
        const isMasuk = m.movement_type === 'MASUK' || m.movement_type === 'IN';
        if (!isMasuk) return false;
        const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date(m.created_at));
        return dStr === selectedDate;
      });

      const { data: todayClosings } = await supabase
        .from('daily_closings')
        .select('*')
        .eq('closing_date', selectedDate)
        .limit(2000);

      // Hitung waste bulanan
      const activeYearMonth = selectedDate.substring(0, 7);
      let monthlyQuery = supabase
        .from('daily_closings')
        .select('waste_qty, terpakai, location_id')
        .gte('closing_date', `${activeYearMonth}-01`)
        .lte('closing_date', `${activeYearMonth}-31`)
        .limit(5000);

      if ((isLeader || isCrew) && currentUser?.location_id) {
        monthlyQuery = monthlyQuery.eq('location_id', currentUser.location_id);
      } else if (selectedLocation !== 'all') {
        monthlyQuery = monthlyQuery.eq('location_id', selectedLocation);
      }

      const { data: monthData } = await monthlyQuery;
      if (monthData) {
        const totalMonthWaste = monthData.reduce((sum, d) => sum + Number(d.waste_qty || 0), 0);
        const totalMonthUsed = monthData.reduce((sum, d) => sum + Number(d.terpakai || 0), 0);
        const baseMovement = totalMonthUsed + totalMonthWaste;
        const wasteRate = baseMovement > 0 ? (totalMonthWaste / baseMovement) * 100 : 0;

        setMonthlyWasteStats({
          wasteQty: totalMonthWaste,
          usedQty: totalMonthUsed,
          wasteRate: parseFloat(wasteRate.toFixed(2)),
        });
      }

      const rows: RowItem[] = (stocks || []).map((s: any) => {
        const normalizedName = cleanName(s.item_name);

        const itemMeta = masterItems?.find((i) => cleanName(i.name) === normalizedName);
        const category = normalizeCategory(s.category || itemMeta?.category, s.item_name);

        const yest = (yesterdayClosings || []).find(
          (y) => String(y.location_id) === String(s.location_id) && cleanName(y.item_name) === normalizedName
        );
        const awal = yest ? Number(yest.remaining_stock || 0) : Number(s.initial_stock || 0);

        const masuk = todayMoves
          .filter((m) => String(m.location_id) === String(s.location_id) && cleanName(m.item_name) === normalizedName)
          .reduce((sum, curr) => sum + Number(curr.quantity || 0), 0);

        const closed = (todayClosings || []).find(
          (c) => String(c.location_id) === String(s.location_id) && cleanName(c.item_name) === normalizedName
        );

        const waste = closed ? Number(closed.waste_qty || 0) : 0;
        const terpakai = closed ? Number(closed.terpakai || 0) : 0;
        const sisaAkhir = closed ? Number(closed.remaining_stock || 0) : (awal + masuk);

        return {
          id: s.id,
          item_name: normalizedName,
          category,
          location_id: s.location_id,
          location_name: s.locations?.name || 'Outlet',
          stok_awal: awal,
          stok_masuk: masuk,
          terpakai: terpakai,
          waste_qty: waste,
          current_stock: sisaAkhir,
          unit: s.unit || 'Pcs',
          reported_by: closed?.reported_by || s.last_updated_by || s.updated_by || 'Sistem',
          updated_at: closed?.created_at || s.last_updated || s.updated_at,
        };
      });

      setDataList(rows);
    } catch (err: any) {
      console.error('Error load movement:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveStockMovement();
  }, [selectedDate, selectedLocation, currentUser]);

  const handleStartEdit = (row: RowItem) => {
    if (!canEdit) {
      alert('Hanya Leader atau Owner yang berhak mengoreksi stok.');
      return;
    }
    setEditingKey(row.id);
    setEditInitial(row.stok_awal);
    setEditReceived(row.stok_masuk);
    setEditUsage(row.terpakai);
    setEditWaste(row.waste_qty);
  };

  const handleSaveEdit = async (row: RowItem) => {
    try {
      const editorName = currentUser?.active_staff_name || currentUser?.username || 'Leader';
      const calculatedEnd = Math.max(0, (editInitial + editReceived) - editUsage - editWaste);
      const nowIso = new Date().toISOString();

      await supabase
        .from('daily_closings')
        .upsert({
          location_id: row.location_id,
          closing_date: selectedDate,
          item_name: row.item_name,
          category: row.category,
          stok_awal: editInitial,
          stok_masuk: editReceived,
          terpakai: editUsage,
          waste_qty: editWaste,
          remaining_stock: calculatedEnd,
          unit: row.unit,
          reported_by: `${editorName} (Koreksi)`,
          is_locked: false,
          corrected_by: editorName,
          corrected_at: nowIso,
          created_at: nowIso,
        }, { onConflict: 'location_id,closing_date,item_name' });

      await supabase
        .from('branch_stocks')
        .upsert({
          location_id: row.location_id,
          item_name: row.item_name,
          remaining_stock: calculatedEnd,
          unit: row.unit,
          category: row.category,
          last_updated: nowIso,
          last_updated_by: `${editorName} (Koreksi)`,
        }, { onConflict: 'location_id,item_name' });

      setEditingKey(null);
      await fetchLiveStockMovement();
    } catch (err: any) {
      alert('Gagal simpan koreksi: ' + err.message);
    }
  };

  const filteredData = useMemo(() => {
    return dataList.filter((item) => {
      const matchSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = selectedCategory === 'Semua' || item.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [dataList, searchTerm, selectedCategory]);

  // Urutkan per kategori dan nama item A-Z
  const groupedData = useMemo(() => {
    const groups: Record<string, RowItem[]> = {
      'Bahan Utama & Dapur': [],
      'Kondimen & Pelengkap': [],
      'Minuman & Es': [],
      'Kemasan & Operasional': [],
    };

    filteredData.forEach((item) => {
      const cat = groups[item.category] ? item.category : 'Bahan Utama & Dapur';
      groups[cat].push(item);
    });

    const ordered: { category: string; items: RowItem[] }[] = [];
    CATEGORY_ORDER.forEach((cat) => {
      if (groups[cat] && groups[cat].length > 0) {
        // Urutkan A-Z
        groups[cat].sort((a, b) => a.item_name.localeCompare(b.item_name));
        ordered.push({ category: cat, items: groups[cat] });
      }
    });

    return ordered;
  }, [filteredData]);

  const formatDateTimeWita = (isoString?: string) => {
    if (!isoString) return { dateStr: '-', timeStr: '' };
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return { dateStr: '-', timeStr: '' };

    const dateStr = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Makassar',
      day: 'numeric',
      month: 'short',
    }).format(date);

    const timeStr = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Makassar',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date) + ' WITA';

    return { dateStr, timeStr };
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-xs font-sans">
      <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Monitor Pergerakan Stok Cabang
            </h2>
            <p className="text-xs font-medium text-slate-400">
              (Stok Awal + Masuk) - Terpakai - Waste = <b>Stok Akhir</b>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <div className="relative flex items-center">
            <Calendar className="absolute left-3 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none"
            />
          </div>

          {(isLeader || isCrew) ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600">
              <Lock className="w-3.5 h-3.5 text-indigo-600" />
              <span>{currentUser?.location_name || 'Outlet'}</span>
            </div>
          ) : (
            <div className="relative flex-1 sm:w-48">
              <MapPin className="absolute left-3.5 top-3 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="all">Semua Cabang</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    Outlet {loc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={fetchLiveStockMovement}
            title="Segarkan Data"
            className="p-2.5 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-2xl border border-slate-100 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* METRIK HEADER: ITEM DIPANTAU & PERSENTASE WASTE BULANAN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-5 bg-[#fafbfe] border-b border-slate-100">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold">
              <span>Item Dipantau</span>
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-1">{filteredData.length}</p>
            <span className="text-[10px] text-slate-400 font-semibold">Master bahan baku outlet terdaftar</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-amber-600 text-[11px] font-bold">
              <span>Persentase Waste Bulanan</span>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <p className={`text-2xl font-black ${monthlyWasteStats.wasteRate > 3 ? 'text-rose-600' : 'text-amber-600'}`}>
                {monthlyWasteStats.wasteRate}%
              </p>
              <span className="text-[11px] font-bold text-slate-400">
                ({monthlyWasteStats.wasteQty.toLocaleString()} qty terbuang)
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold">
              Akumulasi bulan {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(selectedDate))}
            </span>
          </div>

          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${monthlyWasteStats.wasteRate > 3 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* FILTER SEARCH & KATEGORI */}
      <div className="p-4 border-b border-slate-100 space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama barang..."
            className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {['Semua', ...CATEGORY_ORDER].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* TABEL STOK DENGAN HEADER KATEGORI */}
      <div className="overflow-x-auto max-h-[34rem] overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-50/90 sticky top-0 border-b border-slate-100 z-10 backdrop-blur-xs">
            <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4 min-w-[200px]">Nama Barang & Cabang</th>
              <th className="py-3 px-3 text-right min-w-[90px]">Stok Awal</th>
              <th className="py-3 px-3 text-right text-emerald-600 min-w-[85px]">+ Masuk</th>
              <th className="py-3 px-3 text-right text-indigo-600 min-w-[85px]">- Terpakai</th>
              <th className="py-3 px-3 text-right text-amber-600 min-w-[85px]">- Waste</th>
              <th className="py-3 px-3 text-right font-black text-slate-900 bg-amber-50/80 min-w-[100px]">= Stok Akhir</th>
              <th className="py-3 px-4 text-right min-w-[140px]">Terakhir Update</th>
              {canEdit && <th className="py-3 px-4 text-center min-w-[80px]">Koreksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
            {loading ? (
              <tr>
                <td colSpan={canEdit ? 8 : 7} className="py-12 text-center text-slate-400 font-bold">
                  Memuat data pergerakan stok...
                </td>
              </tr>
            ) : groupedData.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 8 : 7} className="py-12 text-center text-slate-400 font-bold">
                  Tidak ada barang yang cocok.
                </td>
              </tr>
            ) : (
              groupedData.map(({ category, items }) => (
                <React.Fragment key={category}>
                  {/* SEKAT HEADER KATEGORI (Identik dengan Laporan Pemakaian) */}
                  <tr className="bg-indigo-50/60 border-y border-indigo-100/90">
                    <td colSpan={canEdit ? 8 : 7} className="py-2.5 px-4 font-black text-indigo-900 uppercase tracking-wider text-[11px]">
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

                  {items.map((row) => {
                    const isEditing = editingKey === row.id;
                    const previewEnd = Math.max(0, (editInitial + editReceived) - editUsage - editWaste);
                    const { dateStr, timeStr } = formatDateTimeWita(row.updated_at);

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-extrabold text-slate-900 uppercase leading-tight">{row.item_name}</div>
                          <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            {row.location_name} • {row.unit}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right font-bold text-slate-700">
                          {isEditing ? (
                            <input
                              type="number"
                              step="any"
                              value={editInitial}
                              onChange={(e) => setEditInitial(parseFloat(e.target.value) || 0)}
                              className="w-16 px-1.5 py-1 border border-indigo-500 rounded-lg text-right text-xs font-bold bg-white focus:outline-none"
                            />
                          ) : (
                            `${row.stok_awal} ${row.unit}`
                          )}
                        </td>

                        <td className="py-3 px-3 text-right font-black text-emerald-600">
                          {isEditing ? (
                            <input
                              type="number"
                              step="any"
                              value={editReceived}
                              onChange={(e) => setEditReceived(parseFloat(e.target.value) || 0)}
                              className="w-16 px-1.5 py-1 border border-emerald-500 rounded-lg text-right text-xs font-bold bg-white text-emerald-600 focus:outline-none"
                            />
                          ) : (
                            row.stok_masuk > 0 ? `+${row.stok_masuk}` : '0'
                          )}
                        </td>

                        <td className="py-3 px-3 text-right font-black text-indigo-600">
                          {isEditing ? (
                            <input
                              type="number"
                              step="any"
                              value={editUsage}
                              onChange={(e) => setEditUsage(parseFloat(e.target.value) || 0)}
                              className="w-16 px-1.5 py-1 border border-indigo-500 rounded-lg text-right text-xs font-bold bg-white text-indigo-600 focus:outline-none"
                            />
                          ) : (
                            row.terpakai > 0 ? `-${row.terpakai}` : '0'
                          )}
                        </td>

                        <td className="py-3 px-3 text-right font-bold text-amber-600">
                          {isEditing ? (
                            <input
                              type="number"
                              step="any"
                              value={editWaste}
                              onChange={(e) => setEditWaste(parseFloat(e.target.value) || 0)}
                              className="w-16 px-1.5 py-1 border border-amber-500 rounded-lg text-right text-xs font-bold bg-white text-amber-600 focus:outline-none"
                            />
                          ) : (
                            row.waste_qty > 0 ? `-${row.waste_qty}` : '0'
                          )}
                        </td>

                        <td className="py-3 px-3 text-right font-black text-slate-900 bg-amber-50/80">
                          <span className="text-sm font-black text-slate-900">
                            {isEditing ? previewEnd.toFixed(1) : row.current_stock.toFixed(1)}{' '}
                            <span className="text-[10px] font-bold text-slate-500">{row.unit}</span>
                          </span>
                        </td>

                        {/* KOLOM TERAKHIR UPDATE */}
                        <td className="py-3 px-4 text-right">
                          <div className="font-black text-slate-800 text-[11px] flex items-center justify-end gap-1">
                            <UserCheck className="w-3 h-3 text-indigo-600" />
                            <span>{row.reported_by || 'Sistem'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{dateStr} • {timeStr}</span>
                          </div>
                        </td>

                        {canEdit && (
                          <td className="py-3 px-4 text-center">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleSaveEdit(row)}
                                  className="p-1.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-xs transition-all"
                                  title="Simpan Koreksi"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingKey(null)}
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
                                title="Koreksi Data"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        )}
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