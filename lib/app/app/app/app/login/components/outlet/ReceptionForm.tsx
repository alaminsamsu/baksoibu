'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { PackageCheck, CheckCircle2, Clock } from 'lucide-react';

export default function ReceptionForm({ user, onBack }: { user: any; onBack: () => void }) {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [receivedQty, setReceivedQty] = useState<{ [key: string]: number }>({});
  const [notes, setNotes] = useState<{ [key: string]: string }>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchTransfers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('stock_transfers')
      .select('*, stock_transfer_items(*, items(name, unit))')
      .eq('to_location_id', user.location_id)
      .in('status', ['shipped', 'in_transit'])
      .order('created_at', { ascending: false });

    if (data) setTransfers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchTransfers();
  }, [user.location_id]);

  const handleReceive = async (transfer: any) => {
    setSavingId(transfer.id);
    try {
      for (const item of transfer.stock_transfer_items) {
        const qty = receivedQty[item.id] ?? item.qty_dispatched ?? item.qty_requested;
        
        await supabase
          .from('stock_transfer_items')
          .update({ qty_received: qty, notes: notes[item.id] || null })
          .eq('id', item.id);

        const { data: inv } = await supabase
          .from('inventories')
          .select('id, quantity')
          .eq('location_id', user.location_id)
          .eq('item_id', item.item_id)
          .single();

        if (inv) {
          await supabase
            .from('inventories')
            .update({ quantity: Number(inv.quantity) + Number(qty), last_updated: new Date().toISOString() })
            .eq('id', inv.id);
        } else {
          await supabase.from('inventories').insert({
            location_id: user.location_id,
            item_id: item.item_id,
            quantity: Number(qty),
          });
        }
      }

      await supabase
        .from('stock_transfers')
        .update({
          status: 'received',
          received_by: user.id,
          received_at: new Date().toISOString(),
          receiver_staff_name: user.active_staff_name || user.username,
        })
        .eq('id', transfer.id);

      alert('Kiriman barang berhasil diterima dan stok outlet telah bertambah!');
      fetchTransfers();
    } catch (err: any) {
      alert('Gagal memproses penerimaan: ' + err.message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <PackageCheck className="text-blue-600" /> Penerimaan Barang Kiriman Dapur Pusat
        </h2>
        <button onClick={onBack} className="text-xs text-amber-900 font-semibold hover:underline">
          ← Kembali ke Menu
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-gray-500 py-4">Memuat data pengiriman...</p>
      ) : transfers.length === 0 ? (
        <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-semibold">Tidak ada kiriman barang yang sedang dalam perjalanan.</p>
        </div>
      ) : (
        transfers.map((t) => (
          <div key={t.id} className="bg-white border rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex justify-between items-center text-xs text-gray-500 border-b pb-2">
              <span className="font-bold text-gray-800">No. Transfer: {t.transfer_number || t.id.slice(0, 8)}</span>
              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold uppercase">Dalam Perjalanan</span>
            </div>

            <div className="space-y-2">
              {t.stock_transfer_items?.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between gap-3 text-xs bg-gray-50 p-2.5 rounded-xl">
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">{item.items?.name}</p>
                    <p className="text-gray-500">Dikirim: {item.qty_dispatched || item.qty_requested} {item.items?.unit}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="font-semibold text-gray-600">Diterima Fisik:</label>
                    <input
                      type="number"
                      defaultValue={item.qty_dispatched || item.qty_requested}
                      onChange={(e) => setReceivedQty({ ...receivedQty, [item.id]: Number(e.target.value) })}
                      className="w-20 p-1.5 border rounded-lg bg-white text-right font-bold"
                    />
                    <span className="text-gray-500">{item.items?.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleReceive(t)}
              disabled={savingId === t.id}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{savingId === t.id ? 'Memproses Masuk...' : 'Konfirmasi Selesai Diterima'}</span>
            </button>
          </div>
        ))
      )}
    </div>
  );
}