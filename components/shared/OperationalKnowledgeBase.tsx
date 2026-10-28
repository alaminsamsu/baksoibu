'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  BookOpen, 
  Crown,
  ChefHat, 
  Receipt, 
  Users, 
  ShieldCheck, 
  Sparkles, 
  Edit3, 
  Plus, 
  Trash2, 
  Save, 
  X,
  Search,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';

interface Props {
  userRole?: string; // 'OWNER', 'EXECUTIVE', 'HR', 'ADMIN', 'LEADER', 'CREW'
  userName?: string;
}

interface GuideItem {
  id: string;
  module_type: 'PRODUCT_KNOWLEDGE' | 'LEADER' | 'DAPUR' | 'KASIR' | 'PELAYAN' | 'HR_POLICY';
  section_type: string;
  title: string;
  description: string;
  sort_order: number;
  updated_at: string;
  updated_by?: string;
}

export default function OperationalKnowledgeBase({ userRole = 'CREW', userName = 'Staff' }: Props) {
  // Hanya Owner dan HR yang punya akses mengedit & menghapus
  const roleUpper = (userRole || '').toUpperCase();
  const canManage = roleUpper === 'OWNER' || roleUpper === 'EXECUTIVE' || roleUpper === 'HR' || roleUpper.includes('ADMIN');

  const [activeModule, setActiveModule] = useState<'PRODUCT_KNOWLEDGE' | 'LEADER' | 'DAPUR' | 'KASIR' | 'PELAYAN' | 'HR_POLICY'>('PRODUCT_KNOWLEDGE');
  const [guides, setGuides] = useState<GuideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');

  // Modal Baca Detail (Untuk Semua Kru, Leader, HR, Owner)
  const [viewingItem, setViewingItem] = useState<GuideItem | null>(null);

  // Modal Form Tambah / Edit (Hanya Owner & HR)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<GuideItem> | null>(null);
  const [saving, setSaving] = useState(false);

  // Ambil Data dari Database
  const fetchGuides = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('operational_guides')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setGuides(data || []);
    } catch (err: any) {
      console.error('Gagal mengambil data panduan:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuides();
  }, []);

  // Membersihkan format teks dan memecah string menjadi array poin-poin rapi
  const parseDescriptionToPoints = (text: string): string[] => {
    if (!text) return [];
    // Hilangkan karakter literal \n atau baris baru nyata
    const cleaned = text.replace(/\\n/g, '\n');
    return cleaned
      .split('\n')
      .map((line) => line.trim())
      // Hapus angka di depan seperti "1. ", "2. ", "1) ", atau "- "
      .map((line) => line.replace(/^(\d+[\.\)]\s*|\-\s*|\*\s*)/, '').trim())
      .filter((line) => line.length > 0);
  };

  // Filter pencarian
  const filteredGuides = useMemo(() => {
    return guides.filter((g) => {
      const matchModule = g.module_type === activeModule;
      const matchSearch = searchKeyword === '' || 
        g.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        g.description.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        g.section_type.toLowerCase().includes(searchKeyword.toLowerCase());
      return matchModule && matchSearch;
    });
  }, [guides, activeModule, searchKeyword]);

  // Kelompokkan per Section (Opening, Closing, dll)
  const groupedGuides = useMemo(() => {
    const map: Record<string, GuideItem[]> = {};
    filteredGuides.forEach((item) => {
      const sec = item.section_type || 'UMUM';
      if (!map[sec]) map[sec] = [];
      map[sec].push(item);
    });
    return map;
  }, [filteredGuides]);

  // Simpan / Perbarui Materi (Khusus Pengelola)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem?.title || !editingItem?.description) return;
    setSaving(true);

    try {
      const payload = {
        module_type: activeModule,
        section_type: (editingItem.section_type || 'OPERASIONAL').toUpperCase().trim(),
        title: editingItem.title.trim(),
        description: editingItem.description.replace(/\\n/g, '\n').trim(),
        sort_order: Number(editingItem.sort_order || 1),
        updated_by: userName,
        updated_at: new Date().toISOString()
      };

      if (editingItem.id) {
        const { error } = await supabase
          .from('operational_guides')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('operational_guides')
          .insert([payload]);
        if (error) throw error;
      }

      setIsFormOpen(false);
      setEditingItem(null);
      await fetchGuides();
    } catch (err: any) {
      alert('Gagal menyimpan panduan: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Hapus Materi (Khusus Pengelola)
  const handleDeleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Cegah membuka modal baca
    if (!confirm('Yakin ingin menghapus poin panduan ini?')) return;
    try {
      const { error } = await supabase
        .from('operational_guides')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
      await fetchGuides();
    } catch (err: any) {
      alert('Gagal menghapus materi: ' + err.message);
    }
  };

  const navTabs = [
    { key: 'PRODUCT_KNOWLEDGE', label: 'Product Knowledge', icon: Sparkles },
    { key: 'LEADER', label: 'Job Desk Leader', icon: Crown },
    { key: 'DAPUR', label: 'Job Desk Dapur', icon: ChefHat },
    { key: 'KASIR', label: 'Job Desk Kasir', icon: Receipt },
    { key: 'PELAYAN', label: 'Job Desk Pelayan', icon: Users },
    { key: 'HR_POLICY', label: 'Kebijakan & Aturan HR', icon: ShieldCheck },
  ] as const;

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-5 sm:p-7 shadow-xs space-y-6 font-sans">
      
      {/* HEADER PANEL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-50 text-[#ff6f3c] flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Pusat Panduan Kerja & Knowledge Base
              </h2>
              {canManage ? (
                <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                  Mode Pengelola ({userRole})
                </span>
              ) : (
                <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                  Mode Panduan Kru ({userRole})
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-slate-400">
              Klik pada kartu untuk membaca rincian langkah kerja secara jelas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari materi..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none w-36 sm:w-48"
            />
          </div>

          {canManage && (
            <button
              onClick={() => {
                setEditingItem({
                  module_type: activeModule,
                  section_type: 'OPERASIONAL',
                  title: '',
                  description: '',
                  sort_order: guides.length + 1
                });
                setIsFormOpen(true);
              }}
              className="px-3.5 py-1.5 bg-[#ff6f3c] hover:bg-orange-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Materi</span>
            </button>
          )}
        </div>
      </div>

      {/* NAVIGASI 6 MODUL UTAMA */}
      <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100 gap-1 overflow-x-auto text-xs font-bold">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeModule === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveModule(tab.key)}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                isActive 
                  ? 'bg-white text-slate-900 shadow-xs font-black' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#ff6f3c]' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* DAFTAR CARD PANDUAN */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs font-bold">
          Memuat panduan operasional...
        </div>
      ) : Object.keys(groupedGuides).length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-xs font-medium bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          Belum ada materi untuk bagian ini. {canManage && 'Tekan tombol "Tambah Materi" di atas untuk mengisi.'}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedGuides).map(([sectionName, items]) => (
            <div key={sectionName} className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                <span className="w-2 h-2 rounded-full bg-[#ff6f3c]"></span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  {sectionName.replace(/_/g, ' ')}
                </h3>
                <span className="text-[10px] font-bold text-slate-400">({items.length} Standar Kerja)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {items.map((guide) => {
                  const points = parseDescriptionToPoints(guide.description);

                  return (
                    <div 
                      key={guide.id}
                      onClick={() => setViewingItem(guide)}
                      className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 hover:border-[#ff6f3c]/40 hover:bg-white hover:shadow-md transition-all cursor-pointer space-y-3 relative group"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-orange-100 text-[#ff6f3c] flex items-center justify-center font-black text-xs shrink-0">
                            ✓
                          </span>
                          <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-[#ff6f3c] transition-colors leading-snug">
                            {guide.title}
                          </h4>
                        </div>

                        {/* Tombol aksi khusus Owner / HR */}
                        {canManage ? (
                          <div 
                            className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingItem(guide);
                                setIsFormOpen(true);
                              }}
                              title="Edit Materi"
                              className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteItem(guide.id, e)}
                              title="Hapus Materi"
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-300 group-hover:text-[#ff6f3c] transition-colors">
                            <ExternalLink className="w-4 h-4" />
                          </span>
                        )}
                      </div>

                      {/* Preview 2 Poin Awal Bersih */}
                      <div className="space-y-1.5 pl-1">
                        {points.slice(0, 2).map((pt, pIdx) => (
                          <div key={pIdx} className="flex items-start gap-2 text-[11px] text-slate-600 leading-relaxed font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0 mt-1.5"></span>
                            <span className="line-clamp-2">{pt}</span>
                          </div>
                        ))}
                        {points.length > 2 && (
                          <span className="text-[10px] font-bold text-indigo-600 block pt-0.5">
                            +{points.length - 2} langkah lainnya (klik untuk buka)
                          </span>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-200/50 flex justify-between items-center text-[9px] text-slate-400 font-semibold">
                        <span>Pembaruan: {new Date(guide.updated_at).toLocaleDateString('id-ID')}</span>
                        {guide.updated_by && <span>Oleh: {guide.updated_by}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. MODAL BACA DETAIL (UNTUK SEMUA KRU, LEADER, HR, OWNER)                  */}
      {/* ========================================================================= */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
            
            {/* Header Modal Baca */}
            <div className="flex justify-between items-start pb-3 border-b border-slate-100 gap-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100">
                  {viewingItem.section_type.replace(/_/g, ' ')}
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1.5 leading-snug">
                  {viewingItem.title}
                </h3>
              </div>
              <button 
                onClick={() => setViewingItem(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center shrink-0 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Konten Poin-Poin Kerja Bersih & Mudah Dipahami */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                STANDAR & URUTAN LANGKAH KERJA:
              </span>

              <div className="space-y-2.5">
                {parseDescriptionToPoints(viewingItem.description).map((point, index) => (
                  <div 
                    key={index} 
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3"
                  >
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <p className="text-xs sm:text-sm font-semibold text-slate-700 leading-relaxed">
                      {point}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Modal Baca */}
            <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
              <div className="text-[10px] text-slate-400 font-semibold">
                <span>Diperbarui: {new Date(viewingItem.updated_at).toLocaleDateString('id-ID')}</span>
                {viewingItem.updated_by && <span> • {viewingItem.updated_by}</span>}
              </div>
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-xs transition-colors"
              >
                Tutup Panduan
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MODAL FORM INPUT / EDIT (HANYA MUNCUL DI AKUN OWNER & HR)              */}
      {/* ========================================================================= */}
      {isFormOpen && canManage && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900">
                {editingItem?.id ? 'Edit Panduan / Job Desk' : 'Tambah Panduan Baru'}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-800 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3.5 text-xs font-bold">
              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-black mb-1">
                  Bagian / Alur Kerja (Section)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: OPENING, BRIEFING, OPERASIONAL, CLOSING, ADMINISTRASI"
                  value={editingItem?.section_type || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, section_type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 uppercase focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-black mb-1">
                  Judul Pos / Panduan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Standar Racik Kuah, SOP Hitung Kasir"
                  value={editingItem?.title || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-black mb-1">
                  Poin-Poin Langkah Kerja (Tiap baris otomatis jadi 1 poin)
                </label>
                <textarea
                  rows={6}
                  placeholder="Tuliskan tiap langkah di baris baru (tekan Enter):&#10;Pastikan air dandang kuah 3/4 penuh&#10;Nyalakan kompor dengan api stabil&#10;Cek rasa sebelum outlet buka"
                  value={(editingItem?.description || '').replace(/\\n/g, '\n')}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none font-medium leading-relaxed"
                  required
                />
                <span className="text-[10px] text-slate-400 font-normal mt-1 block">
                  *Cukup tekan Enter untuk membuat langkah berikutnya. Tidak perlu ketik manual angka 1, 2 atau tanda hubung (-).
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#ff6f3c] hover:bg-orange-600 text-white rounded-xl font-black flex items-center gap-1.5 shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan Panduan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}