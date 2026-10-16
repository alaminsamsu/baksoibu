'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { PackageCheck, ArrowLeft, CheckCircle2, AlertCircle, Search } from 'lucide-react';

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

export default function ReceptionForm({ user, onBack, locationId, staffName }: Props) {
  const activeLocationId = locationId || user?.location_id;
  const activeStaffName = staffName || user?.active_staff_name || user?.username || 'Petugas Outlet';

  const [items, setItems] = useState<MasterItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [source, setSource] = useState<'Dapur Pusat' | 'Belanja Luar / Supplier'>('Dapur Pusat');
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
      const validEntries = Object.entries(quantities).filter(([_, qty]) => parseFloat(qty) > 0);

      if (validEntries.length === 0) {
        throw new Error('Ketik minimal 1 barang dengan jumlah lebih dari 0.');
      }

      for (const [itemName, qtyStr] of validEntries) {
        const qtyNum = parseFloat(qtyStr);
        const itemMeta = items.find((i) => i.name === itemName);
        const unit = itemMeta?.uom || 'Pcs';

        // 1. Simpan riwayat penerimaan
        await supabase.from('receptions').insert([
          {
            location_id: activeLocationId,
            item_name: itemName,
            quantity: qtyNum,
            unit,
            source,
            notes: notes.trim() || null,
            received_by: activeStaffName,
          },
        ]);

        // 2. Update atau tambah stok fisik cabang
        const { data: existingStock } = await supabase
          .from('branch_stocks')
          .select('id, remaining_stock')
          .eq('location_id', activeLocationId)
          .eq('item_name', itemName)
          .maybeSingle();

        if (existingStock) {
          const newStock = Number(existingStock.remaining_stock || 0) + qtyNum;
          await supabase
            .from('branch_stocks')
            .update({
              remaining_stock: newStock,
              updated_by: activeStaffName,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingStock.id);
        } else {
          await supabase.from('branch_stocks').insert([
            {
              location_id: activeLocationId,
              item_name: itemName,
              initial_stock: qtyNum,
              remaining_stock: qtyNum,
              unit,
              updated_by: activeStaffName,
            },
          ]);
        }
      }

      setMessage({
        text: `Sukses menerima dan menambahkan ${validEntries.length} barang ke stok cabang!`,
        type: 'success',
      });
      setQuantities({});
      setNotes('');
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menyimpan penerimaan barang.', type: 'error' });
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
          <PackageCheck className="w-5 h-5 text-amber-800" />
          <div>
            <h2 className="text-base font-bold text-neutral-800">Lembar Penerimaan Barang Datang</h2>
            <p className="text-xs text-neutral-500">Ketik jumlah fisik barang yang baru sampai di outlet.</p>
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

      {/* Pilihan Sumber Pengiriman */}
      <div className="mb-4">
        <label className="block text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1.5">
          Asal Barang / Sumber
        </label>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setSource('Dapur Pusat')}
            className={`py-2 px-3 rounded-xl border text-center font-bold transition-all ${
              source === 'Dapur Pusat'
                ? 'bg-amber-900 text-white border-amber-900 shadow-sm'
                : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
            }`}
          >
            Dapur Pusat
          </button>
          <button
            type="button"
            onClick={() => setSource('Belanja Luar / Supplier')}
            className={`py-2 px-3 rounded-xl border text-center font-bold transition-all ${
              source === 'Belanja Luar / Supplier'
                ? 'bg-amber-900 text-white border-amber-900 shadow-sm'
                : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
            }`}
          >
            Belanja Luar / Supplier
          </button>
        </div>
      </div>

      {/* Pencarian & Tab Kategori */}
      <div className="space-y-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari barang diterima (misal: kuah, halus, minyak, gas)..."
            className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORY_ORDER.map((cat) => (
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

      {/* Tabel Checklist */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="border border-neutral-200 rounded-xl overflow-hidden max-h-[28rem] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-neutral-100/90 sticky top-0 border-b border-neutral-200 z-10 backdrop-blur-sm">
              <tr className="text-neutral-700 font-bold uppercase tracking-wider">
                <th className="py-2.5 px-3">Nama Barang</th>
                <th className="py-2.5 px-3 text-right w-36">Jumlah Diterima</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {Object.keys(groupedItems).length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-8 text-center text-neutral-400">
                    Tidak ada barang ditemukan.
                  </td>
                </tr>
              ) : (
                Object.entries(groupedItems).map(([groupName, groupList]) => (
                  <React.Fragment key={groupName}>
                    <tr className="bg-amber-50/70 border-y border-amber-200/60">
                      <td colSpan={2} className="py-1.5 px-3 font-bold text-amber-900 uppercase tracking-wider text-[11px]">
                        📦 {groupName} ({groupList.length} item)
                      </td>
                    </tr>
                    {groupList.map((item) => {
                      const val = quantities[item.name] || '';
                      const isSelected = parseFloat(val) > 0;
                      return (
                        <tr
                          key={item.id}
                          className={`transition-colors ${
                            isSelected ? 'bg-amber-100/50 font-semibold' : 'hover:bg-neutral-50'
                          }`}
                        >
                          <td className="py-2 px-3 text-neutral-800">{item.name}</td>
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
                              <span className="text-[11px] text-neutral-500 w-10 text-left">
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
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
            Catatan Kondisi Barang
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Kondisi beku baik, plastik utuh, dsb (opsional)"
            className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading || totalFilled === 0}
          className="w-full py-2.5 bg-amber-900 hover:bg-amber-800 text-white text-xs font-bold rounded-xl shadow transition-all disabled:opacity-50"
        >
          {loading ? 'Menyimpan...' : `Konfirmasi Penerimaan (${totalFilled} Item)`}
        </button>
      </form>
    </div>
  );
}