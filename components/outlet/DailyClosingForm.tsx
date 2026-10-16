'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Moon, ArrowLeft, CheckCircle2, AlertCircle, Search, Save } from 'lucide-react';

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

export default function DailyClosingForm({ user, onBack, locationId, staffName }: Props) {
  const activeLocationId = locationId || user?.location_id;
  const activeStaffName = staffName || user?.active_staff_name || user?.username || 'Petugas Outlet';

  const [items, setItems] = useState<MasterItem[]>([]);
  const [closingStocks, setClosingStocks] = useState<Record<string, string>>({});
  const [wasteStocks, setWasteStocks] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState<string>('Semua');
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    async function fetchItemsAndCurrentStocks() {
      const { data: itemData } = await supabase.from('items').select('*').order('name');
      if (itemData) setItems(itemData);

      if (activeLocationId) {
        const { data: stockData } = await supabase
          .from('branch_stocks')
          .select('item_name, remaining_stock')
          .eq('location_id', activeLocationId);

        if (stockData) {
          const initMap: Record<string, string> = {};
          stockData.forEach((s) => {
            initMap[s.item_name] = String(s.remaining_stock ?? '');
          });
          setClosingStocks(initMap);
        }
      }
    }
    fetchItemsAndCurrentStocks();
  }, [activeLocationId]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const closingEntries = items.filter(
        (i) => closingStocks[i.name] !== undefined || wasteStocks[i.name] !== undefined
      );

      const todayStr = new Date().toISOString().split('T')[0];

      for (const item of closingEntries) {
        const remainQty = parseFloat(closingStocks[item.name] || '0');
        const wasteQty = parseFloat(wasteStocks[item.name] || '0');

        await supabase.from('daily_closings').upsert(
          {
            closing_date: todayStr,
            location_id: activeLocationId,
            item_name: item.name,
            remaining_stock: isNaN(remainQty) ? 0 : remainQty,
            waste_qty: isNaN(wasteQty) ? 0 : wasteQty,
            unit: item.uom || 'Pcs',
            notes: notes.trim() || null,
            reported_by: activeStaffName,
          },
          { onConflict: 'closing_date, location_id, item_name' }
        );

        await supabase.from('branch_stocks').upsert(
          {
            location_id: activeLocationId,
            item_name: item.name,
            remaining_stock: isNaN(remainQty) ? 0 : remainQty,
            unit: item.uom || 'Pcs',
            updated_by: activeStaffName,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'location_id, item_name' }
        );
      }

      setMessage({
        text: 'Sukses menyimpan laporan closing sisa stok fisik & waste hari ini!',
        type: 'success',
      });
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menyimpan closing harian.', type: 'error' });
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20">
            <Moon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Form Closing & Opname Malam</h2>
            <p className="text-xs font-medium text-slate-400">Catat sisa fisik barang di etalase dan barang rusak/waste.</p>
          </div>
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

      {/* Search & Categories */}
      <div className="space-y-3 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari barang closing..."
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

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-[30rem] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50/80 sticky top-0 border-b border-slate-100 z-10 backdrop-blur-sm">
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Nama Barang</th>
                <th className="py-3 px-3 text-right w-32">Sisa Bersih</th>
                <th className="py-3 px-3 text-right w-32 text-red-500">Waste / Basi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(groupedItems).map(([groupName, groupList]) => (
                <React.Fragment key={groupName}>
                  <tr className="bg-slate-50/50 border-y border-slate-100">
                    <td colSpan={3} className="py-2.5 px-4 font-black text-slate-700 uppercase tracking-wider text-[11px]">
                      • {groupName}
                    </td>
                  </tr>
                  {groupList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-4 text-slate-800 font-semibold">
                        {item.name}
                        <span className="text-[10px] text-slate-400 font-normal ml-1.5">({item.uom})</span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={closingStocks[item.name] || ''}
                          onChange={(e) =>
                            setClosingStocks({ ...closingStocks, [item.name]: e.target.value })
                          }
                          placeholder="0"
                          className="w-20 px-3 py-1.5 text-right bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={wasteStocks[item.name] || ''}
                          onChange={(e) =>
                            setWasteStocks({ ...wasteStocks, [item.name]: e.target.value })
                          }
                          placeholder="0"
                          className="w-20 px-3 py-1.5 text-right bg-red-50/50 border border-red-200 rounded-xl text-xs font-bold text-red-600 focus:bg-white focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                        />
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
            Catatan Penjelasan Waste / Kondisi Outlet
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Misal: 4 porsi bakso kuah tumpah, 2 sawi kuning dibuang (opsional)"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black rounded-2xl shadow-lg shadow-purple-600/25 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Menyimpan Closing...' : 'Simpan Laporan Closing & Opname Malam'}
        </button>
      </form>
    </div>
  );
}