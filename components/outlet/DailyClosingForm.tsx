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

      // Ambil data sisa stok yang tercatat sebelumnya
      if (activeLocationId) {
        const { data: stockData } = await supabase
          .from('branch_stocks')
          .select('item_name, remaining_stock')
          .eq('location_id', activeLocationId);

        if (stockData) {
          const initMap: Record<string, string> = {};
          stockData.forEach((s) => {
            initMap[s.item_name] = String(s.remaining_stock);
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

        // 1. Simpan rekap penutupan harian ke daily_closings
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

        // 2. Perbarui saldo sisa fisik cabang di branch_stocks
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
        text: `Sukses menyimpan laporan closing sisa stok fisik & waste hari ini!`,
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
          className="text-xs font-bold text-neutral-500 hover:text-amber-800 mb-4 flex items-center gap-1.5 transition-colors