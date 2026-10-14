'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ClipboardList, Send, Plus } from 'lucide-react';

export default function OrderRequestForm({ user, onBack }: { user: any; onBack: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<{ itemId: string; qty: number }[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchItems() {
      const { data } = await supabase.from('items').select('*').eq('is_active', true);
      if (data) setItems(data);
    }
    fetchItems();
  }, []);

  const handleAddItemRow = () => {
    if (items.length > 0) {
      setSelectedItems([...selectedItems, { itemId: items[0].id, qty: 10 }]);
    }
  };

  const handleRemoveRow = (index: number) => {
    const updated = [...selectedItems];
    updated.splice(index, 1);
    setSelectedItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) {
      alert('Pilih minimal 1 barang untuk diorder.');
      return;
    }
    setSubmitting(true);

    try {
      const { data: centralLoc } = await supabase
        .from('locations')
        .select('id')
        .eq('type', 'central_kitchen')
        .single();

      const transferNumber = `RO-${Date.now().toString().slice(-6)}`;

      const { data: transfer, error: transError } = await supabase
        .from('stock_transfers')
        .insert({
          transfer_number: transferNumber,
          from_location_id: centralLoc?.id,
          to_location_id: user.location_id,
          created_by: user.id,
          requested_by_staff_name: user.active_staff_name || user.username,
          status: 'requested',
          notes: notes,
        })
        .select()
        .single();

      if (transError) throw transError;

      const detailInserts = selectedItems.map((row) => ({
        stock_transfer_id: transfer.id,
        item_id: row.itemId,
        qty_requested: row.qty,
      }));

      await supabase.from('stock_transfer_items').insert(detailInserts);

      alert(`Pesanan berhasil terkirim ke Dapur Pusat! No: ${transferNumber}`);
      onBack();
    } catch (err: any) {
      alert('Gagal mengirim order: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg mx-auto bg-white p-6 rounded-2xl border shadow-sm">
      <div className="flex items-center justify-between border-b pb-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <ClipboardList className="text-orange-600" /> Request Order Malam (Untuk Besok)
        </h2>
        <button type="button" onClick={onBack} className="text-xs text-amber-900 font-semibold hover:underline">
          ← Batal
        </button>
      </div>

      <div className="space-y-3">
        {selectedItems.map((row, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <select
              value={row.itemId}
              onChange={(e) => {
                const updated = [...selectedItems];
                updated[idx].itemId = e.target.value;
                setSelectedItems(updated);
              }}
              className="flex-1 p-2 border rounded-xl text-xs bg-white"
            >
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.unit})
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={row.qty}
              onChange={(e) => {
                const updated = [...selectedItems];
                updated[idx].qty = Number(e.target.value);
                setSelectedItems(updated);
              }}
              className="w-20 p-2 border rounded-xl text-xs text-right font-bold"
            />
            <button
              type="button"
              onClick={() => handleRemoveRow(idx)}
              className="p-2 text-red-500 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={handleAddItemRow}
          className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-gray-50"
        >
          <Plus className="w-4 h-4" /> Tambah Barang Orderan
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-600">Catatan Tambahan untuk Dapur Pusat</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Misal: Mohon kirim lebih pagi karena ada pesanan katering."
          className="w-full p-2.5 border rounded-xl text-xs"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-sm shadow flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Send className="w-4 h-4" />
        <span>{submitting ? 'Mengirim ke Dapur Pusat...' : 'Kirim Request Order'}</span>
      </button>
    </form>
  );
}