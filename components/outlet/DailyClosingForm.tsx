'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Store, CheckCircle2, AlertCircle, Save, RefreshCw, ArrowLeft, CheckSquare, Lock, Unlock } from 'lucide-react';

interface Props {
  user?: any;
  onBack?: () => void;
  locationId?: string;
  staffName?: string;
}

interface ClosingItem {
  item_name: string;
  unit: string;
  sisa_fisik: number | string;
  waste: number | string;
}

export default function DailyClosingForm({ user, onBack, locationId: propLocId, staffName: propStaff }: Props) {
  const effectiveLocationId = propLocId || user?.location_id || user?.id || '';
  const effectiveStaffName = propStaff || user?.active_staff_name || user?.username || 'Kru Outlet';
  const userRole = (user?.role || '').toUpperCase();
  const isLeaderOrOwner = userRole === 'LEADER' || userRole === 'OWNER';

  const [items, setItems] = useState<ClosingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [allowCorrection, setAllowCorrection] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadItems = async () => {
    if (!effectiveLocationId) return;
    setLoading(true);
    setMsg(null);
    try {
      // Waktu lokal Makassar (WITA)
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());

      // 1. Ambil master bahan khusus cabang ini
      const { data: stockMasters } = await supabase
        .from('branch_stocks')
        .select('item_name, unit')
        .eq('location_id', effectiveLocationId)
        .order('item_name');

      // 2. Cek apakah cabang ini sudah melakukan closing hari ini
      const { data: todayClosings } = await supabase
        .from('daily_closings')
        .select('item_name, remaining_stock, waste_qty, is_locked')
        .eq('location_id', effectiveLocationId)
        .eq('closing_date', todayStr);

      const hasClosed = todayClosings && todayClosings.length > 0;
      setIsLocked(hasClosed);

      const rows: ClosingItem[] = (stockMasters || []).map((m) => {
        const clean = m.item_name.trim().toLowerCase();
        const saved = todayClosings?.find((t) => t.item_name.trim().toLowerCase() === clean);

        return {
          item_name: m.item_name,
          unit: m.unit || 'porsi',
          sisa_fisik: saved ? Number(saved.remaining_stock) : '0',
          waste: saved ? Number(saved.waste_qty) : '0'
        };
      });

      setItems(rows);
    } catch (err: any) {
      console.error('Error load items:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [effectiveLocationId]);

  const handleInputChange = (index: number, field: 'sisa_fisik' | 'waste', val: string) => {
    const updated = [...items];
    updated[index][field] = val;
    setItems(updated);
  };

  const handleSetAllZero = () => {
    const updated = items.map(item => ({
      ...item,
      sisa_fisik: item.sisa_fisik === '' ? '0' : item.sisa_fisik,
      waste: item.waste === '' ? '0' : item.waste,
    }));
    setItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());

      // 1. Ambil data penerimaan barang masuk khusus cabang ini hari ini
      const { data: moveData } = await supabase
        .from('stock_movements')
        .select('item_name, quantity, created_at')
        .eq('location_id', effectiveLocationId);

      const incomingToday = (moveData || []).filter(m => {
        if (!m.created_at) return false;
        const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date(m.created_at));
        return dStr === todayStr;
      });

      // 2. Ambil data closing kemarin cabang ini untuk Stok Awal
      const yDate = new Date();
      yDate.setDate(yDate.getDate() - 1);
      const yesterdayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(yDate);

      const { data: yesterdayClosings } = await supabase
        .from('daily_closings')
        .select('item_name, remaining_stock')
        .eq('location_id', effectiveLocationId)
        .eq('closing_date', yesterdayStr);

      const payloads = items.map((row) => {
        const cleanName = row.item_name.trim().toLowerCase();
        const prev = yesterdayClosings?.find(y => y.item_name.trim().toLowerCase() === cleanName);
        const inc = incomingToday
          .filter(i => i.item_name.trim().toLowerCase() === cleanName)
          .reduce((sum, curr) => sum + Number(curr.quantity || 0), 0);

        const stokAwal = prev ? Number(prev.remaining_stock) : 0;
        const stokMasuk = inc;
        const sisaFisik = row.sisa_fisik === '' ? 0 : Number(row.sisa_fisik);
        const waste = row.waste === '' ? 0 : Number(row.waste);

        // Rumus otomatis bahan terpakai
        const totalBahan = stokAwal + stokMasuk;
        const terpakai = Math.max(0, totalBahan - sisaFisik - waste);

        return {
          location_id: effectiveLocationId,
          closing_date: todayStr,
          item_name: row.item_name,
          stok_awal: stokAwal,
          stok_masuk: stokMasuk,
          terpakai: terpakai,
          waste_qty: waste,
          remaining_stock: sisaFisik,
          unit: row.unit,
          reported_by: effectiveStaffName,
          is_locked: true,
          corrected_by: allowCorrection ? effectiveStaffName : null,
          corrected_at: allowCorrection ? new Date().toISOString() : null,
          created_at: new Date().toISOString()
        };
      });

      // Simpan ke database daily_closings
      const { error } = await supabase
        .from('daily_closings')
        .upsert(payloads, { onConflict: 'location_id,closing_date,item_name' });

      if (error) throw error;

      // Sinkronkan sisa fisik ke branch_stocks cabang ini
      for (const p of payloads) {
        await supabase
          .from('branch_stocks')
          .upsert({
            location_id: p.location_id,
            item_name: p.item_name,
            remaining_stock: p.remaining_stock,
            unit: p.unit,
            last_updated: new Date().toISOString(),
            last_updated_by: effectiveStaffName
          }, { onConflict: 'location_id,item_name' });
      }

      setMsg({
        text: allowCorrection 
          ? 'Koreksi closing berhasil disimpan dan disinkronkan ke monitor pergerakan stok cabang!' 
          : 'Tutup toko berhasil disimpan dan dikunci! Laporan terpakai & stok akhir telah disinkronkan.',
        type: 'success'
      });

      setAllowCorrection(false);
      await loadItems();
    } catch (err: any) {
      setMsg({ text: `Gagal simpan: ${err.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const isFormDisabled = isLocked && !allowCorrection;

  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4 max-w-4xl mx-auto">
      {/* Header */}
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
              Input hitungan fisik nyata di cabang. Bahan terpakai dihitung otomatis di dashboard stok.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {/* Tombol Koreksi Khusus Leader / Owner */}
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
            onClick={loadItems}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-500"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Peringatan jika Terkunci untuk Crew */}
      {isLocked && !allowCorrection && !isLeaderOrOwner && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-slate-600">
          <Lock className="w-4 h-4 text-slate-400 shrink-0" />
          <span>Tutup toko hari ini telah disimpan. Hanya <b>Leader Cabang</b> atau <b>Owner</b> yang berwenang melakukan koreksi data.</span>
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase text-slate-400 font-black">
                  <th className="py-2.5 px-3">Nama Bahan / Menu</th>
                  <th className="py-2.5 px-3 text-center">Satuan</th>
                  <th className="py-2.5 px-3 text-center bg-indigo-50/60 text-indigo-900 rounded-l-xl">Sisa Fisik Nyata</th>
                  <th className="py-2.5 px-3 text-center bg-amber-50/60 text-amber-900 rounded-r-xl">Waste (Basi/Rusak)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-bold">
                {items.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 text-slate-800 uppercase">{row.item_name}</td>
                    <td className="py-2.5 px-3 text-center text-slate-400 font-normal">{row.unit}</td>
                    <td className="py-2.5 px-3 text-center bg-indigo-50/20">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        disabled={isFormDisabled}
                        value={row.sisa_fisik}
                        onChange={(e) => handleInputChange(idx, 'sisa_fisik', e.target.value)}
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
                        onChange={(e) => handleInputChange(idx, 'waste', e.target.value)}
                        className="w-24 px-2 py-1.5 text-center bg-white border border-amber-200 rounded-xl text-amber-800 font-black focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60 disabled:bg-slate-100"
                      />
                    </td>
                  </tr>
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
                  ? 'Menyimpan & Menghitung...' 
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