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

interface ClosingRow {
  id: string;
  item_name: string;
  location_id: string;
  location_name?: string;
  closing_date: string;
  stok_awal: number;
  stok_masuk: number;
  terpakai: number;
  waste_qty: number;
  remaining_stock: number;
  unit: string;
  reported_by?: string;
  corrected_by?: string;
  created_at: string;
}

export default function BranchStockMonitor() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [dataList, setDataList] = useState<ClosingRow[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Tanggal yang dipantau (WITA)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());
  });

  // State Koreksi Kolom oleh Leader
  const [editingId, setEditingId] = useState<string | null>(null);
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
          setSelectedLocation(u.location_id);
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

  // Tarik data langsung dari daily_closings secara sederhana
  const fetchMovementData = async () => {
    setLoading(true);
    try {
      const { data: locData } = await supabase.from('locations').select('id, name');
      if (locData) setLocations(locData);

      let query = supabase
        .from('daily_closings')
        .select('*')
        .eq('closing_date', selectedDate)
        .order('item_name');

      // Batasi lokasi jika akun kru/leader
      if ((isLeader || isCrew) && currentUser?.location_id) {
        query = query.eq('location_id', currentUser.location_id);
      } else if (selectedLocation !== 'all') {
        query = query.eq('location_id', selectedLocation);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Petakan nama lokasi
      const mapped = (data || []).map((row) => {
        const loc = locData?.find((l) => l.id === row.location_id);
        return {
          ...row,
          location_name: loc ? loc.name : 'Outlet',
          stok_awal: Number(row.stok_awal || 0),
          stok_masuk: Number(row.stok_masuk || 0),
          terpakai: Number(row.terpakai || 0),
          waste_qty: Number(row.waste_qty || 0),
          remaining_stock: Number(row.remaining_stock || 0),
        };
      });

      setDataList(mapped);
    } catch (err: any) {
      console.error('Error load stock movement:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovementData();
  }, [selectedDate, selectedLocation, currentUser]);

  // Mulai mode koreksi
  const handleStartEdit = (row: ClosingRow) => {
    if (!canEdit) {
      alert('Hanya Leader Outlet atau Owner yang berhak mengoreksi stok.');
      return;
    }
    if (isLeader && row.location_id !== currentUser?.location_id) {
      alert('Leader hanya berhak mengoreksi data di outlet sendiri.');
      return;
    }

    setEditingId(row.id);
    setEditInitial(row.stok_awal);
    setEditReceived(row.stok_masuk);
    setEditUsage(row.terpakai);
    setEditWaste(row.waste_qty);
  };

  // Simpan koreksi Leader
  const handleSaveEdit = async (row: ClosingRow) => {
    try {
      const editorName = currentUser?.active_staff_name || currentUser?.username || 'Leader';
      const calculatedEnd = Math.max(0, (editInitial + editReceived) - editUsage - editWaste);

      // 1. Update baris daily_closings
      const { error: closingErr } = await supabase
        .from('daily_closings')
        .update({
          stok_awal: editInitial,
          stok_masuk: editReceived,
          terpakai: editUsage,
          waste_qty: editWaste,
          remaining_stock: calculatedEnd,
          corrected_by: editorName,
          corrected_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      if (closingErr) throw closingErr;

      // 2. Sinkronkan saldo akhir ke branch_stocks
      await supabase
        .from('branch_stocks')
        .upsert({
          location_id: row.location_id,
          item_name: row.item_name,
          remaining_stock: calculatedEnd,
          unit: row.unit,
          last_updated: new Date().toISOString(),
          last_updated_by: `${editorName} (Koreksi Leader)`,
        }, { onConflict: 'location_id,item_name' });

      setEditingId(null);
      await fetchMovementData();
    } catch (err: any) {
      alert('Gagal simpan koreksi: ' + err.message);
    }
  };

  const filteredData = useMemo(() => {
    return dataList.filter((item) =>
      item.item_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [dataList, searchTerm]);

  const totalUsage = useMemo(
    () => filteredData.reduce((acc, curr) => acc + curr.terpakai, 0),
    [filteredData]
  );
  const totalWaste = useMemo(
    () => filteredData.reduce((acc, curr) => acc + curr.waste_qty, 0),
    [filteredData]
  );

  return (
    <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-xs">
      {/* Header Bar */}
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
              (Awal + Masuk) - Terpakai - Waste = <b>Stok Akhir</b>
            </p>
          </div>
        </div>

        {/* Filter Tanggal & Lokasi */}
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
            onClick={fetchMovementData}
            title="Segarkan Data"
            className="p-2.5 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-2xl border border-slate-100 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 3 Kartu Ringkasan Sederhana */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-5 bg-[#fafbfe] border-b border-slate-100">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold">
            <span>Barang Tercatat</span>
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <p className="text-xl font-black text-slate-900 mt-1">{filteredData.length}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 text-[11px] font-bold">
            <span>Total Terpakai</span>
            <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-xl font-black text-emerald-600 mt-1">{totalUsage.toLocaleString()}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 text-[11px] font-bold">
            <span>Total Waste (Rusak/Basi)</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <p className="text-xl font-black text-amber-600 mt-1">{totalWaste.toLocaleString()}</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-4 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama barang di monitor stok..."
            className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Tabel Data Neraca Stok */}
      <div className="overflow-x-auto max-h-[34rem] overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-50/80 sticky top-0 border-b border-slate-100 z-10">
            <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4">Nama Barang & Cabang</th>
              <th className="py-3 px-3 text-right">Stok Awal</th>
              <th className="py-3 px-3 text-right text-emerald-600">+ Masuk</th>
              <th className="py-3 px-3 text-right text-indigo-600">- Terpakai</th>
              <th className="py-3 px-3 text-right text-amber-600">- Waste</th>
              <th className="py-3 px-3 text-right font-black text-slate-900 bg-amber-50/80">= Stok Akhir</th>
              <th className="py-3 px-3">Petugas</th>
              {canEdit && <th className="py-3 px-4 text-center">Koreksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                  Memuat data stok pergerakan...
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                  Belum ada laporan tutup toko untuk tanggal {selectedDate} di cabang ini.
                </td>
              </tr>
            ) : (
              filteredData.map((row) => {
                const isEditing = editingId === row.id;
                const previewEnd = Math.max(0, (editInitial + editReceived) - editUsage - editWaste);
                const formattedTime = row.created_at
                  ? new Date(row.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                  : '-';

                return (
                  <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-extrabold text-slate-800 uppercase">{row.item_name}</div>
                      <div className="text-[10px] text-slate-400">{row.location_name} • {row.unit}</div>
                    </td>

                    {/* 1. STOK AWAL */}
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

                    {/* 2. + MASUK */}
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
                        `+${row.stok_masuk}`
                      )}
                    </td>

                    {/* 3. - TERPAKAI */}
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

                    {/* 4. - WASTE */}
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

                    {/* 5. = STOK AKHIR */}
                    <td className="py-3 px-3 text-right font-black text-slate-900 bg-amber-50/80">
                      <span className="text-sm font-black text-slate-900">
                        {isEditing ? previewEnd : row.remaining_stock}{' '}
                        <span className="text-[10px] font-bold text-slate-500">{row.unit}</span>
                      </span>
                    </td>

                    {/* 6. PETUGAS */}
                    <td className="py-3 px-3">
                      <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                        <UserCheck className="w-3 h-3 text-emerald-600" />
                        <span>{row.reported_by || '-'}</span>
                      </div>
                      {row.corrected_by && (
                        <span className="text-[9px] text-amber-600 font-bold block">
                          Koreksi: {row.corrected_by}
                        </span>
                      )}
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{formattedTime} WITA</span>
                      </div>
                    </td>

                    {/* 7. TOMBOL KOREKSI LEADER */}
                    {canEdit && (
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
                            title="Koreksi Leader"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}