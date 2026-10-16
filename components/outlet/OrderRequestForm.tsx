'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ShoppingBag, ArrowLeft, CheckCircle2, AlertCircle, Search, Send } from 'lucide-react';

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
  uom: string;
}

const CATEGORY_ORDER = [
  'Semua',
  'Bakso & Olahan Frozen',
  'Bahan Dapur & Bumbu',
  'Sayur, Mie & Pelengkap',
  'Minuman & Es',
  'Kemasan & Operasional',
];

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
      const { data, error } = await supabase.from('items').select('*').order('name');
      if (error) {
        console.error('Gagal mengambil master items:', error);
      } else if (data) {
        setItems(data);
      }
    }
    fetchItems();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchCat = activeCategory === 'Semua' || item.category === activeCategory;
      const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [items, activeCategory, searchTerm]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, MasterItem[]> = {};
    filteredItems.forEach((item) => {
      const cat = item.category || 'Lain-lain';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredItems]);

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
            unit: itemMeta?.uom || 'Pcs',
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
    <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-sm shadow-slate-200/50">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-bold text-slate-400 hover:text-indigo-600 mb-5 flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Dashboard
        </button>
      )}

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#ff6f3c] text-white flex items-center justify-center shadow-md shadow-orange-500/20">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Lembar Request Order Malam</h2>
            <p className="text-xs font-medium text-slate-400">Ketik kebutuhan stok untuk persiapan besok pagi.</p>
          </div>
        </div>
        <div className="text-xs font-black px-4 py-2 bg-orange-50 text-[#ff6f3c] border border-orange-200/60 rounded-full w-fit">
          {totalFilled} barang terpilih
        </div>
      </div>

      {message && (
        <div
          className={`p-4 mb-6 rounded-2xl text-xs font-bold flex items-center gap-2.5 ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Search & Modern Pill Filter */}
      <div className="space-y-3 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari barang cepat (misal: bakso halus, kuah, bihun)..."
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Modern Grouped Table */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-[30rem] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50/80 sticky top-0 border-b border-slate-100 z-10 backdrop-blur-sm">
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Nama Barang</th>
                <th className="py-3 px-4 text-right w-36">Jumlah Pesan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.keys(groupedItems).length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-12 text-center text-slate-400 font-medium">
                    Tidak ada barang ditemukan.
                  </td>
                </tr>
              ) : (
                Object.entries(groupedItems).map(([groupName, groupList]) => (
                  <React.Fragment key={groupName}>
                    <tr className="bg-slate-50/50 border-y border-slate-100">
                      <td colSpan={2} className="py-2.5 px-4 font-black text-slate-700 uppercase tracking-wider text-[11px]">
                        • {groupName} <span className="text-slate-400 font-medium lowercase">({groupList.length} item)</span>
                      </td>
                    </tr>
                    {groupList.map((item) => {
                      const val = quantities[item.name] || '';
                      const isSelected = parseFloat(val) > 0;
                      return (
                        <tr
                          key={item.id}
                          className={`transition-colors ${
                            isSelected ? 'bg-orange-50/40 font-bold' : 'hover:bg-slate-50/60'
                          }`}
                        >
                          <td className="py-2.5 px-4 text-slate-800">{item.name}</td>
                          <td className="py-2 px-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={val}
                                onChange={(e) => handleQtyChange(item.name, e.target.value)}
                                placeholder="0"
                                className={`w-20 px-3 py-1.5 text-right rounded-xl text-xs font-bold border transition-all focus:outline-none ${
                                  isSelected
                                    ? 'bg-white border-[#ff6f3c] text-[#ff6f3c] ring-2 ring-orange-500/20 shadow-xs'
                                    : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-500'
                                }`}
                              />
                              <span className="text-[11px] text-slate-400 w-10 text-left font-semibold">
                                {item.uom || 'Pcs'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div>
          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
            Catatan Tambahan untuk Dapur Pusat
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Misal: Prioritas kirim pagi jam 09.00 (opsional)"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={loading || totalFilled === 0}
          className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white text-xs font-black rounded-2xl shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          {loading ? 'Mengirim ke Dapur...' : `Kirim Request Order (${totalFilled} Item)`}
        </button>
      </form>
    </div>
  );
}