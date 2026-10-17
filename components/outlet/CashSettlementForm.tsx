'use client';

import React, { useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { compressImage } from '@/lib/imageCompressor';
import { 
  Banknote, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Camera, 
  Upload, 
  Trash2, 
  Receipt 
} from 'lucide-react';

interface Props {
  user?: any;
  onBack?: () => void;
  locationId?: string;
  staffName?: string;
}

export default function CashSettlementForm({ user, onBack, locationId, staffName }: Props) {
  const activeLocationId = locationId || user?.location_id;
  const activeStaffName = staffName || user?.active_staff_name || user?.username || 'Kasir Outlet';

  const [shift, setShift] = useState<'SHIFT_1' | 'SHIFT_2'>('SHIFT_1');
  const [cashNominal, setCashNominal] = useState('');
  const [qrisNominal, setQrisNominal] = useState('');
  const [onlineNominal, setOnlineNominal] = useState('');
  const [expenseNominal, setExpenseNominal] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [actualCashDeposited, setActualCashDeposited] = useState('');
  const [notes, setNotes] = useState('');

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Total Omset Shift
  const totalOmset = useMemo(() => {
    const c = parseFloat(cashNominal) || 0;
    const q = parseFloat(qrisNominal) || 0;
    const o = parseFloat(onlineNominal) || 0;
    return c + q + o;
  }, [cashNominal, qrisNominal, onlineNominal]);

  // Selisih Kas Tunai
  const cashDifference = useMemo(() => {
    if (!cashNominal && !actualCashDeposited) return 0;
    const target = parseFloat(cashNominal) || 0;
    const actual = parseFloat(actualCashDeposited) || 0;
    return actual - target;
  }, [cashNominal, actualCashDeposited]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 1200, 0.7);
        setProofFile(compressed);
        setProofPreview(URL.createObjectURL(compressed));
      } catch {
        setProofFile(file);
        setProofPreview(URL.createObjectURL(file));
      }
    }
  };

  const handleRemovePhoto = () => {
    setProofFile(null);
    setProofPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (totalOmset <= 0) {
        throw new Error('Total omset shift ini tidak boleh 0.');
      }

      const today = new Date().toISOString().split('T')[0];
      let uploadedUrl = null;

      if (proofFile) {
        const fileExt = proofFile.name.split('.').pop() || 'jpg';
        const filePath = `settlement_${activeLocationId}_${today}_${shift}_${Date.now()}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage.from('receipts').upload(filePath, proofFile);
        if (!uploadErr) {
          const { data } = supabase.storage.from('receipts').getPublicUrl(filePath);
          uploadedUrl = data?.publicUrl;
        }
      }

      const { error } = await supabase.from('cash_settlements').upsert({
        location_id: activeLocationId,
        settlement_date: today,
        shift,
        cash_nominal: parseFloat(cashNominal) || 0,
        qris_nominal: parseFloat(qrisNominal) || 0,
        online_nominal: parseFloat(onlineNominal) || 0,
        expense_nominal: parseFloat(expenseNominal) || 0,
        expense_notes: expenseNotes.trim() || null,
        actual_cash_deposited: parseFloat(actualCashDeposited) || 0,
        cash_difference: cashDifference,
        proof_photo_url: uploadedUrl,
        notes: notes.trim() || null,
        reported_by: `${activeStaffName} (${shift === 'SHIFT_1' ? 'Shift 1' : 'Shift 2'})`,
      }, { onConflict: 'location_id, settlement_date, shift' });

      if (error) throw error;

      setMessage({
        text: `Sukses menyimpan Rekap ${shift === 'SHIFT_1' ? 'Shift 1' : 'Shift 2'}! (Rp ${totalOmset.toLocaleString('id-ID')})`,
        type: 'success',
      });

      setCashNominal('');
      setQrisNominal('');
      setOnlineNominal('');
      setExpenseNominal('');
      setExpenseNotes('');
      setActualCashDeposited('');
      setNotes('');
      handleRemovePhoto();
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menyimpan rekap omset.', type: 'error' });
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

      {/* Header & Pilihan Shift */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 mb-5 border-b border-slate-100 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <Banknote className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 leading-tight">Rekap Omset Kasir</h2>
            <p className="text-xs text-slate-400">Pemasukan, pengeluaran & setoran kasir</p>
          </div>
        </div>

        {/* Pilihan Shift: Cukup Shift 1 / Shift 2 */}
        <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-black">
          <button
            type="button"
            onClick={() => setShift('SHIFT_1')}
            className={`px-4 py-1.5 rounded-xl transition-all ${
              shift === 'SHIFT_1' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500'
            }`}
          >
            Shift 1
          </button>
          <button
            type="button"
            onClick={() => setShift('SHIFT_2')}
            className={`px-4 py-1.5 rounded-xl transition-all ${
              shift === 'SHIFT_2' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500'
            }`}
          >
            Shift 2
          </button>
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

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* 1. Pemasukan (Omset) */}
        <div>
          <span className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
            Pemasukan (Omset)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Uang Tunai (Cash)</label>
              <input
                type="number"
                min="0"
                value={cashNominal}
                onChange={(e) => setCashNominal(e.target.value)}
                placeholder="Rp 0"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">QRIS / Transfer</label>
              <input
                type="number"
                min="0"
                value={qrisNominal}
                onChange={(e) => setQrisNominal(e.target.value)}
                placeholder="Rp 0"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Grab / GoFood</label>
              <input
                type="number"
                min="0"
                value={onlineNominal}
                onChange={(e) => setOnlineNominal(e.target.value)}
                placeholder="Rp 0"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
          </div>
        </div>

        {/* 2. Pengeluaran (Bebas / Fleksibel) */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
          <span className="block text-[11px] font-black text-slate-500 uppercase tracking-wider">
            Pengeluaran di Shift Ini (Opsional)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="number"
              min="0"
              value={expenseNominal}
              onChange={(e) => setExpenseNominal(e.target.value)}
              placeholder="Nominal Pengeluaran (Rp 0 jika tidak ada)"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
            <input
              type="text"
              value={expenseNotes}
              onChange={(e) => setExpenseNotes(e.target.value)}
              placeholder="Keterangan pengeluaran (misal: Beli es batu / bumbu)"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>
        </div>

        {/* 3. Uang Fisik Disetor */}
        <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-100 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
              Uang Tunai Nyata yang Disetor
            </span>
            {cashDifference !== 0 && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                cashDifference < 0 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
              }`}>
                {cashDifference < 0 ? `Kurang Rp ${Math.abs(cashDifference).toLocaleString('id-ID')}` : `Lebih Rp ${cashDifference.toLocaleString('id-ID')}`}
              </span>
            )}
          </div>
          <input
            type="number"
            min="0"
            value={actualCashDeposited}
            onChange={(e) => setActualCashDeposited(e.target.value)}
            placeholder="Ketik total uang tunai yang disetor..."
            className="w-full px-3 py-2.5 bg-white border border-emerald-200 rounded-xl font-black text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {/* 4. Upload Bukti Foto (Auto-Compress) */}
        <div>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            capture="environment"
            onChange={handlePhotoSelect}
            className="hidden"
          />
          {proofPreview ? (
            <div className="relative w-32 h-24 rounded-xl overflow-hidden border border-slate-200">
              <img src={proofPreview} alt="Bukti" className="w-full h-full object-cover" />
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
              className="w-full py-3 border border-dashed border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100/60 flex items-center justify-center gap-2 text-slate-500 transition-colors"
            >
              <Camera className="w-4 h-4 text-slate-400" />
              <span className="font-bold">Foto Struk / Nota (Opsional)</span>
            </button>
          )}
        </div>

        {/* Catatan Kasir */}
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Catatan tambahan (opsional)"
          className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl font-semibold text-slate-800 focus:outline-none"
        />

        {/* Tombol Simpan */}
        <button
          type="submit"
          disabled={loading || totalOmset <= 0}
          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Receipt className="w-4 h-4" />
          <span>{loading ? 'Menyimpan...' : `Simpan Rekap ${shift === 'SHIFT_1' ? 'Shift 1' : 'Shift 2'} (Rp ${totalOmset.toLocaleString('id-ID')})`}</span>
        </button>
      </form>
    </div>
  );
}