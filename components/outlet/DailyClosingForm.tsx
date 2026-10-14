'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { CheckCircle2, Lock } from 'lucide-react';

export default function DailyClosingForm({ user, onBack }: { user: any; onBack: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [wasteValues, setWasteValues] = useState<{ [key: string]: number }>({});
  const [actualValues, setActualValues] = useState<{ [key: string]: number }>({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      const { data } = await supabase
        .from('items')
        .select('*, inventories(quantity)')
        .eq('is_active', true);

      if (data) setItems(data);
    }
    loadData();
  }, [user.location_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const isLeader = user.role === 'leader' || user.role === 'owner' || user.role === 'admin_ops';
      
      const { data: closing, error: closingErr } = await supabase
        .from('daily_closings')
        .insert({
          location_id: user.location_id,
          user_id: user.id,
          staff_name: user.active_staff_name || user.username,
          closing_date: new Date().toISOString().split('T')[0],
          status: isLeader ? 'approved' : 'draft',
          notes: notes,
        })
        .select()
        .single();

      if (closingErr) throw closingErr;

      for (const item of items) {
        const waste = wasteValues[item.id] || 0;
        const actual = actualValues[item.id] || 0;

        await supabase.from('daily_closing_items').insert({
          daily_closing_id: closing.id,
          item_id: item.id,
          waste_qty: waste,
          closing_actual_qty: actual,
        });

        if (isLeader) {
          await supabase
            .from('inventories')
            .upsert({
              location_id: user.location_id,
              item_id: item.id,
              quantity: actual,
              last_updated: new Date().toISOString(),
            });
        }
      }

      alert(isLeader ? 'Tutup toko selesai & stok sisa dikunci resmi!' : 'Laporan tutup toko tersimpan sebagai draft untuk diverifikasi Leader!');
      onBack();
    } catch (err: any) {
      alert('Gagal menyimpan closing: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl mx-auto bg-white p-6 rounded-2xl border shadow-sm">
      <div className="flex items-center justify-between border-b pb-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <CheckCircle2 className="text-purple-600" /> Form Tutup Toko Harian
        </h2>
        <button type="button" onClick={onBack} className="text-xs text-amber-900 font-semibold hover:underline">
          ← Batal
        </button>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {items.map((item) => (
          <div key={item.id} className="p-3 bg-gray-50 rounded-xl flex items-center justify-between gap-3 text-xs">
            <span className="font-bold text-gray-800 flex-1">{item.name} ({item.unit})</span>
            
            <div className="flex items-center gap-1.5">
              <label className="text-gray-500">Basi/Waste:</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                onChange={(e) => setWasteValues({ ...wasteValues, [item.id]: Number(e.target.value) })}
                className="w-16 p-1.5 border rounded-lg bg-white text-right font-semibold text-red-600"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <label className="font-bold text-gray-700">Sisa Fisik:</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                onChange={(e) => setActualValues({ ...actualValues, [item.id]: Number(e.target.value) })}
                className="w-16 p-1.5 border rounded-lg bg-white text-right font-bold text-emerald-700"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-600">Catatan Penutupan</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Kondisi outlet saat tutup, kendala kompor, dll."
          className="w-full p-2.5 border rounded-xl text-xs"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold text-sm shadow flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Lock className="w-4 h-4" />
        <span>{submitting ? 'Menyimpan...' : 'Kunci & Simpan Data Tutup Toko'}</span>
      </button>
    </form>
  );
}