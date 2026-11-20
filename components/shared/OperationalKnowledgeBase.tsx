'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  BookOpen, 
  Search, 
  Plus, 
  Trash2, 
  Edit3,
  X, 
  UserCheck, 
  ChefHat, 
  Receipt, 
  UtensilsCrossed, 
  FileText, 
  ListChecks, 
  ShieldCheck, 
  Layers,
  CheckCircle2,
  AlertCircle,
  Utensils,
  Camera,
  UploadCloud
} from 'lucide-react';

interface Props {
  user?: any;
  isHR?: boolean;
  userRole?: string;
  userName?: string;
}

type DivisionType = 'LEADER' | 'DAPUR' | 'KASIR' | 'PELAYAN' | 'UMUM';
type ContentType = 'JOBDESK' | 'SOP' | 'MENU_STANDARD';
type PhaseType = 'OPENING' | 'OPERASIONAL' | 'HANDOVER' | 'CLOSING' | 'ADMINISTRASI';

interface GuideItem {
  id: string;
  division: DivisionType;
  content_type: ContentType;
  phase?: PhaseType;
  title: string;
  summary?: string;
  steps: string[];
  responsibilities?: string[];
  notes?: string;
  menu_photo_url?: string | null;
  updated_at?: string;
}

interface ParsedStep {
  numberLabel: string;
  text: string;
  isSub: boolean;
}

const DIVISIONS: { id: DivisionType; label: string; icon: any; color: string }[] = [
  { id: 'LEADER', label: 'Leader Outlet', icon: UserCheck, color: 'text-amber-600 bg-amber-50' },
  { id: 'DAPUR', label: 'Divisi Dapur', icon: ChefHat, color: 'text-orange-600 bg-orange-50' },
  { id: 'KASIR', label: 'Divisi Kasir', icon: Receipt, color: 'text-emerald-600 bg-emerald-50' },
  { id: 'PELAYAN', label: 'Divisi Pelayan / Floor', icon: UtensilsCrossed, color: 'text-blue-600 bg-blue-50' },
  { id: 'UMUM', label: 'Kebijakan Umum HR', icon: ShieldCheck, color: 'text-indigo-600 bg-indigo-50' }
];

const SOP_PHASES: { id: PhaseType; title: string; color: string }[] = [
  { id: 'OPENING', title: 'OPENING', color: 'bg-emerald-500' },
  { id: 'OPERASIONAL', title: 'OPERASIONAL (RUNNING)', color: 'bg-amber-500' },
  { id: 'HANDOVER', title: 'SERAH TERIMA SHIFT', color: 'bg-indigo-500' },
  { id: 'CLOSING', title: 'CLOSING', color: 'bg-rose-500' },
  { id: 'ADMINISTRASI', title: 'ADMINISTRASI & PELAPORAN', color: 'bg-slate-700' }
];

const parseHierarchicalLines = (lines: string[]): ParsedStep[] => {
  let mainCount = 0;
  let subCount = 0;

  return lines.map((rawLine) => {
    const trimmed = rawLine.trim();
    const isExplicitSub =
      trimmed.startsWith('-') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('>') ||
      /^\d+\.\d+/.test(trimmed);

    if (isExplicitSub) {
      if (mainCount === 0) mainCount = 1;
      subCount += 1;
      const cleanText = trimmed
        .replace(/^[-*>]\s*/, '')
        .replace(/^\d+\.\d+\.?\s*/, '');
      return {
        numberLabel: `${mainCount}.${subCount}`,
        text: cleanText,
        isSub: true
      };
    } else {
      mainCount += 1;
      subCount = 0;
      const cleanText = trimmed.replace(/^\d+[\.\)]\s*/, '');
      return {
        numberLabel: `${mainCount}.`,
        text: cleanText,
        isSub: false
      };
    }
  });
};

export default function OperationalKnowledgeBase({ 
  user, 
  isHR = true, 
  userRole, 
  userName 
}: Props) {
  const effectiveRole = (userRole || user?.role || user?.role_name || '').toUpperCase();
  const effectiveIsHR = isHR || effectiveRole.includes('HR') || effectiveRole.includes('OWNER') || effectiveRole.includes('ADMIN');

  const [selectedDivision, setSelectedDivision] = useState<DivisionType>('DAPUR');
  const [selectedType, setSelectedType] = useState<ContentType>('SOP');
  const [searchTerm, setSearchTerm] = useState('');
  const [guides, setGuides] = useState<GuideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [activeDetailItem, setActiveDetailItem] = useState<GuideItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [formDivision, setFormDivision] = useState<DivisionType>('DAPUR');
  const [formType, setFormType] = useState<ContentType>('SOP');
  const [formPhase, setFormPhase] = useState<PhaseType>('OPENING');
  const [formTitle, setFormTitle] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formContentList, setFormContentList] = useState<string>('');
  const [formNotes, setFormNotes] = useState('');
  const [formMenuPhoto, setFormMenuPhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  const menuPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const defaultInitialGuides: GuideItem[] = [
    {
      id: 'dapur-jobdesk-1',
      division: 'DAPUR',
      content_type: 'JOBDESK',
      title: 'Jobdesk & Tanggung Jawab Cook / Kitchen Crew',
      summary: 'Tanggung jawab utama atas kualitas rasa, kecepatan penyajian porsi, dan kebersihan dapur.',
      responsibilities: [
        'Memastikan seluruh bahan baku siap pakai sebelum jam operasional dimulai.',
        '- Mengecek stok bakso beku, mie ayam, bihun, dan bumbu kaldu.',
        'Menjaga konsistensi porsi dan standar penyajian bakso serta mie ayam sesuai gramasi.',
        'Mengontrol suhu kuah kaldu agar selalu panas dan mendidih.',
        'Menjaga kebersihan area masak, panci dandang, dan tempat penyimpanan bahan beku.',
        'Melaporkan kekurangan stok bahan baku ke Leader sebelum bahan habis.'
      ],
      steps: [],
      notes: 'Wajib mengenakan celemek, masker, dan penutup kepala selama bertugas.'
    },
    {
      id: 'dapur-sop-1',
      division: 'DAPUR',
      content_type: 'SOP',
      phase: 'OPENING',
      title: 'Persiapan Dandang & Pemanasan Kuah Kaldu',
      summary: 'Standar penyalaan api kompor dan pengisian takaran kuah di pagi hari.',
      steps: [
        'Cek kebersihan bagian dalam dandang sebelum diisi air.',
        '- Pastikan tidak ada sisa kerak bumbu dari shift malam sebelumnya.',
        'Isi air dandang kuah minimal 3/4 volume dandang.',
        'Nyalakan kompor dengan api sedang-tinggi hingga mendidih.',
        'Masukkan bumbu kuah kaldu resmi Bakso Ibu, aduk rata dan cicipi rasa standar.',
        'Kecilkan api ke tingkat api simpan panas begitu kuah mendidih sempurna.'
      ],
      notes: 'Jangan pernah membiarkan air dandang kurang dari 1/2 volume.'
    }
  ];

  const fetchGuides = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('knowledge_base_articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Info DB knowledge_base_articles:', error.message);
        setGuides(defaultInitialGuides);
      } else if (!data || data.length === 0) {
        await supabase.from('knowledge_base_articles').upsert(defaultInitialGuides);
        setGuides(defaultInitialGuides);
      } else {
        setGuides(data);
      }
    } catch {
      setGuides(defaultInitialGuides);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuides();
  }, []);

  const handleSelectDivision = (divId: DivisionType) => {
    setSelectedDivision(divId);
    if (divId !== 'DAPUR' && selectedType === 'MENU_STANDARD') {
      setSelectedType('SOP');
    }
  };

  const filteredGuides = useMemo(() => {
    return guides.filter((g) => {
      const matchDiv = g.division === selectedDivision;
      const matchType = g.content_type === selectedType;
      const matchSearch =
        searchTerm === '' ||
        g.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.summary?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (g.steps && g.steps.some((s) => s.toLowerCase().includes(searchTerm.toLowerCase()))) ||
        (g.responsibilities && g.responsibilities.some((r) => r.toLowerCase().includes(searchTerm.toLowerCase())));

      return matchDiv && matchType && matchSearch;
    });
  }, [guides, selectedDivision, selectedType, searchTerm]);

  const groupedSOPByPhase = useMemo(() => {
    if (selectedType !== 'SOP') return null;

    const phases: Record<PhaseType, GuideItem[]> = {
      OPENING: [],
      OPERASIONAL: [],
      HANDOVER: [],
      CLOSING: [],
      ADMINISTRASI: []
    };

    filteredGuides.forEach((item) => {
      const phaseKey = (item.phase as PhaseType) || 'OPERASIONAL';
      if (phases[phaseKey]) {
        phases[phaseKey].push(item);
      } else {
        phases.OPERASIONAL.push(item);
      }
    });

    return phases;
  }, [filteredGuides, selectedType]);

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const maxWidth = 1000;
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Gagal kanvas'));
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('Gagal kompres'))),
            'image/jpeg',
            0.75
          );
        };
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleUploadMenuPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const blob = await compressImage(file);
      const fileName = `menu_std_${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('settlement-receipts')
        .upload(fileName, blob, { contentType: 'image/jpeg' });
      if (upErr) throw upErr;

      const { data: pubData } = supabase.storage
        .from('settlement-receipts')
        .getPublicUrl(fileName);
      setFormMenuPhoto(pubData.publicUrl);
    } catch (err: any) {
      alert('Gagal upload foto menu: ' + err.message);
    } finally {
      setUploadingPhoto(false);
      if (menuPhotoInputRef.current) menuPhotoInputRef.current.value = '';
    }
  };

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setEditId(null);
    setFormDivision(selectedDivision);
    setFormType(selectedType);
    setFormPhase('OPENING');
    setFormTitle('');
    setFormSummary('');
    setFormContentList('');
    setFormNotes('');
    setFormMenuPhoto(null);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (item: GuideItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsEditing(true);
    setEditId(item.id);
    setFormDivision(item.division);
    setFormType(item.content_type);
    setFormPhase((item.phase as PhaseType) || 'OPERASIONAL');
    setFormTitle(item.title);
    setFormSummary(item.summary || '');
    const listToEdit =
      item.content_type === 'JOBDESK'
        ? (item.responsibilities || []).join('\n')
        : (item.steps || []).join('\n');
    setFormContentList(listToEdit);
    setFormNotes(item.notes || '');
    setFormMenuPhoto(item.menu_photo_url || null);
    setActiveDetailItem(null);
    setShowAddModal(true);
  };

  const handleSaveGuide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('Judul panduan wajib diisi!');
      return;
    }

    setSaving(true);
    setStatusMsg(null);
    const lines = formContentList
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const newGuide: GuideItem = {
      id: isEditing && editId ? editId : `guide-${Date.now()}`,
      division: formDivision,
      content_type: formType,
      phase: formType === 'SOP' ? formPhase : undefined,
      title: formTitle.trim(),
      summary: formSummary.trim(),
      steps: formType !== 'JOBDESK' ? lines : [],
      responsibilities: formType === 'JOBDESK' ? lines : [],
      notes: formNotes.trim(),
      menu_photo_url: formType === 'MENU_STANDARD' ? formMenuPhoto : null,
      updated_at: new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar' }).format(new Date())
    };

    try {
      const { error } = await supabase.from('knowledge_base_articles').upsert([newGuide]);
      if (error) throw error;

      setGuides((prev) => {
        if (isEditing && editId) {
          return prev.map((item) => (item.id === editId ? newGuide : item));
        }
        return [newGuide, ...prev];
      });

      setStatusMsg({
        text: isEditing ? 'Perubahan materi berhasil disimpan permanen!' : 'Materi baru berhasil ditambahkan!',
        type: 'success'
      });
      setShowAddModal(false);
    } catch (err: any) {
      setStatusMsg({
        text: `Gagal menyimpan ke database: ${err.message}`,
        type: 'error'
      });
      setShowAddModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGuide = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Yakin ingin menghapus materi ini?')) return;
    try {
      const { error } = await supabase.from('knowledge_base_articles').delete().eq('id', id);
      if (error) throw error;
      setGuides((prev) => prev.filter((item) => item.id !== id));
      setActiveDetailItem(null);
      setStatusMsg({ text: 'Materi berhasil dihapus.', type: 'success' });
    } catch (err: any) {
      alert('Gagal menghapus: ' + err.message);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-xs space-y-6 font-sans">
      {/* 1. Header Bar Portal Panduan */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Pusat Panduan Kerja, Jobdesk & SOP Divisi
              </h2>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                {effectiveIsHR ? 'Mode Pengelola (HR)' : `Kru: ${userName || 'Karyawan'}`}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-400">
              Standar operasional prosedur, rincian tugas per divisi & takaran penyajian menu.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari materi / menu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none w-48 sm:w-60"
            />
          </div>

          {effectiveIsHR && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Materi</span>
            </button>
          )}
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. TAB PILIHAN DIVISI */}
      <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none">
        {DIVISIONS.map((div) => {
          const Icon = div.icon;
          const isActive = selectedDivision === div.id;
          return (
            <button
              key={div.id}
              type="button"
              onClick={() => handleSelectDivision(div.id)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-100'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : div.color.split(' ')[0]}`} />
              <span>{div.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. SWITCH MODE */}
      <div className="flex flex-wrap items-center justify-between bg-slate-50/80 p-2 rounded-2xl border border-slate-100 gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedType('JOBDESK')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              selectedType === 'JOBDESK'
                ? 'bg-white text-indigo-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <ListChecks className="w-4 h-4 text-indigo-600" />
            <span>1. Jobdesk & Tanggung Jawab</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('SOP')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              selectedType === 'SOP'
                ? 'bg-white text-indigo-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-orange-600" />
            <span>2. SOP & Langkah Kerja Lapangan</span>
          </button>

          {selectedDivision === 'DAPUR' && (
            <button
              type="button"
              onClick={() => setSelectedType('MENU_STANDARD')}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                selectedType === 'MENU_STANDARD'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Utensils className="w-4 h-4 text-emerald-600" />
              <span>3. Standar Penyajian Per Menu</span>
            </button>
          )}
        </div>

        <span className="text-[10px] font-bold text-slate-400 pr-2 hidden sm:inline">
          {filteredGuides.length} Dokumen Ditemukan
        </span>
      </div>

      {/* 4. KONTEN TAMPILAN */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 font-bold text-xs">
          Memuat panduan operasional...
        </div>
      ) : filteredGuides.length === 0 ? (
        <div className="py-16 text-center bg-slate-50/60 rounded-3xl border border-dashed border-slate-200 p-8 space-y-2">
          <Layers className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-slate-500">
            Belum ada data{' '}
            {selectedType === 'JOBDESK'
              ? 'Jobdesk'
              : selectedType === 'MENU_STANDARD'
              ? 'Standar Penyajian Menu'
              : 'SOP'}{' '}
            untuk bagian ini.
          </p>
          {effectiveIsHR && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="text-xs font-black text-indigo-600 hover:underline inline-block pt-1 cursor-pointer"
            >
              + Klik di sini untuk membuat baru
            </button>
          )}
        </div>
      ) : selectedType === 'JOBDESK' ? (
        /* --- TAMPILAN JOBDESK --- */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGuides.map((item) => {
            const parsed = parseHierarchicalLines(item.responsibilities || []);
            return (
              <div
                key={item.id}
                onClick={() => setActiveDetailItem(item)}
                className="p-5 rounded-3xl border border-slate-100 bg-white hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer space-y-3 group"
              >
                <div className="flex items-start justify-between">
                  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-lg">
                    Tanggung Jawab Divisi
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 mr-1">
                      {parsed.filter((p) => !p.isSub).length} Poin Utama
                    </span>
                    {effectiveIsHR && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditModal(item, e)}
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                          title="Edit Jobdesk"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteGuide(item.id, e)}
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Hapus Jobdesk"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {item.title}
                  </h3>
                  {item.summary && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {item.summary}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  {parsed.slice(0, 4).map((p, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-2 text-xs font-medium ${
                        p.isSub ? 'pl-4 text-slate-500 text-[11px]' : 'text-slate-700'
                      }`}
                    >
                      <span className="font-bold text-indigo-600 shrink-0">{p.numberLabel}</span>
                      <span className="line-clamp-1">{p.text}</span>
                    </div>
                  ))}
                  {parsed.length > 4 && (
                    <p className="text-[10px] font-bold text-indigo-600 pt-0.5">
                      +{parsed.length - 4} rincian lainnya (klik untuk buka)
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : selectedType === 'MENU_STANDARD' ? (
        /* --- TAMPILAN STANDAR PENYAJIAN PER MENU (KHUSUS DAPUR) --- */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGuides.map((menu) => {
            const parsed = parseHierarchicalLines(menu.steps || []);
            return (
              <div
                key={menu.id}
                onClick={() => setActiveDetailItem(menu)}
                className="rounded-3xl border border-slate-100 bg-white hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col group"
              >
                {menu.menu_photo_url && (
                  <div className="h-40 w-full bg-slate-100 overflow-hidden relative">
                    <img
                      src={menu.menu_photo_url}
                      alt={menu.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                )}

                <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase rounded-lg">
                        Standar Gramasi & Plating
                      </span>
                      {effectiveIsHR && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditModal(menu, e)}
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                            title="Edit Standar Menu"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteGuide(menu.id, e)}
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Hapus Standar Menu"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <h3 className="text-sm font-black text-slate-900 group-hover:text-emerald-600 transition-colors">
                      {menu.title}
                    </h3>

                    {menu.summary && (
                      <p className="text-xs text-slate-500 line-clamp-2">{menu.summary}</p>
                    )}

                    <div className="pt-2 border-t border-slate-100 space-y-1">
                      {parsed.slice(0, 4).map((p, idx) => (
                        <div
                          key={idx}
                          className={`flex items-start gap-1.5 text-[11px] ${
                            p.isSub ? 'pl-3.5 text-slate-600' : 'font-bold text-slate-800'
                          }`}
                        >
                          <span className="text-emerald-600 font-black shrink-0">{p.numberLabel}</span>
                          <span className="line-clamp-1">{p.text}</span>
                        </div>
                      ))}
                      {parsed.length > 4 && (
                        <span className="text-[10px] font-bold text-emerald-600 block pt-0.5">
                          +{parsed.length - 4} detail takaran lainnya (klik untuk buka)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* --- TAMPILAN SOP --- */
        <div className="space-y-6">
          {SOP_PHASES.map((phaseObj) => {
            const phaseItems = groupedSOPByPhase?.[phaseObj.id] || [];
            if (phaseItems.length === 0) return null;

            return (
              <div key={phaseObj.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${phaseObj.color}`}></span>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    {phaseObj.title}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-medium">
                    ({phaseItems.length} Standar Kerja)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {phaseItems.map((sop) => {
                    const parsed = parseHierarchicalLines(sop.steps || []);
                    return (
                      <div
                        key={sop.id}
                        onClick={() => setActiveDetailItem(sop)}
                        className="p-4 rounded-2xl border border-slate-100 bg-white hover:border-orange-300 hover:shadow-xs transition-all cursor-pointer space-y-2.5 group"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="font-bold text-orange-600">
                            ✓ {parsed.filter((p) => !p.isSub).length} Langkah Utama
                          </span>
                          <div className="flex items-center gap-1">
                            {sop.updated_at && <span className="mr-1">{sop.updated_at}</span>}
                            {effectiveIsHR && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenEditModal(sop, e)}
                                  className="p-1 rounded-md bg-slate-50 hover:bg-orange-50 text-slate-400 hover:text-orange-600 transition-colors cursor-pointer"
                                  title="Edit SOP"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteGuide(sop.id, e)}
                                  className="p-1 rounded-md bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                  title="Hapus SOP"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <h4 className="text-xs font-black text-slate-900 group-hover:text-orange-600 transition-colors leading-snug">
                          {sop.title}
                        </h4>

                        <div className="space-y-1 pt-1">
                          {parsed.slice(0, 3).map((step, sIdx) => (
                            <div
                              key={sIdx}
                              className={`flex items-start gap-1.5 text-[11px] ${
                                step.isSub ? 'pl-3.5 text-slate-500' : 'text-slate-700 font-medium'
                              }`}
                            >
                              <span className="text-slate-400 font-bold shrink-0">{step.numberLabel}</span>
                              <span className="line-clamp-1">{step.text}</span>
                            </div>
                          ))}
                          {parsed.length > 3 && (
                            <span className="text-[10px] font-bold text-orange-600 block pt-0.5">
                              +{parsed.length - 3} detail langkah lainnya (klik untuk buka)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. MODAL POPUP DETAIL DOKUMEN */}
      {activeDetailItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 space-y-5 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      activeDetailItem.content_type === 'JOBDESK'
                        ? 'bg-indigo-50 text-indigo-700'
                        : activeDetailItem.content_type === 'MENU_STANDARD'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-orange-50 text-orange-700'
                    }`}
                  >
                    {activeDetailItem.content_type === 'JOBDESK'
                      ? 'URAIAN JOBDESK'
                      : activeDetailItem.content_type === 'MENU_STANDARD'
                      ? 'STANDAR PENYAJIAN MENU'
                      : `SOP • ${SOP_PHASES.find((p) => p.id === activeDetailItem.phase)?.title || activeDetailItem.phase}`}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    Divisi: {DIVISIONS.find((d) => d.id === activeDetailItem.division)?.label}
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-900 mt-1.5">
                  {activeDetailItem.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setActiveDetailItem(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {activeDetailItem.menu_photo_url && (
                <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 max-h-60 flex items-center justify-center">
                  <img
                    src={activeDetailItem.menu_photo_url}
                    alt={activeDetailItem.title}
                    className="w-full h-full object-contain max-h-60"
                  />
                </div>
              )}

              {activeDetailItem.summary && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 font-medium">
                  {activeDetailItem.summary}
                </div>
              )}

              {(() => {
                const rawLines =
                  activeDetailItem.content_type === 'JOBDESK'
                    ? activeDetailItem.responsibilities || []
                    : activeDetailItem.steps || [];
                const parsedItems = parseHierarchicalLines(rawLines);
                const badgeColor =
                  activeDetailItem.content_type === 'JOBDESK'
                    ? 'bg-indigo-600'
                    : activeDetailItem.content_type === 'MENU_STANDARD'
                    ? 'bg-emerald-600'
                    : 'bg-orange-500';

                return (
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                      {activeDetailItem.content_type === 'JOBDESK'
                        ? 'Daftar Tanggung Jawab & Target Kerja:'
                        : activeDetailItem.content_type === 'MENU_STANDARD'
                        ? 'Komposisi Gramasi & Urutan Penyajian:'
                        : 'Langkah Kerja Petunjuk Lapangan:'}
                    </h4>

                    <div className="space-y-1.5">
                      {parsedItems.map((p, idx) =>
                        p.isSub ? (
                          <div
                            key={idx}
                            className="ml-6 p-2.5 rounded-xl bg-slate-50/90 border border-slate-100 text-xs text-slate-700 flex items-start gap-2"
                          >
                            <span className="font-black text-slate-500 text-[11px] shrink-0 mt-0.5">
                              {p.numberLabel}
                            </span>
                            <span className="leading-relaxed">{p.text}</span>
                          </div>
                        ) : (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs font-bold text-slate-900 flex items-start gap-2.5 mt-2 first:mt-0"
                          >
                            <span
                              className={`px-2 py-0.5 rounded-lg ${badgeColor} text-white text-[10px] font-black shrink-0 mt-0.5`}
                            >
                              {p.numberLabel}
                            </span>
                            <span className="leading-relaxed">{p.text}</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })()}

              {activeDetailItem.notes && (
                <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200/70 text-xs text-amber-900 space-y-1">
                  <span className="font-black block uppercase text-[10px] text-amber-700">
                    ⚠️ Catatan Khusus & Ketentuan HR:
                  </span>
                  <p className="leading-relaxed">{activeDetailItem.notes}</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              {effectiveIsHR ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(activeDetailItem)}
                    className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Materi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteGuide(activeDetailItem.id)}
                    className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setActiveDetailItem(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL INPUT TAMBAH / EDIT DOKUMEN HR */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 uppercase">
                {isEditing ? 'Edit Materi Panduan' : 'Tambah Materi Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGuide} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                    Divisi Terkait
                  </label>
                  <select
                    value={formDivision}
                    onChange={(e: any) => {
                      const val = e.target.value as DivisionType;
                      setFormDivision(val);
                      if (val !== 'DAPUR' && formType === 'MENU_STANDARD') {
                        setFormType('SOP');
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    {DIVISIONS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                    Jenis Dokumen
                  </label>
                  <select
                    value={formType}
                    onChange={(e: any) => setFormType(e.target.value as ContentType)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    <option value="SOP">SOP (Standar Operasional)</option>
                    <option value="JOBDESK">Jobdesk (Uraian Tugas)</option>
                    {formDivision === 'DAPUR' && (
                      <option value="MENU_STANDARD">Standar Penyajian Menu</option>
                    )}
                  </select>
                </div>
              </div>

              {formType === 'SOP' && (
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                    Fase Pelaksanaan SOP
                  </label>
                  <select
                    value={formPhase}
                    onChange={(e: any) => setFormPhase(e.target.value as PhaseType)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    <option value="OPENING">OPENING (Persiapan Buka Toko)</option>
                    <option value="OPERASIONAL">OPERASIONAL (Saat Melayani Tamu)</option>
                    <option value="HANDOVER">SERAH TERIMA SHIFT (Pergantian Shift 1 → 2)</option>
                    <option value="CLOSING">CLOSING (Bersih-bersih & Tutup Toko)</option>
                    <option value="ADMINISTRASI">ADMINISTRASI & PELAPORAN (Stok, Order & WA)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  {formType === 'MENU_STANDARD' ? 'Nama Menu' : 'Judul Materi'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    formType === 'MENU_STANDARD'
                      ? 'Misal: Bakso Urat Spesial / Mie Ayam Bakso'
                      : 'Misal: Serah Terima Laci Kasir / Persiapan Dandang'
                  }
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                />
              </div>

              {formType === 'MENU_STANDARD' && (
                <div className="p-3 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-emerald-800 flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5" /> Foto Contoh Penyajian / Plating (Opsional)
                    </span>
                    <button
                      type="button"
                      onClick={() => menuPhotoInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="px-2.5 py-1 bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <UploadCloud className="w-3 h-3" />
                      <span>{uploadingPhoto ? 'Mengunggah...' : formMenuPhoto ? 'Ganti Foto' : '+ Upload Foto'}</span>
                    </button>
                    <input
                      ref={menuPhotoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadMenuPhoto}
                    />
                  </div>
                  {formMenuPhoto && (
                    <div className="relative w-28 h-20 rounded-xl overflow-hidden border border-emerald-200">
                      <img src={formMenuPhoto} alt="Preview Menu" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFormMenuPhoto(null)}
                        className="absolute top-1 right-1 p-0.5 bg-black/60 text-white rounded-full cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  Ringkasan / Uraian Singkat
                </label>
                <input
                  type="text"
                  placeholder="Deskripsi singkat tujuan panduan atau keterangan menu..."
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-black uppercase text-slate-400">
                    {formType === 'JOBDESK'
                      ? 'Poin Tanggung Jawab'
                      : formType === 'MENU_STANDARD'
                      ? 'Komposisi Gramasi & Urutan Penyajian'
                      : 'Langkah Kerja SOP'}
                  </label>
                  <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                    Awali baris dengan &ldquo;-&rdquo; untuk sub-detail (1.1, 1.2)
                  </span>
                </div>
                <textarea
                  required
                  rows={5}
                  placeholder={`Contoh penulisan bertingkat:\nPersiapan Dandang Kuah\n- Pastikan bagian dalam dandang bersih\n- Isi air minimal 3/4 dandang\nNyalakan Kompor Api Sedang`}
                  value={formContentList}
                  onChange={(e) => setFormContentList(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  Catatan Tambahan / Larangan HR (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Misal: Kuah wajib mendidih saat disiram ke mangkuk..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-2/3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-md transition-all disabled:opacity-40 cursor-pointer"
                >
                  {saving ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Simpan Materi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}