'use client';

import React, { useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Banknote, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Camera, 
  Upload, 
  Trash2, 
  QrCode, 
  Smartphone, 
  DollarSign,
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

  const [cashNominal, setCashNominal] = useState('');
  const [qrisNominal, setQrisNominal] = useState('');
  const [onlineNominal, setOnlineNominal] = useState('');
  const [actualCashDeposited, setActualCashDeposited] = useState('');
  const [notes, setNotes] = useState('');

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Total Omset Otomatis
  const totalOmset = useMemo(() => {
    const c = parseFloat(cashNominal) || 0;
    const q = parseFloat(qrisNominal) || 0;
    const o = parseFloat(onlineNominal) || 0;
    return c + q + o;
  }, [cashNominal, qrisNominal, onlineNominal]);

  // Selisih Kas Tunai
  const cashDifference = useMemo(() => {
    const expected = parseFloat(cashNominal) || 0;
    const actual = parseFloat(actualCashDeposited) || 0;
    if (!cashNominal && !actualCashDeposited) return 0;
    return actual - expected;
  }, [cashNominal, actualCashDeposited]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofFile(file);
      setProofPreview(URL.createObjectURL(file));
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
        throw new Error('Total omset harian tidak boleh 0.');
      }

      const today = new Date().toISOString().split('T')[0];
      let uploadedUrl = null;

      // Upload Bukti Struk / QRIS jika ada
      if (proofFile) {
        const fileExt = proofFile.name.split('.').pop();
        const filePath = `settlement_${activeLocationId}_${today}_${Date.now()}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage.from('receipts').upload(filePath, proofFile);
        if (!uploadErr) {
          const { data } = supabase.storage.from('receipts').getPublicUrl(filePath);
          uploadedUrl = data?.publicUrl;
        }
      }

      // Upsert ke tabel cash_settlements
      const { error } = await supabase.from('cash_settlements').upsert({
        location_id: activeLocationId,
        settlement_date: today,
        cash_nominal: parseFloat(cashNominal) || 0,
        qris_nominal: parseFloat(qrisNominal) || 0,
        online_nominal: parseFloat(onlineNominal) || 0,
        actual_cash_deposited: parseFloat(actualCashDeposited) || 0,
        cash_difference: cashDifference,
        proof_photo_url: uploadedUrl,
        notes: notes.trim() || null,
        reported_by: activeStaffName,
      }, { onConflict: 'location_id, settlement_date' });

      if (error) throw error;

      setMessage({
        text: `Sukses menyimpan Rekap Omset Rp ${totalOmset.toLocaleString('id-ID')} untuk hari ini!`,
        type: 'success',
      });

      setCashNominal('');
      setQrisNominal('');
      setOnlineNominal('');
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
            <Banknote className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Rekap Omset & Tutup Kas Kasir</h2>
            <p className="text-xs font-medium text-slate-400">Pencatatan uang tunai fisik, transaksi QRIS & online.</p>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200/60 px-4 py-2 rounded-2xl text-right">
          <span className="text-[10px] font-bold text-emerald-600 uppercase">Estimasi Total Omset</span>
          <p className="text-lg font-black text-emerald-800">Rp {totalOmset.toLocaleString('id-ID')}</p>
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Rincian Pemasukan per Jalur */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 mb-2 text-slate-700">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <label className="text-xs font-black uppercase tracking-wider">1. Tunai / Cash</label>
            </div>
            <input
              type="number"
              min="0"
              value={cashNominal}
              onChange={(e) => setCashNominal(e.target.value)}
              placeholder="Rp 0"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">Total uang cash laci kasir</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 mb-2 text-slate-700">
              <QrCode className="w-4 h-4 text-indigo-600" />
              <label className="text-xs font-black uppercase tracking-wider">2. QRIS / Transfer</label>
            </div>
            <input
              type="number"
              min="0"
              value={qrisNominal}
              onChange={(e) => setQrisNominal(e.target.value)}
              placeholder="Rp 0"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">Sesuai total settlement QRIS</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 mb-2 text-slate-700">
              <Smartphone className="w-4 h-4 text-[#ff6f3c]" />
              <label className="text-xs font-black uppercase tracking-wider">3. Grab / GoFood</label>
            </div>
            <input
              type="number"
              min="0"
              value={onlineNominal}
              onChange={(e) => setOnlineNominal(e.target.value)}
              placeholder="Rp 0"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
            <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">Orderan merchant aplikasi</span>
          </div>
        </div>

        {/* Verifikasi Uang Fisik Disetor */}
        <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-slate-800">
                Uang Tunai Fisik yang Disetor / Diserahkan ke Owner/Leader
              </label>
              <p className="text-[11px] text-slate-400">Ketik jumlah uang fisik nyata yang dihitung di amplop/setoran.</p>
            </div>
            {cashDifference !== 0 && (
              <span className={`text-[11px] font-black px-3 py-1 rounded-full ${
                cashDifference < 0 
                  ? 'bg-red-50 text-red-600 border border-red-200' 
                  : 'bg-blue-50 text-blue-600 border border-blue-200'
              }`}>
                {cashDifference < 0 ? `Selisih Kurang: Rp ${Math.abs(cashDifference).toLocaleString('id-ID')}` : `Kelebihan: Rp ${cashDifference.toLocaleString('id-ID')}`}
              </span>
            )}
          </div>

          <input
            type="number"
            min="0"
            value={actualCashDeposited}
            onChange={(e) => setActualCashDeposited(e.target.value)}
            placeholder="Ketik nominal fisik uang setoran..."
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {/* Upload Bukti Settlement / Transfer */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-slate-600" />
              <label className="text-xs font-black uppercase tracking-wider text-slate-800">
                Foto Struk Settlement QRIS / Bukti Setor Bank (Opsional)
              </label>
            </div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            capture="environment"
            onChange={handlePhotoSelect}
            className="hidden"
          />

          {proofPreview ? (
            <div className="relative w-full max-w-xs rounded-2xl overflow-hidden border border-slate-200">
              <img src={proofPreview} alt="Bukti Setor" className="w-full h-40 object-cover" />
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-xl shadow-md hover:bg-red-700"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-6 border-2 border-dashed border-slate-200 rounded-2xl bg-white hover:bg-slate-100/50 flex flex-col items-center justify-center gap-2 text-slate-500 transition-all"
            >
              <Upload className="w-5 h-5 text-slate-400" />
              <span className="text-xs font-bold">Ambil / Unggah Foto Bukti Struk Settlement</span>
            </button>
          )}
        </div>

        {/* Catatan Kasir */}
        <div>
          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
            Catatan Kasir
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Contoh: Uang modal kasir Rp 200.000 sudah disisihkan, uang setoran bersih Rp ..."
            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <button
          type="submit"
          disabled={loading || totalOmset <= 0}
          className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black rounded-2xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Receipt className="w-4 h-4" />
          <span>{loading ? 'Menyimpan Rekap Omset...' : 'Simpan Rekap Omset & Tutup Kas'}</span>
        </button>
      </form>
    </div>
  );
}