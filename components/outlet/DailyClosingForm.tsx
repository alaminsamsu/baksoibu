'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Store, CheckCircle2, AlertCircle, Save, RefreshCw, ArrowLeft } from 'lucide-react';

interface Props {
  user?: any;
  onBack?: () => void;
  locationId?: string;
  staffName?: string;
}

interface ItemRow {
  item_name: string;
  unit: string;
  stok_awal: number;
  stok_masuk: number;
  sisa_fisik: number | '';
  waste: number | '';
}

export default function DailyClosingForm({ user, onBack, locationId: propLocationId, staffName: propStaffName }: Props) {
  // Ambil location_id dan nama staf baik dari prop langsung maupun dari objek user
  const effectiveLocationId = propLocationId || user?.location_id || user?.id || '';
  const effectiveStaffName = propStaffName || user?.active_staff_name || user?.username || 'Kru Outlet';

  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadClosingData = async () => {
    if (!effectiveLocationId) return;
    setLoading(true);
    setMsg(null);
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // 1. Ambil daftar bahan master dari branch_stocks
      const { data: stockMasters } = await supabase
        .from('branch_stocks')
        .select('item_name, unit')
        .eq('location_id', effectiveLocationId)
        .order('item_name');

      // 2. Ambil total stok masuk hari ini
      const { data: incomingMoves } = await supabase
        .from('stock_movements')
        .select('item_name, quantity')
        .eq('location_id', effectiveLocationId)
        .gte('created_at', `${todayStr}T00:00:00Z`);

      // 3. Ambil sisa stok kemarin sebagai stok awal
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const { data: yesterdayClosings } = await supabase
        .from('daily_closings')
        .select('item_name, remaining_stock')
        .eq('location_id', effectiveLocationId)
        .eq('closing_date', yesterdayStr);

      // 4. Cek apakah hari ini sudah pernah disimpan
      const { data: todayClosings } = await supabase
        .from('daily_closings')
        .select('*')
        .eq('location_id', effectiveLocationId)
        .eq('closing_date', todayStr);

      const rows: ItemRow[] = (stockMasters || []).map((m) => {
        const prev = yesterdayClosings?.find((y) => y.item_name === m.item_name);
        const inc = incomingMoves?.filter((i) => i.item_name === m.item_name)
          .reduce((sum, curr) => sum + Number(curr.quantity || 0), 0) || 0;
        const savedToday = todayClosings?.find((t) => t.item_name === m.item_name);

        return {
          item_name: m.item_name,
          unit: m.unit || 'porsi',
          stok_awal: prev ? Number(prev.remaining_stock) : 0,
          stok_masuk: inc,
          sisa_fisik: savedToday ? Number(savedToday.remaining_stock) : '',
          waste: savedToday ? Number(savedToday.waste_qty) : ''
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
    loadClosingData();
  }, [effectiveLocationId]);

  const handleInputChange = (index: number, field: 'sisa_fisik' | 'waste', val: string) => {
    const updated = [...items];
    updated[index][field] = val === '' ? '' : Number(val);
    setItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      const payloads = items.map((row) => {
        const fisik = row.sisa_fisik === '' ? 0 : Number(row.sisa_fisik);
        const waste = row.waste === '' ? 0 : Number(row.waste);
        const totalModal = row.stok_awal + row.stok_masuk;
        const terpakai = Math.max(0, totalModal - fisik - waste);

        return {
          location_id: effectiveLocationId,
          closing_date: todayStr,
          item_name: row.item_name,
          stok_awal: row.stok_awal,
          stok_masuk: row.stok_masuk,
          terpakai: terpakai,
          waste_qty: waste,
          remaining_stock: fisik,
          unit: row.unit,
          reported_by: effectiveStaffName,
          created_at: new Date().toISOString()
        };
      });

      const { error } = await supabase
        .from('daily_closings')
        .upsert(payloads, { onConflict: 'location_id,closing_date,item_name' });

      if (error) throw error;

      setMsg({
        text: 'Tutup toko berhasil disimpan! Data Terpakai dan Stok Akhir telah disinkronkan.',
        type: 'success'
      });
      await loadClosingData();
    } catch (err: any) {
      setMsg({ text: `Gagal simpan: ${err.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
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
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
              Form Tutup Toko (Closing Harian)
            </h3>
            <p className="text-[10px] text-slate-400">
              Input sisa fisik & waste. Sistem otomatis menghitung bahan terpakai dan mengunci stok akhir.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadClosingData}
          className="p-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-500"
          title="Segarkan Data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {msg && (
        <div className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
          msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-xs text-slate-400 font-bold">Memuat daftar bahan...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase text-slate-400 font-black">
                  <th className="py-2.5 px-2">Bahan</th>
                  <th className="py-2.5 px-2 text-center bg-slate-50 rounded-l-lg">Awal</th>
                  <th className="py-2.5 px-2 text-center bg-slate-50">+ Masuk</th>
                  <th className="py-2.5 px-2 text-center bg-indigo-50/60 text-indigo-800">Sisa Fisik</th>
                  <th className="py-2.5 px-2 text-center bg-amber-50/60 text-amber-800">Waste</th>
                  <th className="py-2.5 px-2 text-center font-black text-slate-700 bg-slate-100 rounded-r-lg">= Terpakai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-bold">
                {items.map((row, idx) => {
                  const fisik = row.sisa_fisik === '' ? 0 : Number(row.sisa_fisik);
                  const waste = row.waste === '' ? 0 : Number(row.waste);
                  const total = row.stok_awal + row.stok_masuk;
                  const terpakai = Math.max(0, total - fisik - waste);

                  return (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-2">
                        <span className="text-slate-800 block">{row.item_name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{row.unit}</span>
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-500 bg-slate-50/50">
                        {row.stok_awal}
                      </td>
                      <td className="py-2.5 px-2 text-center text-indigo-600 bg-slate-50/50">
                        +{row.stok_masuk}
                      </td>
                      <td className="py-2.5 px-2 text-center bg-indigo-50/30">
                        <input
                          type="number"
                          step="any"
                          required
                          value={row.sisa_fisik}
                          onChange={(e) => handleInputChange(idx, 'sisa_fisik', e.target.value)}
                          placeholder="0"
                          className="w-16 px-2 py-1 text-center bg-white border border-indigo-200 rounded-lg text-slate-800 font-black focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="py-2.5 px-2 text-center bg-amber-50/30">
                        <input
                          type="number"
                          step="any"
                          value={row.waste}
                          onChange={(e) => handleInputChange(idx, 'waste', e.target.value)}
                          placeholder="0"
                          className="w-16 px-2 py-1 text-center bg-white border border-amber-200 rounded-lg text-amber-700 font-black focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </td>
                      <td className="py-2.5 px-2 text-center font-black text-slate-800 bg-slate-100/50">
                        {terpakai}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            type="submit"
            disabled={saving || items.length === 0}
            className="w-full py-3 bg-[#5252ea] hover:bg-[#4343d6] disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Mengunci Data & Menghitung...' : 'Kunci & Simpan Tutup Toko'}</span>
          </button>
        </form>
      )}
    </div>
  );
}