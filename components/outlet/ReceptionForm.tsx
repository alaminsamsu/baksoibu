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
  const [activeCategory, setActiveCategory] = useState<string>('Semua');
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('items').select('*').order('name');
      if (error) throw error;
      if (data) setItems(data);
    } catch (err: any) {
      console.error('Gagal mengambil master items:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleQtyChange = (itemName: string, val: string) => {
    setQuantities((prev) => ({ ...prev, [itemName]: val }));
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchCat = activeCategory === 'Semua' || item.category === activeCategory;
      const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [items, activeCategory, searchTerm]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, MasterItem[]> = {};
    CATEGORY_ORDER.forEach((cat) => { groups[cat] = []; });

    filteredItems.forEach((item) => {
      const cat = CATEGORY_ORDER.includes(item.category) ? item.category : 'Lain-lain';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });

    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => a.name.localeCompare(b.name));
    });

    return groups;
  }, [filteredItems]);

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

      const now = new Date();

      for (const [itemName, qtyStr] of validEntries) {
        const qtyNum = parseFloat(qtyStr);
        const itemMeta = items.find((i) => i.name === itemName);
        const unit = itemMeta?.uom || 'Pcs';

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
            category: itemMeta?.category || 'Bakso & Olahan Frozen',
            updated_by: `${activeStaffName} (Terima Barang)`,
            last_updated_by: `${activeStaffName} (Terima Barang)`,
            updated_at: now.toISOString(),
            last_updated: now.toISOString(),
          },
          { onConflict: 'location_id, item_name' }
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
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-sm shadow-slate-200/50 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-600 transition-all mr-1"
              title="Kembali"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-800 tracking-tight">
              Lembar Penerimaan Barang Datang
            </h2>
            <p className="text-xs font-medium text-slate-400">
              Konfirmasi fisik barang nyata yang tiba di outlet.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full">
            {totalFilled} barang terisi
          </span>
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
            placeholder="Cari barang diterima..."
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {['Semua', ...CATEGORY_ORDER].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-[30rem] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50/80 sticky top-0 border-b border-slate-100 z-10">
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Nama Barang</th>
                <th className="py-3 px-4 text-right w-36">Jumlah Diterima</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-12 text-center text-slate-400 font-medium">
                    Tidak ada barang ditemukan.
                  </td>
                </tr>
              ) : (
                Object.entries(groupedItems).map(([groupName, groupList]) => {
                  if (groupList.length === 0) return null;
                  return (
                    <React.Fragment key={groupName}>
                      <tr className="bg-slate-100/70 border-y border-slate-200">
                        <td colSpan={2} className="py-2 px-4 font-black text-indigo-900 uppercase tracking-wider text-[11px]">
                          • {groupName} <span className="text-slate-500 font-normal lowercase">({groupList.length} item)</span>
                        </td>
                      </tr>
                      {groupList.map((item) => {
                        const val = quantities[item.name] || '';
                        const isSelected = parseFloat(val) > 0;
                        return (
                          <tr
                            key={item.id}
                            className={`transition