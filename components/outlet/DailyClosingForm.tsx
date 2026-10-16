'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Moon, ArrowLeft, CheckCircle2, AlertCircle, Search } from 'lucide-react';

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
          <Moon className="w-5 h-5 text-amber-800" />
          <div>
            <h2 className="text-base font-bold text-neutral-800">Form Closing & Opname Malam</h2>
            <p className="text-xs text-neutral-500">Catat sisa fisik barang di etalase dan barang rusak/waste.</p>
          </div>
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

      <div className="space-y-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari barang closing..."
            className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text