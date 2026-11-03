'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Banknote, 
  QrCode, 
  ShoppingBag, 
  Wallet, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Building2,
  Camera,
  Eye,
  X,
  ArrowRightCircle,
  Coins
} from 'lucide-react';

interface Props {
  user?: any;
  locationId?: string;
}

export default function LeaderSettlementMonitor({ user, locationId: propLocId }: Props) {
  const activeLocationId = propLocId || user?.location_id;

  const todayWita = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());
  const [filterDate, setFilterDate] = useState<string>(todayWita);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // State Modal Galeri Foto Bukti Nota & Struk
  const [selectedShiftForPhotos, setSelectedShiftForPhotos] = useState<any | null>(null);
  const [zoomPhotoUrl, setZoomPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchSettlements();
  }, [filterDate, activeLocationId]);

  const fetchSettlements = async () => {
    if (!activeLocationId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cash_settlements')
        .select('*')
        .eq('location_id', activeLocationId)
        .eq('settlement_date', filterDate)
        .order('shift', { ascending: true });

      if (error) throw error;
      setSettlements(data || []);
    } catch (err: any) {
      console.error('Gagal mengambil settlement cabang:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => {
    const totalOmset = settlements.reduce((acc, curr) => acc + Number(curr.total_omset || (Number(curr.omset_dine_in || 0) + Number(curr.omset_online || 0)) || 0), 0);
    const totalCash = settlements.reduce((acc, curr) => acc + Number(curr.cash_nominal || 0), 0);
    const totalNonCashIncome = settlements.reduce(
      (acc, curr) => acc + Number(curr.qris_nominal || 0) + Number(curr.online_nominal || 0), 
      0
    );
    const totalCashExpense = settlements.reduce((acc, curr) => acc + Number(curr.expense_nominal || 0), 0);
    const totalNonCashExpense = settlements.reduce((acc, curr) => acc + Number(curr.non_cash_expense_nominal || 0), 0);
    const totalCashDiff = settlements.reduce((acc, curr) => acc + Number(curr.cash_difference || 0), 0);
    const totalBills = settlements.reduce((acc, curr) => acc + Number(curr.total_bills || 0), 0);
    const totalNetDeposited = settlements.reduce((acc, curr) => acc + Number(curr.net_cash_deposited || curr.actual_cash_deposited || 0), 0);

    return {
      totalOmset,
      totalCash,
      totalNonCashIncome,
      totalCashExpense,
      totalNonCashExpense,
      totalCombinedExpense: totalCashExpense + totalNonCashExpense,
      totalCashDiff,
      totalBills,
      totalNetDeposited
    };
  }, [settlements]);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-7 shadow-xs space-y-5 font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Banknote className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 tracking-tight">
              Rekap Omset Kasir & Audit Bukti Nota
            </h2>
            <p className="text-[11px] font-medium text-slate-400">
              Pantau setoran kasir, pengeluaran laci, cek selisih & foto bukti fisik nota.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={fetchSettlements}
            className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 border border-slate-200 cursor-pointer"
            title="Segarkan"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Ringkasan Angka Utama */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Omset</span>
          <span className="text-base font-black text-slate-900 block mt-1">
            Rp {summary.totalOmset.toLocaleString('id-ID')}
          </span>
          <span className="text-[10px] text-slate-400">{summary.totalBills} Transaksi</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Tunai (Cash)</span>
          <span className="text-base font-black text-emerald-700 block mt-1">
            Rp {summary.totalCash.toLocaleString('id-ID')}
          </span>
          <span className="text-[10px] text-slate-400">Uang masuk</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Non-Tunai</span>
          <span className="text-base font-black text-indigo-700 block mt-1">
            Rp {summary.totalNonCashIncome.toLocaleString('id-ID')}
          </span>
          <span className="text-[10px] text-slate-400">QRIS & Ojol</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-100">
          <span className="text-[10px] font-bold text-rose-700 uppercase block">Keluar (Laci)</span>
          <span className="text-base font-black text-rose-600 block mt-1">
            Rp {summary.totalCashExpense.toLocaleString('id-ID')}
          </span>
          <span className="text-[10px] text-rose-400 font-medium">Potong fisik</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100">
          <span className="text-[10px] font-bold text-emerald-700 uppercase block">Total Setoran</span>
          <span className="text-base font-black text-emerald-700 block mt-1">
            Rp {summary.totalNetDeposited.toLocaleString('id-ID')}
          </span>
          <span className="text-[10px] text-emerald-500 font-medium">Uang disetor</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Selisih Kasir</span>
          <span className={`text-base font-black block mt-1 ${summary.totalCashDiff < 0 ? 'text-red-600' : 'text-slate-800'}`}>
            {summary.totalCashDiff === 0 ? 'Rp 0' : `${summary.totalCashDiff < 0 ? '-' : '+'}Rp ${Math.abs(summary.totalCashDiff).toLocaleString('id-ID')}`}
          </span>
          <span className="text-[10px] text-slate-400">{summary.totalCashDiff === 0 ? 'Klop' : 'Cek laci'}</span>
        </div>
      </div>

      {/* Rincian Per Shift */}
      <div className="space-y-4 pt-1">
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
          Rincian Pembagian Shift ({settlements.length} Shift Terinput)
        </span>

        {loading ? (
          <div className="py-8 text-center text-xs font-bold text-slate-400">Memuat rekap shift...</div>
        ) : settlements.length === 0 ? (
          <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400 font-bold">
            Belum ada rekap kasir yang disimpan pada tanggal {filterDate}.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settlements.map((s) => {
              let nonCashBreakdown: any[] = [];
              if (s.non_cash_expense_notes && s.non_cash_expense_notes.startsWith('[')) {
                try {
                  nonCashBreakdown = JSON.parse(s.non_cash_expense_notes);
                } catch {
                  nonCashBreakdown = [];
                }
              }

              const expensePhotos: string[] = s.expense_receipt_photos || [];
              const depositPhoto: string | null = s.deposit_receipt_photo || null;
              const totalPhotos = expensePhotos.length + (depositPhoto ? 1 : 0);

              return (
                <div key={s.id} className="p-5 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-3.5">
                  <div className="flex justify-between items-start border-b border-slate-200/60 pb-3">
                    <div>
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-black tracking-wider uppercase">
                        {s.shift === 'SHIFT_2' ? 'Shift 2 (Malam)' : 'Shift 1 (Siang)'}
                      </span>
                      <div className="text-xs font-bold text-slate-700 mt-1.5">
                        Kasir: <span className="font-extrabold text-slate-900">{s.reported_by || '-'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-bold">Omset Shift</span>
                      <span className="text-sm font-black text-slate-900">
                        Rp {Number(s.total_omset || 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                        <Banknote className="w-3.5 h-3.5 text-emerald-600" /> Tunai (Cash):
                      </span>
                      <span className="font-bold text-slate-800">Rp {Number(s.cash_nominal || 0).toLocaleString('id-ID')}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 text-indigo-600" /> QRIS / Transfer:
                      </span>
                      <span className="font-bold text-indigo-700">Rp {Number(s.qris_nominal || 0).toLocaleString('id-ID')}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" /> Online (Grab/Go/Shopee):
                      </span>
                      <span className="font-bold text-slate-800">Rp {Number(s.online_nominal || 0).toLocaleString('id-ID')}</span>
                    </div>
                  </div>

                  {/* Pengeluaran Kasir Tunai + Lampiran Foto Nota */}
                  <div className="pt-2 border-t border-slate-200/60 text-xs space-y-1.5">
                    <div className="flex justify-between items-center text-rose-600 font-black">
                      <span className="flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5" /> Pengeluaran Laci (Tunai):
                      </span>
                      <span>-Rp {Number(s.expense_nominal || 0).toLocaleString('id-ID')}</span>
                    </div>
                    {s.expense_notes && (
                      <div className="text-[11px] text-slate-500 bg-white p-2 rounded-lg border border-slate-200/60 italic">
                        &ldquo;{s.expense_notes}&rdquo;
                      </div>
                    )}

                    {/* Pratinjau Mini Foto Nota Kasir */}
                    {expensePhotos.length > 0 && (
                      <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-1">
                        {expensePhotos.map((url, idx) => (
                          <img
                            key={idx}
                            src={url}
                            alt={`Nota ${idx + 1}`}
                            onClick={() => setZoomPhotoUrl(url)}
                            className="w-10 h-10 object-cover rounded-lg border border-rose-200 cursor-pointer hover:scale-105 transition-transform shrink-0"
                            title="Klik untuk perbesar nota"
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => setSelectedShiftForPhotos(s)}
                          className="px-2 py-1 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold rounded-lg shrink-0 cursor-pointer"
                        >
                          Lihat {expensePhotos.length} Nota
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Pengeluaran Non-Kasir (Rumah Produksi & Vendor) */}
                  {Number(s.non_cash_expense_nominal || 0) > 0 && (
                    <div className="pt-2 border-t border-slate-200/60 text-xs space-y-1.5">
                      <div className="flex justify-between text-indigo-700 font-black">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5" /> Beban Non-Kasir (RP / Vendor):
                        </span>
                        <span>Rp {Number(s.non_cash_expense_nominal || 0).toLocaleString('id-ID')}</span>
                      </div>

                      {nonCashBreakdown.length > 0 ? (
                        <div className="space-y-1">
                          {nonCashBreakdown.map((item, idx) => (
                            <div key={idx} className="bg-white p-2 rounded-lg border border-indigo-100 flex justify-between items-center text-[11px]">
                              <div>
                                <span className="font-black text-indigo-900 block">{item.category}</span>
                                <span className="text-slate-500 italic">{item.notes || '-'}</span>
                              </div>
                              <span className="font-black text-indigo-700">
                                Rp {Number(item.nominal || 0).toLocaleString('id-ID')}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        s.non_cash_expense_notes && (
                          <div className="text-[11px] text-indigo-900 bg-white p-2 rounded-lg border border-indigo-100 italic">
                            &ldquo;{s.non_cash_expense_notes}&rdquo;
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {/* Kas Laci, Setoran Bersih & Tombol Galeri Nota */}
                  <div className="pt-2 border-t border-slate-200/60 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Total Fisik Laci:</span>
                        <span className="font-black text-slate-800">
                          Rp {Number(s.actual_cash_deposited || 0).toLocaleString('id-ID')}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-emerald-600 block font-bold">Uang Disetor:</span>
                        <span className="font-black text-emerald-800">
                          Rp {Number(s.net_cash_deposited || s.actual_cash_deposited || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                        Number(s.cash_difference || 0) === 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {Number(s.cash_difference || 0) === 0 ? 'Klop (Pas)' : `Selisih: Rp ${Number(s.cash_difference || 0).toLocaleString('id-ID')}`}
                      </span>

                      {/* Tombol Akses Bukti Foto */}
                      {totalPhotos > 0 ? (
                        <button
                          type="button"
                          onClick={() => setSelectedShiftForPhotos(s)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Camera className="w-3 h-3 text-indigo-600" />
                          <span>{totalPhotos} Bukti Foto</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Tanpa foto bukti</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL AUDIT BUKTI NOTA & STRUK SETORAN */}
      {selectedShiftForPhotos && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  Pemeriksaan Bukti Kasir
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  Nota Pengeluaran & Struk Setoran
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  {selectedShiftForPhotos.settlement_date} ({selectedShiftForPhotos.shift === 'SHIFT_1' ? 'Shift 1' : 'Shift 2'}) • Kasir: {selectedShiftForPhotos.reported_by}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedShiftForPhotos(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              {/* Bagian 1: Nota Pengeluaran Kasir */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-800">
                    <Wallet className="w-4 h-4 text-rose-600" />
                    <span>Foto Nota Pengeluaran Laci ({selectedShiftForPhotos.expense_receipt_photos?.length || 0})</span>
                  </div>
                  <span className="text-xs font-bold text-rose-700">
                    Total: Rp {Number(selectedShiftForPhotos.expense_nominal || 0).toLocaleString('id-ID')}
                  </span>
                </div>

                {selectedShiftForPhotos.expense_notes && (
                  <p className="text-xs text-slate-600 bg-rose-50/60 p-2.5 rounded-xl border border-rose-100">
                    <b>Catatan Kasir:</b> {selectedShiftForPhotos.expense_notes}
                  </p>
                )}

                {selectedShiftForPhotos.expense_receipt_photos && selectedShiftForPhotos.expense_receipt_photos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {selectedShiftForPhotos.expense_receipt_photos.map((url: string, idx: number) => (
                      <div 
                        key={idx} 
                        className="group relative rounded-2xl overflow-hidden border border-slate-200 aspect-3/4 bg-slate-900 cursor-pointer shadow-xs"
                        onClick={() => setZoomPhotoUrl(url)}
                      >
                        <img 
                          src={url} 
                          alt={`Nota ${idx + 1}`} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1">
                          <Eye className="w-4 h-4" />
                          <span>Perbesar</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-3.5 rounded-xl text-center">
                    Kasir tidak melampirkan foto nota pengeluaran laci.
                  </p>
                )}
              </div>

              {/* Bagian 2: Struk Setoran Bank / Transfer */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-800">
                    <ArrowRightCircle className="w-4 h-4 text-emerald-600" />
                    <span>Struk Setoran Bank / Transfer</span>
                  </div>
                  <span className="text-xs font-black text-emerald-800">
                    Disetor: Rp {Number(selectedShiftForPhotos.net_cash_deposited || selectedShiftForPhotos.actual_cash_deposited || 0).toLocaleString('id-ID')}
                  </span>
                </div>

                {selectedShiftForPhotos.deposit_receipt_photo ? (
                  <div 
                    className="group relative rounded-2xl overflow-hidden border border-slate-200 w-44 aspect-3/4 bg-slate-900 cursor-pointer shadow-xs"
                    onClick={() => setZoomPhotoUrl(selectedShiftForPhotos.deposit_receipt_photo)}
                  >
                    <img 
                      src={selectedShiftForPhotos.deposit_receipt_photo} 
                      alt="Struk Transfer" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1">
                      <Eye className="w-4 h-4" />
                      <span>Perbesar</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
                    ⚠️ Kasir/Leader belum mengunggah struk bukti transfer atau setoran bank untuk shift ini.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedShiftForPhotos(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Tutup Galeri
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX PERBESAR GAMBAR */}
      {zoomPhotoUrl && (
        <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative max-w-2xl w-full bg-slate-950 rounded-3xl p-3 border border-slate-800 space-y-3 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center px-2 pt-1">
              <span className="text-xs font-black text-white uppercase tracking-wider">
                Pratinjau Detail Nota
              </span>
              <button
                type="button"
                onClick={() => setZoomPhotoUrl(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden bg-black flex items-center justify-center max-h-[80vh]">
              <img 
                src={zoomPhotoUrl} 
                alt="Nota Zoom" 
                className="max-w-full max-h-[80vh] object-contain" 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}