'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Send, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Search, 
  Layers, 
  Store,
  Calendar
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
}

interface RequestItemRow {
  item_name: string;
  category: string;
  unit: string;
  quantity: number | string;
  notes: string;
  target_type: 'RUMAH_PRODUKSI' | 'PASAR' | 'VENDOR';
}

const CATEGORY_ORDER = [
  'Bakso & Olahan Frozen',
  'Bahan Dapur & Bumbu',
  'Sayur, Mie & Pelengkap',
  'Minuman & Es',
  'Kemasan & Operasional',
  'Lain-lain'
];

export default function OrderRequestForm({ user, onBack, locationId: propLocId, staffName: propStaff }: Props) {
  const effectiveLocationId = propLocId || user?.location_id || user?.id || '';
  const effectiveStaffName = propStaff || user?.active_staff_name || user?.username || 'Kru Cabang';

  // Tanggal default operasional
  const getTodayWita = () => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());
  };

  const [requestDate, setRequestDate] = useState<string>(getTodayWita());
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  const [requestList, setRequestList] = useState<RequestItemRow[]>([]);
  
  // State untuk form tambah item
  const [selectedItemName, setSelectedItemName] = useState('');
  const [itemQty, setItemQty] = useState<number | string>('');
  const [itemTarget, setItemTarget] = useState<'RUMAH_PRODUKSI' | 'PASAR' | 'VENDOR'>('RUMAH_PRODUKSI');
  const [itemNotes, setItemNotes] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Ambil daftar master barang
  useEffect(() => {
    const fetchMasterItems = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('items')
          .select('id, name, category, uom')
          .order('name');

        if (error) throw error;
        setMasterItems(data || []);
      } catch (err: any) {
        console.error('Gagal mengambil master barang:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMasterItems();
  }, []);

  // Filter pilihan dropdown barang
  const filteredMasterItems = useMemo(() => {
    if (!searchTerm) return masterItems;
    return masterItems.filter((i) => 
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.category && i.category.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [masterItems, searchTerm]);

  // Tambah baris belanja ke keranjang permintaan
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemName) {
      alert('Pilih nama barang terlebih dahulu.');
      return;
    }
    if (!itemQty || Number(itemQty) <= 0) {
      alert('Masukkan jumlah kuantitas yang valid.');
      return;
    }

    const found = masterItems.find((m) => m.name.toLowerCase() === selectedItemName.toLowerCase());
    const unit = found?.uom || 'porsi';
    const category = found?.category || 'Lain-lain';

    // Cek apakah item sudah ada di daftar
    const existingIndex = requestList.findIndex(
      (r) => r.item_name.toLowerCase() === selectedItemName.toLowerCase() && r.target_type === itemTarget
    );

    if (existingIndex >= 0) {
      const updated = [...requestList];
      updated[existingIndex].quantity = Number(updated[existingIndex].quantity) + Number(itemQty);
      if (itemNotes) {
        updated[existingIndex].notes = updated[existingIndex].notes 
          ? `${updated[existingIndex].notes}, ${itemNotes}` 
          : itemNotes;
      }
      setRequestList(updated);
    } else {
      setRequestList([
        ...requestList,
        {
          item_name: found ? found.name : selectedItemName,
          category,
          unit,
          quantity: Number(itemQty),
          notes: itemNotes,
          target_type: itemTarget
        }
      ]);
    }

    // Reset input penambahan
    setSelectedItemName('');
    setItemQty('');
    setItemNotes('');
    setSearchTerm('');
  };

  const handleRemoveItem = (index: number) => {
    setRequestList((prev) => prev.filter((_, i) => i !== index));
  };

  // Simpan seluruh permintaan belanja ke database
  const handleSubmitAll = async () => {
    if (requestList.length === 0) {
      setMsg({ text: 'Daftar permintaan belanja masih kosong.', type: 'error' });
      return;
    }
    if (!effectiveLocationId) {
      setMsg({ text: 'Cabang outlet tidak terdeteksi.', type: 'error' });
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const nowIso = new Date().toISOString();
      const payloads = requestList.map((row) => ({
        location_id: effectiveLocationId,
        item_name: row.item_name,
        quantity: Number(row.quantity),
        unit: row.unit,
        category: row.category,
        target_type: row.target_type,
        notes: row.notes || null,
        requested_by: effectiveStaffName,
        request_date: requestDate,
        status: 'PENDING',
        created_at: nowIso
      }));

      const { error } = await supabase
        .from('order_requests')
        .insert(payloads);

      if (error) throw error;

      setMsg({
        text: `Berhasil mengirim ${requestList.length} permintaan belanja untuk kebutuhan tanggal ${requestDate}!`,
        type: 'success'
      });
      setRequestList([]);
    } catch (err: any) {
      console.error('Gagal kirim order:', err);
      setMsg({ text: `Gagal mengirim permintaan: ${err.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-xs space-y-5 max-w-4xl mx-auto font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-all mr-1"
              title="Kembali"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <Send className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
              Form Permintaan Belanja Cabang
            </h3>
            <p className="text-[10px] text-slate-400">
              Ajukan kebutuhan bahan untuk Rumah Produksi, Pasar & Supplier
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Calendar className="absolute left-3 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={requestDate}
              onChange={(e) => setRequestDate(e.target.value)}
              className="pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
              title="Tanggal Pengadaan / Belanja"
            />
          </div>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
          msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Form Tambah Item Belanja */}
      <form onSubmit={handleAddItem} className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 space-y-3">
        <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
          + Tambah Item Permintaan Belanja
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Pilih Barang */}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Nama Barang / Bahan
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={selectedItemName || searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSelectedItemName(e.target.value);
                }}
                placeholder="Ketik untuk mencari barang..."
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none"
                list="master-items-options"
                required
              />
              <datalist id="master-items-options">
                {filteredMasterItems.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.category} ({item.uom})
                  </option>
                ))}
              </datalist>
            </div>
          </div>

          {/* Jumlah Kuantitas */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Jumlah (Qty)
            </label>
            <input
              type="number"
              step="any"
              min="0.1"
              value={itemQty}
              onChange={(e) => setItemQty(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:outline-none"
              required
            />
          </div>

          {/* Jalur Pengadaan / Tujuan Belanja */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Jalur Pengadaan
            </label>
            <select
              value={itemTarget}
              onChange={(e: any) => setItemTarget(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
            >
              <option value="RUMAH_PRODUKSI">Rumah Produksi (Dapur Pusat)</option>
              <option value="PASAR">Belanja Pasar</option>
              <option value="VENDOR">Supplier / Vendor Luar</option>
            </select>
          </div>

          {/* Catatan Tambahan */}
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Catatan Khusus (Opsional)
            </label>
            <input
              type="text"
              value={itemNotes}
              onChange={(e) => setItemNotes(e.target.value)}
              placeholder="Contoh: Tolong kirim sebelum jam 11 siang"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
            />
          </div>

          {/* Tombol Tambah ke List */}
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Item</span>
            </button>
          </div>
        </div>
      </form>

      {/* Tabel Keranjang Permintaan Belanja */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase text-slate-700 tracking-wider">
            Daftar Permintaan Belanja ({requestList.length} Item)
          </span>
          {requestList.length > 0 && (
            <button
              type="button"
              onClick={() => setRequestList([])}
              className="text-[11px] font-bold text-rose-600 hover:underline"
            >
              Kosongkan Semua
            </button>
          )}
        </div>

        {requestList.length === 0 ? (
          <div className="py-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-1">
            <p className="text-xs font-bold text-slate-600">Belum ada barang yang ditambahkan.</p>
            <p className="text-[11px] text-slate-400">Pilih barang dan jumlah di form atas, lalu klik "Tambah Item".</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">Nama Barang</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3 text-right">Kuantitas</th>
                  <th className="py-2.5 px-3 text-center">Tujuan Belanja</th>
                  <th className="py-2.5 px-3">Catatan</th>
                  <th className="py-2.5 px-3 text-center">Hapus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {requestList.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-extrabold text-slate-800 uppercase">
                      {row.item_name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {row.category}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-blue-600">
                      {row.quantity} <span className="text-[10px] font-normal text-slate-400">{row.unit}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        row.target_type === 'RUMAH_PRODUKSI'
                          ? 'bg-indigo-50 text-indigo-700'
                          : row.target_type === 'PASAR'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {row.target_type === 'RUMAH_PRODUKSI' ? 'Dapur Pusat' : row.target_type === 'PASAR' ? 'Pasar' : 'Vendor'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {row.notes || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Hapus baris"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tombol Simpan Permintaan Belanja */}
      <button
        type="button"
        onClick={handleSubmitAll}
        disabled={saving || requestList.length === 0}
        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Send className="w-4 h-4" />
        <span>
          {saving 
            ? 'Mengirim Permintaan...' 
            : `Kirim Permintaan Belanja (${requestList.length} Item) - ${requestDate}`}
        </span>
      </button>
    </div>
  );
}