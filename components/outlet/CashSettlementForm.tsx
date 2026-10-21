'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Banknote, 
  QrCode, 
  ShoppingBag, 
  Wallet, 
  Save, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Calendar,
  Building2,
  Plus,
  Trash2
} from 'lucide-react';

interface Props {
  user?: any;
  onBack?: () => void;
  locationId?: string;
  staffName?: string;
}

interface NonCashItem {
  id: string;
  category: string;
  nominal: number | string;
  notes: string;
}

export default function CashSettlementForm({ user, onBack, locationId: propLocId, staffName: propStaff }: Props) {
  const effectiveLocationId = propLocId || user?.location_id || user?.id || '';
  const effectiveStaffName = propStaff || user?.active_staff_name || user?.username || 'Kasir Outlet';

  const getTodayWita = () => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());
  };

  const [settlementDate, setSettlementDate] = useState<string>(getTodayWita());
  const [shift, setShift] = useState<'SHIFT_1' | 'SHIFT_2'>('SHIFT_1');

  // Input Fields Omset
  const [openingCash, setOpeningCash] = useState<number | string>(0);
  const [totalBills, setTotalBills] = useState<number | string>('');
  const [cashNominal, setCashNominal] = useState<number | string>('');
  const [qrisNominal, setQrisNominal] = useState<number | string>('');
  const [grabNominal, setGrabNominal] = useState<number | string>('');
  const [gofoodNominal, setGofoodNominal] = useState<number | string>('');
  const [shopeeNominal, setShopeeNominal] = useState<number | string>('');
  
  // 1. Pengeluaran Kasir (Memotong Uang Laci)
  const [expenseNominal, setExpenseNominal] = useState<number | string>('');
  const [expenseNotes, setExpenseNotes] = useState<string>('');

  // 2. Daftar Pengeluaran Non-Kasir Dinamis (Bisa Tambah Banyak Beban)
  const [nonCashList, setNonCashList] = useState<NonCashItem[]>([
    { id: '1', category: 'RUMAH_PRODUKSI', nominal: '', notes: '' }
  ]);

  // Uang Laci Fisik
  const [actualCashDeposited, setActualCashDeposited] = useState<number | string>('');
  const [notes, setNotes] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Kalkulasi Angka
  const numOpeningCash = Number(openingCash) || 0;
  const numCash = Number(cashNominal) || 0;
  const numQris = Number(qrisNominal) || 0;
  const numGrab = Number(grabNominal) || 0;
  const numGofood = Number(gofoodNominal) || 0;
  const numShopee = Number(shopeeNominal) || 0;
  const numExpense = Number(expenseNominal) || 0;

  // Akumulasi Total Beban Non-Kasir
  const totalNonCashExpense = nonCashList.reduce((sum, item) => sum + (Number(item.nominal) || 0), 0);
  
  const numActualCash = Number(actualCashDeposited) || 0;

  const totalOmset = numCash + numQris + numGrab + numGofood + numShopee;
  // Uang di laci HANYA dipotong oleh pengeluaran kasir tunai (numExpense)
  const expectedCashInDrawer = numOpeningCash + numCash - numExpense;
  const cashDifference = actualCashDeposited === '' ? 0 : numActualCash - expectedCashInDrawer;

  useEffect(() => {
    loadExistingSettlement();
  }, [settlementDate, shift, effectiveLocationId]);

  const loadExistingSettlement = async () => {
    if (!effectiveLocationId) return;
    setLoading(true);
    setMsg(null);
    try {
      const { data, error } = await supabase
        .from('cash_settlements')
        .select('*')
        .eq('location_id', effectiveLocationId)
        .eq('settlement_date', settlementDate)
        .eq('shift', shift)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setOpeningCash(data.opening_cash ?? 0);
        setTotalBills(data.total_bills ?? '');
        setCashNominal(data.cash_nominal ?? '');
        setQrisNominal(data.qris_nominal ?? '');
        setGrabNominal(data.grab_nominal ?? '');
        setGofoodNominal(data.gofood_nominal ?? '');
        setShopeeNominal(data.shopee_nominal ?? '');
        setExpenseNominal(data.expense_nominal ?? '');
        setExpenseNotes(data.expense_notes ?? '');

        // Parse jika tersimpan list JSON
        if (data.non_cash_expense_notes && data.non_cash_expense_notes.startsWith('[')) {
          try {
            const parsed = JSON.parse(data.non_cash_expense_notes);
            setNonCashList(parsed);
          } catch {
            setNonCashList([{
              id: '1',
              category: data.non_cash_expense_category || 'RUMAH_PRODUKSI',
              nominal: data.non_cash_expense_nominal || '',
              notes: data.non_cash_expense_notes || ''
            }]);
          }
        } else if (data.non_cash_expense_nominal > 0) {
          setNonCashList([{
            id: '1',
            category: data.non_cash_expense_category || 'RUMAH_PRODUKSI',
            nominal: data.non_cash_expense_nominal,
            notes: data.non_cash_expense_notes || ''
          }]);
        } else {
          setNonCashList([{ id: '1', category: 'RUMAH_PRODUKSI', nominal: '', notes: '' }]);
        }

        setActualCashDeposited(data.actual_cash_deposited ?? '');
        setNotes(data.notes ?? '');
      } else {
        setOpeningCash(0);
        setTotalBills('');
        setCashNominal('');
        setQrisNominal('');
        setGrabNominal('');
        setGofoodNominal('');
        setShopeeNominal('');
        setExpenseNominal('');
        setExpenseNotes('');
        setNonCashList([{ id: '1', category: 'RUMAH_PRODUKSI', nominal: '', notes: '' }]);
        setActualCashDeposited('');
        setNotes('');
      }
    } catch (err: any) {
      console.error('Error load settlement:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handler Tambah Baris Pengeluaran Non-Kasir
  const handleAddNonCashRow = () => {
    setNonCashList((prev) => [
      ...prev,
      { id: Date.now().toString(), category: 'RUMAH_PRODUKSI', nominal: '', notes: '' }
    ]);
  };

  // Handler Hapus Baris
  const handleRemoveNonCashRow = (id: string) => {
    if (nonCashList.length === 1) {
      setNonCashList([{ id: Date.now().toString(), category: 'RUMAH_PRODUKSI', nominal: '', notes: '' }]);
      return;
    }
    setNonCashList((prev) => prev.filter((item) => item.id !== id));
  };

  // Handler Perubahan Data Tiap Baris
  const handleUpdateNonCashRow = (id: string, field: keyof NonCashItem, value: any) => {
    setNonCashList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveLocationId) {
      setMsg({ text: 'Cabang / Lokasi tidak terdeteksi.', type: 'error' });
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      // Filter hanya baris yang ada nominalnya
      const validNonCashItems = nonCashList.filter((item) => Number(item.nominal) > 0);
      const totalNonCash = validNonCashItems.reduce((acc, curr) => acc + Number(curr.nominal || 0), 0);

      const payload: Record<string, any> = {
        location_id: effectiveLocationId,
        settlement_date: settlementDate,
        shift: shift,
        opening_cash: numOpeningCash,
        total_bills: Number(totalBills) || 0,
        cash_nominal: numCash,
        qris_nominal: numQris,
        grab_nominal: numGrab,
        gofood_nominal: numGofood,
        shopee_nominal: numShopee,
        online_nominal: numGrab + numGofood + numShopee,
        expense_nominal: numExpense,
        expense_notes: expenseNotes.trim() || null,
        non_cash_expense_nominal: totalNonCash,
        non_cash_expense_category: validNonCashItems.length > 0 ? validNonCashItems.map(i => i.category).join(', ') : null,
        non_cash_expense_notes: validNonCashItems.length > 0 ? JSON.stringify(validNonCashItems) : null,
        actual_cash_deposited: numActualCash,
        cash_difference: cashDifference,
        notes: notes.trim() || null,
        reported_by: effectiveStaffName,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('cash_settlements')
        .upsert(payload, { onConflict: 'location_id,settlement_date,shift' });

      if (error) throw error;

      setMsg({
        text: `Laporan setoran ${shift === 'SHIFT_1' ? 'Shift 1' : 'Shift 2'} berhasil disimpan oleh ${effectiveStaffName}!`,
        type: 'success'
      });
    } catch (err: any) {
      setMsg({ text: `Gagal simpan: ${err.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-xs space-y-5 max-w-2xl mx-auto font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
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
          <Banknote className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
              Rekap Omset & Kas Kasir
            </h3>
            <p className="text-[10px] text-slate-400">
              Input rincian omset shift, pengeluaran kasir & beban non-kasir.
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Petugas</span>
          <span className="text-xs font-black text-slate-800">{effectiveStaffName}</span>
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

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tanggal & Pilihan Shift */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Tanggal Operasional
            </label>
            <input
              type="date"
              value={settlementDate}
              onChange={(e) => setSettlementDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> Pilihan Shift
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setShift('SHIFT_1')}
                className={`py-1.5 text-xs font-black rounded-lg transition-all ${
                  shift === 'SHIFT_1' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Shift 1 (Siang)
              </button>
              <button
                type="button"
                onClick={() => setShift('SHIFT_2')}
                className={`py-1.5 text-xs font-black rounded-lg transition-all ${
                  shift === 'SHIFT_2' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Shift 2 (Malam)
              </button>
            </div>
          </div>
        </div>

        {/* Modal Kas & Total Bill */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Modal Awal Laci Kasir (Rp)
            </label>
            <input
              type="number"
              min="0"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Total Transaksi / Bill (Struk)
            </label>
            <input
              type="number"
              min="0"
              value={totalBills}
              onChange={(e) => setTotalBills(e.target.value)}
              placeholder="Contoh: 85"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
            />
          </div>
        </div>

        {/* Rincian Omset Penjualan */}
        <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 space-y-3">
          <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
            Rincian Omset Penjualan Shift
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-emerald-600" /> Penjualan Tunai / Cash (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={cashNominal}
                onChange={(e) => setCashNominal(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-indigo-600" /> QRIS / Transfer (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={qrisNominal}
                onChange={(e) => setQrisNominal(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" /> GrabFood (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={grabNominal}
                onChange={(e) => setGrabNominal(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-red-600" /> GoFood (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={gofoodNominal}
                onChange={(e) => setGofoodNominal(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-orange-600" /> ShopeeFood (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={shopeeNominal}
                onChange={(e) => setShopeeNominal(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-200/60">
            <span className="text-xs font-bold text-slate-500">Total Omset Shift:</span>
            <span className="text-base font-black text-emerald-600">
              Rp {totalOmset.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* 1. PENGELUARAN KASIR (MEMOTONG FISIK LACI KASIR) */}
        <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-rose-500 block tracking-wider flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> 1. Pengeluaran Kasir (Uang Laci)
            </span>
            <span className="text-[9px] font-bold text-rose-400 bg-rose-100/60 px-2 py-0.5 rounded-md">
              Memotong Fisik Kasir
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-rose-800 mb-1">
                Nominal Keluar (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={expenseNominal}
                onChange={(e) => setExpenseNominal(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-white border border-rose-200 rounded-xl text-xs font-black text-rose-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-rose-800 mb-1">
                Catatan Pengeluaran / Keperluan
              </label>
              <input
                type="text"
                value={expenseNotes}
                onChange={(e) => setExpenseNotes(e.target.value)}
                placeholder="Misal: Gas 3 kg : 3 buah, es batu kristal"
                className="w-full px-3 py-2 bg-white border border-rose-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 2. PENGELUARAN NON-KASIR MULTI-BARIS (TIDAK MEMOTONG UANG LACI) */}
        <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-indigo-700 block tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> 2. Pengeluaran Rumah Produksi & Vendor
              </span>
              <span className="text-[9px] font-bold text-indigo-600 bg-indigo-100/60 px-2 py-0.5 rounded-md">
                TIDAK Memotong Laci
              </span>
            </div>

            <button
              type="button"
              onClick={handleAddNonCashRow}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-2xs transition-all"
            >
              <Plus className="w-3 h-3" />
              <span>Tambah Beban</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {nonCashList.map((item, index) => (
              <div key={item.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white p-2.5 rounded-xl border border-indigo-100 items-center">
                {/* Kategori (Span 4) */}
                <div className="sm:col-span-4">
                  <select
                    value={item.category}
                    onChange={(e) => handleUpdateNonCashRow(item.id, 'category', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-indigo-900 focus:outline-none"
                  >
                    <option value="RUMAH_PRODUKSI">Rumah Produksi</option>
                    <option value="VENDOR_PASAR">Vendor Pasar</option>
                    <option value="VENDOR_HAMDALAH">Vendor Hamdalah</option>
                    <option value="KARYA_HARAPAN">Karya Harapan</option>
                    <option value="SATU_SAMA">Satu Sama</option>
                    <option value="SUMBER_PLASTIK">Sumber Plastik</option>
                    <option value="VENDOR_GAS">Vendor Gas</option>
                    <option value="VENDOR_ES">Vendor Es Batu</option>
                    <option value="VENDOR_SUPPLIER">Vendor Supplier Lainnya</option>
                    <option value="LAINNYA">Tagihan Lainnya</option>
                  </select>
                </div>

                {/* Nominal (Span 3) */}
                <div className="sm:col-span-3">
                  <input
                    type="number"
                    min="0"
                    value={item.nominal}
                    onChange={(e) => handleUpdateNonCashRow(item.id, 'nominal', e.target.value)}
                    placeholder="Rp Nominal"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-indigo-700 focus:outline-none"
                  />
                </div>

                {/* Catatan (Span 4) */}
                <div className="sm:col-span-4">
                  <input
                    type="text"
                    value={item.notes}
                    onChange={(e) => handleUpdateNonCashRow(item.id, 'notes', e.target.value)}
                    placeholder="Keperluan / Catatan"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
                  />
                </div>

                {/* Tombol Hapus Baris (Span 1) */}
                <div className="sm:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleRemoveNonCashRow(item.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Hapus baris ini"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalNonCashExpense > 0 && (
            <div className="flex justify-between items-center pt-2 border-t border-indigo-100 text-xs">
              <span className="font-bold text-indigo-900">Total Beban Non-Kasir:</span>
              <span className="font-black text-indigo-700">Rp {totalNonCashExpense.toLocaleString('id-ID')}</span>
            </div>
          )}
        </div>

        {/* UANG FISIK LACI & CEK SELISIH */}
        <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">
                Uang Seharusnya di Laci (Modal + Tunai - Pengeluaran Kasir)
              </span>
              <span className="text-lg font-black text-white">
                Rp {expectedCashInDrawer.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              Uang Fisik Nyata Dihitung di Laci (Rp)
            </label>
            <input
              type="number"
              min="0"
              value={actualCashDeposited}
              onChange={(e) => setActualCashDeposited(e.target.value)}
              placeholder="Hitung lembaran fisik di laci..."
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-black text-emerald-400 focus:outline-none"
              required
            />
          </div>

          {actualCashDeposited !== '' && (
            <div className={`p-3 rounded-xl border text-xs flex justify-between items-center ${
              cashDifference === 0 
                ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300' 
                : cashDifference < 0 
                ? 'bg-rose-950/40 border-rose-800/80 text-rose-300' 
                : 'bg-amber-950/40 border-amber-800/80 text-amber-300'
            }`}>
              <span className="font-bold">
                {cashDifference === 0 ? 'Status Kasir: Klop (Pas)' : cashDifference < 0 ? 'Status Kasir: Minus' : 'Status Kasir: Lebih'}
              </span>
              <span className="font-black text-sm">
                {cashDifference === 0 ? 'Rp 0' : `${cashDifference < 0 ? '-' : '+'}Rp ${Math.abs(cashDifference).toLocaleString('id-ID')}`}
              </span>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={saving || loading}
          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Menyimpan Rekap...' : `Simpan Rekap Kasir (${shift === 'SHIFT_1' ? 'Shift 1' : 'Shift 2'})`}</span>
        </button>
      </form>
    </div>
  );
}