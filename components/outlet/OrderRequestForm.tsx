'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ShoppingBag, ArrowLeft, CheckCircle2, AlertCircle, Search } from 'lucide-react';

interface Props {
  user?: any;
  onBack?: () => void;
  locationId?: string;
  staffName?: string;
}

interface MasterItem {
  id: string;
  name: string;
  category: string;
  default_unit: string;
}

export default function OrderRequestForm({ user, onBack, locationId, staffName }: Props) {
  const activeLocationId = locationId || user?.location_id;
  const activeStaffName = staffName || user?.active_staff_name || user?.username || 'Petugas Outlet';

  const [items, setItems] = useState<MasterItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState<string>('Semua');
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    async function fetchItems() {
      const { data } = await supabase.from('items').select('*').order('name');
      if (data) setItems(data);
    }
    fetchItems();
  }, []);

  const categories = useMemo(() => {
    const list = Array.from(new Set(items.map((i) => i.category || 'Lainnya')));
    return ['Semua', ...list];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchCat = activeCategory === 'Semua' || item.category === activeCategory;
      const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [items, activeCategory, searchTerm]);

  const handleQtyChange = (itemName: string, val: string) => {
    setQuantities((prev) => ({
      ...prev,
      [itemName]: val,
    }));
  };

  const totalFilled = useMemo(() => {
    return Object.values(quantities).filter((q) => parseFloat(q) > 0).length;
  }, [quantities]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const orderPayload = Object.entries(quantities)
        .filter(([_, qty]) => parseFloat(qty) > 0)
        .map(([itemName, qty]) => {
          const itemMeta = items.find((i) => i.name === itemName);
          return {
            location_id: activeLocationId,
            item_name: itemName,
            quantity: parseFloat(qty),
            unit: itemMeta?.default_unit || 'Pcs',
            notes: notes.trim() || null,
            requested_by: activeStaffName,
            status: 'pending',
          };
        });

      if (orderPayload.length === 0) {
        throw new Error('Isi minimal satu barang dengan jumlah lebih dari 0.');
      }

      const { error } = await supabase.from('order_requests').insert(orderPayload);
      if (error) throw error;

      setMessage({
        text: `Berhasil mengirim permintaan untuk ${orderPayload.length} barang ke Dapur Pusat!`,
        type: 'success',
      });
      setQuantities({});
      setNotes('');
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal mengirim order.', type: 'error' });
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-neutral-100 gap-2">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-amber-800" />
          <div>
            <h2 className="text-base font-bold text-neutral-800">Lembar Request Order Malam</h2>
            <p className="text-xs text-neutral-500">Ketik angka langsung pada barang yang ingin dipesan.</p>
          </div>
        </div>
        <div className="text-xs font-bold px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl w-fit">
          {totalFilled} barang terisi
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

      {/* Filter Kategori & Pencarian */}
      <div className="space-y-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama barang cepat (misal: bakso, plastik, kecap)..."
            className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-amber-900 text-white shadow-sm'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tabel Checklist Barang */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="border border-neutral-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-neutral-50 sticky top-0 border-b border-neutral-200 z-10">
              <tr className="text-neutral-600 font-bold uppercase tracking-wider">
                <th className="py-2.5 px-3">Nama Barang</th>
                <th className="py-2.5 px-3">Kategori</th>
                <th className="py-2.5 px-3 text-right w-36">Jumlah Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredItems.map((item) => {
                const val = quantities[item.name] || '';
                const isSelected = parseFloat(val) > 0;
                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-amber-50/60 font-semibold' : 'hover:bg-neutral-50'
                    }`}
                  >
                    <td className="py-2 px-3 text-neutral-800">{item.name}</td>
                    <td className="py-2 px-3 text-neutral-400 text-[11px]">{item.category}</td>
                    <td className="py-1.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={val}
                          onChange={(e) => handleQtyChange(item.name, e.target.value)}
                          placeholder="0"
                          className="w-20 px-2 py-1 text-right bg-white border border-neutral-200 rounded-lg text-xs font-bold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <span className="text-[11px] text-neutral-500 w-9 text-left">
                          {item.default_unit}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
            Catatan Tambahan untuk Dapur Pusat
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Misal: Prioritas kirim jam 09.00 pagi (opsional)"
            className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading || totalFilled === 0}
          className="w-full py-2.5 bg-amber-900 hover:bg-amber-800 text-white text-xs font-bold rounded-xl shadow transition-all disabled:opacity-50"
        >
          {loading ? 'Mengirim...' : `Kirim Request Order (${totalFilled} Item)`}
        </button>
      </form>
    </div>
  );
}