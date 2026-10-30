'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Building2, 
  Store, 
  Calendar, 
  FileDown, 
  RefreshCw, 
  PieChart,
  Layers,
  ShoppingBag,
  Truck,
  PlusCircle,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface LocationItem {
  id: string;
  name: string;
}

interface BreakdownLog {
  id: string;
  date: string;
  locationId: string;
  locationName: string;
  vendorName: string;
  nominal: number;
  notes: string;
  reporter: string;
}

interface PnLData {
  locationId: string;
  locationName: string;
  revenue: number;
  omsetDineIn: number;
  omsetOnline: number;
  vendorBreakdown: Record<string, number>;
  totalCogs: number;
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

  const getTodayWita = () => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());
  };

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);

  const [pnlList, setPnlList] = useState<PnLData[]>([]);
  const [expenseBreakdownLogs, setExpenseBreakdownLogs] = useState<BreakdownLog[]>([]);
  const [allVendorNames, setAllVendorNames] = useState<string[]>([]);
  const [totalHqSharedPool, setTotalHqSharedPool] = useState<number>(0);

  // State Modal Tambah Pengeluaran Susulan Owner
  const [showModal, setShowModal] = useState<boolean>(false);
  const [targetScope, setTargetScope] = useState<'SINGLE' | 'SHARED'>('SINGLE');
  const [modalLocationId, setModalLocationId] = useState<string>('');
  const [componentType, setComponentType] = useState<'COGS_VENDOR' | 'STORE_OPEX' | 'STORE_UTILITY'>('COGS_VENDOR');
  const [selectedVendorCategory, setSelectedVendorCategory] = useState<string>('Vendor Pasar');
  const [customVendorName, setCustomVendorName] = useState<string>('');
  const [expenseTitle, setExpenseTitle] = useState<string>('');
  const [modalAmount, setModalAmount] = useState<string>('');
  const [modalDate, setModalDate] = useState<string>(getTodayWita());
  const [modalNotes, setModalNotes] = useState<string>('');
  const [submittingExpense, setSubmittingExpense] = useState<boolean>(false);
  const [modalMessage, setModalMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const cleanLocationName = (name?: string) => {
    if (!name) return 'Outlet';
    return `Outlet ${name.replace(/^outlet\s+/i, '').trim()}`;
  };

  const normalizeVendorName = (rawName?: string) => {
    if (!rawName) return 'Rumah Produksi';
    const clean = rawName.trim();
    const upper = clean.toUpperCase();

    if (upper.includes('RUMAH_PRODUKSI') || upper.includes('RUMAH PRODUKSI') || upper === 'RP') {
      return 'Rumah Produksi';
    }
    if (upper.includes('PASAR')) {
      return 'Vendor Pasar';
    }
    if (upper.includes('HAMDALAH')) {
      return 'Vendor Hamdalah';
    }
    return clean.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
  };

  useEffect(() => {
    async function fetchLocations() {
      const { data } = await supabase.from('locations').select('id, name').order('name');
      if (data && data.length > 0) {
        setLocations(data);
        if (!modalLocationId) {
          setModalLocationId(String(data[0].id));
        }
      }
    }
    fetchLocations();
  }, []);

  const fetchPnLAnalytics = async () => {
    setLoading(true);
    try {
      const startDate = `${selectedMonth}-01`;
      const endDate = `${selectedMonth}-31`;

      // 1. Ambil Beban HQ & Beban Susulan Owner dari hq_and_overhead_expenses
      const { data: hqExpenses } = await supabase
        .from('hq_and_overhead_expenses')
        .select('*')
        .eq('period_month', selectedMonth);

      let sharedPool = 0;
      const utilityDirectMap: Record<string, number> = {};
      const ownerManualOpexMap: Record<string, number> = {};
      const ownerManualCogsVendorMap: Record<string, Record<string, number>> = {};
      const ownerSharedCogsVendorMap: Record<string, number> = {};

      (hqExpenses || []).forEach((exp: any) => {
        const val = Number(exp.amount || 0);
        const cat = exp.expense_category || '';

        if (cat.startsWith('COGS_') || cat === 'COGS_VENDOR') {
          const vName = normalizeVendorName(exp.expense_name?.replace(/^\[COGS - /i, '').replace(/\].*$/, ''));
          if (exp.is_shared_to_all_branches) {
            ownerSharedCogsVendorMap[vName] = (ownerSharedCogsVendorMap[vName] || 0) + val;
          } else if (exp.location_id) {
            if (!ownerManualCogsVendorMap[exp.location_id]) ownerManualCogsVendorMap[exp.location_id] = {};
            ownerManualCogsVendorMap[exp.location_id][vName] = (ownerManualCogsVendorMap[exp.location_id][vName] || 0) + val;
          }
        }
        else if (cat === 'STORE_OPEX') {
          if (exp.is_shared_to_all_branches) {
            sharedPool += val;
          } else if (exp.location_id) {
            ownerManualOpexMap[exp.location_id] = (ownerManualOpexMap[exp.location_id] || 0) + val;
          }
        }
        else if (cat === 'STORE_UTILITY' && exp.location_id && !exp.is_shared_to_all_branches) {
          utilityDirectMap[exp.location_id] = (utilityDirectMap[exp.location_id] || 0) + val;
        }
        else if (exp.is_shared_to_all_branches) {
          sharedPool += val;
        }
      });

      setTotalHqSharedPool(sharedPool);

      // 2. Penggajian Kru Cabang
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

      // 3. Omzet (Termasuk Dine In & Online), Pengeluaran Kasir & Beban Non-Kasir dari cash_settlements
      const { data: settlements } = await supabase
        .from('cash_settlements')
        .select('id, location_id, settlement_date, total_omset, omset_dine_in, omset_online, expense_nominal, non_cash_expense_nominal, non_cash_expense_category, non_cash_expense_notes, reported_by, locations(name)')
        .gte('settlement_date', startDate)
        .lte('settlement_date', endDate);

      const revenueMap: Record<string, number> = {};
      const omsetDineInMap: Record<string, number> = {};
      const omsetOnlineMap: Record<string, number> = {};
      const cashierExpMap: Record<string, number> = {};
      const vendorPerLocMap: Record<string, Record<string, number>> = {};
      const discoveredVendors = new Set<string>(['Rumah Produksi']);
      const logs: BreakdownLog[] = [];

      (settlements || []).forEach((s: any) => {
        const locId = s.location_id;
        if (!locId) return;

        // Ambil nilai per kategori omzet
        let dineIn = Number(s.omset_dine_in || 0);
        let online = Number(s.omset_online || 0);
        const total = Number(s.total_omset || 0);

        // Fallback backward-compatible: jika input kasir lama belum memecah kolomnya
        if (dineIn === 0 && online === 0 && total > 0) {
          dineIn = total;
        }

        omsetDineInMap[locId] = (omsetDineInMap[locId] || 0) + dineIn;
        omsetOnlineMap[locId] = (omsetOnlineMap[locId] || 0) + online;
        revenueMap[locId] = (revenueMap[locId] || 0) + (dineIn + online > 0 ? (dineIn + online) : total);
        
        cashierExpMap[locId] = (cashierExpMap[locId] || 0) + Number(s.expense_nominal || 0);

        if (!vendorPerLocMap[locId]) {
          vendorPerLocMap[locId] = {};
        }

        if (Number(s.non_cash_expense_nominal || 0) > 0) {
          let parsedItems: any[] = [];
          if (s.non_cash_expense_notes && s.non_cash_expense_notes.startsWith('[')) {
            try {
              parsedItems = JSON.parse(s.non_cash_expense_notes);
            } catch {
              parsedItems = [];
            }
          }

          if (parsedItems.length > 0) {
            parsedItems.forEach((item: any, idx: number) => {
              const vendor = normalizeVendorName(item.category || item.vendor || s.non_cash_expense_category);
              const nom = Number(item.nominal || 0);

              discoveredVendors.add(vendor);
              vendorPerLocMap[locId][vendor] = (vendorPerLocMap[locId][vendor] || 0) + nom;

              logs.push({
                id: `${s.id}-${idx}`,
                date: s.settlement_date,
                locationId: locId,
                locationName: cleanLocationName(s.locations?.name),
                vendorName: vendor,
                nominal: nom,
                notes: item.notes || item.name || '-',
                reporter: s.reported_by || 'Kasir'
              });
            });
          } else {
            const vendor = normalizeVendorName(s.non_cash_expense_category);
            const nom = Number(s.non_cash_expense_nominal || 0);

            discoveredVendors.add(vendor);
            vendorPerLocMap[locId][vendor] = (vendorPerLocMap[locId][vendor] || 0) + nom;

            logs.push({
              id: s.id,
              date: s.settlement_date,
              locationId: locId,
              locationName: cleanLocationName(s.locations?.name),
              vendorName: vendor,
              nominal: nom,
              notes: s.non_cash_expense_notes || '-',
              reporter: s.reported_by || 'Kasir'
            });
          }
        }
      });

      // Tambahkan vendor dari susulan owner
      Object.keys(ownerSharedCogsVendorMap).forEach((v) => discoveredVendors.add(v));
      Object.values(ownerManualCogsVendorMap).forEach((m) => Object.keys(m).forEach((v) => discoveredVendors.add(v)));

      (hqExpenses || []).forEach((exp: any) => {
        if (exp.expense_category?.startsWith('COGS_') || exp.expense_category === 'STORE_OPEX') {
          const vName = exp.expense_category?.startsWith('COGS_')
            ? normalizeVendorName(exp.expense_name?.replace(/^\[COGS - /i, '').replace(/\].*$/, ''))
            : 'Biaya Operasional (Susulan Owner)';

          const locLabel = exp.is_shared_to_all_branches 
            ? 'Bagi Rata Seluruh Cabang' 
            : cleanLocationName(locations.find(l => l.id === exp.location_id)?.name);

          logs.push({
            id: exp.id,
            date: exp.expense_date,
            locationId: exp.location_id || 'shared',
            locationName: locLabel,
            vendorName: vName,
            nominal: Number(exp.amount || 0),
            notes: `[Input Owner] ${exp.notes || exp.expense_name}`,
            reporter: exp.created_by || 'Owner'
          });
        }
      });

      const branchCount = Math.max(1, locations.length);
      const sharedPerBranch = Math.round(sharedPool / branchCount);

      const vendorArray = Array.from(discoveredVendors).sort((a, b) => {
        if (a === 'Rumah Produksi') return -1;
        if (b === 'Rumah Produksi') return 1;
        return a.localeCompare(b);
      });
      setAllVendorNames(vendorArray);
      setExpenseBreakdownLogs(logs);

      // 4. Hitung PnL per Cabang
      const computedList: PnLData[] = locations.map((loc) => {
        const rev = revenueMap[loc.id] || 0;
        const dineIn = omsetDineInMap[loc.id] || 0;
        const online = omsetOnlineMap[loc.id] || 0;

        const vBreakdown: Record<string, number> = { ...(vendorPerLocMap[loc.id] || {}) };

        if (ownerManualCogsVendorMap[loc.id]) {
          Object.entries(ownerManualCogsVendorMap[loc.id]).forEach(([v, amt]) => {
            vBreakdown[v] = (vBreakdown[v] || 0) + amt;
          });
        }

        Object.entries(ownerSharedCogsVendorMap).forEach(([v, totalAmt]) => {
          const splitAmt = Math.round(totalAmt / branchCount);
          vBreakdown[v] = (vBreakdown[v] || 0) + splitAmt;
        });

        let totalCogs = 0;
        vendorArray.forEach((v) => {
          totalCogs += Number(vBreakdown[v] || 0);
        });

        const grossProfit = rev - totalCogs;
        const grossMarginPct = rev > 0 ? (grossProfit / rev) * 100 : 0;

        const cashierExp = (cashierExpMap[loc.id] || 0) + (ownerManualOpexMap[loc.id] || 0);
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
          omsetDineIn: dineIn,
          omsetOnline: online,
          vendorBreakdown: vBreakdown,
          totalCogs: totalCogs,
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

  // Konsolidasi Semua Cabang
  const consolidated = useMemo(() => {
    const targetRows = selectedLocation === 'all' 
      ? pnlList 
      : pnlList.filter(p => p.locationId === selectedLocation);

    const totalRev = targetRows.reduce((sum, p) => sum + p.revenue, 0);
    const totalDineIn = targetRows.reduce((sum, p) => sum + p.omsetDineIn, 0);
    const totalOnline = targetRows.reduce((sum, p) => sum + p.omsetOnline, 0);
    
    const totalPerVendor: Record<string, number> = {};
    allVendorNames.forEach((v) => {
      totalPerVendor[v] = targetRows.reduce((sum, p) => sum + Number(p.vendorBreakdown[v] || 0), 0);
    });

    const totalCogs = targetRows.reduce((sum, p) => sum + p.totalCogs, 0);
    const totalGross = totalRev - totalCogs;
    
    const totalCashierExp = targetRows.reduce((sum, p) => sum + p.cashierExpenses, 0);
    const totalPayroll = targetRows.reduce((sum, p) => sum + p.storePayroll, 0);
    const totalUtilityBank = targetRows.reduce((sum, p) => sum + p.storeUtilityBank, 0);
    const totalDirectOpex = targetRows.reduce((sum, p) => sum + p.directOpexTotal, 0);
    const totalStoreProfit = totalGross - totalDirectOpex;
    
    const totalHq = selectedLocation === 'all' 
      ? totalHqSharedPool 
      : (targetRows[0]?.hqSharedAllocation || 0);

    const totalNet = totalStoreProfit - totalHq;

    const dineInPct = totalRev > 0 ? Math.round((totalDineIn / totalRev) * 1000) / 10 : 0;
    const onlinePct = totalRev > 0 ? Math.round((totalOnline / totalRev) * 1000) / 10 : 0;

    return {
      totalRev,
      totalDineIn,
      totalOnline,
      dineInPct,
      onlinePct,
      totalPerVendor,
      totalCogs,
      totalGross,
      grossPct: totalRev > 0 ? Math.round((totalGross / totalRev) * 1000) / 10 : 0,
      totalCashierExp,
      totalPayroll,
      totalUtilityBank,
      totalDirectOpex,
      totalStoreProfit,
      totalHq,
      totalNet,
      netPct: totalRev > 0 ? Math.round((totalNet / totalRev) * 1000) / 10 : 0
    };
  }, [pnlList, selectedLocation, allVendorNames, totalHqSharedPool]);

  // Submit Pengeluaran Susulan Owner
  const handleSaveOwnerExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalAmount || parseFloat(modalAmount) <= 0) {
      alert('Masukkan nominal pengeluaran yang valid.');
      return;
    }

    setSubmittingExpense(true);
    setModalMessage(null);

    try {
      const isShared = targetScope === 'SHARED';
      const locId = isShared ? null : modalLocationId;

      let finalCategory = componentType;
      let vendorTarget = selectedVendorCategory === 'CUSTOM' ? (customVendorName.trim() || 'Vendor Lainnya') : selectedVendorCategory;
      let finalExpenseName = expenseTitle.trim() || 'Pengeluaran Susulan Owner';

      if (componentType === 'COGS_VENDOR') {
        finalExpenseName = `[COGS - ${vendorTarget}] ${expenseTitle.trim() || 'Belanja Bahan'}`;
      }

      const payload = {
        period_month: selectedMonth,
        expense_date: modalDate,
        expense_category: finalCategory,
        expense_name: finalExpenseName,
        amount: parseFloat(modalAmount),
        location_id: locId,
        is_shared_to_all_branches: isShared,
        payment_method: 'TRANSFER_BANK',
        notes: modalNotes.trim() || 'Input susulan oleh Owner di modul PnL',
        created_by: 'Owner (Susulan PnL)',
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('hq_and_overhead_expenses').insert([payload]);
      if (error) throw error;

      setModalMessage({ text: 'Pengeluaran susulan berhasil ditambahkan ke laporan!', type: 'success' });
      setExpenseTitle('');
      setModalAmount('');
      setModalNotes('');
      setCustomVendorName('');

      setTimeout(() => {
        setShowModal(false);
        setModalMessage(null);
      }, 1200);

      await fetchPnLAnalytics();
    } catch (err: any) {
      setModalMessage({ text: err.message || 'Gagal menyimpan beban susulan.', type: 'error' });
    } finally {
      setSubmittingExpense(false);
    }
  };

  const filteredBreakdownLogs = useMemo(() => {
    if (selectedLocation === 'all') return expenseBreakdownLogs;
    return expenseBreakdownLogs.filter(l => l.locationId === selectedLocation || l.locationId === 'shared');
  }, [expenseBreakdownLogs, selectedLocation]);

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
              Breakdown rinci pengeluaran Rumah Produksi, Vendor Pasar, Hamdalah, dan Input Susulan Owner.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* TOMBOL SUSULAN OWNER */}
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs"
          >
            <PlusCircle className="w-4 h-4 text-indigo-600" />
            <span>+ Tambah Beban Susulan</span>
          </button>

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
          <span className="text-[10px] text-slate-500 font-semibold mt-0.5 block">
            Dine In: {consolidated.dineInPct}% • Online: {consolidated.onlinePct}%
          </span>
        </div>

        <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
          <span className="text-[10px] uppercase font-black tracking-wider text-rose-500">Total Belanja Bahan (HPP)</span>
          <div className="text-xl font-black text-rose-800 mt-1">
            Rp {consolidated.totalCogs.toLocaleString('id-ID')}
          </div>
          <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">
            {allVendorNames.length} Vendor / Sumber Pasokan
          </span>
        </div>

        <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100">
          <span className="text-[10px] uppercase font-black tracking-wider text-emerald-600">Laba Operasional Toko</span>
          <div className="text-xl font-black text-emerald-800 mt-1">
            Rp {consolidated.totalStoreProfit.toLocaleString('id-ID')}
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">Setelah HPP & Beban Toko</span>
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

      {/* TABEL ANATOMI PnL RESMI */}
      <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <th className="py-3 px-4 min-w-[260px]">Komponen Laba Rugi (PnL)</th>
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
                {/* 1. REVENUE TOTAL */}
                <tr className="bg-slate-50/60 font-black">
                  <td className="py-2.5 px-4 font-black text-slate-900 uppercase">
                    1. PENDAPATAN PENJUALAN (OMZET)
                  </td>
                  {selectedLocation === 'all' ? (
                    <>
                      {pnlList.map((p) => (
                        <td key={p.locationId} className="py-2.5 px-3 text-right font-black text-slate-900">
                          Rp {p.revenue.toLocaleString('id-ID')}
                        </td>
                      ))}
                      <td className="py-2.5 px-4 text-right font-black bg-indigo-50/60 text-indigo-950">
                        Rp {consolidated.totalRev.toLocaleString('id-ID')}
                      </td>
                    </>
                  ) : (
                    <td className="py-2.5 px-4 text-right font-black text-indigo-950">
                      Rp {consolidated.totalRev.toLocaleString('id-ID')}
                    </td>
                  )}
                </tr>

                {/* SUB-BARIS 1A: OMZET DINE IN */}
                <tr className="text-slate-600 bg-white/50">
                  <td className="py-2 px-4 pl-8 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span className="text-[11px] font-bold">↳ Omzet Dine In (Offline / Kasir)</span>
                  </td>
                  {selectedLocation === 'all' ? (
                    <>
                      {pnlList.map((p) => (
                        <td key={`dine-${p.locationId}`} className="py-2 px-3 text-right font-bold text-slate-700 text-[11px]">
                          Rp {p.omsetDineIn.toLocaleString('id-ID')}
                        </td>
                      ))}
                      <td className="py-2 px-4 text-right font-bold bg-indigo-50/20 text-slate-800 text-[11px]">
                        Rp {consolidated.totalDineIn.toLocaleString('id-ID')}
                      </td>
                    </>
                  ) : (
                    <td className="py-2 px-4 text-right font-bold text-slate-800 text-[11px]">
                      Rp {consolidated.totalDineIn.toLocaleString('id-ID')}
                    </td>
                  )}
                </tr>

                {/* SUB-BARIS 1B: OMZET ONLINE */}
                <tr className="text-slate-600 bg-white/50 border-b border-slate-200/60">
                  <td className="py-2 px-4 pl-8 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                    <span className="text-[11px] font-bold">↳ Omzet Online (Grab / Gojek / Shopee)</span>
                  </td>
                  {selectedLocation === 'all' ? (
                    <>
                      {pnlList.map((p) => (
                        <td key={`online-${p.locationId}`} className="py-2 px-3 text-right font-bold text-orange-700 text-[11px]">
                          Rp {p.omsetOnline.toLocaleString('id-ID')}
                        </td>
                      ))}
                      <td className="py-2 px-4 text-right font-bold bg-indigo-50/20 text-orange-800 text-[11px]">
                        Rp {consolidated.totalOnline.toLocaleString('id-ID')}
                      </td>
                    </>
                  ) : (
                    <td className="py-2 px-4 text-right font-bold text-orange-800 text-[11px]">
                      Rp {consolidated.totalOnline.toLocaleString('id-ID')}
                    </td>
                  )}
                </tr>

                {/* 2. BREAKDOWN HPP / BEBAN POKOK */}
                <tr className="bg-slate-50/20">
                  <td colSpan={selectedLocation === 'all' ? pnlList.length + 2 : 2} className="py-2 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Beban Pokok Penjualan / Bahan Masuk (HPP)
                  </td>
                </tr>

                {allVendorNames.map((vendor) => {
                  const isRP = vendor === 'Rumah Produksi';
                  return (
                    <tr key={vendor}>
                      <td className="py-2 px-4 text-slate-700 pl-8 flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${isRP ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
                        <span>(-) {vendor}</span>
                      </td>
                      {selectedLocation === 'all' ? (
                        <>
                          {pnlList.map((p) => {
                            const val = Number(p.vendorBreakdown[vendor] || 0);
                            return (
                              <td key={p.locationId} className={`py-2 px-3 text-right ${isRP ? 'text-rose-700' : 'text-amber-800'}`}>
                                (Rp {val.toLocaleString('id-ID')})
                              </td>
                            );
                          })}
                          <td className={`py-2 px-4 text-right font-bold bg-indigo-50/20 ${isRP ? 'text-rose-800' : 'text-amber-900'}`}>
                            (Rp {Number(consolidated.totalPerVendor[vendor] || 0).toLocaleString('id-ID')})
                          </td>
                        </>
                      ) : (
                        <td className={`py-2 px-4 text-right font-bold ${isRP ? 'text-rose-800' : 'text-amber-900'}`}>
                          (Rp {Number(consolidated.totalPerVendor[vendor] || 0).toLocaleString('id-ID')})
                        </td>
                      )}
                    </tr>
                  );
                })}

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
                    (-) Pengeluaran Kasir / Petty Cash Laci & Susulan
                  </td>
                  {selectedLocation === 'all' ? (
                    <>
                      {pnlList.map((p) => (
                        <td key={p.locationId} className="py-1.5 px-3 text-right text-slate-700">
                          (Rp {p.cashierExpenses.toLocaleString('id-ID')})
                        </td>
                      ))}
                      <td className="py-1.5 px-4 text-right text-slate-800 font-bold bg-indigo-50/20">
                        (Rp {consolidated.totalCashierExp.toLocaleString('id-ID')})
                      </td>
                    </>
                  ) : (
                    <td className="py-1.5 px-4 text-right text-slate-800 font-bold">
                      (Rp {consolidated.totalCashierExp.toLocaleString('id-ID')})
                    </td>
                  )}
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
                        (Rp {consolidated.totalPayroll.toLocaleString('id-ID')})
                      </td>
                    </>
                  ) : (
                    <td className="py-1.5 px-4 text-right text-slate-800 font-bold">
                      (Rp {consolidated.totalPayroll.toLocaleString('id-ID')})
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
                        (Rp {consolidated.totalUtilityBank.toLocaleString('id-ID')})
                      </td>
                    </>
                  ) : (
                    <td className="py-1.5 px-4 text-right text-slate-800 font-bold">
                      (Rp {consolidated.totalUtilityBank.toLocaleString('id-ID')})
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
                    <td className="py-2 px-4 text-right font-black text-slate-900 bg-indigo-50/40">
                      Rp {consolidated.totalStoreProfit.toLocaleString('id-ID')}
                    </td>
                  )}
                </tr>

                {/* 4. BEBAN KANTOR PUSAT */}
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

      {/* RINCIAN NOTA PENGELUARAN PER VENDOR & SUSULAN */}
      <div className="bg-slate-50/60 p-5 rounded-3xl border border-slate-100 space-y-3 no-print">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-black uppercase text-slate-800">
              Audit Rincian Belanja Bahan: Rumah Produksi, Vendor & Susulan Owner ({filteredBreakdownLogs.length} Nota)
            </h3>
          </div>
          <span className="text-[10px] font-bold text-slate-400">
            Ditarik dari Kasir & Input Susulan Owner
          </span>
        </div>

        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200/60 bg-white/60 sticky top-0">
                <th className="py-2.5 px-3">Tanggal & Outlet</th>
                <th className="py-2.5 px-3">Sumber / Vendor</th>
                <th className="py-2.5 px-3">Rincian Barang / Catatan Nota</th>
                <th className="py-2.5 px-3">Pelapor</th>
                <th className="py-2.5 px-3 text-right">Nominal (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 font-medium">
              {filteredBreakdownLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">
                    Belum ada rekaman pengeluaran RP atau Vendor pada periode {selectedMonth}.
                  </td>
                </tr>
              ) : (
                filteredBreakdownLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/80 transition-colors">
                    <td className="py-2 px-3">
                      <div className="font-bold text-slate-900">{log.locationName}</div>
                      <div className="text-[10px] text-slate-400">{log.date}</div>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black border flex items-center gap-1 w-fit ${
                        log.vendorName === 'Rumah Produksi' 
                          ? 'bg-rose-50 text-rose-700 border-rose-200' 
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {log.vendorName === 'Rumah Produksi' ? <ShoppingBag className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                        {log.vendorName}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-700 font-bold">
                      {log.notes}
                    </td>
                    <td className="py-2 px-3 text-slate-400 text-[11px]">
                      {log.reporter}
                    </td>
                    <td className="py-2 px-3 text-right font-black text-rose-800">
                      Rp {log.nominal.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL POPUP: TAMBAH BEBAN SUSULAN OWNER */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Tambah Pengeluaran Susulan Owner</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Beban yang tidak terinput di kasir outlet</p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalMessage && (
              <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                modalMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {modalMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />}
                <span>{modalMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveOwnerExpense} className="space-y-4">
              
              {/* 1. Alokasi Cabang: Khusus 1 Cabang vs Bagi Rata */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">
                  1. Alokasi Beban ke Cabang
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetScope('SINGLE')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      targetScope === 'SINGLE'
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    Khusus 1 Cabang
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetScope('SHARED')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      targetScope === 'SHARED'
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    Bagi Rata Semua Cabang
                  </button>
                </div>
              </div>

              {targetScope === 'SINGLE' && (
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">
                    Pilih Cabang Tertuju
                  </label>
                  <select
                    value={modalLocationId}
                    onChange={(e) => setModalLocationId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {cleanLocationName(loc.name)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 2. Pilihan Komponen PnL */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">
                  2. Komponen Laba Rugi (PnL)
                </label>
                <select
                  value={componentType}
                  onChange={(e: any) => setComponentType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                >
                  <option value="COGS_VENDOR">HPP / Belanja Bahan (Masuk ke Baris Vendor)</option>
                  <option value="STORE_OPEX">Beban Operasional Cabang (Direct OPEX Toko)</option>
                  <option value="STORE_UTILITY">Utilitas / Maintenance Cabang (Listrik/WiFi)</option>
                </select>
              </div>

              {/* Jika memilih HPP/Vendor, tampilkan pilihan vendor */}
              {componentType === 'COGS_VENDOR' && (
                <div className="space-y-2 p-3 bg-amber-50/50 rounded-2xl border border-amber-200/60">
                  <label className="block text-[10px] font-black uppercase text-amber-800">
                    Pilih Baris Vendor Terkait
                  </label>
                  <select
                    value={selectedVendorCategory}
                    onChange={(e) => setSelectedVendorCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="Rumah Produksi">Rumah Produksi (RP)</option>
                    <option value="Vendor Pasar">Vendor Pasar</option>
                    <option value="Vendor Hamdalah">Vendor Hamdalah</option>
                    <option value="CUSTOM">+ Tulis Nama Vendor Lain...</option>
                  </select>

                  {selectedVendorCategory === 'CUSTOM' && (
                    <input
                      type="text"
                      placeholder="Masukkan nama vendor baru..."
                      value={customVendorName}
                      onChange={(e) => setCustomVendorName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                    />
                  )}
                </div>
              )}

              {/* 3. Detail Nominal & Tanggal */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">
                    Nominal Beban (Rp)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder="0"
                    value={modalAmount}
                    onChange={(e) => setModalAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-indigo-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">
                    Tanggal Transaksi
                  </label>
                  <input
                    type="date"
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                  />
                </div>
              </div>

              {/* Keterangan */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">
                  Keterangan / Keperluan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Misal: Nota sayur darurat / Beli sparepart kompor..."
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingExpense}
                  className="w-2/3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all disabled:opacity-40"
                >
                  {submittingExpense ? 'Menyimpan...' : 'Simpan ke Laporan PnL'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}