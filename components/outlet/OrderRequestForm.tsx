'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  ShoppingBag, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Send, 
  Store, 
  CheckSquare, 
  Square,
  PackageCheck
} from 'lucide-react';

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
  supplier?: string;
}

const CATEGORY_ORDER = [
  'Bahan Utama & Dapur',
  'Kondimen & Pelengkap',
  'Minuman & Es',
  'Kemasan & Operasional'
];

const VENDOR_LIST = [
  'Semua Supplier',
  'RUMAH PRODUKSI',
  'VENDOR HAMDALAH',
  'KARYA HARAPAN',
  'SATU SAMA',
  'SUMBER PLASTIK',
  'VENDOR PASAR',
  'VENDOR UBI BTP',
  'VENDOR TISU',
  'VENDOR AIR',
  'VENDOR GALON',
  'VENDOR GAS',
  'VENDOR ES BATU',
];

export default function OrderRequestForm({ user, onBack, locationId, staffName }: Props) {
  const activeLocationId = locationId || user?.location_id;
  const activeStaffName = staffName || user?.active_staff_name || user?.username || 'Petugas Outlet';

  // LOGIKA BISNIS: Cut-off jam 06:00 pagi WITA. 
  // Jika kru order jam 00:00 - 05:59 dini hari, otomatis tanggal belanja adalah kemarin (H-1).
  const getEffectiveOrderDate = () => {
    const now = new Date();
    const witaHour = parseInt(
      new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', hour: 'numeric', hour12: false }).format(now)
    );
    const d = new Date();
    if (witaHour < 6) {
      d.setDate(d.getDate() - 1);
    }
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(d);
  };

  const [items, setItems] = useState<MasterItem[]>([]);
  const [currentStocks, setCurrentStocks] = useState<Record<string, number>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [orderedByLeader, setOrderedByLeader] = useState<Record<string, boolean>>({});
  
  const [activeSupplier, setActiveSupplier] = useState<string>('Semua Supplier');
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const cleanName = (name?: string) => {
    return (name || '').trim().toUpperCase().replace(/\s+/g, ' ');
  };

  // Standarisasi ke 4 Kategori Baku (Identik dengan Laporan Pemakaian & Monitor Stok)
  const normalizeCategory = (rawCat?: string, itemName?: string) => {
    const cat = (rawCat || '').trim();
    const name = cleanName(itemName);

    if (
      cat === 'Bahan Utama & Dapur' || 
      cat === 'Bahan Dapur & Bumbu' ||
      cat === 'Sayur, Mie & Pelengkap' ||
      cat === 'Bakso & Olahan Frozen' ||
      name.includes('AYAM') ||
      name.includes('BUMBU') ||
      name.includes('MASAKO') ||
      name.includes('GARAM') ||
      name.includes('LADAKU') ||
      name.includes('VITSIN') ||
      name.includes('MSG') ||
      name.includes('MINYAK') ||
      name.includes('TELUR') ||
      name.includes('BAKSO') ||
      name.includes('BIHUN') ||
      name.includes('BAWANG') ||
      name.includes('BURAS') ||
      name.includes('CUKA') ||
      name.includes('TAHU')
    ) {
      return 'Bahan Utama & Dapur';
    }

    if (cat === 'Kondimen & Pelengkap' || name.includes('KECAP') || name.includes('SAOS') || name.includes('SAUS') || name.includes('SAMBAL')) {
      return 'Kondimen & Pelengkap';
    }

    if (cat === 'Minuman & Es' || name.includes('TEH') || name.includes('AIR MINERAL') || name.includes('SIRUP')) {
      return 'Minuman & Es';
    }

    if (
      cat === 'Kemasan & Operasional' || 
      name.includes('SEDOTAN') || 
      name.includes('PIPET') || 
      name.includes('TISU') || 
      name.includes('TISSUE') || 
      name.includes('PLASTIK') || 
      name.includes('CUP') || 
      name.includes('KERTAS') ||
      name.includes('TALI')
    ) {
      return 'Kemasan & Operasional';
    }

    return 'Bahan Utama & Dapur';
  };

  useEffect(() => {
    async function fetchData() {
      // 1. Tarik Data Master Items
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .order('name');
      
      if (itemsError) {
        console.error('Gagal mengambil master items:', itemsError);
      } else if (itemsData) {
        setItems(itemsData);
      }

      // 2. Tarik Data Stok Akhir / Berjalan Cabang Saat Ini
      if (activeLocationId) {
        const { data: stockData, error: stockError } = await supabase
          .from('branch_stocks')
          .select('item_name, remaining_stock')
          .eq('location_id', activeLocationId);

        if (stockError) {
          console.error('Gagal mengambil branch stocks:', stockError);
        } else if (stockData) {
          const stockMap: Record<string, number> = {};
          stockData.forEach((s) => {
            stockMap[cleanName(s.item_name)] = Number(s.remaining_stock || 0);
          });
          setCurrentStocks(stockMap);
        }
      }
    }

    fetchData();
  }, [activeLocationId]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSupplier =
        activeSupplier === 'Semua Supplier' ||
        (item.supplier || 'RUMAH PRODUKSI').toUpperCase() === activeSupplier.toUpperCase();
      const matchSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.category || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchSupplier && matchSearch;
    });
  }, [items, activeSupplier, searchTerm]);

  // Kelompokkan Berdasarkan 4 Kategori Baku & Urutkan A-Z
  const groupedByCategory = useMemo(() => {
    const groups: Record<string, MasterItem[]> = {
      'Bahan Utama & Dapur': [],
      'Kondimen & Pelengkap': [],
      'Minuman & Es': [],
      'Kemasan & Operasional': [],
    };

    filteredItems.forEach((item) => {
      const normalizedCat = normalizeCategory(item.category, item.name);
      groups[normalizedCat].push(item);
    });

    const ordered: { category: string; items: MasterItem[] }[] = [];
    CATEGORY_ORDER.forEach((cat) => {
      if (groups[cat] && groups[cat].length > 0) {
        // Urutkan A-Z di setiap kategori
        groups[cat].sort((a, b) => a.name.localeCompare(b.name));
        ordered.push({ category: cat, items: groups[cat] });
      }
    });

    return ordered;
  }, [filteredItems]);

  const handleQtyChange = (itemName: string, val: string) => {
    setQuantities((prev) => ({
      ...prev,
      [itemName]: val,
    }));
  };

  const handleToggleOrdered = (itemName: string) => {
    setOrderedByLeader((prev) => ({
      ...prev,
      [itemName]: !prev[itemName],
    }));
  };

  const totalFilled = useMemo(() => {
    return Object.values(quantities).filter((q) => parseFloat(q) > 0).length;
  }, [quantities]);

  const totalDirectOrdered = useMemo(() => {
    return Object.entries(quantities).filter(
      ([name, q]) => parseFloat(q) > 0 && orderedByLeader[name]
    ).length;
  }, [quantities, orderedByLeader]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const orderDate = getEffectiveOrderDate();
      const orderPayload = Object.entries(quantities)
        .filter(([_, qty]) => parseFloat(qty) > 0)
        .map(([itemName, qty]) => {
          const itemMeta = items.find((i) => i.name === itemName);
          const isDirect = !!orderedByLeader[itemName];
          const supName = itemMeta?.supplier || 'RUMAH PRODUKSI';
          return {
            location_id: activeLocationId,
            item_name: itemName,
            quantity: parseFloat(qty),
            unit: itemMeta?.uom || 'Pcs',
            source_type: supName === 'RUMAH PRODUKSI' ? 'PRODUCTION' : 'VENDOR',
            target_type: supName,
            supplier: supName,
            notes: notes.trim() || null,
            requested_by: activeStaffName,
            status: isDirect ? 'ORDERED_BY_LEADER' : 'pending',
            is_ordered_by_leader: isDirect,
            created_at: new Date().toISOString()
          };
        });

      if (orderPayload.length === 0) {
        throw new Error('Isi minimal satu barang dengan jumlah lebih dari 0.');
      }

      const { error } = await supabase.from('order_requests').insert(orderPayload);
      if (error) throw error;

      setMessage({
        text: `Berhasil mengirim ${orderPayload.length} permintaan belanja untuk tanggal ${orderDate}! (${totalDirectOrdered} item ditandai sudah diorder oleh Leader).`,
        type: 'success',
      });
      setQuantities({});
      setOrderedByLeader({});
      setNotes('');
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal mengirim order.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-sm shadow-slate-200/50 font-sans">
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

      {/* Header Form */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#ff6f3c] text-white flex items-center justify-center shadow-md shadow-orange-500/20">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Lembar Permintaan Belanja</h2>
            <p className="text-xs font-medium text-slate-400">
              Periksa stok akhir, isi kebutuhan bahan & beri tanda jika bahan sudah langsung dipesan ke vendor oleh Leader.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs font-black px-3.5 py-1.5 bg-orange-50 text-[#ff6f3c] border border-orange-200/60 rounded-full">
            {totalFilled} barang diisi
          </div>
          {totalDirectOrdered > 0 && (
            <div className="text-xs font-black px-3.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
              {totalDirectOrdered} diorder Leader
            </div>
          )}
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

      {/* Pencarian & Filter Tab Vendor */}
      <div className="space-y-3 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari barang cepat (misal: ayam, plastik, bakso, kecap)..."
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none">
          {VENDOR_LIST.map((sup) => {
            const isActive = activeSupplier === sup;
            const vendorItems = items.filter((i) => (i.supplier || 'RUMAH PRODUKSI').toUpperCase() === sup.toUpperCase());
            const filledCount = vendorItems.filter((i) => parseFloat(quantities[i.name] || '0') > 0).length;

            return (
              <button
                key={sup}
                type="button"
                onClick={() => setActiveSupplier(sup)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? 'bg-[#ff6f3c] text-white shadow-md shadow-orange-500/20'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-100'
                }`}
              >
                <Store className="w-3 h-3" />
                <span>{sup}</span>
                {filledCount > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-white text-[#ff6f3c]' : 'bg-[#ff6f3c] text-white'
                  }`}>
                    {filledCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Form & Tabel Barang */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-[32rem] overflow-y-auto shadow-2xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50/90 sticky top-0 border-b border-slate-100 z-10 backdrop-blur-xs">
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 min-w-[200px]">Nama Bahan & Supplier</th>
                <th className="py-3 px-4 text-center w-36">Stok Akhir</th>
                <th className="py-3 px-4 text-right w-40">Jumlah Pesan</th>
                <th className="py-3 px-4 text-center w-44">Sudah Diorder Leader?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupedByCategory.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                    Tidak ada barang ditemukan untuk filter ini.
                  </td>
                </tr>
              ) : (
                groupedByCategory.map(({ category, items: groupList }) => (
                  <React.Fragment key={category}>
                    {/* HEADER SEKAT KATEGORI */}
                    <tr className="bg-indigo-50/60 border-y border-indigo-100/90">
                      <td colSpan={4} className="py-2.5 px-4 font-black text-indigo-900 uppercase tracking-wider text-[11px]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block"></span>
                            <span>{category}</span>
                          </div>
                          <span className="text-[10px] font-bold text-indigo-500 normal-case tracking-normal">
                            {groupList.length} Bahan Baku
                          </span>
                        </div>
                      </td>
                    </tr>

                    {groupList.map((item) => {
                      const val = quantities[item.name] || '';
                      const isSelected = parseFloat(val) > 0;
                      const isOrdered = !!orderedByLeader[item.name];
                      const stockVal = currentStocks[cleanName(item.name)] ?? 0;
                      const isLowStock = stockVal <= 2;

                      return (
                        <tr
                          key={item.id}
                          className={`transition-colors ${
                            isSelected ? 'bg-orange-50/40 font-bold' : 'hover:bg-slate-50/60'
                          }`}
                        >
                          <td className="py-2.5 px-4">
                            <div className="text-slate-900 font-extrabold leading-tight">{item.name}</div>
                            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                              {item.supplier || 'RUMAH PRODUKSI'} • {item.category}
                            </div>
                          </td>

                          <td className="py-2 px-4 text-center">
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100/80 rounded-xl border border-slate-200/60">
                              <PackageCheck className="w-3 h-3 text-slate-400" />
                              <span className={`font-black text-xs ${isLowStock ? 'text-rose-600' : 'text-slate-700'}`}>
                                {stockVal}
                              </span>
                              <span className="text-[10px] font-medium text-slate-400">
                                {item.uom || 'Pcs'}
                              </span>
                            </div>
                          </td>

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
                              <span className="text-[11px] text-slate-400 w-12 text-left font-semibold">
                                {item.uom || 'Pcs'}
                              </span>
                            </div>
                          </td>

                          <td className="py-2 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleOrdered(item.name)}
                              disabled={!isSelected}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                !isSelected
                                  ? 'opacity-30 cursor-not-allowed text-slate-400'
                                  : isOrdered
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                              }`}
                              title={isSelected ? 'Centang jika Leader sudah memesan ke vendor' : 'Isi jumlah dulu'}
                            >
                              {isOrdered ? (
                                <CheckSquare className="w-4 h-4 text-white" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400" />
                              )}
                              <span>{isOrdered ? 'Sudah Diorder' : 'Belum Diorder'}</span>
                            </button>
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
            Catatan Tambahan untuk Pengadaan / Dapur
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Misal: Mohon dikirim sebelum jam 10.00 pagi atau bawa kantong tambahan (opsional)"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={loading || totalFilled === 0}
          className="w-full py-3.5 bg-gradient-to-r from-[#ff6f3c] to-orange-500 hover:from-orange-600 hover:to-orange-500 text-white text-xs font-black rounded-2xl shadow-lg shadow-orange-500/25 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          {loading ? 'Mengirim Permintaan...' : `Kirim Permintaan Belanja (${totalFilled} Item Terpilih)`}
        </button>
      </form>
    </div>
  );
}