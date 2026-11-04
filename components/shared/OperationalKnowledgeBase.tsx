'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  BookOpen, 
  Search, 
  Plus, 
  Trash2, 
  X, 
  UserCheck, 
  ChefHat, 
  Receipt, 
  UtensilsCrossed, 
  FileText, 
  ListChecks, 
  ShieldCheck, 
  Layers
} from 'lucide-react';

interface Props {
  user?: any;
  isHR?: boolean;
  userRole?: string;
  userName?: string;
}

interface GuideItem {
  id: string;
  division: 'LEADER' | 'DAPUR' | 'KASIR' | 'PELAYAN' | 'UMUM';
  content_type: 'JOBDESK' | 'SOP';
  phase?: 'OPENING' | 'OPERASIONAL' | 'CLOSING' | 'UMUM';
  title: string;
  summary?: string;
  steps: string[];
  responsibilities?: string[];
  notes?: string;
  updated_at?: string;
}

const DIVISIONS = [
  { id: 'LEADER', label: 'Leader Outlet', icon: UserCheck, color: 'text-amber-600 bg-amber-50' },
  { id: 'DAPUR', label: 'Divisi Dapur', icon: ChefHat, color: 'text-orange-600 bg-orange-50' },
  { id: 'KASIR', label: 'Divisi Kasir', icon: Receipt, color: 'text-emerald-600 bg-emerald-50' },
  { id: 'PELAYAN', label: 'Divisi Pelayan / Floor', icon: UtensilsCrossed, color: 'text-blue-600 bg-blue-50' },
  { id: 'UMUM', label: 'Kebijakan Umum HR', icon: ShieldCheck, color: 'text-indigo-600 bg-indigo-50' }
];

export default function OperationalKnowledgeBase({ 
  user, 
  isHR = true, 
  userRole, 
  userName 
}: Props) {
  const effectiveRole = (userRole || user?.role || user?.role_name || '').toUpperCase();
  const effectiveIsHR = isHR || effectiveRole.includes('HR') || effectiveRole.includes('OWNER') || effectiveRole.includes('ADMIN');

  const [selectedDivision, setSelectedDivision] = useState<string>('DAPUR');
  const [selectedType, setSelectedType] = useState<'JOBDESK' | 'SOP'>('SOP');
  const [searchTerm, setSearchTerm] = useState('');
  const [guides, setGuides] = useState<GuideItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [activeDetailItem, setActiveDetailItem] = useState<GuideItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form State
  const [formDivision, setFormDivision] = useState<'LEADER' | 'DAPUR' | 'KASIR' | 'PELAYAN' | 'UMUM'>('DAPUR');
  const [formType, setFormType] = useState<'JOBDESK' | 'SOP'>('SOP');
  const [formPhase, setFormPhase] = useState<'OPENING' | 'OPERASIONAL' | 'CLOSING' | 'UMUM'>('OPENING');
  const [formTitle, setFormTitle] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formContentList, setFormContentList] = useState<string>('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Data Default Awal
  const defaultInitialGuides: GuideItem[] = [
    {
      id: 'dapur-jobdesk-1',
      division: 'DAPUR',
      content_type: 'JOBDESK',
      title: 'Jobdesk & Tanggung Jawab Cook / Kitchen Crew',
      summary: 'Tanggung jawab utama atas kualitas rasa, kecepatan penyajian porsi, dan kebersihan dapur.',
      responsibilities: [
        'Memastikan seluruh bahan baku siap pakai sebelum jam operasional dimulai.',
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
        'Isi air dandang kuah minimal 3/4 volume dandang.',
        'Nyalakan kompor dengan api sedang-tinggi hingga mendidih.',
        'Masukkan bumbu kuah kaldu resmi Bakso Ibu, aduk rata dan cicipi rasa standar.',
        'Kecilkan api ke tingkat api simpan panas begitu kuah mendidih sempurna.'
      ],
      notes: 'Jangan pernah membiarkan air dandang kurang dari 1/2 volume.'
    },
    {
      id: 'dapur-sop-2',
      division: 'DAPUR',
      content_type: 'SOP',
      phase: 'OPERASIONAL',
      title: 'Standar Rebus Mie Ayam & Racikan Topping',
      summary: 'Waktu perebusan mie agar tekstur kenyal dan tidak lembek.',
      steps: [
        'Pastikan air rebusan mie dalam kondisi mendidih bergolak.',
        'Urai mie ayam sebelum dimasukkan ke saringan rebus.',
        'Rebus mie ayam selama 1 - 1.5 menit sambil diaduk perlahan.',
        'Tiriskan mie secara maksimal (kocok saringan 3-4 kali agar air tidak terbawa).',
        'Tuangkan racikan minyak bumbu ke mangkuk sebelum mie dimasukkan, aduk cepat hingga merata.',
        'Beri topping ayam cincang dan daun bawang sesuai takaran standar.'
      ],
      notes: 'Ganti air rebusan mie jika sudah mulai keruh dan berbusa.'
    },
    {
      id: 'dapur-sop-3',
      division: 'DAPUR',
      content_type: 'SOP',
      phase: 'CLOSING',
      title: 'Pembersihan Kompor, Dandang & Penyimpanan Bahan Sisa',
      summary: 'Prosedur tutup shift malam untuk sterilisasi dapur.',
      steps: [
        'Matikan seluruh regulator kompor gas dan pastikan tidak ada bau gas menyengat.',
        'Pindahkan sisa kuah kaldu yang layak ke wadah pendingin.',
        'Cuci bersih dandang dan tiriskan di rak yang bersih.',
        'Tutup rapat bahan sisa (daun bawang, bumbu, bakso) dan simpan dalam chiller/freezer.',
        'Pel lantai dapur dengan karbol pembersih lemak.'
      ],
      notes: 'Pastikan regulator tabung gas dicabut saat outlet tutup malam.'
    },
    {
      id: 'kasir-jobdesk-1',
      division: 'KASIR',
      content_type: 'JOBDESK',
      title: 'Jobdesk & Tanggung Jawab Kasir Outlet',
      summary: 'Tanggung jawab penuh atas penerimaan uang pembayaran, ketelitian input POS, dan setoran.',
      responsibilities: [
        'Melayani transaksi pembayaran pelanggan dengan ramah, cepat, dan teliti.',
        'Menjaga kesesuaian antara uang tunai di laci fisik dengan laporan penjualan sistem.',
        'Mencatat seluruh pengeluaran kas kecil laci (petty cash) dan melampirkan foto nota fisik.',
        'Mengelola pesanan online (GrabFood, GoFood, ShopeeFood) agar tidak terlewat.',
        'Menghitung dan melaporkan rekapan setoran bersih di akhir shift.'
      ],
      steps: [],
      notes: 'Uang laci kasir tidak boleh dipinjamkan atau digunakan untuk keperluan pribadi.'
    },
    {
      id: 'kasir-sop-1',
      division: 'KASIR',
      content_type: 'SOP',
      phase: 'OPENING',
      title: 'Standar Buka Kasir & Cek Uang Modal (Float)',
      summary: 'Pengecekan modal receh awal shift.',
      steps: [
        'Nyalakan tablet / perangkat POS Olsera / ESB.',
        'Hitung fisik uang modal laci kembalian (pastikan nominal pecahan sesuai modal awal).',
        'Cek koneksi internet printer Bluetooth dan kertas struk termal.',
        'Pastikan kode QRIS statis bersih dan terlihat jelas oleh pembeli.'
      ],
      notes: 'Jika modal pecahan awal kurang, segera koordinasikan dengan Leader.'
    },
    {
      id: 'kasir-sop-2',
      division: 'KASIR',
      content_type: 'SOP',
      phase: 'CLOSING',
      title: 'Rekap Kas Laci, Upload Nota & Penyerahan Setoran',
      summary: 'Langkah tutup shift kasir di sistem ERP Bakso Ibu.',
      steps: [
        'Keluarkan seluruh uang tunai dari laci kasir dan pisahkan per pecahan.',
        'Buka modul "Rekap Omset & Kas Kasir" di portal outlet.',
        'Input nominal penjualan tunai, QRIS, dan pesanan online sesuai laporan POS.',
        'Input pengeluaran laci dan ambil foto nota/bon belanja lewat kamera HP.',
        'Tentukan sisa uang modal yang ditinggal di laci untuk shift esok.',
        'Cek status selisih kasir, simpan rekap, dan bagikan ringkasan ke grup WhatsApp.'
      ],
      notes: 'Uang bersih setoran wajib diserahkan ke Leader atau disetor ke rekening bank resmi.'
    },
    {
      id: 'leader-jobdesk-1',
      division: 'LEADER',
      content_type: 'JOBDESK',
      title: 'Jobdesk & Tanggung Jawab Leader Outlet',
      summary: 'Penanggung jawab operasional harian cabang, koordinasi tim, stok bahan, dan kepuasan pelanggan.',
      responsibilities: [
        'Memimpin briefing harian sebelum outlet buka dan membagi tugas kru.',
        'Memeriksa stok harian cabang dan mengajukan pesanan belanja bahan baku ke dapur pusat/vendor.',
        'Menyetujui (ACC) atau menolak pengajuan lembur (overtime) kru sebelum jam kerja ekstra berjalan.',
        'Memvalidasi laporan setoran kasir dan memeriksa keaslian nota belanja fisik.',
        'Menangani komplain pelanggan dengan sopan dan solusi cepat.'
      ],
      steps: [],
      notes: 'Leader adalah role model ketepatan waktu, kedisiplinan, dan keramahan pelayanan.'
    },
    {
      id: 'leader-sop-1',
      division: 'LEADER',
      content_type: 'SOP',
      phase: 'OPERASIONAL',
      title: 'SOP Pengajuan Order Belanja Cabang',
      summary: 'Tata cara pemesanan kebutuhan bahan harian ke Logistik & Vendor.',
      steps: [
        'Lakukan pengecekan fisik sisa stok di rak, chiller, dan freezer pada sore hari.',
        'Buka modul "Lembar Permintaan Belanja" di portal outlet.',
        'Isi jumlah kebutuhan bahan sesuai estimasi penjualan esok hari.',
        'Tentukan penanggung jawab pembelian (Order Leader / Kasir / Logistik).',
        'Kirim data ke sistem dan tekan tombol "Bagikan ke WA" untuk dikirim ke tim logistik.'
      ],
      notes: 'Pemesanan bahan maksimal dikirim sebelum jam cut-off dapur pusat.'
    }
  ];

  const fetchGuides = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('knowledge_base_articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) {
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

    const phases: Record<string, GuideItem[]> = {
      OPENING: [],
      OPERASIONAL: [],
      CLOSING: []
    };

    filteredGuides.forEach((item) => {
      const phaseKey = item.phase || 'OPERASIONAL';
      if (phases[phaseKey]) {
        phases[phaseKey].push(item);
      } else {
        phases.OPERASIONAL.push(item);
      }
    });

    return phases;
  }, [filteredGuides, selectedType]);

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setEditId(null);
    setFormDivision(selectedDivision as any);
    setFormType(selectedType);
    setFormPhase('OPENING');
    setFormTitle('');
    setFormSummary('');
    setFormContentList('');
    setFormNotes('');
    setShowAddModal(true);
  };

  const handleSaveGuide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('Judul panduan wajib diisi!');
      return;
    }

    setSaving(true);
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
      steps: formType === 'SOP' ? lines : [],
      responsibilities: formType === 'JOBDESK' ? lines : [],
      notes: formNotes.trim(),
      updated_at: new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar' }).format(new Date())
    };

    try {
      await supabase.from('knowledge_base_articles').upsert([newGuide]);
    } catch {
      // Fallback
    }

    setGuides((prev) => {
      if (isEditing && editId) {
        return prev.map((item) => (item.id === editId ? newGuide : item));
      }
      return [newGuide, ...prev];
    });

    setSaving(false);
    setShowAddModal(false);
  };

  const handleDeleteGuide = async (id: string) => {
    if (!confirm('Yakin ingin menghapus panduan/jobdesk ini?')) return;
    try {
      await supabase.from('knowledge_base_articles').delete().eq('id', id);
    } catch {
      // ignore
    }
    setGuides((prev) => prev.filter((item) => item.id !== id));
    setActiveDetailItem(null);
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
              Standar operasional prosedur dan rincian tanggung jawab kru per bagian.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari materi / panduan..."
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

      {/* 2. TAB PILIHAN DIVISI */}
      <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none">
        {DIVISIONS.map((div) => {
          const Icon = div.icon;
          const isActive = selectedDivision === div.id;
          return (
            <button
              key={div.id}
              type="button"
              onClick={() => setSelectedDivision(div.id)}
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

      {/* 3. SWITCH MODE: JOBDESK vs SOP */}
      <div className="flex items-center justify-between bg-slate-50/80 p-2 rounded-2xl border border-slate-100">
        <div className="flex gap-1.5">
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
            Belum ada data {selectedType === 'JOBDESK' ? 'Jobdesk' : 'SOP'} untuk divisi ini.
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
          {filteredGuides.map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveDetailItem(item)}
              className="p-5 rounded-3xl border border-slate-100 bg-white hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer space-y-3 group"
            >
              <div className="flex items-start justify-between">
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-lg">
                  Tanggung Jawab Divisi
                </span>
                <span className="text-[10px] text-slate-400">
                  {item.responsibilities?.length || 0} Poin Utama
                </span>
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
                {(item.responsibilities || []).slice(0, 3).map((resp, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></span>
                    <span className="line-clamp-1">{resp}</span>
                  </div>
                ))}
                {(item.responsibilities?.length || 0) > 3 && (
                  <p className="text-[10px] font-bold text-indigo-600 pt-0.5">
                    +{item.responsibilities!.length - 3} tanggung jawab lainnya (klik untuk buka)
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* --- TAMPILAN SOP --- */
        <div className="space-y-6">
          {(['OPENING', 'OPERASIONAL', 'CLOSING'] as const).map((phase) => {
            const phaseItems = groupedSOPByPhase?.[phase] || [];
            if (phaseItems.length === 0) return null;

            const phaseLabels = {
              OPENING: { title: 'OPENING', color: 'bg-emerald-500' },
              OPERASIONAL: { title: 'OPERASIONAL (RUNNING)', color: 'bg-amber-500' },
              CLOSING: { title: 'CLOSING', color: 'bg-rose-500' }
            };

            return (
              <div key={phase} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${phaseLabels[phase].color}`}></span>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    {phaseLabels[phase].title}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-medium">
                    ({phaseItems.length} Standar Kerja)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {phaseItems.map((sop) => (
                    <div
                      key={sop.id}
                      onClick={() => setActiveDetailItem(sop)}
                      className="p-4 rounded-2xl border border-slate-100 bg-white hover:border-orange-300 hover:shadow-xs transition-all cursor-pointer space-y-2.5 group"
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-bold text-orange-600">✓ {sop.steps.length} Langkah SOP</span>
                        {sop.updated_at && <span>{sop.updated_at}</span>}
                      </div>

                      <h4 className="text-xs font-black text-slate-900 group-hover:text-orange-600 transition-colors leading-snug">
                        {sop.title}
                      </h4>

                      <div className="space-y-1 pt-1">
                        {sop.steps.slice(0, 2).map((step, sIdx) => (
                          <div key={sIdx} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                            <span className="text-slate-400 font-bold shrink-0">{sIdx + 1}.</span>
                            <span className="line-clamp-1">{step}</span>
                          </div>
                        ))}
                        {sop.steps.length > 2 && (
                          <span className="text-[10px] font-bold text-orange-600 block pt-0.5">
                            +{sop.steps.length - 2} langkah lainnya (klik untuk buka)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
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
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                    activeDetailItem.content_type === 'JOBDESK'
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'bg-orange-50 text-orange-700'
                  }`}>
                    {activeDetailItem.content_type === 'JOBDESK' ? 'URAIAN JOBDESK' : `SOP • ${activeDetailItem.phase || 'OPERASIONAL'}`}
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
              {activeDetailItem.summary && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 font-medium">
                  {activeDetailItem.summary}
                </div>
              )}

              {activeDetailItem.content_type === 'JOBDESK' && activeDetailItem.responsibilities && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                    Daftar Tanggung Jawab & Target Kerja:
                  </h4>
                  <div className="space-y-2">
                    {activeDetailItem.responsibilities.map((resp, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-indigo-50/40 border border-indigo-100 text-xs font-semibold text-slate-800 flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">{resp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeDetailItem.content_type === 'SOP' && activeDetailItem.steps && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                    Langkah Kerja Petunjuk Lapangan:
                  </h4>
                  <div className="space-y-2">
                    {activeDetailItem.steps.map((step, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs font-semibold text-slate-800 flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeDetailItem.notes && (
                <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200/70 text-xs text-amber-900 space-y-1">
                  <span className="font-black block uppercase text-[10px] text-amber-700">
                    ⚠️ Catatan Khusus & Ketentuan HR:
                  </span>
                  <p className="leading-relaxed">{activeDetailItem.notes}</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              {effectiveIsHR ? (
                <button
                  type="button"
                  onClick={() => handleDeleteGuide(activeDetailItem.id)}
                  className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Materi</span>
                </button>
              ) : <div />}

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
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 uppercase">
                {isEditing ? 'Edit Materi Panduan' : 'Tambah Materi Jobdesk / SOP Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700"
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
                    onChange={(e: any) => setFormDivision(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    {DIVISIONS.map((d) => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                    Jenis Dokumen
                  </label>
                  <select
                    value={formType}
                    onChange={(e: any) => setFormType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    <option value="SOP">SOP (Standar Operasional)</option>
                    <option value="JOBDESK">Jobdesk (Uraian Tugas)</option>
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
                    onChange={(e: any) => setFormPhase(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    <option value="OPENING">OPENING (Persiapan Buka Toko)</option>
                    <option value="OPERASIONAL">OPERASIONAL (Saat Melayani Tamu)</option>
                    <option value="CLOSING">CLOSING (Bersih-bersih & Tutup Toko)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  Judul Materi
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Standar Pembersihan Kompor Dapur / Standar Salam Kasir"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  Ringkasan / Uraian Singkat
                </label>
                <input
                  type="text"
                  placeholder="Deskripsi singkat tujuan dari SOP atau Jobdesk ini..."
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  {formType === 'JOBDESK' ? 'Poin-Poin Tanggung Jawab (1 baris per poin)' : 'Langkah-Langkah SOP (1 baris per langkah)'}
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder={`Tulis tiap poin di baris baru:\n1. Pastikan dandang bersih\n2. Nyalakan kompor api sedang\n3. Cek takaran bumbu kaldu`}
                  value={formContentList}
                  onChange={(e) => setFormContentList(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  Catatan Tambahan / Larangan HR (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Misal: Dilarang bermain HP saat jam operasional..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-2/3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-md transition-all disabled:opacity-40"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Materi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}