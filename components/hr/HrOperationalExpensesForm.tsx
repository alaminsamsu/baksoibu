'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Megaphone, 
  Calendar, 
  Plus, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  DollarSign
} from 'lucide-react';

interface HrExpenseItem {
  id: string;
  expense_date: string;
  period_month: string;
  expense_category: string;
  expense_name: string;
  amount: number;
  notes?: string;
  created_by?: string;
}

export default function HrOperationalExpensesForm() {
  const getCurrentMonthStr = () => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date()).substring(0, 7);
  };

  const getTodayWita = () => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());
  };

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());
  const [expenseDate, setExpenseDate] = useState<string>(getTodayWita());
  const [expenseName, setExpenseName] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('IKLAN_LOKER');
  const [notes, setNotes] = useState<string>('');
  
  const [expenses, setExpenses] = useState<HrExpenseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchHrExpenses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hq_and_overhead_expenses')
        .select('*')
        .eq('period_month', selectedMonth)
        .in('expense_category', ['IKLAN_LOKER', 'REKRUTMEN', 'SERAGAM_KRU', 'OPERASIONAL_HR'])
        .order('expense_date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (err: any) {
      console.error('Gagal mengambil pengeluaran HR:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHrExpenses();
  }, [selectedMonth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseName.trim() || !amount || parseFloat(amount) <= 0) {
      alert('Nama pengeluaran dan nominal wajib diisi!');
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const savedUserStr = localStorage.getItem('baksoibu_active_staff');
      let creator = 'Petugas HR';
      if (savedUserStr) {
        try {
          const parsed = JSON.parse(savedUserStr);
          creator = parsed.active_staff_name || parsed.username || 'Petugas HR';
        } catch (e) {
          console.error(e);
        }
      }

      const payload = {
        period_month: selectedMonth,
        expense_date: expenseDate,
        expense_category: category,
        expense_name: `[HR] ${expenseName.trim()}`,
        amount: parseFloat(amount),
        location_id: null, // NULL agar otomatis dibagi rata ke seluruh cabang di laporan PnL
        is_shared_to_all_branches: true,
        payment_method: 'TRANSFER_BANK',
        notes: notes.trim() || null,
        created_by: creator,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('hq_and_overhead_expenses').insert([payload]);
      if (error) throw error;

      setMessage({ text: 'Biaya operasional HR berhasil dicatat!', type: 'success' });
      setExpenseName('');
      setAmount('');
      setNotes('');
      await fetchHrExpenses();
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menyimpan.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus catatan biaya ini?')) return;
    try {
      const { error } = await supabase.from('hq_and_overhead_expenses').delete().eq('id', id);
      if (error) throw error;
      setExpenses((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      alert('Gagal menghapus: ' + err.message);
    }
  };

  const totalExpense = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-xs space-y-6 font-sans">
      
      {/* Header Form */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              Biaya Operasional HR & Iklan Loker
            </h2>
            <p className="text-xs font-medium text-slate-400">
              Input pengeluaran iklan loker IG/Jobstreet, cetak banner, materai, dan administrasi HR.
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
            onClick={fetchHrExpenses}
            className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-500"
            title="Segarkan"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Ringkasan */}
      <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex justify-between items-center">
        <div>
          <span className="text-[10px] uppercase font-black tracking-wider text-indigo-500 block">
            Total Biaya Operasional HR ({selectedMonth})
          </span>
          <div className="text-xl font-black text-indigo-950 mt-0.5">
            Rp {totalExpense.toLocaleString('id-ID')}
          </div>
        </div>
        <div className="text-[11px] font-bold text-slate-500">
          {expenses.length} Transaksi Tercatat
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 ${
          message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Form Input */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">
              Kategori Pengeluaran
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
            >
              <option value="IKLAN_LOKER">Iklan Lowongan Kerja (IG Ads / Info Loker)</option>
              <option value="REKRUTMEN">Biaya Rekrutmen / Psikotes / Wawancara</option>
              <option value="SERAGAM_KRU">Pengadaan Seragam & Apron Kru</option>
              <option value="OPERASIONAL_HR">Operasional HR (Materai, Cetak Berkas)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">
              Keterangan / Nama Beban
            </label>
            <input
              type="text"
              required
              value={expenseName}
              onChange={(e) => setExpenseName(e.target.value)}
              placeholder="Contoh: Pasang Loker IG @loker_makassar"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">
              Nominal Pengeluaran (Rp)
            </label>
            <input
              type="number"
              step="any"
              min="0"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-indigo-900 focus:outline-none focus:border-indigo-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">
              Tanggal Pembayaran
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
              Catatan / Bukti Transfer (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Link struk / detail durasi tayang iklan..."
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
          <span>{submitting ? 'Menyimpan...' : 'Simpan Pengeluaran HR'}</span>
        </button>
      </form>

      {/* Tabel Riwayat */}
      <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs pt-2">
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 sticky top-0 border-b border-slate-100 z-10 backdrop-blur-xs">
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-3">Kategori</th>
                <th className="py-2.5 px-3">Keterangan & Catatan</th>
                <th className="py-2.5 px-3">Dicatat Oleh</th>
                <th className="py-2.5 px-3 text-right">Nominal (Rp)</th>
                <th className="py-2.5 px-2 text-center w-10">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                    Memuat daftar pengeluaran HR...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                    Belum ada pengeluaran operasional HR pada bulan {selectedMonth}.
                  </td>
                </tr>
              ) : (
                expenses.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-3 text-slate-600 font-bold text-[11px]">
                      {new Date(row.expense_date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {row.expense_category.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-extrabold text-slate-900">{row.expense_name}</div>
                      {row.notes && <div className="text-[10px] text-slate-400 font-normal">{row.notes}</div>}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {row.created_by || 'HR'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-rose-600 text-sm">
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
  );
}