'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { PackageCheck, ArrowLeft, CheckCircle2, AlertCircle, Search, Check, RefreshCw } from 'lucide-react';

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
  'Bakso & Olahan Frozen',
  'Bahan Dapur & Bumbu',
  'Sayur, Mie & Pelengkap',
  'Minuman & Es',
  'Kemasan & Operasional',
  'Lain-lain'
];

export default function ReceptionForm({ user, onBack, locationId, staffName }: Props) {
  const activeLocationId = locationId || user?.location_id;
  const activeStaffName = staffName || user?.active_staff_name || user?.username || 'Petugas Outlet';

  const [items, setItems] = useState<MasterItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('items').select('*').order('name');
      if (error) {
        console.error('Gagal mengambil master items:', error);
      } else if (data) {
        setItems(data);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleQtyChange = (itemName: string, val: string) => {
    setQuantities((prev) => ({
      ...prev,
      [itemName]: val,
    }));
  };

  const totalFilled = useMemo(() => {
    return Object.values(quantities).filter((q) => parseFloat(q) > 0).length;
  }, [quantities]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = selectedCategory === 'Semua' || (item.category || 'Lain-lain') === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [items, searchTerm, selectedCategory]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, MasterItem[]> = {};
    filteredItems.forEach((item) => {
      const cat = item.category || 'Lain-lain';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });

    const ordered: { category: string; list: MasterItem[] }[] = [];
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const validEntries = Object.entries(quantities).filter(([_, qty]) => parseFloat(qty) > 0);

      if (validEntries.length === 0) {
        throw new Error('Ketik minimal 1 barang dengan jumlah lebih dari 0.');
      }

      const now = new Date();

      for (const [itemName, qtyStr] of validEntries) {
        const qtyNum = parseFloat(qtyStr);
        const itemMeta = items.find((i) => i.name === itemName);
        const unit = itemMeta?.uom || 'porsi';
        const category = itemMeta?.category || 'Lain-lain';

        await supabase.from('stock_movements').insert([
          {
            location_id: activeLocationId,
            item_name: itemName,
            quantity: qtyNum,
            unit,
            movement_type: 'MASUK',
            notes: notes.trim() || 'Penerimaan barang fisik tiba di outlet',
            recorded_by: activeStaffName,
            created_at: now.toISOString(),
          },
        ]);

        await supabase.from('branch_stocks').upsert(
          {
            location_id: activeLocationId,
            item_name: itemName,
            unit,
            category,
            updated_by: `${activeStaffName} (Terima Barang)`,
            last_updated_by: `${activeStaffName} (Terima Barang)`,
            updated_at: now.toISOString(),
            last_updated: now.toISOString(),
          },
          { onConflict: 'location_id,item_name' }
        );
      }

      setMessage({
        text: `Sukses mencatat ${validEntries.length} barang fisik masuk! Kolom (+ Masuk) di pergerakan stok cabang otomatis terisi.`,
        type: 'success',
      });
      setQuantities({});
      setNotes('');
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menyimpan penerimaan barang.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-xs max-w-4xl mx-auto space-y-6">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Dashboard
        </button>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Lembar Penerimaan Barang Datang</h2>
            <p className="text-xs font-medium text-slate-400">Konfirmasi fisik barang nyata yang tiba di outlet.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs font-black px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-200/60 rounded-full w-fit">
            {totalFilled} barang terisi
          </div>
          <button
            type="button"
            onClick={fetchItems}
            className="p-2 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 ${
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

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari barang diterima (misal: kuah, halus, minyak, gas)..."
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {['Semua', ...CATEGORY_ORDER].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
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

      {loading ? (
        <div className="text-center py-12 text-xs text-slate-400 font-bold">Memuat daftar barang...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-[30rem] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50/80 sticky top-0 border-b border-slate-100 z-10 backdrop-blur-xs">
                <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Nama Barang</th>
                  <th className="py-3 px-4 text-right w-36">Jumlah Diterima</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupedItems.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-12 text-center text-slate-400 font-medium">
                      Tidak ada barang ditemukan.
                    </td>
                  </tr>
                ) : (
                  groupedItems.map(({ category, list }) => (
                    <React.Fragment key={category}>
                      <tr className="bg-slate-50/80 border-y border-slate-100">
                        <td colSpan={2} className="py-2 px-4 font-black text-slate-700 uppercase tracking-wider text-[11px]">
                          • {category} <span className="text-slate-400 font-normal lowercase">({list.length} item)</span>
                        </td>
                      </tr>
                      {list.map((item) => {
                        const val = quantities[item.name] || '';
                        const isSelected = parseFloat(val) > 0;
                        return (
                          <tr
                            key={item.id}
                            className={`transition-colors ${
                              isSelected ? 'bg-indigo-50/40 font-bold' : 'hover:bg-slate-50/60'
                            }`}
                          >
                            <td className="py-2.5 px-4 text-slate-800 uppercase">{item.name}</td>
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
                                      ? 'bg-white border-indigo-600 text-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                                      : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-500'
                                  }`}
                                />
                                <span className="text-[11px] text-slate-400 w-10 text-left font-semibold">
                                  {item.uom || 'porsi'}
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
              Catatan Kondisi Barang
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Kondisi beku baik, plastik utuh, dsb (opsional)"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || totalFilled === 0}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white text-xs font-black rounded-2xl shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>{submitting ? 'Menyimpan...' : `Konfirmasi Penerimaan (${totalFilled} Item)`}</span>
          </button>
        </form>
      )}
    </div>
  );
}