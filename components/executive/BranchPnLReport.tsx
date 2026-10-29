'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Building2, 
  Store, 
  Calendar, 
  FileDown, 
  RefreshCw, 
  PieChart
} from 'lucide-react';

interface LocationItem {
  id: string;
  name: string;
}

interface PnLData {
  locationId: string;
  locationName: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  cashierExpenses: number;
  storePayroll: number;
  storeUtilityBank: number;
  directOpexTotal: number;
  storeOperatingProfit: number;
  hqSharedAllocation: number;
  netProfit: number;
  netMarginPct: number;
}

export default function BranchPnLReport() {
  const getCurrentMonthStr = () => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date()).substring(0, 7);
  };

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);

  const [pnlList, setPnlList] = useState<PnLData[]>([]);
  const [totalHqSharedPool, setTotalHqSharedPool] = useState<number>(0);

  const cleanLocationName = (name?: string) => {
    if (!name) return 'Outlet';
    return `Outlet ${name.replace(/^outlet\s+/i, '').trim()}`;
  };

  useEffect(() => {
    async function fetchLocations() {
      const { data } = await supabase.from('locations').select('id, name').order('name');
      if (data) setLocations(data);
    }
    fetchLocations();
  }, []);

  const fetchPnLAnalytics = async () => {
    setLoading(true);
    try {
      const startDate = `${selectedMonth}-01`;
      const endDate = `${selectedMonth}-31`;
      const startDateTime = `${startDate}T00:00:00`;
      const endDateTime = `${endDate}T23:59:59`;

      // A. Ambil Biaya Kantor Pusat (HQ Shared)
      const { data: hqExpenses } = await supabase
        .from('hq_and_overhead_expenses')
        .select('*')
        .eq('period_month', selectedMonth);

      let sharedPool = 0;
      const utilityDirectMap: Record<string, number> = {};

      (hqExpenses || []).forEach((exp: any) => {
        const val = Number(exp.amount || 0);
        if (exp.is_shared_to_all_branches) {
          sharedPool += val;
        } else if (exp.location_id) {
          utilityDirectMap[exp.location_id] = (utilityDirectMap[exp.location_id] || 0) + val;
        }
      });
      setTotalHqSharedPool(sharedPool);

      // B. Ambil Penggajian Kru Cabang (Store Payroll)
      const { data: payrollData } = await supabase
        .from('store_payroll')
        .select('location_id, total_net_salary')
        .eq('period_month', selectedMonth);

      const payrollMap: Record<string, number> = {};
      (payrollData || []).forEach((pay: any) => {
        if (pay.location_id) {
          payrollMap[pay.location_id] = (payrollMap[pay.location_id] || 0) + Number(pay.total_net_salary || 0);
        }
      });

      // C. Ambil HPP / Belanja Bahan Masuk (Rumah Produksi & Vendor)
      const { data: orderData } = await supabase
        .from('order_requests')
        .select('location_id, quantity, item_name, created_at')
        .gte('created_at', startDateTime)
        .lte('created_at', endDateTime);

      const { data: itemsMeta } = await supabase.from('items').select('name, cost_price, price');
      const itemCostMap: Record<string, number> = {};
      (itemsMeta || []).forEach((itm: any) => {
        const clean = (itm.name || '').trim().toUpperCase().replace(/\s+/g, ' ');
        itemCostMap[clean] = Number(itm.cost_price || itm.price || 0);
      });

      const cogsMap: Record<string, number> = {};
      (orderData || []).forEach((ord: any) => {
        if (ord.location_id) {
          const cName = (ord.item_name || '').trim().toUpperCase().replace(/\s+/g, ' ');
          const cost = itemCostMap[cName] || 0;
          const totalItemCost = Number(ord.quantity || 0) * cost;
          cogsMap[ord.location_id] = (cogsMap[ord.location_id] || 0) + totalItemCost;
        }
      });

      // D. Ambil Pendapatan Penjualan dari Daily Closings (Pastikan item_name di-select)
      const { data: closingData } = await supabase
        .from('daily_closings')
        .select('location_id, item_name, terpakai, closing_date')
        .gte('closing_date', startDate)
        .lte('closing_date', endDate);

      const revenueMap: Record<string, number> = {};
      const cashierExpMap: Record<string, number> = {};

      (closingData || []).forEach((c: any) => {
        if (c.location_id) {
          const cName = (c.item_name || '').trim().toUpperCase().replace(/\s+/g, ' ');
          if (cName.includes('BAKSO') || cName.includes('MIE') || cName.includes('AYAM')) {
            revenueMap[c.location_id] = (revenueMap[c.location_id] || 0) + (Number(c.terpakai || 0) * 18000);
          }
        }
      });

      // E. Kalkulasi PnL per Cabang
      const branchCount = Math.max(1, locations.length);
      const sharedPerBranch = Math.round(sharedPool / branchCount);

      const computedList: PnLData[] = locations.map((loc) => {
        const rev = revenueMap[loc.id] || 0;
        const cogs = cogsMap[loc.id] || 0;
        const grossProfit = rev - cogs;
        const grossMarginPct = rev > 0 ? (grossProfit / rev) * 100 : 0;

        const cashierExp = cashierExpMap[loc.id] || 0;
        const payroll = payrollMap[loc.id] || 0;
        const utilityBank = utilityDirectMap[loc.id] || 0;

        const directOpex = cashierExp + payroll + utilityBank;
        const storeOperatingProfit = grossProfit - directOpex;
        const netProfit = storeOperatingProfit - sharedPerBranch;
        const netMarginPct = rev > 0 ? (netProfit / rev) * 100 : 0;

        return {
          locationId: loc.id,
          locationName: cleanLocationName(loc.name),
          revenue: rev,
          cogs: cogs,
          grossProfit: grossProfit,
          grossMarginPct: Math.round(grossMarginPct * 10) / 10,
          cashierExpenses: cashierExp,
          storePayroll: payroll,
          storeUtilityBank: utilityBank,
          directOpexTotal: directOpex,
          storeOperatingProfit: storeOperatingProfit,
          hqSharedAllocation: sharedPerBranch,
          netProfit: netProfit,
          netMarginPct: Math.round(netMarginPct * 10) / 10
        };
      });

      setPnlList(computedList);
    } catch (err: any) {
      console.error('Gagal mengakumulasi PnL:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPnLAnalytics();
  }, [selectedMonth, locations]);

  const consolidated = useMemo(() => {
    const targetRows = selectedLocation === 'all' 
      ? pnlList 
      : pnlList.filter(p => p.locationId === selectedLocation);

    const totalRev = targetRows.reduce((sum, p) => sum + p.revenue, 0);
    const totalCogs = targetRows.reduce((sum, p) => sum + p.cogs, 0);
    const totalGross = totalRev - totalCogs;
    const totalDirectOpex = targetRows.reduce((sum, p) => sum + p.directOpexTotal, 0);
    const totalStoreProfit = totalGross - totalDirectOpex;
    
    const totalHq = selectedLocation === 'all' 
      ? totalHqSharedPool 
      : (targetRows[0]?.hqSharedAllocation || 0);

    const totalNet = totalStoreProfit - totalHq;

    return {
      totalRev,
      totalCogs,
      totalGross,
      grossPct: totalRev > 0 ? Math.round((totalGross / totalRev) * 1000) / 10 : 0,
      totalDirectOpex,
      totalStoreProfit,
      totalHq,
      totalNet,
      netPct: totalRev > 0 ? Math.round((totalNet / totalRev) * 1000) / 10 : 0
    };
  }, [pnlList, selectedLocation, totalHqSharedPool]);

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `Laporan PnL Bakso Ibu (${selectedMonth})`;
    window.print();
    setTimeout(() => { document.title = originalTitle; }, 2000);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-xs space-y-6 font-sans print:p-0 print:border-none">
      
      {/* CSS Cetak PDF Khusus Laporan PnL */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .print-header {
            display: block !important;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid #0f172a;
          }
        }
      `}</style>

      {/* Header Cetak */}
      <div className="hidden print:block print-header">
        <h1 className="text-base font-black text-slate-900 tracking-tight">
          BAKSO IBU • LAPORAN LABA RUGI EKSEKUTIF (PnL)
        </h1>
        <p className="text-[11px] text-slate-600 font-semibold mt-0.5">
          Periode Bulan: {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(`${selectedMonth}-01`))}
        </p>
      </div>

      {/* Header Navigasi & Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-slate-100 gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
            <PieChart className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              Laporan Laba Rugi Eksekutif (PnL Bulanan)
            </h2>
            <p className="text-xs font-medium text-slate-400">
              Otomatis menghitung HPP bahan, gaji kru cabang, kas laci & bagi rata beban kantor pusat.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex items-center">
            <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="pl-8 pr-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
            />
          </div>

          <div className="relative">
            <Store className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Cabang (Konsolidasi)</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {cleanLocationName(loc.name)}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchPnLAnalytics}
            className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-500"
            title="Segarkan PnL"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20"
          >
            <FileDown className="w-4 h-4" />
            <span>Cetak / Download PDF</span>
          </button>
        </div>
      </div>

      {/* METRIK KARTU RINGKASAN FINANSIAL */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 no-print">
        <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Total Omzet Penjualan</span>
          <div className="text-xl font-black text-slate-900 mt-1">
            Rp {consolidated.totalRev.toLocaleString('id-ID')}
          </div>
          <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">100% Basis Omzet Toko</span>
        </div>

        <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Total HPP Bahan Masuk</span>
          <div className="text-xl font-black text-slate-700 mt-1">
            Rp {consolidated.totalCogs.toLocaleString('id-ID')}
          </div>
          <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">RP & Vendor Luar</span>
        </div>

        <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100">
          <span className="text-[10px] uppercase font-black tracking-wider text-emerald-600">Laba Operasional Toko</span>
          <div className="text-xl font-black text-emerald-800 mt-1">
            Rp {consolidated.totalStoreProfit.toLocaleString('id-ID')}
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">Sebelum Alokasi Pusat</span>
        </div>

        <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100">
          <span className="text-[10px] uppercase font-black tracking-wider text-indigo-600">Laba Bersih Akhir (Net)</span>
          <div className="text-xl font-black text-indigo-900 mt-1">
            Rp {consolidated.totalNet.toLocaleString('id-ID')}
          </div>
          <span className="text-[10px] text-indigo-600 font-bold mt-0.5 block">
            Net Margin: {consolidated.netPct}%
          </span>
        </div>
      </div>

      {/* TABEL ANATOMI PnL */}
      <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <th className="py-3 px-4 min-w-[240px]">Komponen Laba Rugi (PnL)</th>
              {selectedLocation === 'all' ? (
                <>
                  {pnlList.map((p) => (
                    <th key={p.locationId} className="py-3 px-3 text-right min-w-[130px]">
                      {p.locationName}
                    </th>
                  ))}
                  <th className="py-3 px-4 text-right min-w-[140px] font-black bg-indigo-50 text-indigo-900">
                    KONSOLIDASI (TOTAL)
                  </th>
                </>
              ) : (
                <th className="py-3 px-4 text-right font-black bg-indigo-50 text-indigo-900">
                  {pnlList.find(p => p.locationId === selectedLocation)?.locationName}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
            {loading ? (
              <tr>
                <td colSpan={pnlList.length + 2} className="py-16 text-center text-slate-400 font-bold">
                  Mengalkulasi angka PnL dari database...
                </td>
              </tr>
            ) : (
              <>
                {/* 1. REVENUE */}
                <tr className="bg-slate-50/40">
                  <td className="py-2.5 px-4 font-black text-slate-900 uppercase">
                    1. PENDAPATAN PENJUALAN (OMZET)
                  </td>
                  {selectedLocation === 'all' ? (
                    <>
                      {pnlList.map((p) => (
                        <td key={p.locationId} className="py-2.5 px-3 text-right font-black">
                          Rp {p.revenue.toLocaleString('id-ID')}
                        </td>
                      ))}
                      <td className="py-2.5 px-4 text-right font-black bg-indigo-50/40 text-indigo-950">
                        Rp {consolidated.totalRev.toLocaleString('id-ID')}
                      </td>
                    </>
                  ) : (
                    <td className="py-2.5 px-4 text-right font-black text-indigo-950">
                      Rp {consolidated.totalRev.toLocaleString('id-ID')}
                    </td>
                  )}
                </tr>

                {/* 2. COGS / HPP */}
                <tr>
                  <td className="py-2 px-4 text-slate-600 pl-8">
                    (-) Belanja Bahan Masuk (RP & Vendor)
                  </td>
                  {selectedLocation === 'all' ? (
                    <>
                      {pnlList.map((p) => (
                        <td key={p.locationId} className="py-2 px-3 text-right text-rose-700">
                          (Rp {p.cogs.toLocaleString('id-ID')})
                        </td>
                      ))}
                      <td className="py-2 px-4 text-right text-rose-800 font-bold bg-indigo-50/20">
                        (Rp {consolidated.totalCogs.toLocaleString('id-ID')})
                      </td>
                    </>
                  ) : (
                    <td className="py-2 px-4 text-right text-rose-800 font-bold">
                      (Rp {consolidated.totalCogs.toLocaleString('id-ID')})
                    </td>
                  )}
                </tr>

                {/* LABA KOTOR */}
                <tr className="bg-emerald-50/30 border-y border-emerald-100">
                  <td className="py-2.5 px-4 font-black text-emerald-900 uppercase">
                    = LABA KOTOR (GROSS PROFIT)
                  </td>
                  {selectedLocation === 'all' ? (
                    <>
                      {pnlList.map((p) => (
                        <td key={p.locationId} className="py-2.5 px-3 text-right font-black text-emerald-800">
                          Rp {p.grossProfit.toLocaleString('id-ID')}
                          <span className="block text-[10px] text-emerald-600 font-normal">
                            {p.grossMarginPct}%
                          </span>
                        </td>
                      ))}
                      <td className="py-2.5 px-4 text-right font-black text-emerald-900 bg-emerald-100/40">
                        Rp {consolidated.totalGross.toLocaleString('id-ID')}
                        <span className="block text-[10px] text-emerald-700 font-normal">
                          {consolidated.grossPct}%
                        </span>
                      </td>
                    </>
                  ) : (
                    <td className="py-2.5 px-4 text-right font-black text-emerald-900 bg-emerald-100/40">
                      Rp {consolidated.totalGross.toLocaleString('id-ID')}
                      <span className="block text-[10px] text-emerald-700 font-normal">
                        {consolidated.grossPct}%
                      </span>
                    </td>
                  )}
                </tr>

                {/* 3. BEBAN OPERASIONAL TOKO */}
                <tr className="bg-slate-50/40">
                  <td colSpan={selectedLocation === 'all' ? pnlList.length + 2 : 2} className="py-2 px-4 font-black text-slate-800 uppercase text-[10px] tracking-wider">
                    2. BEBAN OPERASIONAL LANGSUNG CABANG (DIRECT OPEX)
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 px-4 text-slate-600 pl-8">
                    (-) Gaji & Bonus Kru Cabang (Input HR)
                  </td>
                  {selectedLocation === 'all' ? (
                    <>
                      {pnlList.map((p) => (
                        <td key={p.locationId} className="py-1.5 px-3 text-right text-slate-700">
                          (Rp {p.storePayroll.toLocaleString('id-ID')})
                        </td>
                      ))}
                      <td className="py-1.5 px-4 text-right text-slate-800 font-bold bg-indigo-50/20">
                        (Rp {pnlList.reduce((sum, p) => sum + p.storePayroll, 0).toLocaleString('id-ID')})
                      </td>
                    </>
                  ) : (
                    <td className="py-1.5 px-4 text-right text-slate-800 font-bold">
                      (Rp {pnlList.find(p => p.locationId === selectedLocation)?.storePayroll.toLocaleString('id-ID')})
                    </td>
                  )}
                </tr>
                <tr>
                  <td className="py-1.5 px-4 text-slate-600 pl-8">
                    (-) Utilitas Non-Kasir (WiFi & Listrik Transfer Bank)
                  </td>
                  {selectedLocation === 'all' ? (
                    <>
                      {pnlList.map((p) => (
                        <td key={p.locationId} className="py-1.5 px-3 text-right text-slate-700">
                          (Rp {p.storeUtilityBank.toLocaleString('id-ID')})
                        </td>
                      ))}
                      <td className="py-1.5 px-4 text-right text-slate-800 font-bold bg-indigo-50/20">
                        (Rp {pnlList.reduce((sum, p) => sum + p.storeUtilityBank, 0).toLocaleString('id-ID')})
                      </td>
                    </>
                  ) : (
                    <td className="py-1.5 px-4 text-right text-slate-800 font-bold">
                      (Rp {pnlList.find(p => p.locationId === selectedLocation)?.storeUtilityBank.toLocaleString('id-ID')})
                    </td>
                  )}
                </tr>

                {/* LABA OPERASIONAL TOKO */}
                <tr className="bg-slate-100/70 border-y border-slate-200">
                  <td className="py-2 px-4 font-black text-slate-900 uppercase">
                    = LABA OPERASIONAL CABANG (STORE PROFIT)
                  </td>
                  {selectedLocation === 'all' ? (
                    <>
                      {pnlList.map((p) => (
                        <td key={p.locationId} className="py-2 px-3 text-right font-black text-slate-800">
                          Rp {p.storeOperatingProfit.toLocaleString('id-ID')}
                        </td>
                      ))}
                      <td className="py-2 px-4 text-right font-black text-slate-900 bg-indigo-50/40">
                        Rp {consolidated.totalStoreProfit.toLocaleString('id-ID')}
                      </td>
                    </>
                  ) : (
                    <td className="py-2.5 px-4 text-right font-black text-slate-900 bg-indigo-50/40">
                      Rp {consolidated.totalStoreProfit.toLocaleString('id-ID')}
                    </td>
                  )}
                </tr>

                {/* 4. BEBAN KANTOR PUSAT (BAGI RATA) */}
                <tr>
                  <td className="py-2 px-4 text-indigo-900 font-bold pl-8">
                    (-) Alokasi Manajemen HQ (Bagi Rata: Gaji HR, Admin, Owner)
                  </td>
                  {selectedLocation === 'all' ? (
                    <>
                      {pnlList.map((p) => (
                        <td key={p.locationId} className="py-2 px-3 text-right text-indigo-700 font-bold">
                          (Rp {p.hqSharedAllocation.toLocaleString('id-ID')})
                        </td>
                      ))}
                      <td className="py-2 px-4 text-right text-indigo-900 font-black bg-indigo-50/30">
                        (Rp {consolidated.totalHq.toLocaleString('id-ID')})
                      </td>
                    </>
                  ) : (
                    <td className="py-2 px-4 text-right text-indigo-900 font-black bg-indigo-50/30">
                      (Rp {consolidated.totalHq.toLocaleString('id-ID')})
                    </td>
                  )}
                </tr>

                {/* 5. LABA BERSIH AKHIR */}
                <tr className="bg-indigo-600 text-white border-t-2 border-indigo-700">
                  <td className="py-3 px-4 font-black uppercase text-xs tracking-wider">
                    = LABA BERSIH AKHIR (NET PROFIT RIIL)
                  </td>
                  {selectedLocation === 'all' ? (
                    <>
                      {pnlList.map((p) => (
                        <td key={p.locationId} className="py-3 px-3 text-right font-black text-sm">
                          Rp {p.netProfit.toLocaleString('id-ID')}
                          <span className="block text-[10px] text-indigo-200 font-normal">
                            Margin: {p.netMarginPct}%
                          </span>
                        </td>
                      ))}
                      <td className="py-3 px-4 text-right font-black text-base bg-indigo-700">
                        Rp {consolidated.totalNet.toLocaleString('id-ID')}
                        <span className="block text-[10px] text-indigo-200 font-normal">
                          Margin: {consolidated.netPct}%
                        </span>
                      </td>
                    </>
                  ) : (
                    <td className="py-3 px-4 text-right font-black text-base bg-indigo-700">
                      Rp {consolidated.totalNet.toLocaleString('id-ID')}
                      <span className="block text-[10px] text-indigo-200 font-normal">
                        Margin: {consolidated.netPct}%
                      </span>
                    </td>
                  )}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}