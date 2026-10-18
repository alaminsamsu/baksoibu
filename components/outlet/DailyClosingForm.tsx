'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Store, CheckCircle2, AlertCircle, Save, RefreshCw, ArrowLeft, CheckSquare, Lock, Unlock, Search } from 'lucide-react';

interface Props {
  user?: any;
  onBack?: () => void;
  locationId?: string;
  staffName?: string;
}

interface ClosingItem {
  item_name: string;
  category: string;
  unit: string;
  stok_awal: number;
  stok_masuk: number;
  sisa_fisik: number | string;
  waste: number | string;
}

const CATEGORY_ORDER = [
  'Bakso & Olahan Frozen',
  'Bahan Dapur & Bumbu',
  'Sayur, Mie & Pelengkap',
  'Minuman & Es',
  'Kemasan & Operasional',
  'Lain-lain'
];

export default function DailyClosingForm({ user, onBack, locationId: propLocId, staffName: propStaff }: Props) {
  const effectiveLocationId = propLocId || user?.location_id || user?.id || '';
  const effectiveStaffName = propStaff || user?.active_staff_name || user?.username || 'Kru Outlet';
  const userRole = (user?.role || '').toUpperCase();
  const isLeaderOrOwner = userRole === 'LEADER' || userRole === 'OWNER';

  const [items, setItems] = useState<ClosingItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [allowCorrection, setAllowCorrection] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadData = async () => {
    if (!effectiveLocationId) return;
    setLoading(true);
    setMsg(null);
    try {
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());

      const yDate = new Date();
      yDate.setDate(yDate.getDate() - 1);
      const yesterdayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(yDate);

      const { data: masterItems } = await supabase.from('items').select('name, category');

      const { data: stockMasters } = await supabase
        .from('branch_stocks')
        .select('item_name, unit, category')
        .eq('location_id', effectiveLocationId);

      const { data: yesterdayClosings } = await supabase
        .from('daily_closings')
        .select('item_name, remaining_stock')
        .eq('location_id', effectiveLocationId)
        .eq('closing_date', yesterdayStr);

      const { data: moveData } = await supabase
        .from('stock_movements')
        .select('item_name, quantity, created_at, movement_type')
        .eq('location_id', effectiveLocationId);

      const todayMoves = (moveData || []).filter((m) => {
        if (!m.created_at) return false;
        const isMasuk = m.movement_type === 'MASUK' || m.movement_type === 'IN';
        if (!isMasuk) return false;
        const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date(m.created_at));
        return dStr === todayStr;
      });

      const { data: todayClosings } = await supabase
        .from('daily_closings')
        .select('*')
        .eq('location_id', effectiveLocationId)
        .eq('closing_date', todayStr);

      const hasClosed = todayClosings && todayClosings.length > 0;
      setIsLocked(hasClosed);

      const rows: ClosingItem[] = (stockMasters || []).map((m) => {
        const clean = m.item_name.trim().toLowerCase();
        const itemMeta = masterItems?.find((i) => i.name.trim().toLowerCase() === clean);
        const category = m.category || itemMeta?.category || 'Lain-lain';

        const prev = yesterdayClosings?.find((y) => y.item_name.trim().toLowerCase() === clean);
        const inc = todayMoves
          .filter((i) => i.item_name.trim().toLowerCase() === clean)
          .reduce((sum, curr) => sum + Number(curr.quantity || 0), 0);
        const saved = todayClosings?.find((t) => t.item_name.trim().toLowerCase() === clean);

        return {
          item_name: m.item_name,
          category,
          unit: m.unit || 'porsi',
          stok_awal: prev ? Number(prev.remaining_stock || 0) : 0,
          stok_masuk: inc,
          sisa_fisik: saved ? Number(saved.remaining_stock) : '0',
          waste: saved ? Number(saved.waste_qty) : '0',
        };
      });

      setItems(rows);
    } catch (err: any) {
      console.error('Error load closing:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [effectiveLocationId]);

  const handleInputChange = (itemName: string, field: 'sisa_fisik' | 'waste', val: string) => {
    setItems((prev) =>
      prev.map((item) => (item.item_name === itemName ? { ...item, [field]: val } : item))
    );
  };

  const handleSetAllZero = () => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        sisa_fisik: item.sisa_fisik === '' ? '0' : item.sisa_fisik,
        waste: item.waste === '' ? '0' : item.waste,
      }))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());

      const payloads = items.map((row) => {
        const fisik = row.sisa_fisik === '' ? 0 : Number(row.sisa_fisik);
        const waste = row.waste === '' ? 0 : Number(row.waste);
        const totalModal = row.stok_awal + row.stok_masuk;
        const terpakai = Math.max(0, totalModal - fisik - waste);

        return {
          location_id: effectiveLocationId,
          closing_date: todayStr,
          item_name: row.item_name,
          category: row.category,
          stok_awal: row.stok_awal,
          stok_masuk: row.stok_masuk,
          terpakai: terpakai,
          waste_qty: waste,
          remaining_stock: fisik,
          unit: row.unit,
          reported_by: effectiveStaffName,
          is_locked: true,
          corrected_by: allowCorrection ? effectiveStaffName : null,
          corrected_at: allowCorrection ? new Date().toISOString() : null,
          created_at: new Date().toISOString(),
        };
      });

      const { error } = await supabase
        .from('daily_closings')
        .upsert(payloads, { onConflict: 'location_id,closing_date,item_name' });

      if (error) throw error;

      for (const p of payloads) {
        await supabase
          .from('branch_stocks')
          .upsert({
            location_id: p.location_id,
            item_name: p.item_name,
            remaining_stock: p.remaining_stock,
            unit: p.unit,
            category: p.category,
            updated_at: new Date().toISOString(),
            last_updated: new Date().toISOString(),
            updated_by: effectiveStaffName,
            last_updated_by: effectiveStaffName,
          }, { onConflict: 'location_id,item_name' });
      }

      setMsg({
        text: allowCorrection
          ? 'Koreksi closing berhasil diperbarui di Monitor Stok Cabang.'
          : 'Tutup toko berhasil disimpan! Neraca pergerakan stok telah dikunci.',
        type: 'success',
      });

      setAllowCorrection(false);
      await loadData();
    } catch (err: any) {
      setMsg({ text: `Gagal simpan: ${err.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = selectedCategory === 'Semua' || item.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [items, searchTerm, selectedCategory]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, ClosingItem[]> = {};
    filteredItems.forEach((item) => {
      const cat = item.category || 'Lain-lain';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });

    const ordered: { category: string; list: ClosingItem[] }[] = [];
    CATEGORY_ORDER.forEach((cat) => {
      if (groups[cat] && groups[cat].length > 0) {
        ordered.push({ category: cat, list: groups[cat] });
        delete groups[cat];
      }
    });

    Object.keys(groups).forEach((cat) => {
      if (groups[cat].length > 0) {
        ordered.push({ category: cat, list: groups[cat] });
      }
    });

    return ordered;
  }, [filteredItems]);

  const isFormDisabled = isLocked && !allowCorrection;

  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-all mr-1"
              title="Kembali"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <Store className="w-5 h-5 text-indigo-600" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                Form Tutup Toko (Sisa Fisik & Waste)
              </h3>
              {isLocked && !allowCorrection && (
                <span className="flex items-center gap-1 text-[10px] font-black bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-200">
                  <Lock className="w-3 h-3" /> Terkunci
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400">
              Input sisa fisik dan waste. Terpakai dan stok akhir dikalkulasi otomatis ke dashboard monitor.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {isLocked && !allowCorrection && isLeaderOrOwner && (
            <button
              type="button"
              onClick={() => setAllowCorrection(true)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Buka Kunci Koreksi (Leader)</span>
            </button>
          )}

          {!isFormDisabled && (
            <button
              type="button"
              onClick={handleSetAllZero}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Set Kosong = 0</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadData}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-500"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari bahan di form tutup toko..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {['Semua', ...CATEGORY_ORDER].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
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

      {isLocked && !allowCorrection && !isLeaderOrOwner && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-slate-600">
          <Lock className="w-4 h-4 text-slate-400 shrink-0" />
          <span>Tutup toko hari ini telah disimpan. Hanya Leader atau Owner yang berhak mengoreksi data.</span>
        </div>
      )}

      {msg && (
        <div className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
          msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-xs text-slate-400 font-bold">Memuat daftar bahan cabang...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="overflow-x-auto max-h-[30rem] overflow-y-auto">
            <table className="w-full text-left text-xs font-medium border-collapse">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-slate-100 text-[10px] uppercase text-slate-400 font-black">
                  <th className="py-2.5 px-3">Nama Bahan / Menu</th>
                  <th className="py-2.5 px-3 text-center">Satuan</th>
                  <th className="py-2.5 px-3 text-center bg-indigo-50/60 text-indigo-900 rounded-l-xl">Sisa Fisik Nyata</th>
                  <th className="py-2.5 px-3 text-center bg-amber-50/60 text-amber-900 rounded-r-xl">Waste (Basi/Rusak)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-bold">
                {groupedItems.map(({ category, list }) => (
                  <React.Fragment key={category}>
                    <tr className="bg-slate-50/80 border-y border-slate-100">
                      <td colSpan={4} className="py-2 px-3 font-black text-slate-700 uppercase tracking-wider text-[11px]">
                        • {category} <span className="text-slate-400 font-normal lowercase">({list.length} item)</span>
                      </td>
                    </tr>
                    {list.map((row) => (
                      <tr key={row.item_name} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 text-slate-800 uppercase">{row.item_name}</td>
                        <td className="py-2.5 px-3 text-center text-slate-400 font-normal">{row.unit}</td>
                        <td className="py-2.5 px-3 text-center bg-indigo-50/20">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            disabled={isFormDisabled}
                            value={row.sisa_fisik}
                            onChange={(e) => handleInputChange(row.item_name, 'sisa_fisik', e.target.value)}
                            className="w-24 px-2 py-1.5 text-center bg-white border border-indigo-200 rounded-xl text-slate-900 font-black focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:bg-slate-100"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center bg-amber-50/20">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            disabled={isFormDisabled}
                            value={row.waste}
                            onChange={(e) => handleInputChange(row.item_name, 'waste', e.target.value)}
                            className="w-24 px-2 py-1.5 text-center bg-white border border-amber-200 rounded-xl text-amber-800 font-black focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60 disabled:bg-slate-100"
                          />
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {!isFormDisabled && (
            <button
              type="submit"
              disabled={saving || items.length === 0}
              className={`w-full py-3 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 ${
                allowCorrection
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
                  : 'bg-[#5252ea] hover:bg-[#4343d6] shadow-indigo-500/20'
              } disabled:opacity-50`}
            >
              <Save className="w-4 h-4" />
              <span>
                {saving
                  ? 'Menyimpan & Mengunci Data...'
                  : allowCorrection
                  ? 'Simpan Perubahan Koreksi (Leader)'
                  : 'Kunci & Simpan Tutup Toko'}
              </span>
            </button>
          )}
        </form>
      )}
    </div>
  );
}