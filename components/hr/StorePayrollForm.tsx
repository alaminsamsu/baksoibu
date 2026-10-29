'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Users, 
  Store, 
  Calendar, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  DollarSign,
  Award,
  MinusCircle,
  HelpCircle
} from 'lucide-react';

interface StaffPayrollRow {
  staff_name: string;
  role: string;
  days_worked: number;
  daily_rate: number;
  base_salary: number;
  bonus_omzet: number;
  bonus_performance: number;
  deduction_late: number;
  deduction_kasbon: number;
  total_net: number;
  notes: string;
  is_saved: boolean;
}

export default function StorePayrollForm() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  
  const getCurrentMonthStr = () => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date()).substring(0, 7);
  };

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());
  const [payrollRows, setPayrollRows] = useState<StaffPayrollRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('baksoibu_active_staff');
    if (saved) {
      try {
        setCurrentUser(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const cleanLocationName = (name?: string) => {
    if (!name) return 'Outlet';
    return `Outlet ${name.replace(/^outlet\s+/i, '').trim()}`;
  };

  // 1. Ambil daftar cabang outlet
  useEffect(() => {
    async function fetchLocations() {
      const { data } = await supabase.from('locations').select('id, name').order('name');
      if (data && data.length > 0) {
        setLocations(data);
        if (!selectedLocation) {
          setSelectedLocation(String(data[0].id));
        }
      }
    }
    fetchLocations();
  }, []);

  // 2. Tarik daftar kru & hitung hari masuk dari closing/presensi
  const loadPayrollData = async () => {
    if (!selectedLocation) return;
    setLoading(true);
    setMessage(null);

    try {
      // Ambil data yang sudah pernah disimpan di store_payroll untuk periode ini
      const { data: existingRecords } = await supabase
        .from('store_payroll')
        .select('*')
        .eq('period_month', selectedMonth)
        .eq('location_id', selectedLocation);

      const existingMap = new Map();
      (existingRecords || []).forEach((r) => {
        existingMap.set(r.staff_name.toUpperCase(), r);
      });

      // Ambil akumulasi hari masuk riil dari daily_closings pada bulan terkait
      const startDate = `${selectedMonth}-01`;
      const endDate = `${selectedMonth}-31`;

      const { data: attendanceData } = await supabase
        .from('daily_closings')
        .select('reported_by, closing_date')
        .eq('location_id', selectedLocation)
        .gte('closing_date', startDate)
        .lte('closing_date', endDate);

      // Hitung hari unik kerja tiap staf
      const workDaysMap = new Map<string, Set<string>>();
      (attendanceData || []).forEach((att) => {
        const staff = (att.reported_by || '').trim().toUpperCase();
        if (staff && !staff.includes('SISTEM') && !staff.includes('KOREKSI')) {
          if (!workDaysMap.has(staff)) {
            workDaysMap.set(staff, new Set());
          }
          workDaysMap.get(staff)?.add(att.closing_date);
        }
      });

      // Ambil master user/staff cabang jika ada
      const { data: staffUsers } = await supabase
        .from('users')
        .select('username, active_staff_name, role_name, location_id')
        .eq('location_id', selectedLocation);

      const staffList = new Set<string>();
      (staffUsers || []).forEach((u) => {
        const name = (u.active_staff_name || u.username || '').trim().toUpperCase();
        if (name) staffList.add(name);
      });
      workDaysMap.forEach((_, staff) => staffList.add(staff));
      existingMap.forEach((_, staff) => staffList.add(staff));

      // Susun baris penggajian
      const rows: StaffPayrollRow[] = Array.from(staffList).map((staffName) => {
        const exist = existingMap.get(staffName);
        const daysFromAttendance = workDaysMap.get(staffName)?.size || 0;
        const daysWorked = exist ? exist.days_worked : daysFromAttendance;
        const dailyRate = exist ? Number(exist.daily_rate) : 0;
        const baseSalary = exist ? Number(exist.base_salary) : (daysWorked * dailyRate);
        const bonusOmzet = exist ? Number(exist.bonus_omzet) : 0;
        const bonusPerf = exist ? Number(exist.bonus_performance) : 0;
        const dLate = exist ? Number(exist.deduction_late) : 0;
        const dKasbon = exist ? Number(exist.deduction_kasbon) : 0;
        
        const totalNet = exist 
          ? Number(exist.total_net_salary) 
          : Math.max(0, (baseSalary + bonusOmzet + bonusPerf) - dLate - dKasbon);

        return {
          staff_name: staffName,
          role: exist?.role || 'CREW',
          days_worked: daysWorked,
          daily_rate: dailyRate,
          base_salary: baseSalary,
          bonus_omzet: bonusOmzet,
          bonus_performance: bonusPerf,
          deduction_late: dLate,
          deduction_kasbon: dKasbon,
          total_net: totalNet,
          notes: exist?.notes || '',
          is_saved: !!exist
        };
      });

      rows.sort((a, b) => a.staff_name.localeCompare(b.staff_name));
      setPayrollRows(rows);
    } catch (err: any) {
      console.error('Gagal mengambil data payroll:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayrollData();
  }, [selectedLocation, selectedMonth]);

  // Handler update nilai form secara otomatis
  const handleValueChange = (index: number, field: keyof StaffPayrollRow, val: any) => {
    setPayrollRows((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: val };

      // Kalkulasi ulang total
      if (['days_worked', 'daily_rate', 'base_salary', 'bonus_omzet', 'bonus_performance', 'deduction_late', 'deduction_kasbon'].includes(field)) {
        const days = Number(item.days_worked) || 0;
        const rate = Number(item.daily_rate) || 0;
        
        if (field === 'days_worked' || field === 'daily_rate') {
          item.base_salary = days * rate;
        }

        const earnings = Number(item.base_salary || 0) + Number(item.bonus_omzet || 0) + Number(item.bonus_performance || 0);
        const deductions = Number(item.deduction_late || 0) + Number(item.deduction_kasbon || 0);
        item.total_net = Math.max(0, earnings - deductions);
      }

      next[index] = item;
      return next;
    });
  };

  // Simpan Penggajian Cabang
  const handleSavePayroll = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const submitter = currentUser?.active_staff_name || currentUser?.username || 'HR Officer';
      const payloads = payrollRows.map((r) => ({
        period_month: selectedMonth,
        location_id: selectedLocation,
        staff_name: r.staff_name,
        role: r.role,
        days_worked: Number(r.days_worked || 0),
        daily_rate: Number(r.daily_rate || 0),
        base_salary: Number(r.base_salary || 0),
        bonus_omzet: Number(r.bonus_omzet || 0),
        bonus_performance: Number(r.bonus_performance || 0),
        deduction_late: Number(r.deduction_late || 0),
        deduction_kasbon: Number(r.deduction_kasbon || 0),
        total_net_salary: Number(r.total_net || 0),
        notes: r.notes?.trim() || null,
        submitted_by: submitter,
        payment_status: 'PAID',
        payment_date: new Date().toISOString().substring(0, 10),
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('store_payroll')
        .upsert(payloads, { onConflict: 'period_month,location_id,staff_name' });

      if (error) throw error;

      setMessage({
        text: `Data penggajian berhasil disimpan untuk periode ${selectedMonth}! (${payloads.length} staf terdata)`,
        type: 'success'
      });

      await loadPayrollData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menyimpan payroll.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const totalPayrollCabang = useMemo(() => {
    return payrollRows.reduce((sum, r) => sum + Number(r.total_net || 0), 0);
  }, [payrollRows]);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-xs space-y-6 font-sans">
      
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              Input Penggajian & Bonus Kru Cabang
            </h2>
            <p className="text-xs font-medium text-slate-400">
              Khusus diinput oleh HR. Total otomatis masuk ke pengeluaran langsung cabang terkait.
            </p>
          </div>
        </div>

        {/* Filter Periode & Cabang */}
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
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {cleanLocationName(loc.name)}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={loadPayrollData}
            className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-500"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Ringkasan Beban Gaji Cabang */}
      <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <span className="text-[10px] uppercase font-black tracking-wider text-indigo-500">
            Total Beban Gaji & Bonus ({cleanLocationName(locations.find(l => String(l.id) === selectedLocation)?.name)})
          </span>
          <div className="text-xl font-black text-indigo-900 mt-0.5">
            Rp {totalPayrollCabang.toLocaleString('id-ID')}
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-500 font-semibold">
          {payrollRows.length} Orang Karyawan Tercatat
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

      {/* Tabel Input Penggajian */}
      <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto max-h-[34rem] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 sticky top-0 border-b border-slate-100 z-10 backdrop-blur-xs">
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 min-w-[150px]">Nama Kru</th>
                <th className="py-3 px-2 text-center w-24">Hari Masuk</th>
                <th className="py-3 px-2 text-right min-w-[110px]">Upah/Hari (Rp)</th>
                <th className="py-3 px-2 text-right min-w-[110px]">Gaji Pokok (Rp)</th>
                <th className="py-3 px-2 text-right min-w-[100px] text-emerald-600">Bonus Omzet (Rp)</th>
                <th className="py-3 px-2 text-right min-w-[90px] text-rose-600">Kasbon / Pot. (Rp)</th>
                <th className="py-3 px-4 text-right min-w-[130px] font-black text-indigo-900 bg-indigo-50/60">Gaji Bersih (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400 font-bold">
                    Memuat data kehadiran & slip kru...
                  </td>
                </tr>
              ) : payrollRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400 font-bold">
                    Belum ada data kru terdaftar untuk cabang ini pada periode {selectedMonth}.
                  </td>
                </tr>
              ) : (
                payrollRows.map((row, idx) => (
                  <tr key={row.staff_name} className="hover:bg-slate-50/60 transition-colors">
                    {/* Nama Kru & Role */}
                    <td className="py-2.5 px-4 font-black text-slate-900 uppercase">
                      <div className="flex items-center gap-1.5">
                        <span>{row.staff_name}</span>
                        {row.is_saved && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                            Tersimpan
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal">Role: {row.role}</span>
                    </td>

                    {/* Hari Masuk */}
                    <td className="py-2 px-2 text-center">
                      <input
                        type="number"
                        min="0"
                        value={row.days_worked}
                        onChange={(e) => handleValueChange(idx, 'days_worked', parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 text-center bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                      />
                    </td>

                    {/* Upah Per Hari */}
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        step="1000"
                        min="0"
                        value={row.daily_rate}
                        onChange={(e) => handleValueChange(idx, 'daily_rate', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 text-right bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                        placeholder="0"
                      />
                    </td>

                    {/* Gaji Pokok (Bisa Ditimpa Manual) */}
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        step="5000"
                        min="0"
                        value={row.base_salary}
                        onChange={(e) => handleValueChange(idx, 'base_salary', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 text-right bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                      />
                    </td>

                    {/* Bonus Target Omzet */}
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        step="5000"
                        min="0"
                        value={row.bonus_omzet}
                        onChange={(e) => handleValueChange(idx, 'bonus_omzet', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 text-right bg-emerald-50/60 border border-emerald-200 rounded-lg font-bold text-emerald-800 focus:outline-none focus:border-emerald-500"
                        placeholder="0"
                      />
                    </td>

                    {/* Potongan Kasbon */}
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        step="5000"
                        min="0"
                        value={row.deduction_kasbon}
                        onChange={(e) => handleValueChange(idx, 'deduction_kasbon', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 text-right bg-rose-50/60 border border-rose-200 rounded-lg font-bold text-rose-800 focus:outline-none focus:border-rose-500"
                        placeholder="0"
                      />
                    </td>

                    {/* Gaji Bersih */}
                    <td className="py-2 px-4 text-right bg-indigo-50/30 font-black text-indigo-900 text-sm">
                      Rp {Number(row.total_net || 0).toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSavePayroll}
        disabled={saving || payrollRows.length === 0}
        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
      >
        <Save className="w-4 h-4" />
        <span>{saving ? 'Menyimpan Penggajian...' : `Simpan Penggajian Cabang (${payrollRows.length} Staf)`}</span>
      </button>

    </div>
  );
}