'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  DollarSign, 
  Calendar, 
  RefreshCw, 
  Banknote, 
  QrCode, 
  ShoppingBag, 
  Receipt, 
  AlertCircle, 
  CheckCircle2, 
  TrendingUp, 
  UserCheck 
} from 'lucide-react';

interface Props {
  user?: any;
  locationId?: string;
}

interface Settlement {
  id: string;
  settlement_date: string;
  shift: string;
  opening_cash: number;
  cash_nominal: number;
  qris_nominal: number;
  grab_nominal: number;
  gofood_nominal: number;
  shopee_nominal: number;
  expense_nominal: number;
  expense_notes: string | null;
  total_omset: number;
  total_bills: number;
  actual_cash_deposited: number;
  cash_difference: number;
  reported_by: string;
  created_at: string;
}

export default function LeaderSettlementMonitor({ user, locationId: propLocId }: Props) {
  const effectiveLocationId = propLocId || user?.location_id || user?.id || '';
  
  // Default tanggal hari ini (Timezone Makassar/WITA)
  const todayWita = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayWita);
  
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSettlementData = async () => {
    if (!effectiveLocationId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cash_settlements')
        .select('*')
        .eq('location_id', effectiveLocationId)
        .eq('settlement_date', selectedDate)
        .order('shift', { ascending: true });

      if (error) throw error;
      setSettlements(data || []);
    } catch (err: any) {
      console.error('Gagal memuat rekap setoran omset:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettlementData();
  }, [effectiveLocationId, selectedDate]);

  // Kalkulasi Akumulasi Gabungan Semua Shift pada Tanggal Tersebut
  const dailyTotal = useMemo(() => {
    return settlements.reduce(
      (acc, s) => ({
        omset: acc.omset + Number(s.total_omset || 0),
        bills: acc.bills + Number(s.total_bills || 0),
        cash: acc.cash + Number(s.cash_nominal || 0),
        qris: acc.qris + Number(s.qris_nominal || 0),
        online: acc.online + Number(s.grab_nominal || 0) + Number(s.gofood_nominal || 0) + Number(s.shopee_nominal || 0),
        expense: acc.expense + Number(s.expense_nominal || 0),
        diff: acc.diff + Number(s.cash_difference || 0),
      }),
      { omset: 0, bills: 0, cash: 0, qris: 0, online: 0, expense: 0, diff: 0 }
    );
  }, [settlements]);

  return (
    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-xs space-y-6 max-w-4xl mx-auto font-sans">
      {/* Header & Filter Tanggal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-xs">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              Rekap Omset Kasir & Shift Cabang
            </h2>
            <p className="text-xs font-medium text-slate-400">
              Pantau laporan setoran kasir per shift dan selisih kas fisik laci.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
            />
          </div>

          <button
            onClick={fetchSettlementData}
            title="Segarkan Data"
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Ringkasan Akumulasi Harian */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Omset Harian</span>
          <span className="text-base sm:text-lg font-black text-emerald-600 mt-1 block">
            Rp {dailyTotal.omset.toLocaleString('id-ID')}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">{dailyTotal.bills} Total Transaksi</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Tunai (Cash)</span>
          <span className="text-base sm:text-lg font-black text-slate-800 mt-1 block">
            Rp {dailyTotal.cash.toLocaleString('id-ID')}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">Uang masuk kasir</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Non-Tunai</span>
          <span className="text-base sm:text-lg font-black text-indigo-600 mt-1 block">
            Rp {(dailyTotal.qris + dailyTotal.online).toLocaleString('id-ID')}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">QRIS + Online Ojol</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Selisih Kas Laci</span>
          <span className={`text-base sm:text-lg font-black mt-1 block ${dailyTotal.diff < 0 ? 'text-red-600' : 'text-slate-800'}`}>
            {dailyTotal.diff < 0 ? `-Rp ${Math.abs(dailyTotal.diff).toLocaleString('id-ID')}` : `Rp ${dailyTotal.diff.toLocaleString('id-ID')}`}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            {dailyTotal.diff === 0 ? 'Klop Sesuai' : dailyTotal.diff < 0 ? 'Uang Kurang' : 'Uang Lebih'}
          </span>
        </div>
      </div>

      {/* Rincian Kartu per Shift */}
      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
          Rincian Pembagian Shift ({settlements.length} Shift Terinput)
        </h3>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 font-bold">
            Memuat data setoran shift...
          </div>
        ) : settlements.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-1">
            <p className="text-xs font-bold text-slate-600">Belum ada laporan closing kasir pada tanggal ini.</p>
            <p className="text-[11px] text-slate-400">Kasir belum mengisi lembar setoran closing.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settlements.map((s) => {
              const shiftLabel = s.shift === 'SHIFT_1' ? 'Shift 1 (Siang)' : s.shift === 'SHIFT_2' ? 'Shift 2 (Malam)' : s.shift;
              const hasDiff = Number(s.cash_difference || 0) !== 0;

              return (
                <div key={s.id} className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
                  {/* Header Shift Card */}
                  <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100 mb-1">
                        {shiftLabel}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        Kasir: <span className="font-bold text-slate-800">{s.reported_by || 'Petugas'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold block">Omset Shift</span>
                      <span className="text-base font-black text-emerald-600">
                        Rp {Number(s.total_omset || 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  {/* Detail Komposisi Pembayaran */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <Banknote className="w-3.5 h-3.5 text-emerald-600" /> Tunai (Cash):
                      </span>
                      <span className="font-bold text-slate-800">Rp {Number(s.cash_nominal || 0).toLocaleString('id-ID')}</span>
                    </div>

                    <div className="flex justify-between text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 text-indigo-600" /> QRIS / Transfer:
                      </span>
                      <span className="font-bold text-slate-800">Rp {Number(s.qris_nominal || 0).toLocaleString('id-ID')}</span>
                    </div>

                    <div className="flex justify-between text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5 text-orange-600" /> Online (Grab/Go/Shopee):
                      </span>
                      <span className="font-bold text-slate-800">
                        Rp {(Number(s.grab_nominal || 0) + Number(s.gofood_nominal || 0) + Number(s.shopee_nominal || 0)).toLocaleString('id-ID')}
                      </span>
                    </div>

                    {Number(s.expense_nominal || 0) > 0 && (
                      <div className="flex justify-between text-rose-600 pt-1 border-t border-slate-100">
                        <span>Pengeluaran Kas Kecil:</span>
                        <span className="font-bold">-Rp {Number(s.expense_nominal).toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    {s.expense_notes && (
                      <p className="text-[10px] text-slate-400 italic">Keperluan: "{s.expense_notes}"</p>
                    )}
                  </div>

                  {/* Status Uang Laci Fisik & Selisih */}
                  <div className={`p-3 rounded-xl border text-xs flex justify-between items-center ${
                    hasDiff
                      ? Number(s.cash_difference) < 0
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}>
                    <div>
                      <span className="font-bold block">Uang Fisik di Laci:</span>
                      <span className="text-[11px]">Rp {Number(s.actual_cash_deposited || 0).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="text-right font-black">
                      <span>{Number(s.cash_difference) === 0 ? 'Klop (Pas)' : `Selisih: Rp ${Number(s.cash_difference).toLocaleString('id-ID')}`}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}