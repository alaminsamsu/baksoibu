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
  Lock,
  Calendar
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
  is_closed: boolean;
  updated_at?: string;
}

const CATEGORY_ORDER = [
  'Bakso & Olahan Frozen',
  'Bahan Dapur & Bumbu',
  'Sayur, Mie & Pelengkap',
  'Minuman & Es',
  'Kemasan & Operasional',
  'Lain-lain'
];

export default function BranchStockMonitor() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [dataList, setDataList] = useState<RowItem[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

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

  const fetchLiveStockMovement = async () => {
    setLoading(true);
    try {
      const { data: locData } = await supabase.from('locations').select('id, name');
      if (locData) setLocations(locData);

      const { data: masterItems } = await supabase.from('items').select('name, category');

      let branchQuery = supabase.from('branch_stocks').select('*, locations(name)');
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
        .eq('closing_date', yesterdayStr);

      const { data: moveData } = await supabase
        .from('stock_movements')
        .select('item_name, quantity, location_id, created_at, movement_type');

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
        .eq('closing_date', selectedDate);

      const rows: RowItem[] = (stocks || []).map((s: any) => {
        const cleanName = s.item_name.trim().toLowerCase();

        const itemMeta = masterItems?.find((i) => i.name.trim().toLowerCase() === cleanName);
        const category = s.category || itemMeta?.category || 'Lain-lain';

        const yest = (yesterdayClosings || []).find(
          (y) => String(y.location_id) === String(s.location_id) && y.item_name.trim().toLowerCase() === cleanName
        );
        const awal = yest ? Number(yest.remaining_stock || 0) : Number(s.initial_stock || 0);

        const masuk = todayMoves
          .filter((m) => String(m.location_id) === String(s.location_id) && m.item_name.trim().toLowerCase() === cleanName)
          .reduce((sum, curr) => sum + Number(curr.quantity || 0), 0);

        const closed = (todayClosings || []).find(
          (c) => String(c.location_id) === String(s.location_id) && c.item_name.trim().toLowerCase() === cleanName
        );

        const isClosed = !!closed;
        const waste = closed ? Number(closed.waste_qty || 0) : 0;
        const terpakai = closed ? Number(closed.terpakai || 0) : 0;
        const sisaAkhir = closed ? Number(closed.remaining_stock || 0) : (awal + masuk);

        return {
          id: s.id,
          item_name: s.item_name,
          category,
          location_id: s.location_id,
          location_name: s.locations?.name || 'Outlet',
          stok_awal: awal,
          stok_masuk: masuk,
          terpakai: terpakai,
          waste_qty: waste,
          current_stock: sisaAkhir,
          unit: s.unit || 'porsi',
          reported_by: closed?.reported_by || s.last_updated_by || 'Sistem',
          is_closed: isClosed,
          updated_at: closed?.created_at || s.last_updated,
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
          is_locked: true,
          corrected_by: editorName,
          corrected_at: new Date().toISOString(),
        }, { onConflict: 'location_id,closing_date,item_name' });

      await supabase
        .from('branch_stocks')
        .upsert({
          location_id: row.location_id,
          item_name: row.item_name,
          remaining_stock: calculatedEnd,
          unit: row.unit,
          last_updated: new Date().toISOString(),
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

  const groupedData = useMemo(() => {
    const groups: Record<string, RowItem[]> = {};
    filteredData.forEach((item) => {
      const cat = item.category || 'Lain-lain';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });

    const ordered: { category: string; items: RowItem[] }[] = [];
    CATEGORY_ORDER.forEach((cat) => {
      if (groups[cat] && groups[cat].length > 0) {
        ordered.push({ category: cat, items: groups[cat] });
        delete groups[cat];
      }
    });

    Object.keys(groups).forEach((cat) => {
      if (groups[cat].length > 0) {
        ordered.push({ category: cat, items: groups[cat] });
      }
    });

    return ordered;
  }, [filteredData]);

  const totalMasuk = useMemo(() => filteredData.reduce((acc, curr) => acc + curr.stok_masuk, 0), [filteredData]);
  const totalTerpakai = useMemo(() => filteredData.reduce((acc, curr) => acc + curr.terpakai, 0), [filteredData]);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-xs">
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
              <MapPin className="absolute left-3.5 top-3 w-3.5 h-3.5 text-slate-400" />
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-5 bg-[#fafbfe] border-b border-slate-100">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold">
            <span>Item Dipantau</span>
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <p className="text-xl font-black text-slate-900 mt-1">{filteredData.length}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 text-[11px] font-bold">
            <span>Total Masuk Hari Ini</span>
            <span className="text-xs font-black text-emerald-600">+ Realtime</span>
          </div>
          <p className="text-xl font-black text-emerald-600 mt-1">+{totalMasuk.toLocaleString()}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between text-indigo-600 text-[11px] font-bold">
            <span>Total Terpakai</span>
            <TrendingDown className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <p className="text-xl font-black text-indigo-600 mt-1">{totalTerpakai.toLocaleString()}</p>
        </div>
      </div>

      <div className="p-4 border-b border-slate-100 space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-3 w-4 h-4 text-slate-400" />
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

      <div className="overflow-x-auto max-h-[34rem] overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-50/80 sticky top-0 border-b border-slate-100 z-10 backdrop-blur-xs">
            <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4">Nama Barang & Cabang</th>
              <th className="py-3 px-3 text-right">Stok Awal</th>
              <th className="py-3 px-3 text-right text-emerald-600">+ Masuk</th>
              <th className="py-3 px-3 text-right text-indigo-600">- Terpakai</th>
              <th className="py-3 px-3 text-right text-amber-600">- Waste</th>
              <th className="py-3 px-3 text-right font-black text-slate-900 bg-amber-50/80">= Stok Akhir</th>
              <th className="py-3 px-3 text-center">Status</th>
              {canEdit && <th className="py-3 px-4 text-center">Koreksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                  Memuat data pergerakan stok...
                </td>
              </tr>
            ) : groupedData.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                  Tidak ada barang yang cocok.
                </td>
              </tr>
            ) : (
              groupedData.map(({ category, items }) => (
                <React.Fragment key={category}>
                  <tr className="bg-slate-50/80 border-y border-slate-100">
                    <td colSpan={8} className="py-2 px-4 font-black text-slate-700 uppercase tracking-wider text-[11px]">
                      • {category} <span className="text-slate-400 font-normal lowercase">({items.length} item)</span>
                    </td>
                  </tr>

                  {items.map((row) => {
                    const isEditing = editingKey === row.id;
                    const previewEnd = Math.max(0, (editInitial + editReceived) - editUsage - editWaste);

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-extrabold text-slate-800 uppercase">{row.item_name}</div>
                          <div className="text-[10px] text-slate-400">{row.location_name} • {row.unit}</div>
                        </td>

                        <td className="py-3 px-3 text-right font-bold">
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
                            {isEditing ? previewEnd : row.current_stock}{' '}
                            <span className="text-[10px] font-bold text-slate-500">{row.unit}</span>
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center">
                          {row.is_closed ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Closed
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100">
                              Live Open
                            </span>
                          )}
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