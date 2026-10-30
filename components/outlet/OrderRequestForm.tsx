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
  PackageCheck,
  Calendar,
  X,
  Clock
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

  // Default otomatis H+1 (karena biasanya diorder malam untuk kebutuhan besok)
  const getDefaultTargetDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(d);
  };

  const [targetDate, setTargetDate] = useState<string>(getDefaultTargetDate());
  const [items, setItems] = useState<MasterItem[]>([]);
  const [currentStocks, setCurrentStocks] = useState<Record<string, number>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [orderStatuses, setOrderStatuses] = useState<Record<string, string>>({});
  const [activeSupplier, setActiveSupplier] = useState<string>('Semua Supplier');
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // State Modal Konfirmasi Tanggal sebelum Submit
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  const cleanName = (name?: string) => {
    return (name || '').trim().toUpperCase().replace(/\s+/g, ' ');
  };

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
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .order('name');
      
      if (itemsError) {
        console.error('Gagal mengambil master items:', itemsError);
      } else if (itemsData) {
        setItems(itemsData);
      }

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

    // Otomatis default ke ORDERED_LEADER tanpa status menunggu
    if (parseFloat(val) > 0 && !orderStatuses[itemName]) {
      setOrderStatuses((prev) => ({
        ...prev,
        [itemName]: 'ORDERED_LEADER',
      }));
    }
  };

  const handleStatusChange = (itemName: string, statusVal: string) => {
    setOrderStatuses((prev) => ({
      ...prev,
      [itemName]: statusVal,
    }));
  };

  const totalFilled = useMemo(() => {
    return Object.values(quantities).filter((q) => parseFloat(q) > 0).length;
  }, [quantities]);

  // Tahap 1: Ketika tombol kirim ditekan di form utama, munculkan konfirmasi tanggal
  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalFilled === 0) {
      alert('Isi minimal satu barang dengan jumlah lebih dari 0.');
      return;
    }
    // Update ulang default tanggal ke H+1 saat tombol ditekan agar tetap fresh jika proses input lewat tengah malam
    setTargetDate(getDefaultTargetDate());
    setShowConfirmModal(true);
  };

  // Tahap 2: Eksekusi kirim ke Supabase setelah tanggal dipastikan di modal
  const handleFinalSubmit = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const orderPayload = Object.entries(quantities)
        .filter(([_, qty]) => parseFloat(qty) > 0)
        .map(([itemName, qty]) => {
          const itemMeta = items.find((i) => i.name === itemName);
          const chosenStatus = orderStatuses[itemName] || 'ORDERED_LEADER';
          const isDirectLeader = chosenStatus === 'ORDERED_LEADER';
          const supName = itemMeta?.supplier || 'RUMAH PRODUKSI';
          
          return {
            location_id: activeLocationId,
            order_date: targetDate, // Tanggal yang sudah dikonfirmasi di modal
            item_name: itemName,
            quantity: parseFloat(qty),
            unit: itemMeta?.uom || 'Pcs',
            source_type: supName === 'RUMAH PRODUKSI' ? 'PRODUCTION' : 'VENDOR',
            target_type: supName,
            supplier: supName,
            notes: notes.trim() ? notes.trim() : null,
            requested_by: activeStaffName,
            status: chosenStatus,
            is_ordered_by_leader: isDirectLeader,
            created_at: new Date().toISOString()
          };
        });

      if (orderPayload.length === 0) {
        throw new Error('Tidak ada barang yang dipesan.');
      }

      const { error } = await supabase.from('order_requests').insert(orderPayload);
      if (error) throw error;

      setMessage({
        text: `Berhasil mengirim ${orderPayload.length} permintaan belanja untuk operasional tanggal ${targetDate}!`,
        type: 'success',
      });

      setQuantities({});
      setOrderStatuses({});
      setNotes('');
      setShowConfirmModal(false);
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
              Periksa stok akhir, isi jumlah kebutuhan & tentukan penanggung jawab pemesanan.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs font-black px-3.5 py-1.5 bg-orange-50 text-[#ff6f3c] border border-orange-200/60 rounded-full">
            {totalFilled} barang diisi
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

      <div className="space-y-3 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
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

      <form onSubmit={handlePreSubmit} className="space-y-6">
        <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-[32rem] overflow-y-auto shadow-2xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50/90 sticky top-0 border-b border-slate-100 z-10 backdrop-blur-xs">
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 min-w-[200px]">Nama Bahan & Supplier</th>
                <th className="py-3 px-4 text-center w-36">Stok Akhir</th>
                <th className="py-3 px-4 text-right w-40">Jumlah Pesan</th>
                <th className="py-3 px-4 text-center w-52">Status Pemesanan</th>
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
                      const currentStatus = orderStatuses[item.name] || 'ORDERED_LEADER';
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

                          {/* Dropdown status pemesanan (HANYA 3 STATUS TANPA Menunggu Pembelian) */}
                          <td className="py-2 px-4 text-center">
                            <select
                              value={currentStatus}
                              onChange={(e) => handleStatusChange(item.name, e.target.value)}
                              disabled={!isSelected}
                              className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all focus:outline-none cursor-pointer ${
                                !isSelected
                                  ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                                  : currentStatus === 'ORDERED_LEADER'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-black'
                                  : currentStatus === 'BOUGHT_CASHIER'
                                  ? 'bg-blue-50 text-blue-700 border-blue-300 font-black'
                                  : 'bg-purple-50 text-purple-700 border-purple-300 font-black'
                              }`}
                            >
                              <option value="ORDERED_LEADER">✓ Diorder Leader</option>
                              <option value="BOUGHT_CASHIER">💵 Dibeli Kasir</option>
                              <option value="PROCESSED_LOGISTICS">🚚 Diproses Logistik</option>
                            </select>
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

        {/* Input Catatan Tambahan */}
        <div>
          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
            Catatan Tambahan untuk Pengadaan / Dapur
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ketik catatan di sini jika ada kebutuhan khusus (opsional)..."
            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
          />
        </div>

        {/* Tombol Buka Konfirmasi */}
        <button
          type="submit"
          disabled={loading || totalFilled === 0}
          className="w-full py-3.5 bg-gradient-to-r from-[#ff6f3c] to-orange-500 hover:from-orange-600 hover:to-orange-500 text-white text-xs font-black rounded-2xl shadow-lg shadow-orange-500/25 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          <span>Kirim Permintaan Belanja ({totalFilled} Item Terpilih)</span>
        </button>
      </form>

      {/* MODAL POPUP: KONFIRMASI TANGGAL SEBELUM MENGIRIM */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-orange-50 text-[#ff6f3c] flex items-center justify-center font-black">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Konfirmasi Tanggal Operasional</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Pastikan tanggal kebutuhan belanja sudah benar</p>
                </div>
              </div>
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3.5 bg-amber-50/70 border border-amber-200/60 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Karena penginputan sering lewat tengah malam, pastikan tanggal di bawah sesuai dengan <b>hari operasional penggunaan bahan</b>.
                </span>
              </div>

              {/* Pemilihan Tanggal Tepat Sebelum Kirim */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Tanggal Kebutuhan Operasional:
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#ff6f3c] cursor-pointer"
                />
              </div>

              {/* Rangkuman Singkat Item yang Dipesan */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Total Barang:</span>
                  <span className="text-[#ff6f3c] font-black">{totalFilled} Barang</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Pelapor / Pengirim:</span>
                  <span className="font-semibold text-slate-700">{activeStaffName}</span>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleFinalSubmit}
                  className="w-2/3 py-2.5 bg-gradient-to-r from-[#ff6f3c] to-orange-500 hover:from-orange-600 hover:to-orange-500 text-white font-black text-xs rounded-xl shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{loading ? 'Mengirim...' : 'Kirim Sekarang'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}