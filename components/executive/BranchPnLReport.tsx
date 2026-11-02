'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
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
  AlertCircle, 
  Landmark, 
  FileSpreadsheet,
  Download,
  Eye,
  ChevronDown,
  Printer,
  FileText
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
  componentType: 'REVENUE_TOTAL' | 'REVENUE_DINE_IN' | 'REVENUE_ONLINE' | 'COGS_VENDOR' | 'CASHIER_EXPENSE' | 'FINANCING' | 'OTHER';
  vendorOrChannel: string;
  nominal: number;
  notes: string;
  reporter: string;
  cashNominal?: number;
  qrisNominal?: number;
  grabNominal?: number;
  gofoodNominal?: number;
  shopeeNominal?: number;
  shiftName?: string;
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
  financingExpense: number;
  otherExpense: number;
  netProfit: number;
  netMarginPct: number;
}

interface ActiveDrillDown {
  title: string;
  componentType: string;
  vendorOrChannel?: string;
  targetLocationId: string;
  targetLocationName: string;
}

export default function BranchPnLReport() {
  const getCurrentMonthStr = () => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date()).substring(0, 7);
  };

  const getTodayWita = () => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());
  };

  const getLastDayOfMonth = (yearMonthStr: string) => {
    const [year, month] = yearMonthStr.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return `${yearMonthStr}-${String(lastDay).padStart(2, '0')}`;
  };

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);

  const [pnlList, setPnlList] = useState<PnLData[]>([]);
  const [allLogs, setAllLogs] = useState<BreakdownLog[]>([]);
  const [allVendorNames, setAllVendorNames] = useState<string[]>([]);
  const [totalHqSharedPool, setTotalHqSharedPool] = useState<number>(0);
  const [totalFinancingPool, setTotalFinancingPool] = useState<number>(0);
  const [totalOtherExpPool, setTotalOtherExpPool] = useState<number>(0);

  const [activeDrillDown, setActiveDrillDown] = useState<ActiveDrillDown | null>(null);

  // Opsi Download Popover & Mode Cetak
  const [showDownloadMenu, setShowDownloadMenu] = useState<boolean>(false);
  const [includePrintDetails, setIncludePrintDetails] = useState<boolean>(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  const [showModal, setShowModal] = useState<boolean>(false);
  const [targetScope, setTargetScope] = useState<'SINGLE' | 'SHARED'>('SINGLE');
  const [modalLocationId, setModalLocationId] = useState<string>('');
  const [componentType, setComponentType] = useState<'COGS_VENDOR' | 'STORE_OPEX' | 'STORE_UTILITY' | 'FINANCING_EXPENSE' | 'OTHER_EXPENSE'>('COGS_VENDOR');
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
    const handleClickOutside = (event: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setShowDownloadMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      const endDate = getLastDayOfMonth(selectedMonth);

      const { data: hqExpenses } = await supabase
        .from('hq_and_overhead_expenses')
        .select('*')
        .eq('period_month', selectedMonth);

      let sharedHqPool = 0;
      let sharedFinancingPool = 0;
      let sharedOtherPool = 0;

      const utilityDirectMap: Record<string, number> = {};
      const ownerManualOpexMap: Record<string, number> = {};
      const directFinancingMap: Record<string, number> = {};
      const directOtherMap: Record<string, number> = {};
      const ownerManualCogsVendorMap: Record<string, Record<string, number>> = {};
      const ownerSharedCogsVendorMap: Record<string, number> = {};

      const logs: BreakdownLog[] = [];

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

          logs.push({
            id: exp.id,
            date: exp.expense_date,
            locationId: exp.location_id || 'shared',
            locationName: exp.is_shared_to_all_branches ? 'Bagi Rata Seluruh Cabang' : cleanLocationName(locations.find(l => l.id === exp.location_id)?.name),
            componentType: 'COGS_VENDOR',
            vendorOrChannel: vName,
            nominal: val,
            notes: `[Input Susulan] ${exp.notes || exp.expense_name}`,
            reporter: exp.created_by || 'Owner'
          });
        }
        else if (cat === 'STORE_OPEX') {
          if (exp.is_shared_to_all_branches) {
            sharedHqPool += val;
          } else if (exp.location_id) {
            ownerManualOpexMap[exp.location_id] = (ownerManualOpexMap[exp.location_id] || 0) + val;
          }

          logs.push({
            id: exp.id,
            date: exp.expense_date,
            locationId: exp.location_id || 'shared',
            locationName: exp.is_shared_to_all_branches ? 'Bagi Rata Seluruh Cabang' : cleanLocationName(locations.find(l => l.id === exp.location_id)?.name),
            componentType: 'CASHIER_EXPENSE',
            vendorOrChannel: 'Biaya Operasional Toko',
            nominal: val,
            notes: `[Input Susulan] ${exp.notes || exp.expense_name}`,
            reporter: exp.created_by || 'Owner'
          });
        }
        else if (cat === 'STORE_UTILITY' && exp.location_id && !exp.is_shared_to_all_branches) {
          utilityDirectMap[exp.location_id] = (utilityDirectMap[exp.location_id] || 0) + val;
        }
        else if (cat === 'FINANCING_EXPENSE') {
          if (exp.is_shared_to_all_branches) {
            sharedFinancingPool += val;
          } else if (exp.location_id) {
            directFinancingMap[exp.location_id] = (directFinancingMap[exp.location_id] || 0) + val;
          }

          logs.push({
            id: exp.id,
            date: exp.expense_date,
            locationId: exp.location_id || 'shared',
            locationName: exp.is_shared_to_all_branches ? 'Bagi Rata Seluruh Cabang' : cleanLocationName(locations.find(l => l.id === exp.location_id)?.name),
            componentType: 'FINANCING',
            vendorOrChannel: 'Beban Financing / Pinjaman',
            nominal: val,
            notes: `[Financing] ${exp.notes || exp.expense_name}`,
            reporter: exp.created_by || 'Owner'
          });
        }
        else if (cat === 'OTHER_EXPENSE') {
          if (exp.is_shared_to_all_branches) {
            sharedOtherPool += val;
          } else if (exp.location_id) {
            directOtherMap[exp.location_id] = (directOtherMap[exp.location_id] || 0) + val;
          }

          logs.push({
            id: exp.id,
            date: exp.expense_date,
            locationId: exp.location_id || 'shared',
            locationName: exp.is_shared_to_all_branches ? 'Bagi Rata Seluruh Cabang' : cleanLocationName(locations.find(l => l.id === exp.location_id)?.name),
            componentType: 'OTHER',
            vendorOrChannel: 'Beban Lain-Lain',
            nominal: val,
            notes: `[Lain-lain] ${exp.notes || exp.expense_name}`,
            reporter: exp.created_by || 'Owner'
          });
        }
        else if (exp.is_shared_to_all_branches) {
          sharedHqPool += val;
        }
      });

      setTotalHqSharedPool(sharedHqPool);
      setTotalFinancingPool(sharedFinancingPool);
      setTotalOtherExpPool(sharedOtherPool);

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

      const { data: settlements, error: settleErr } = await supabase
        .from('cash_settlements')
        .select('*')
        .gte('settlement_date', startDate)
        .lte('settlement_date', endDate)
        .order('settlement_date', { ascending: false });

      if (settleErr) throw settleErr;

      const revenueMap: Record<string, number> = {};
      const omsetDineInMap: Record<string, number> = {};
      const omsetOnlineMap: Record<string, number> = {};
      const cashierExpMap: Record<string, number> = {};
      const vendorPerLocMap: Record<string, Record<string, number>> = {};
      const discoveredVendors = new Set<string>(['Rumah Produksi']);

      (settlements || []).forEach((s: any) => {
        const locId = s.location_id;
        if (!locId) return;

        const locName = cleanLocationName(locations.find(l => l.id === locId)?.name);

        let cCash = Number(s.cash_nominal || 0);
        let cQris = Number(s.qris_nominal || 0);
        let cGrab = Number(s.grab_nominal || 0);
        let cGofood = Number(s.gofood_nominal || 0);
        let cShopee = Number(s.shopee_nominal || 0);

        let dineIn = (s.cash_nominal !== undefined || s.qris_nominal !== undefined)
          ? (cCash + cQris)
          : Number(s.omset_dine_in || 0);

        let online = (s.grab_nominal !== undefined || s.gofood_nominal !== undefined || s.shopee_nominal !== undefined)
          ? (cGrab + cGofood + cShopee)
          : Number(s.omset_online || 0);

        const totalNominal = Number(s.total_omset || 0);
        let finalRev = dineIn + online;

        if (finalRev === 0 && totalNominal > 0) {
          dineIn = totalNominal;
          finalRev = totalNominal;
        }

        omsetDineInMap[locId] = (omsetDineInMap[locId] || 0) + dineIn;
        omsetOnlineMap[locId] = (omsetOnlineMap[locId] || 0) + online;
        revenueMap[locId] = (revenueMap[locId] || 0) + finalRev;

        logs.push({
          id: `rev-${s.id}`,
          date: s.settlement_date,
          locationId: locId,
          locationName: locName,
          componentType: 'REVENUE_TOTAL',
          vendorOrChannel: 'Omzet Shift Kasir',
          nominal: finalRev,
          notes: `Shift: ${s.shift || s.shift_name || 'Shift Harian'}`,
          reporter: s.reported_by || 'Kasir',
          cashNominal: cCash,
          qrisNominal: cQris,
          grabNominal: cGrab,
          gofoodNominal: cGofood,
          shopeeNominal: cShopee,
          shiftName: s.shift || s.shift_name || 'Shift Harian'
        });

        const cExp = Number(s.expense_nominal || 0);
        cashierExpMap[locId] = (cashierExpMap[locId] || 0) + cExp;

        if (cExp > 0) {
          logs.push({
            id: `exp-${s.id}`,
            date: s.settlement_date,
            locationId: locId,
            locationName: locName,
            componentType: 'CASHIER_EXPENSE',
            vendorOrChannel: 'Petty Cash Laci Kasir',
            nominal: cExp,
            notes: s.expense_notes || 'Pengeluaran uang kas kasir',
            reporter: s.reported_by || 'Kasir'
          });
        }

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
                locationName: locName,
                componentType: 'COGS_VENDOR',
                vendorOrChannel: vendor,
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
              locationName: locName,
              componentType: 'COGS_VENDOR',
              vendorOrChannel: vendor,
              nominal: nom,
              notes: s.non_cash_expense_notes || '-',
              reporter: s.reported_by || 'Kasir'
            });
          }
        }
      });

      Object.keys(ownerSharedCogsVendorMap).forEach((v) => discoveredVendors.add(v));
      Object.values(ownerManualCogsVendorMap).forEach((m) => Object.keys(m).forEach((v) => discoveredVendors.add(v)));

      const branchCount = Math.max(1, locations.length);
      const sharedPerBranchHq = Math.round(sharedHqPool / branchCount);
      const sharedPerBranchFinancing = Math.round(sharedFinancingPool / branchCount);
      const sharedPerBranchOther = Math.round(sharedOtherPool / branchCount);

      const vendorArray = Array.from(discoveredVendors).sort((a, b) => {
        if (a === 'Rumah Produksi') return -1;
        if (b === 'Rumah Produksi') return 1;
        return a.localeCompare(b);
      });
      setAllVendorNames(vendorArray);
      setAllLogs(logs);

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

        const branchFinancing = (directFinancingMap[loc.id] || 0) + sharedPerBranchFinancing;
        const branchOtherExp = (directOtherMap[loc.id] || 0) + sharedPerBranchOther;

        const netProfit = storeOperatingProfit - sharedPerBranchHq - branchFinancing - branchOtherExp;
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
          hqSharedAllocation: sharedPerBranchHq,
          financingExpense: branchFinancing,
          otherExpense: branchOtherExp,
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

    const totalFinancing = targetRows.reduce((sum, p) => sum + p.financingExpense, 0);
    const totalOtherExp = targetRows.reduce((sum, p) => sum + p.otherExpense, 0);

    const totalNet = totalStoreProfit - totalHq - totalFinancing - totalOtherExp;

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
      totalFinancing,
      totalOtherExp,
      totalNet,
      netPct: totalRev > 0 ? Math.round((totalNet / totalRev) * 1000) / 10 : 0
    };
  }, [pnlList, selectedLocation, allVendorNames, totalHqSharedPool]);

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
      let finalExpenseName = expenseTitle.trim() || 'Pengeluaran Susulan';

      if (componentType === 'COGS_VENDOR') {
        finalExpenseName = `[COGS - ${vendorTarget}] ${expenseTitle.trim() || 'Belanja Bahan'}`;
      } else if (componentType === 'FINANCING_EXPENSE') {
        finalExpenseName = `[FINANCING] ${expenseTitle.trim() || 'Cicilan / Bunga Pinjaman'}`;
      } else if (componentType === 'OTHER_EXPENSE') {
        finalExpenseName = `[LAIN-LAIN] ${expenseTitle.trim() || 'Beban Non-Operasional'}`;
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
        notes: modalNotes.trim() || 'Input susulan di modul PnL',
        created_by: 'Owner/Admin (Modul PnL)',
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('hq_and_overhead_expenses').insert([payload]);
      if (error) throw error;

      setModalMessage({ text: 'Pengeluaran berhasil ditambahkan ke laporan!', type: 'success' });
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

  // Opsi Cetak Standar vs Lengkap Lampiran
  const triggerPrint = (includeDetails: boolean) => {
    setShowDownloadMenu(false);
    setIncludePrintDetails(includeDetails);

    const originalTitle = document.title;
    document.title = `Laporan_PnL_${includeDetails ? 'Lengkap_Detail' : 'Ringkasan'}_Bakso_Ibu_${selectedMonth}`;

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = originalTitle;
        setIncludePrintDetails(false);
      }, 2000);
    }, 150);
  };

  // Ekspor Seluruh Rincian Transaksi Bulanan ke CSV
  const handleExportFullMonthlyCsv = () => {
    setShowDownloadMenu(false);
    if (allLogs.length === 0) {
      alert('Tidak ada transaksi pada bulan ini.');
      return;
    }

    const targetLogs = selectedLocation === 'all'
      ? allLogs
      : allLogs.filter(l => l.locationId === selectedLocation || l.locationId === 'shared');

    let csvContent = 'Tipe Transaksi,Tanggal,Cabang,Pos / Vendor / Shift,Rincian / Keterangan,Pelapor,Cash (Rp),QRIS (Rp),GrabFood (Rp),GoFood (Rp),ShopeeFood (Rp),Total Nominal (Rp)\n';

    targetLogs.forEach((l) => {
      const isRev = l.componentType === 'REVENUE_TOTAL';
      const rowType = isRev ? 'PEMASUKAN OMZET' : 'PENGELUARAN / BEBAN';
      const pos = isRev ? (l.shiftName || 'Shift Kasir') : l.vendorOrChannel;
      const notesClean = (l.notes || '-').replace(/"/g, '""');

      csvContent += `"${rowType}","${l.date}","${l.locationName}","${pos}","${notesClean}","${l.reporter}","${l.cashNominal || 0}","${l.qrisNominal || 0}","${l.grabNominal || 0}","${l.gofoodNominal || 0}","${l.shopeeNominal || 0}","${l.nominal}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Semua_Rincian_PnL_Bakso_Ibu_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const drillDownLogs = useMemo(() => {
    if (!activeDrillDown) return [];

    return allLogs.filter((log) => {
      const matchLoc = activeDrillDown.targetLocationId === 'all' 
        ? true 
        : (log.locationId === activeDrillDown.targetLocationId || log.locationId === 'shared');

      if (!matchLoc) return false;

      if (activeDrillDown.componentType === 'REVENUE_TOTAL' || 
          activeDrillDown.componentType === 'REVENUE_DINE_IN' || 
          activeDrillDown.componentType === 'REVENUE_ONLINE') {
        return log.componentType === 'REVENUE_TOTAL';
      }

      if (activeDrillDown.componentType === 'COGS_VENDOR') {
        return log.componentType === 'COGS_VENDOR' && log.vendorOrChannel === activeDrillDown.vendorOrChannel;
      }

      if (activeDrillDown.componentType === 'CASHIER_EXPENSE') {
        return log.componentType === 'CASHIER_EXPENSE';
      }

      if (activeDrillDown.componentType === 'FINANCING') {
        return log.componentType === 'FINANCING';
      }

      if (activeDrillDown.componentType === 'OTHER') {
        return log.componentType === 'OTHER';
      }

      return false;
    });
  }, [allLogs, activeDrillDown]);

  const handleExportDrillDownCsv = () => {
    if (!activeDrillDown || drillDownLogs.length === 0) return;

    const isRevenue = activeDrillDown.componentType.startsWith('REVENUE');
    let csvHeader = '';
    let csvRows: string[] = [];

    if (isRevenue) {
      csvHeader = 'Tanggal,Cabang,Shift,Kasir,Cash,QRIS,Total Dine In,GrabFood,GoFood,ShopeeFood,Total Online,Total Omset Shift\n';
      csvRows = drillDownLogs.map((l) => {
        const dine = (l.cashNominal || 0) + (l.qrisNominal || 0);
        const onl = (l.grabNominal || 0) + (l.gofoodNominal || 0) + (l.shopeeNominal || 0);
        return `"${l.date}","${l.locationName}","${l.shiftName || '-'}","${l.reporter}","${l.cashNominal || 0}","${l.qrisNominal || 0}","${dine}","${l.grabNominal || 0}","${l.gofoodNominal || 0}","${l.shopeeNominal || 0}","${onl}","${l.nominal}"`;
      });
    } else {
      csvHeader = 'Tanggal,Cabang,Kategori / Vendor,Uraian / Catatan,Pelapor,Nominal (Rp)\n';
      csvRows = drillDownLogs.map((l) => {
        return `"${l.date}","${l.locationName}","${l.vendorOrChannel}","${l.notes.replace(/"/g, '""')}","${l.reporter}","${l.nominal}"`;
      });
    }

    const blob = new Blob([csvHeader + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Rincian_${activeDrillDown.title.replace(/\s+/g, '_')}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printableLogs = useMemo(() => {
    return selectedLocation === 'all'
      ? allLogs
      : allLogs.filter(l => l.locationId === selectedLocation || l.locationId === 'shared');
  }, [allLogs, selectedLocation]);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-xs space-y-6 font-sans print:p-0 print:border-none">
      
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
          .page-break {
            page-break-before: always;
          }
        }
      `}</style>

      {/* Header Cetak Formal */}
      <div className="hidden print:block print-header">
        <h1 className="text-base font-black text-slate-900 tracking-tight">
          BAKSO IBU • LAPORAN LABA RUGI EKSEKUTIF (PnL)
        </h1>
        <p className="text-[11px] text-slate-600 font-semibold mt-0.5">
          Periode Bulan: {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(`${selectedMonth}-01`))} • {selectedLocation === 'all' ? 'Konsolidasi Seluruh Cabang' : cleanLocationName(locations.find(l => l.id === selectedLocation)?.name)}
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
              Laporan Laba Rugi Eksekutif (PnL Bulanan)[cite: 10]
            </h2>
            <p className="text-xs font-medium text-slate-400">
              Klik angka nominal pada tabel di bawah untuk melihat rincian nota & transaksi harian.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs"
          >
            <PlusCircle className="w-4 h-4 text-indigo-600" />
            <span>+ Input Pengeluaran / Financing</span>[cite: 10]
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
              <option value="all">Semua Cabang (Konsolidasi)</option>[cite: 10]
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

          {/* MENU DROPDOWN DOWNLOAD DENGAN PILIHAN DETAIL */}
          <div className="relative" ref={downloadMenuRef}>
            <button
              type="button"
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20"
            >
              <FileDown className="w-4 h-4" />
              <span>Cetak / Download</span>[cite: 10]
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {showDownloadMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Pilih Format Unduhan PnL
                </div>

                <button
                  type="button"
                  onClick={() => triggerPrint(false)}
                  className="w-full text-left p-2.5 hover:bg-slate-50 rounded-xl flex items-start gap-2.5 transition-colors group"
                >
                  <Printer className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">
                      PDF Ringkasan PnL (Standar)
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Hanya tabel rangkuman laba rugi 1 halaman
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => triggerPrint(true)}
                  className="w-full text-left p-2.5 hover:bg-indigo-50 rounded-xl flex items-start gap-2.5 transition-colors group"
                >
                  <FileText className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">
                      PDF Lengkap dengan Rincian
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Tabel PnL + lampiran buku pembantu nota belanja & omzet harian
                    </div>
                  </div>
                </button>

                <div className="my-1 border-t border-slate-100"></div>

                <button
                  type="button"
                  onClick={handleExportFullMonthlyCsv}
                  className="w-full text-left p-2.5 hover:bg-emerald-50 rounded-xl flex items-start gap-2.5 transition-colors group"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">
                      Ekspor Seluruh Data (.CSV / Excel)
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Seluruh rekapan omzet kasir & belanja vendor sebulan penuh
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* METRIK KARTU RINGKASAN FINANSIAL */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 no-print">
        <div 
          onClick={() => setActiveDrillDown({
            title: 'Seluruh Pemasukan Penjualan Toko (Omzet)',
            componentType: 'REVENUE_TOTAL',
            targetLocationId: selectedLocation,
            targetLocationName: selectedLocation === 'all' ? 'Semua Cabang (Konsolidasi)' : cleanLocationName(locations.find(l => l.id === selectedLocation)?.name)
          })}
          className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100 hover:border-indigo-300 hover:bg-white cursor-pointer transition-all group"
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Total Omzet Penjualan</span>[cite: 10]
            <Eye className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 transition-colors" />
          </div>
          <div className="text-xl font-black text-slate-900 mt-1">
            Rp {consolidated.totalRev.toLocaleString('id-ID')}[cite: 10]
          </div>
          <span className="text-[10px] text-slate-500 font-semibold mt-0.5 block">
            Dine In: {consolidated.dineInPct}% • Online: {consolidated.onlinePct}%[cite: 10]
          </span>
        </div>

        <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
          <span className="text-[10px] uppercase font-black tracking-wider text-rose-500">Total Belanja Bahan (HPP)</span>[cite: 10]
          <div className="text-xl font-black text-rose-800 mt-1">
            Rp {consolidated.totalCogs.toLocaleString('id-ID')}[cite: 10]
          </div>
          <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">
            {allVendorNames.length} Vendor / Sumber Pasokan[cite: 10]
          </span>
        </div>

        <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100">
          <span className="text-[10px] uppercase font-black tracking-wider text-emerald-600">Laba Operasional Toko</span>[cite: 10]
          <div className="text-xl font-black text-emerald-800 mt-1">
            Rp {consolidated.totalStoreProfit.toLocaleString('id-ID')}[cite: 10]
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">Setelah HPP & Beban Toko</span>[cite: 10]
        </div>

        <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100">
          <span className="text-[10px] uppercase font-black tracking-wider text-indigo-600">Laba Bersih Akhir (Net)</span>[cite: 10]
          <div className="text-xl font-black text-indigo-900 mt-1">
            Rp {consolidated.totalNet.toLocaleString('id-ID')}[cite: 10]
          </div>
          <span className="text-[10px] text-indigo-600 font-bold mt-0.5 block">
            Net Margin: {consolidated.netPct}%[cite: 10]
          </span>
        </div>
      </div>

      {/* TABEL ANATOMI PnL RESMI */}
      <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <th className="py-3 px-4 min-w-[260px]">Komponen Laba Rugi (PnL)</th>[cite: 10]
              {selectedLocation === 'all' ? (
                <>
                  {pnlList.map((p) => (
                    <th key={p.locationId} className="py-3 px-3 text-right min-w-[130px]">
                      {p.locationName}[cite: 10]
                    </th>
                  ))}
                  <th className="py-3 px-4 text-right min-w-[140px] font-black bg-indigo-50 text-indigo-900">
                    KONSOLIDASI (TOTAL)[cite: 10]
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
                <tr className="bg-slate-50/60 font-black">
                  <td className="py-2.5 px-4 font-black text-slate-900 uppercase">
                    1. PENDAPATAN PENJUALAN (OMZET)[cite: 10]
                  </td>
                  {selectedLocation === 'all' ? (
                    <>
                      {pnlList.map((p) => (
                        <td 
                          key={p.locationId} 
                          onClick={() => setActiveDrillDown({
                            title: `Omzet Penjualan • ${p.locationName}`,
                            componentType: 'REVENUE_TOTAL',
                            targetLocationId: p.locationId,
                            targetLocationName: p.locationName
                          })}
                          className="py-2.5 px-3 text-right font-black text-slate-900 hover:text-indigo-600 hover:underline cursor-pointer"
                        >
                          Rp {p.revenue.toLocaleString('id-ID')}[cite: 10]
                        </td>
                      ))}
                      <td 
                        onClick={() => setActiveDrillDown({
                          title: 'Omzet Penjualan • Konsolidasi Seluruh Cabang',
                          componentType: 'REVENUE_TOTAL',
                          targetLocationId: 'all',
                          targetLocationName: 'Semua Cabang (Konsolidasi)'
                        })}
                        className="py-2.5 px-4 text-right font-black bg-indigo-50/60 text-indigo-950 hover:underline cursor-pointer"
                      >
                        Rp {consolidated.totalRev.toLocaleString('id-ID')}[cite: 10]
                      </td>
                    </>
                  ) : (
                    <td 
                      onClick={() => setActiveDrillDown({
                        title: `Omzet Penjualan • ${pnlList.find(p => p.locationId === selectedLocation)?.locationName}`,
                        componentType: 'REVENUE_TOTAL',
                        targetLocationId: selectedLocation,
                        targetLocationName: cleanLocationName(locations.find(l => l.id === selectedLocation)?.name)
                      })}
                      className="py-2.5 px-4 text-right font-black text-indigo-950 hover:underline cursor-pointer"
                    >
                      Rp {consolidated.totalRev.toLocaleString('id-ID')}
                    </td>
                  )}
                </tr>

                <tr className="text-slate-600 bg-white/50">
                  <td className="py-2 px-4 pl-8 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span className="text-[11px] font-bold">↳ Omzet Dine In (Cash + QRIS)</span>[cite: 10]
                  </td>
                  {selectedLocation === 'all' ? (
                    <>
                      {pnlList.map((p) => (
                        <td 
                          key={`dine-${p.locationId}`} 
                          onClick={() => setActiveDrillDown({
                            title: `Omzet Dine In (Cash + QRIS) • ${p.locationName}`,
                            componentType: 'REVENUE_DINE_IN',
                            targetLocationId: p.locationId,
                            targetLocationName: p.locationName
                          })}
                          className="py-2 px-3 text-right font-bold text-slate-700 text-[11px] hover:text-emerald-700 hover:underline cursor-pointer"
                        >
                          Rp {p.omsetDineIn.toLocaleString('id-ID')}[cite: 10]
                        </td>
                      ))}
                      <td 
                        onClick={() => setActiveDrillDown({
                          title: 'Omzet Dine In (Cash + QRIS) • Konsolidasi Seluruh Cabang',
                          componentType: 'REVENUE_DINE_IN',
                          targetLocationId: 'all',
                          targetLocationName: 'Semua Cabang (Konsolidasi)'
                        })}
                        className="py-2 px-4 text-right font-bold bg-indigo-50/20 text-slate-800 text-[11px] hover:underline cursor-pointer"
                      >
                        Rp {consolidated.totalDineIn.toLocaleString('id-ID')}[cite: 10]
                      </td>
                    </>
                  ) : (
                    <td 
                      onClick={() => setActiveDrillDown({
                        title: `Omzet Dine In (Cash + QRIS) • ${pnlList.find(p => p.locationId === selectedLocation)?.locationName}`,
                        componentType: 'REVENUE_DINE_IN',
                        targetLocationId: selectedLocation,
                        targetLocationName: cleanLocationName(locations.find(l => l.id === selectedLocation)?.name)
                      })}
                      className="py-2 px-4 text-right font-bold text-slate-800 text-[11px] hover:underline cursor-pointer"
                    >
                      Rp {consolidated.totalDineIn.toLocaleString('id-ID')}
                    </td>
                  )}
                </tr>

                <tr className="text-slate-600 bg-white/50 border-b border-slate-200/60">
                  <td className="py-2 px-4 pl-8 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                    <span className="text-[11px] font-bold">↳ Omzet Online (Grab / Gojek / Shopee)</span>[cite: 10]
                  </td>
                  {selectedLocation === 'all' ? (
                    <>
                      {pnlList.map((p) => (
                        <td 
                          key={`online-${p.locationId}`} 
                          onClick={() => setActiveDrillDown({
                            title: `Omzet Online (Ojol) • ${p.locationName}`,
                            componentType: 'REVENUE_ONLINE',
                            targetLocationId: p.locationId,
                            targetLocationName: p.locationName
                          })}
                          className="py-2 px-3 text-right font-bold text-orange-700 text-[11px] hover:underline cursor-pointer"
                        >
                          Rp {p.omsetOnline.toLocaleString('id-ID')}[cite: 10]
                        </td>
                      ))}
                      <td 
                        onClick={() => setActiveDrillDown({
                          title: 'Omzet Online (Ojol) • Konsolidasi Seluruh Cabang',
                          componentType: 'REVENUE_ONLINE',
                          targetLocationId: 'all',
                          targetLocationName: 'Semua Cabang (Konsolidasi)'
                        })}
                        className="py-2 px-4 text-right font-bold bg-indigo-50/20 text-orange-800 text-[11px] hover:underline cursor-pointer"
                      >
                        Rp {consolidated.totalOnline.toLocaleString('id-ID')}[cite: 10]
                      </td>
                    </>
                  ) : (
                    <td 
                      onClick={() => setActiveDrillDown({
                        title: `Omzet Online (Ojol) • ${pnlList.find(p => p.locationId === selectedLocation)?.locationName}`,
                        componentType: 'REVENUE_ONLINE',
                        targetLocationId: selectedLocation,
                        targetLocationName: cleanLocationName(locations.find(l => l.id === selectedLocation)?.name)
                      })}
                      className="py-2 px-4 text-right font-bold text-orange-800 text-[11px] hover:underline cursor-pointer"
                    >
                      Rp {consolidated.totalOnline.toLocaleString('id-ID')}
                    </td>
                  )}
                </tr>

                <tr className="bg-slate-50/20">
                  <td colSpan={selectedLocation === 'all' ? pnlList.length + 2 : 2} className="py-2 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Beban Pokok Penjualan / Bahan Masuk (HPP)[cite: 10]
                  </td>
                </tr>

                {allVendorNames.map((vendor) => {
                  const isRP = vendor === 'Rumah Produksi';
                  return (
                    <tr key={vendor} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-2 px-4 text-slate-700 pl-8 flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${isRP ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
                        <span>(-) {vendor}</span>[cite: 10]
                      </td>
                      {selectedLocation === 'all' ? (
                        <>
                          {pnlList.map((p) => {
                            const val = Number(p.vendorBreakdown[vendor] || 0);
                            return (
                              <td 
                                key={p.locationId} 
                                onClick={() => setActiveDrillDown({
                                  title: `Belanja ${vendor} • ${p.locationName}`,
                                  componentType: 'COGS_VENDOR',
                                  vendorOrChannel: vendor,
                                  targetLocationId: p.locationId,
                                  targetLocationName: p.locationName
                                })}
                                className={`py-2 px-3 text-right cursor-pointer hover:underline ${isRP ? 'text-rose-700' : 'text-amber-800'}`}
                              >
                                (Rp {val.toLocaleString('id-ID')})[cite: 10]
                              </td>
                            );
                          })}
                          <td 
                            onClick={() => setActiveDrillDown({
                              title: `Belanja ${vendor} • Konsolidasi Seluruh Cabang`,
                              componentType: 'COGS_VENDOR',
                              vendorOrChannel: vendor,
                              targetLocationId: 'all',
                              targetLocationName: 'Semua Cabang (Konsolidasi)'
                            })}
                            className={`py-2 px-4 text-right font-bold bg-indigo-50/20 cursor-pointer hover:underline ${isRP ? 'text-rose-800' : 'text-amber-900'}`}
                          >
                            (Rp {Number(consolidated.totalPerVendor[vendor] || 0).toLocaleString('id-ID')})[cite: 10]
                          </td>
                        </>
                      ) : (
                        <td 
                          onClick={() => setActiveDrillDown({
                            title: `Belanja ${vendor} • ${pnlList.find(p => p.locationId === selectedLocation)?.locationName}`,
                            componentType: 'COGS_VENDOR',
                            vendorOrChannel: vendor,
                            targetLocationId: selectedLocation,
                            targetLocationName: cleanLocationName(locations.find(l => l.id === selectedLocation)?.name)
                          })}
                          className={`py-2 px-4 text-right font-bold cursor-pointer hover:underline ${isRP ? 'text-rose-800' : 'text-amber-900'}`}
                        >
                          (Rp {Number(consolidated.totalPerVendor[vendor] || 0).toLocaleString('id-ID')})
                        </td>
                      )}
                    </tr>
                  );
                })}

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
                        <td 
                          key={p.locationId} 
                          onClick={() => setActiveDrillDown({
                            title: `Pengeluaran Kasir Laci • ${p.locationName}`,
                            componentType: 'CASHIER_EXPENSE',
                            targetLocationId: p.locationId,
                            targetLocationName: p.locationName
                          })}
                          className="py-1.5 px-3 text-right text-slate-700 cursor-pointer hover:underline"
                        >
                          (Rp {p.cashierExpenses.toLocaleString('id-ID')})
                        </td>
                      ))}
                      <td 
                        onClick={() => setActiveDrillDown({
                          title: 'Pengeluaran Kasir Laci • Konsolidasi Seluruh Cabang',
                          componentType: 'CASHIER_EXPENSE',
                          targetLocationId: 'all',
                          targetLocationName: 'Semua Cabang (Konsolidasi)'
                        })}
                        className="py-1.5 px-4 text-right text-slate-800 font-bold bg-indigo-50/20 cursor-pointer hover:underline"
                      >
                        (Rp {consolidated.totalCashierExp.toLocaleString('id-ID')})
                      </td>
                    </>
                  ) : (
                    <td 
                      onClick={() => setActiveDrillDown({
                        title: `Pengeluaran Kasir Laci • ${pnlList.find(p => p.locationId === selectedLocation)?.locationName}`,
                        componentType: 'CASHIER_EXPENSE',
                        targetLocationId: selectedLocation,
                        targetLocationName: cleanLocationName(locations.find(l => l.id === selectedLocation)?.name)
                      })}
                      className="py-1.5 px-4 text-right text-slate-800 font-bold cursor-pointer hover:underline"
                    >
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

                <tr className="bg-purple-50/40">
                  <td colSpan={selectedLocation === 'all' ? pnlList.length + 2 : 2} className="py-2 px-4 font-black text-purple-900 uppercase text-[10px] tracking-wider">
                    3. BEBAN PEMBIAYAAN (FINANCING) & PENGELUARAN LAIN-LAIN
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 px-4 text-purple-800 pl-8 flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-purple-600" />
                    <span>(-) Beban Financing & Pinjaman (Cicilan / Bunga Modal)</span>
                  </td>
                  {selectedLocation === 'all' ? (
                    <>
                      {pnlList.map((p) => (
                        <td 
                          key={p.locationId} 
                          onClick={() => setActiveDrillDown({
                            title: `Beban Financing & Pinjaman • ${p.locationName}`,
                            componentType: 'FINANCING',
                            targetLocationId: p.locationId,
                            targetLocationName: p.locationName
                          })}
                          className="py-1.5 px-3 text-right text-purple-700 font-medium cursor-pointer hover:underline"
                        >
                          (Rp {p.financingExpense.toLocaleString('id-ID')})
                        </td>
                      ))}
                      <td 
                        onClick={() => setActiveDrillDown({
                          title: 'Beban Financing & Pinjaman • Konsolidasi Seluruh Cabang',
                          componentType: 'FINANCING',
                          targetLocationId: 'all',
                          targetLocationName: 'Semua Cabang (Konsolidasi)'
                        })}
                        className="py-1.5 px-4 text-right text-purple-900 font-bold bg-purple-50/30 cursor-pointer hover:underline"
                      >
                        (Rp {consolidated.totalFinancing.toLocaleString('id-ID')})
                      </td>
                    </>
                  ) : (
                    <td 
                      onClick={() => setActiveDrillDown({
                        title: `Beban Financing & Pinjaman • ${pnlList.find(p => p.locationId === selectedLocation)?.locationName}`,
                        componentType: 'FINANCING',
                        targetLocationId: selectedLocation,
                        targetLocationName: cleanLocationName(locations.find(l => l.id === selectedLocation)?.name)
                      })}
                      className="py-1.5 px-4 text-right text-purple-900 font-bold cursor-pointer hover:underline"
                    >
                      (Rp {consolidated.totalFinancing.toLocaleString('id-ID')})
                    </td>
                  )}
                </tr>

                <tr>
                  <td className="py-1.5 px-4 text-slate-700 pl-8 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                    <span>(-) Beban Lain-Lain / Non-Operasional</span>
                  </td>
                  {selectedLocation === 'all' ? (
                    <>
                      {pnlList.map((p) => (
                        <td 
                          key={p.locationId} 
                          onClick={() => setActiveDrillDown({
                            title: `Beban Lain-Lain • ${p.locationName}`,
                            componentType: 'OTHER',
                            targetLocationId: p.locationId,
                            targetLocationName: p.locationName
                          })}
                          className="py-1.5 px-3 text-right text-slate-700 font-medium cursor-pointer hover:underline"
                        >
                          (Rp {p.otherExpense.toLocaleString('id-ID')})
                        </td>
                      ))}
                      <td 
                        onClick={() => setActiveDrillDown({
                          title: 'Beban Lain-Lain • Konsolidasi Seluruh Cabang',
                          componentType: 'OTHER',
                          targetLocationId: 'all',
                          targetLocationName: 'Semua Cabang (Konsolidasi)'
                        })}
                        className="py-1.5 px-4 text-right text-slate-900 font-bold bg-slate-100/50 cursor-pointer hover:underline"
                      >
                        (Rp {consolidated.totalOtherExp.toLocaleString('id-ID')})
                      </td>
                    </>
                  ) : (
                    <td 
                      onClick={() => setActiveDrillDown({
                        title: `Beban Lain-Lain • ${pnlList.find(p => p.locationId === selectedLocation)?.locationName}`,
                        componentType: 'OTHER',
                        targetLocationId: selectedLocation,
                        targetLocationName: cleanLocationName(locations.find(l => l.id === selectedLocation)?.name)
                      })}
                      className="py-1.5 px-4 text-right text-slate-900 font-bold cursor-pointer hover:underline"
                    >
                      (Rp {consolidated.totalOtherExp.toLocaleString('id-ID')})
                    </td>
                  )}
                </tr>

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

      {/* LAMPIRAN DOKUMEN CETAK: RINCIAN AUDIT KETIKA MEMILIH PDF LENGKAP */}
      {includePrintDetails && (
        <div className="hidden print:block page-break pt-4 space-y-6">
          <div className="border-b-2 border-slate-900 pb-2">
            <h2 className="text-sm font-black uppercase tracking-tight text-slate-900">
              LAMPIRAN 1: BUKU BESAR DETAIL TRANSAKSI OMZET & BELANJA
            </h2>
            <p className="text-[10px] text-slate-500 font-medium">
              Rincian seluruh pencatatan shift kasir, nota vendor pasar, dan input susulan periode {selectedMonth}
            </p>
          </div>

          <table className="w-full text-left text-[10px] border-collapse font-sans">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-black uppercase text-slate-700">
                <th className="py-2 px-2">Tanggal</th>
                <th className="py-2 px-2">Cabang</th>
                <th className="py-2 px-2">Pos / Kategori</th>
                <th className="py-2 px-2">Keterangan / Rincian Barang</th>
                <th className="py-2 px-2">Petugas</th>
                <th className="py-2 px-2 text-right">Nominal (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-semibold text-slate-800">
              {printableLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-1.5 px-2">{log.date}</td>
                  <td className="py-1.5 px-2">{log.locationName}</td>
                  <td className="py-1.5 px-2">{log.vendorOrChannel}</td>
                  <td className="py-1.5 px-2">{log.notes}</td>
                  <td className="py-1.5 px-2">{log.reporter}</td>
                  <td className="py-1.5 px-2 text-right font-black">
                    Rp {log.nominal.toLocaleString('id-ID')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL POPUP: DETAIL DRILL-DOWN TRANSAKSI & PEMASUKAN */}
      {activeDrillDown && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 no-print">
          <div className="bg-white w-full max-w-4xl rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col space-y-4">
            
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 gap-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  Detail Buku Pembantu PnL
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  {activeDrillDown.title}
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  {activeDrillDown.targetLocationName} • Periode Bulan: {selectedMonth} ({drillDownLogs.length} Entri Ditemukan)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportDrillDownCsv}
                  disabled={drillDownLogs.length === 0}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-40"
                  title="Unduh Spreadsheet Data"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                </button>
                <button 
                  onClick={() => setActiveDrillDown(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Total Agregat Modal */}
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Total Akumulasi Transaksi:</span>
              <span className="text-base font-black text-indigo-900">
                Rp {drillDownLogs.reduce((sum, item) => sum + (activeDrillDown.componentType === 'REVENUE_DINE_IN' ? ((item.cashNominal || 0) + (item.qrisNominal || 0)) : activeDrillDown.componentType === 'REVENUE_ONLINE' ? ((item.grabNominal || 0) + (item.gofoodNominal || 0) + (item.shopeeNominal || 0)) : item.nominal), 0).toLocaleString('id-ID')}
              </span>
            </div>

            {/* TABEL DETAIL TRANSAKSI */}
            <div className="flex-1 overflow-y-auto border border-slate-100 rounded-2xl shadow-2xs">
              {activeDrillDown.componentType.startsWith('REVENUE') ? (
                <table className="w-full text-left text-xs border-collapse font-sans">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">Tanggal & Shift</th>
                      <th className="py-2.5 px-3">Cabang</th>
                      <th className="py-2.5 px-3 text-right bg-emerald-50/50 text-emerald-800">Dine In (Cash + QRIS)</th>
                      <th className="py-2.5 px-3 text-right bg-orange-50/50 text-orange-800">Online (Grab+Gojek+Shopee)</th>
                      <th className="py-2.5 px-3 text-right font-black">Total Shift</th>
                      <th className="py-2.5 px-3">Kasir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {drillDownLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                          Tidak ada rekaman transaksi kasir pada periode ini.
                        </td>
                      </tr>
                    ) : (
                      drillDownLogs.map((log) => {
                        const dineInTotal = (log.cashNominal || 0) + (log.qrisNominal || 0);
                        const onlineTotal = (log.grabNominal || 0) + (log.gofoodNominal || 0) + (log.shopeeNominal || 0);
                        return (
                          <tr key={log.id} className="hover:bg-slate-50/80">
                            <td className="py-2 px-3">
                              <span className="font-bold text-slate-900 block">{log.date}</span>
                              <span className="text-[10px] text-slate-400 font-normal">{log.shiftName}</span>
                            </td>
                            <td className="py-2 px-3 text-slate-800">{log.locationName}</td>
                            <td className="py-2 px-3 text-right text-emerald-700 bg-emerald-50/20">
                              <span className="font-bold">Rp {dineInTotal.toLocaleString('id-ID')}</span>
                              <span className="block text-[9px] text-slate-400 font-normal">
                                Cash: {log.cashNominal?.toLocaleString('id-ID')} | QRIS: {log.qrisNominal?.toLocaleString('id-ID')}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right text-orange-700 bg-orange-50/20">
                              <span className="font-bold">Rp {onlineTotal.toLocaleString('id-ID')}</span>
                              <span className="block text-[9px] text-slate-400 font-normal">
                                G: {log.grabNominal?.toLocaleString('id-ID')} | Go: {log.gofoodNominal?.toLocaleString('id-ID')} | Sh: {log.shopeeNominal?.toLocaleString('id-ID')}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-black text-slate-900">
                              Rp {log.nominal.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-3 text-slate-500 text-[11px]">{log.reporter}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-xs border-collapse font-sans">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">Tanggal & Cabang</th>
                      <th className="py-2.5 px-3">Uraian Transaksi / Catatan Nota</th>
                      <th className="py-2.5 px-3">Pelapor / Sumber</th>
                      <th className="py-2.5 px-3 text-right text-rose-700">Nominal Beban (Rp)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {drillDownLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-slate-400 font-bold">
                          Tidak ada rincian nota pengeluaran pada komponen ini.
                        </td>
                      </tr>
                    ) : (
                      drillDownLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/80">
                          <td className="py-2 px-3">
                            <span className="font-bold text-slate-900 block">{log.date}</span>
                            <span className="text-[10px] text-slate-400 font-normal">{log.locationName}</span>
                          </td>
                          <td className="py-2 px-3 text-slate-800 font-bold">{log.notes}</td>
                          <td className="py-2 px-3 text-slate-400 text-[11px]">{log.reporter}</td>
                          <td className="py-2 px-3 text-right font-black text-rose-800">
                            Rp {log.nominal.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setActiveDrillDown(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 no-print">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Input Pengeluaran Susulan & Financing</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Beban pinjaman, bunga modal, atau non-operasional</p>
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

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">
                  2. Kategori Komponen Beban (PnL)
                </label>
                <select
                  value={componentType}
                  onChange={(e: any) => setComponentType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                >
                  <option value="FINANCING_EXPENSE">🏦 Financing / Cicilan & Bunga Pinjaman Modal</option>
                  <option value="OTHER_EXPENSE">📦 Beban Lain-Lain / Non-Operasional</option>
                  <option value="COGS_VENDOR">🛒 HPP / Belanja Bahan (Masuk ke Baris Vendor)</option>
                  <option value="STORE_OPEX">🏬 Beban Operasional Toko (Direct OPEX)</option>
                  <option value="STORE_UTILITY">⚡ Utilitas Toko (Listrik / WiFi Transfer Bank)</option>
                </select>
              </div>

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

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">
                  Nama / Uraian Beban
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    componentType === 'FINANCING_EXPENSE' 
                      ? 'Contoh: Bunga Pinjaman Bank Mandiri / Cicilan KUR Nov 2026'
                      : 'Contoh: Pajak Daerah, Denda, Administrasi'
                  }
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>

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

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">
                  Keterangan / Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Misal: Nomor kontrak / referensi transfer bank..."
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