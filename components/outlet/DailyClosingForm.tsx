'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { compressImage } from '@/lib/imageCompressor';
import { 
  Store, 
  ArrowLeft, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Trash2 
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

  const totalWasteCount = useMemo(() => {
    return Object.values(wasteQtys).filter((w) => parseFloat(w) > 0).length;
  }, [wasteQtys]);

  const handleStockChange = (name: string, val: string) => {
    setClosingStocks((prev) => ({ ...prev, [name]: val }));
  };

  const handleWasteChange = (name: string, val: string) => {
    setWasteQtys((prev) => ({ ...prev, [name]: val }));
  };

  // Kompresi foto otomatis
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 1200, 0.7);
        setWastePhotoFile(compressed);
        setWastePhotoPreview(URL.createObjectURL(compressed));
      } catch {
        setWastePhotoFile(file);
        setWastePhotoPreview(URL.createObjectURL(file));
      }
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

      if (hasWaste && !wastePhotoFile) {
        throw new Error('Ada pencatatan barang waste. Wajib melampirkan foto bukti fisik waste sebelum menyimpan.');
      }

      let uploadedPhotoUrl = null;
      if (wastePhotoFile) {
        const fileExt = wastePhotoFile.name.split('.').pop() || 'jpg';
        const filePath = `waste_${activeLocationId}_${today}_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, wastePhotoFile);

        if (!uploadError) {
          const { data: pubData } = supabase.storage.from('receipts').getPublicUrl(filePath);
          uploadedPhotoUrl = pubData?.publicUrl;
        }
      }

      for (const [itemName, remainStr] of validStockEntries) {
        const remainQty = parseFloat(remainStr) || 0;
        const wasteQty = parseFloat(wasteQtys[itemName] || '0') || 0;
        const itemMeta = items.find((i) => i.name === itemName);
        const unit = itemMeta?.uom || 'Pcs';

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
        text: `Closing toko berhasil disimpan (${validStockEntries.length} item tersimpan)!`,
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
    <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-7 shadow-xs">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-bold text-slate-400 hover:text-indigo-600 mb-4 flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali
        </button>
      )}

      <div className="flex items-center gap-3 pb-5 mb-5 border-b border-slate-100">
        <div className="w-10 h-10 rounded-2xl bg-[#ff6f3c] text-white flex items-center justify-center shadow-sm">
          <Store className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-black text-slate-900 leading-tight">Form Tutup Toko (Closing)</h2>
          <p className="text-xs text-slate-400">Opname sisa fisik etalase & catat barang waste</p>
        </div>
      </div>

      {message && (
        <div
          className={`p-3.5 mb-5 rounded-2xl text-xs font-bold flex items-center gap-2 ${
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

      {/* Filter Kategori & Search */}
      <div className="space-y-2 mb-4 text-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari barang closing..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-500 hover:text-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Tabel Input Ringkas */}
        <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-96 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 sticky top-0 border-b border-slate-100 z-10">
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Nama Barang</th>
                <th className="py-2.5 px-2 text-right w-28">Sisa Fisik</th>
                <th className="py-2.5 px-2 text-right w-28 text-[#ff6f3c]">Waste</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(groupedItems).map(([groupName, groupList]) => (
                <React.Fragment key={groupName}>
                  <tr className="bg-slate-50/60">
                    <td colSpan={3} className="py-1.5 px-3 font-black text-slate-600 text-[10px] uppercase">
                      • {groupName}
                    </td>
                  </tr>
                  {groupList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-semibold text-slate-800">{item.name}</td>
                      <td className="py-1.5 px-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={closingStocks[item.name] || ''}
                            onChange={(e) => handleStockChange(item.name, e.target.value)}
                            placeholder="0"
                            className="w-16 px-2 py-1 text-right rounded-lg text-xs font-bold border border-slate-200 bg-white focus:outline-none"
                          />
                          <span className="text-[10px] text-slate-400 w-6 text-left">{item.uom || 'Pcs'}</span>
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={wasteQtys[item.name] || ''}
                            onChange={(e) => handleWasteChange(item.name, e.target.value)}
                            placeholder="0"
                            className="w-16 px-2 py-1 text-right rounded-lg text-xs font-bold border border-orange-200 bg-orange-50/40 text-[#ff6f3c] focus:outline-none"
                          />
                          <span className="text-[10px] text-slate-400 w-6 text-left">{item.uom || 'Pcs'}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Upload Foto Waste Ringkas */}
        <div>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            capture="environment"
            onChange={handlePhotoSelect}
            className="hidden"
          />
          {wastePhotoPreview ? (
            <div className="relative w-32 h-24 rounded-xl overflow-hidden border border-slate-200">
              <img src={wastePhotoPreview} alt="Bukti Waste" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-lg shadow-xs hover:bg-red-700"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`w-full py-3 border border-dashed rounded-xl flex items-center justify-center gap-2 transition-colors ${
                totalWasteCount > 0
                  ? 'border-red-300 bg-red-50/30 text-red-600'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span className="font-bold">
                {totalWasteCount > 0 ? 'Foto Bukti Waste (Wajib Ada)' : 'Foto Bukti Waste (Jika ada)'}
              </span>
            </button>
          )}
        </div>

        {/* Catatan Tambahan */}
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Catatan closing / penyebab waste (opsional)"
          className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl font-semibold text-slate-800 focus:outline-none"
        />

        {/* Tombol Simpan */}
        <button
          type="submit"
          disabled={loading || (totalWasteCount > 0 && !wastePhotoFile)}
          className={`w-full py-3.5 font-black rounded-2xl shadow-sm transition-all ${
            totalWasteCount > 0 && !wastePhotoFile
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-[#ff6f3c] hover:bg-orange-600 text-white'
          }`}
        >
          {loading ? 'Menyimpan...' : 'Kunci Closing Harian Toko'}
        </button>
      </form>
    </div>
  );
}