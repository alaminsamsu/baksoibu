'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Building2, 
  Calendar, 
  Plus, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Store,
  DollarSign,
  Layers,
  ArrowRight
} from 'lucide-react';

interface ExpenseRecord {
  id: string;
  period_month: string;
  expense_date: string;
  expense_category: string;
  expense_name: string;
  amount: number;
  location_id: string | null;
  is_shared_to_all_branches: boolean;
  payment_method: string;
  notes?: string;
  created_by?: string;
  locations?: { name: string };
}

export default function HqExpensesForm() {
  const getCurrentMonthStr = () => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date()).substring(0, 7);
  };

  const getTodayWita = () => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());
  };

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());
  const [locations, setLocations] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [expenseType, setExpenseType] = useState<'HQ_SHARED' | 'STORE_DIRECT'>('HQ_SHARED');
  const [expenseCategory, setExpenseCategory] = useState<string>('HQ_SALARY');
  const [expenseName, setExpenseName] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [targetLocationId, setTargetLocationId] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(getTodayWita());
  const [notes, setNotes] = useState<string>('');

  const cleanLocationName = (name?: string) => {
    if (!name) return 'Kantor Pusat / Shared';
    return `Outlet ${name.replace(/^outlet\s+/i, '').trim()}`;
  };

  useEffect(() => {
    async function fetchLocations() {
      const { data } = await supabase.from('locations').select('id, name').order('name');
      if (data && data.length > 0) {
        setLocations(data);
        setTargetLocationId(String(data[0].id));
      }
    }
    fetchLocations();
  }, []);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hq_and_overhead_expenses')
        .select('*, locations(name)')
        .eq('period_month', selectedMonth)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (err: any) {
      console.error('Gagal mengambil data beban HQ:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [selectedMonth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseName.trim() || !amount || parseFloat(amount) <= 0) {
      alert('Isi nama beban dan nominal dengan benar.');
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const isShared = expenseType === 'HQ_SHARED';
      const locId = isShared ? null : targetLocationId;

      const payload = {
        period_month: selectedMonth,
        expense_date: expenseDate,
        expense_category: isShared ? expenseCategory : 'STORE_UTILITY',
        expense_name: expenseName.trim(),
        amount: parseFloat(amount),
        location_id: locId,
        is_shared_to_all_branches: isShared,
        payment_method: 'TRANSFER_BANK',
        notes: notes.trim() || null,
        created_by: 'Owner / Executive',
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('hq_and_overhead_expenses').insert([payload]);
      if (error) throw error;

      setMessage({ text: 'Beban berhasil dicatat ke sistem!', type: 'success' });
      setExpenseName('');
      setAmount('');
      setNotes('');
      await fetchExpenses();
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menyimpan beban.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus catatan beban ini?')) return;
    try {
      const { error } = await supabase.from('hq_and_overhead_expenses').delete().eq('id', id);
      if (error) throw error;
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch (err: any) {
      alert('Gagal menghapus: ' + err.message);
    }
  };

  // Kalkulasi Total
  const { totalHqShared, totalStoreDirect, activeBranchCount } = useMemo(() => {
    let shared = 0;
    let direct = 0;
    expenses.forEach(e => {
      if (e.is_shared_to_all_branches) {
        shared += Number(e.amount || 0);
      } else {
        direct += Number(e.amount || 0);
      }
    });

    return {
      totalHqShared: shared,
      totalStoreDirect: direct,
      activeBranchCount: Math.max(1, locations.length)
    };
  }, [expenses, locations]);

  const sharedPerBranch = Math.round(totalHqShared / activeBranchCount);

  return (
    <div className="space-y-6 font-sans">
      
      {/* Kartu Ringkasan Alokasi Biaya */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Total Beban Manajemen HQ (Bulan {selectedMonth})
          </span>
          <div className="text-xl font-black text-indigo-900 mt-1">
            Rp {totalHqShared.toLocaleString('id-ID')}
          </div>
          <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">
            Gaji HR, Admin Ops & Manajemen Pusat
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
            Alokasi Bagi Rata per Cabang
          </span>
          <div className="text-xl font-black text-emerald-700 mt-1">
            Rp {sharedPerBranch.toLocaleString('id-ID')}{' '}
            <span className="text-xs font-normal text-slate-400">/ cabang</span>
          </div>
          <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">
            Dibagi rata ke {activeBranchCount} cabang aktif
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">
            Utilitas Cabang (Transfer Bank Pusat)
          </span>
          <div className="text-xl font-black text-amber-700 mt-1">
            Rp {totalStoreDirect.toLocaleString('id-ID')}
          </div>
          <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">
            WiFi / Listrik non-laci kasir
          </span>
        </div>
      </div>

      {/* Form Input Beban */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Pencatatan Beban Pusat & Utilitas Non-Kasir
              </h2>
              <p className="text-xs font-medium text-slate-400">
                Input gaji manajemen kantor pusat atau tagihan cabang yang ditransfer via bank pusat.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="pl-8 pr-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
              />
            </div>
            <button
              onClick={fetchExpenses}
              className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-500"
              title="Segarkan"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 ${
            message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Pilihan Tipe Beban */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => { setExpenseType('HQ_SHARED'); setExpenseCategory('HQ_SALARY'); }}
              className={`p-4 rounded-2xl border text-left transition-all ${
                expenseType === 'HQ_SHARED'
                  ? 'bg-indigo-50/60 border-indigo-600 ring-2 ring-indigo-500/20'
                  : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/60'
              }`}
            >
              <div className="flex items-center gap-2 font-black text-xs text-indigo-950">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>1. Beban Kantor Pusat (Bagi Rata ke Cabang)</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 font-medium leading-relaxed">
                Gaji HR, Admin Ops, Finance, atau Alokasi Manajemen Owner. Beban ini otomatis dibagi rata ke seluruh outlet aktif.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setExpenseType('STORE_DIRECT')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                expenseType === 'STORE_DIRECT'
                  ? 'bg-amber-50/60 border-amber-500 ring-2 ring-amber-500/20'
                  : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/60'
              }`}
            >
              <div className="flex items-center gap-2 font-black text-xs text-amber-950">
                <Store className="w-4 h-4 text-amber-600" />
                <span>2. Tagihan Cabang via Bank Pusat (Non-Kasir)</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 font-medium leading-relaxed">
                WiFi cabang, token listrik besar via m-Banking, sewa ruko. Memotong langsung ke cabang yang dipilih tanpa memotong kasir.
              </p>
            </button>
          </div>

          {/* Baris Input Field */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">
                Nama Pengeluaran / Beban
              </label>
              <input
                type="text"
                required
                value={expenseName}
                onChange={(e) => setExpenseName(e.target.value)}
                placeholder={expenseType === 'HQ_SHARED' ? "Contoh: Gaji Admin Ops & HR" : "Contoh: WiFi Indihome Outlet BTP"}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">
                Nominal Beban (Rp)
              </label>
              <input
                type="number"
                step="5000"
                min="0"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-indigo-900 focus:outline-none focus:border-indigo-600"
              />
            </div>

            {expenseType === 'STORE_DIRECT' ? (
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">
                  Bebankan ke Cabang
                </label>
                <select
                  value={targetLocationId}
                  onChange={(e) => setTargetLocationId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {cleanLocationName(loc.name)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">
                  Alokasi Cabang
                </label>
                <div className="w-full px-3 py-2 bg-indigo-50/60 border border-indigo-200 rounded-xl text-xs font-black text-indigo-800">
                  Dibagi Rata Seluruh Cabang ({activeBranchCount} Cabang)
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">
                Tanggal Transfer / Bayar
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">
                Catatan Tambahan (Opsional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Keterangan transfer bank, nomor referensi, dll..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            <span>{submitting ? 'Menyimpan...' : 'Simpan Pengeluaran Pusat'}</span>
          </button>
        </form>

        {/* Tabel Riwayat Pengeluaran HQ */}
        <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs pt-2">
          <div className="overflow-x-auto max-h-[26rem] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/90 sticky top-0 border-b border-slate-100 z-10 backdrop-blur-xs">
                <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">Nama Beban & Catatan</th>
                  <th className="py-2.5 px-3">Jenis Alokasi</th>
                  <th className="py-2.5 px-3 text-right">Nominal (Rp)</th>
                  <th className="py-2.5 px-2 text-center w-10">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-bold">
                      Memuat daftar beban pusat...
                    </td>
                  </tr>
                ) : expenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-bold">
                      Belum ada beban pusat tercatat pada bulan {selectedMonth}.
                    </td>
                  </tr>
                ) : (
                  expenses.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 text-slate-600 font-bold text-[11px]">
                        {new Date(row.expense_date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-extrabold text-slate-900 uppercase">{row.expense_name}</div>
                        {row.notes && <div className="text-[10px] text-slate-400 font-normal">{row.notes}</div>}
                      </td>
                      <td className="py-2.5 px-3">
                        {row.is_shared_to_all_branches ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Bagi Rata HQ
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                            {cleanLocationName(row.locations?.name)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-indigo-900 text-sm">
                        Rp {Number(row.amount || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          className="p-1 text-slate-300 hover:text-rose-600 transition-colors"
                          title="Hapus Catatan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}