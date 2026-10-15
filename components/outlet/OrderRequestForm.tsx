'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ShoppingBag, Plus, Trash2, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  user?: any;
  onBack?: () => void;
  locationId?: string;
  staffName?: string;
}

interface OrderRow {
  itemName: string;
  quantity: string;
  unit: string;
}

export default function OrderRequestForm({ user, onBack, locationId, staffName }: Props) {
  const activeLocationId = locationId || user?.location_id;
  const activeStaffName = staffName || user?.active_staff_name || user?.username || 'Petugas Outlet';

  const [masterItems, setMasterItems] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<OrderRow[]>([
    { itemName: '', quantity: '', unit: 'Porsi' },
  ]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    async function fetchItems() {
      const { data } = await supabase.from('items').select('*').order('name');
      if (data && data.length > 0) {
        setMasterItems(data);
        setOrderItems([{ itemName: data[0].name, quantity: '', unit: data[0].default_unit || 'Porsi' }]);
      }
    }
    fetchItems();
  }, []);

  const handleAddItemRow = () => {
    const defaultItem = masterItems[0]?.name || '';
    const defaultUnit = masterItems[0]?.default_unit || 'Porsi';
    setOrderItems([...orderItems, { itemName: defaultItem, quantity: '', unit: defaultUnit }]);
  };

  const handleRemoveRow = (index: number) => {
    if (orderItems.length === 1) return;
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, name: string) => {
    const found = masterItems.find((i) => i.name === name);
    const updated = [...orderItems];
    updated[index].itemName = name;
    if (found) {
      updated[index].unit = found.default_unit || 'Porsi';
    }
    setOrderItems(updated);
  };

  const handleQtyChange = (index: number, qty: string) => {
    const updated = [...orderItems];
    updated[index].quantity = qty;
    setOrderItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const validRows = orderItems.filter((row) => row.itemName && parseFloat(row.quantity) > 0);
      if (validRows.length === 0) {
        throw new Error('Masukkan minimal satu barang dengan jumlah lebih dari 0.');
      }

      const inserts = validRows.map((row) => ({
        location_id: activeLocationId,
        item_name: row.itemName,
        quantity: parseFloat(row.quantity),
        unit: row.unit,
        notes: notes.trim() || null,
        requested_by: activeStaffName,
        status: 'pending',
      }));

      const { error } = await supabase.from('order_requests').insert(inserts);
      if (error) throw error;

      setMessage({ text: `Berhasil mengirim ${validRows.length} item request order malam!`, type: 'success' });
      setOrderItems([{ itemName: masterItems[0]?.name || '', quantity: '', unit: masterItems[0]?.default_unit || 'Porsi' }]);
      setNotes('');
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal mengirim request order.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-bold text-neutral-500 hover:text-amber-800 mb-4 flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Menu Utama
        </button>
      )}

      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-100">
        <ShoppingBag className="w-5 h-5 text-amber-800" />
        <div>
          <h2 className="text-base font-bold text-neutral-800">Request Order Malam</h2>
          <p className="text-xs text-neutral-500">Kirim permintaan stok bahan ke dapur pusat untuk persiapan besok.</p>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 mb-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="space-y-2.5">
          <label className="block font-bold text-neutral-700 uppercase tracking-wider">
            Daftar Barang yang Dipesan
          </label>

          {orderItems.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
              <select
                value={row.itemName}
                onChange={(e) => handleItemChange(idx, e.target.value)}
                className="flex-1 px-2.5 py-2 bg-white border border-neutral-200 rounded-lg font-semibold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {masterItems.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                step="any"
                required
                value={row.quantity}
                onChange={(e) => handleQtyChange(idx, e.target.value)}
                placeholder="Jumlah"
                className="w-20 px-2.5 py-2 bg-white border border-neutral-200 rounded-lg font-semibold text-neutral-800 text-right focus:outline-none focus:ring-1 focus:ring-amber-500"
              />

              <span className="w-12 font-bold text-neutral-600">{row.unit}</span>

              {orderItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveRow(idx)}
                  className="p-1.5 text-neutral-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={handleAddItemRow}
            className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl border border-dashed border-neutral-300 flex items-center justify-center gap-1.5 transition-all mt-1"
          >
            <Plus className="w-4 h-4" />
            Tambah Baris Barang Lain
          </button>
        </div>

        <div>
          <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">
            Catatan Tambahan untuk Dapur Pusat
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Misal: Prioritas kirim jam 09.00 pagi (opsional)"
            className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-medium text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-amber-900 hover:bg-amber-800 text-white font-bold rounded-xl shadow transition-all disabled:opacity-50"
        >
          {loading ? 'Mengirim Request...' : 'Kirim Request Order'}
        </button>
      </form>
    </div>
  );
}