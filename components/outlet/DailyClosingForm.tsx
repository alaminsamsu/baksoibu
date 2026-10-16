'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Store, 
  ArrowLeft, 
  Camera, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Trash2, 
  AlertTriangle 
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
  const [wasteQtys, setWasteQtys] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState('');
  
  // State untuk Bukti Foto Waste
  const [wastePhotoFile, setWastePhotoFile] = useState<File | null>(null);
  const [wastePhotoPreview, setWastePhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    async function fetchItems() {
      const { data, error } = await supabase.from('items').select('*').order('name');
      if (error) {
        console.error('Gagal mengambil master item:', error);
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

  // Hitung total item waste yang diisi
  const totalWasteCount = useMemo(() => {
    return Object.values(wasteQtys).filter((w) => parseFloat(w) > 0).length;
  }, [wasteQtys]);

  const handleStockChange = (name: string, val: string) => {
    setClosingStocks((prev) => ({ ...prev, [name]: val }));
  };

  const handleWasteChange = (name: string, val: string) => {
    setWasteQtys((prev) => ({ ...prev, [name]: val }));
  };

  // Handler Pilih Foto
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setWastePhotoFile(file);
      const previewUrl = URL.createObjectURL(file);
      setWastePhotoPreview(previewUrl);
    }
  };

  const handleRemovePhoto = () => {
    setWastePhotoFile(null);
    setWastePhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const today = new Date().toISOString().split('T')[0];
      const validStockEntries = Object.entries(closingStocks).filter(([_, val]) => val !== '' && !isNaN(Number(val)));
      const hasWaste = totalWasteCount > 0;

      if (validStockEntries.length === 0) {
        throw new Error('Harap isi minimal 1 sisa fisik barang saat closing.');
      }

      // Validasi Wajib Lampirkan Foto jika ada waste
      if (hasWaste && !wastePhotoFile) {
        throw new Error('Ada pencatatan barang Waste (basi/rusak). Wajib melampirkan foto bukti fisik waste sebelum menyimpan.');
      }

      // Upload Foto Bukti jika ada
      let uploadedPhotoUrl = null;
      if (wastePhotoFile) {
        const fileExt = wastePhotoFile.name.split('.').pop();
        const filePath = `waste_${activeLocationId}_${today}_${Date.now()}.${fileExt}`;
        
        // Gunakan bucket 'receipts' atau 'waste-proofs' yang sudah ada
        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, wastePhotoFile);

        if (!uploadError) {
          const { data: pubData } = supabase.storage.from('receipts').getPublicUrl(filePath);
          uploadedPhotoUrl = pubData?.publicUrl;
        }
      }

      // Simpan ke daily_closings dan perbarui branch_stocks
      for (const [itemName, remainStr] of validStockEntries) {
        const remainQty = parseFloat(remainStr) || 0;
        const wasteQty = parseFloat(wasteQtys[itemName] || '0') || 0;
        const itemMeta = items.find((i) => i.name === itemName);
        const unit = itemMeta?.uom || 'Pcs';

        // 1. Simpan ke daily_closings
        await supabase.from('daily_closings').upsert(
          {
            location_id: activeLocationId,
            closing_date: today,
            item_name: itemName,
            remaining_stock: remainQty,
            waste_qty: wasteQty,
            unit,
            reported_by: activeStaffName,
            photo_url: uploadedPhotoUrl,
            notes: notes.trim() || null,
          },
          { onConflict: 'location_id, closing_date, item_name' }
        );

        // 2. Kunci sisa fisik di branch_stocks
        await supabase.from('branch_stocks').upsert(
          {
            location_id: activeLocationId,
            item_name: itemName,
            remaining_stock: remainQty,
            unit,
            updated_at: new Date().toISOString(),
            updated_by: `${activeStaffName} (Closing Opname)`,
          },
          { onConflict: 'location_id, item_name' }
        );
      }

      setMessage({
        text: `Sukses menyimpan closing toko dan bukti waste (${validStockEntries.length} item tersimpan)!`,
        type: 'success',
      });

      setClosingStocks({});
      setWasteQtys({});
      setNotes('');
      handleRemovePhoto();
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menyimpan closing toko.', type: 'error' });
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#ff6f3c] to-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Form Tutup Toko (Closing Malam)</h2>
            <p className="text-xs font-medium text-slate-400">Opname sisa fisik dan pencatatan barang waste harian.</p>
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
          <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari barang opname..."
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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
        {/* Tabel Input Sisa Fisik & Waste */}
        <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-[30rem] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50/80 sticky top-0 border-b border-slate-100 z-10 backdrop-blur-sm">
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Nama Barang</th>
                <th className="py-3 px-3 text-right w-32">Sisa Fisik</th>
                <th className="py-3 px-3 text-right w-32 text-[#ff6f3c]">Waste (Basi/Rusak)</th>
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
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{item.name}</td>
                      <td className="py-2 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={closingStocks[item.name] || ''}
                            onChange={(e) => handleStockChange(item.name, e.target.value)}
                            placeholder="0"
                            className="w-18 px-2 py-1.5 text-right rounded-xl text-xs font-bold border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                          <span className="text-[10px] text-slate-400 w-8 text-left">{item.uom || 'Pcs'}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={wasteQtys[item.name] || ''}
                            onChange={(e) => handleWasteChange(item.name, e.target.value)}
                            placeholder="0"
                            className="w-18 px-2 py-1.5 text-right rounded-xl text-xs font-bold border border-orange-200 bg-orange-50/30 text-[#ff6f3c] focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                          />
                          <span className="text-[10px] text-slate-400 w-8 text-left">{item.uom || 'Pcs'}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* BAGIAN FOTO BUKTI WASTE */}
        <div className={`p-5 rounded-3xl border transition-all ${
          totalWasteCount > 0 && !wastePhotoFile 
            ? 'bg-red-50/40 border-red-200 ring-2 ring-red-500/10' 
            : 'bg-slate-50 border-slate-100'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Camera className={`w-4 h-4 ${totalWasteCount > 0 ? 'text-red-500' : 'text-slate-500'}`} />
              <label className="text-xs font-black uppercase tracking-wider text-slate-800">
                Foto Bukti Fisik Barang Waste
              </label>
            </div>
            {totalWasteCount > 0 ? (
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-red-100 text-red-600">
                Wajib Dilampirkan ({totalWasteCount} item waste)
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-slate-400">
                Opsional jika tidak ada waste
              </span>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            capture="environment"
            onChange={handlePhotoSelect}
            className="hidden"
          />

          {wastePhotoPreview ? (
            <div className="relative w-full max-w-xs rounded-2xl overflow-hidden border border-slate-200 group">
              <img src={wastePhotoPreview} alt="Bukti Waste" className="w-full h-44 object-cover" />
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-xl shadow-md hover:bg-red-700 transition-all"
                title="Hapus Foto"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`w-full py-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all ${
                totalWasteCount > 0
                  ? 'border-red-300 bg-white hover:bg-red-50/50 text-red-600'
                  : 'border-slate-200 bg-white hover:bg-slate-100/50 text-slate-500'
              }`}
            >
              <Upload className="w-5 h-5" />
              <span className="text-xs font-bold">
                {totalWasteCount > 0
                  ? 'Ambil / Unggah Foto Bukti Barang Waste'
                  : 'Klik untuk ambil foto (jika ada)'}
              </span>
            </button>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
            Catatan Tambahan Closing
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Penyebab waste (misal: kuah basi karena mati lampu) atau catatan lain"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <button
          type="submit"
          disabled={loading || (totalWasteCount > 0 && !wastePhotoFile)}
          className={`w-full py-4 text-xs font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 ${
            totalWasteCount > 0 && !wastePhotoFile
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-[#ff6f3c] to-orange-500 hover:from-[#f25c28] hover:to-orange-600 text-white shadow-orange-500/25'
          }`}
        >
          {loading ? 'Menyimpan Opname & Bukti...' : 'Kunci Closing Harian Toko'}
        </button>
      </form>
    </div>
  );
}