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
  Search
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
  const isManagement = ['OWNER', 'EXECUTIVE', 'HR', 'ADMIN'].includes((userRole || '').toUpperCase());

  const [activeModule, setActiveModule] = useState<'PRODUCT_KNOWLEDGE' | 'LEADER' | 'DAPUR' | 'KASIR' | 'PELAYAN' | 'HR_POLICY'>('PRODUCT_KNOWLEDGE');
  const [guides, setGuides] = useState<GuideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');

  // State Modal Tambah / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<GuideItem> | null>(null);
  const [saving, setSaving] = useState(false);

  // Ambil data dari database
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

  // Simpan / Perbarui Materi
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem?.title || !editingItem?.description) return;
    setSaving(true);

    try {
      const payload = {
        module_type: activeModule,
        section_type: (editingItem.section_type || 'OPERASIONAL').toUpperCase().trim(),
        title: editingItem.title.trim(),
        description: editingItem.description.trim(),
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

      setIsModalOpen(false);
      setEditingItem(null);
      await fetchGuides();
    } catch (err: any) {
      alert('Gagal menyimpan panduan: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Hapus / Nonaktifkan Materi
  const handleDeleteItem = async (id: string) => {
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
              {isManagement && (
                <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                  Mode Pengelola ({userRole})
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-slate-400">
              Standar baku rasa, alur tugas harian, dan kebijakan kerja resmi Bakso Ibu.
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

          {isManagement && (
            <button
              onClick={() => {
                setEditingItem({
                  module_type: activeModule,
                  section_type: 'OPERASIONAL',
                  title: '',
                  description: '',
                  sort_order: guides.length + 1
                });
                setIsModalOpen(true);
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

      {/* DAFTAR MATERI */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs font-bold">
          Memuat panduan operasional...
        </div>
      ) : Object.keys(groupedGuides).length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-xs font-medium bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          Belum ada materi untuk bagian ini. {isManagement && 'Tekan tombol "Tambah Materi" di atas untuk mengisi.'}
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
                <span className="text-[10px] font-bold text-slate-400">({items.length} Poin Standar)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map((guide) => (
                  <div 
                    key={guide.id}
                    className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 hover:border-slate-200 transition-all space-y-2 relative group"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="text-xs font-black text-slate-900 leading-snug">
                        {guide.title}
                      </h4>
                      {isManagement && (
                        <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingItem(guide);
                              setIsModalOpen(true);
                            }}
                            title="Edit Materi"
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(guide.id)}
                            title="Hapus Materi"
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-600 leading-relaxed font-medium whitespace-pre-line">
                      {guide.description}
                    </div>

                    <div className="pt-2 border-t border-slate-200/50 flex justify-between items-center text-[9px] text-slate-400 font-semibold">
                      <span>Diperbarui: {new Date(guide.updated_at).toLocaleDateString('id-ID')}</span>
                      {guide.updated_by && <span>Oleh: {guide.updated_by}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL INPUT / EDIT MATERI (OWNER & HR) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900">
                {editingItem?.id ? 'Edit Panduan / Job Desk' : 'Tambah Panduan Baru'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
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
                  placeholder="Contoh: Briefing Pagi, Standar Racik Kuah, SOP Hitung Kasir"
                  value={editingItem?.title || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-black mb-1">
                  Poin-Poin Langkah Kerja / Standar Baku
                </label>
                <textarea
                  rows={6}
                  placeholder="Tuliskan nomor 1, 2, 3 langkah-langkah kerja..."
                  value={editingItem?.description || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none font-medium leading-relaxed"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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