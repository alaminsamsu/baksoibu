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
  Gift, 
  CheckSquare, 
  Square 
} from 'lucide-react';

interface StaffPayrollRow {
  staff_name: string;
  role: string;
  is_selected: boolean;
  days_worked: number;
  take_home_pay: number;
  bonus_nominal: number;
  notes: string;
  is_saved: boolean;
}

export default function StorePayrollForm() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  
  // Tipe Siklus: 'GAJI' (Tgl 28 Bulan Berjalan) atau 'BONUS' (Tgl 5 Bulan Berikutnya)
  const [disbursementType, setDisbursementType] = useState<'GAJI' | 'BONUS'>('GAJI');

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

  // 2. Tarik daftar kru & hari masuk murni dari tabel presensi HR (staff_attendances)
  const loadPayrollData = async () => {
    if (!selectedLocation) return;
    setLoading(true);
    setMessage(null);

    try {
      // Ambil data yang sudah pernah disimpan di store_payroll untuk siklus ini
      const { data: existingRecords } = await supabase
        .from('store_payroll')
        .select('*')
        .eq('period_month', selectedMonth)
        .eq('location_id', selectedLocation)
        .eq('disbursement_type', disbursementType);

      const existingMap = new Map();
      (existingRecords || []).forEach((r) => {
        existingMap.set(r.staff_name.toUpperCase(), r);
      });

      // TARIK DARI DATABASE HR: staff_attendances
      const [year, month] = selectedMonth.split('-');
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const startDate = `${selectedMonth}-01`;
      const endDate = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

      const { data: attendanceData, error: attError } = await supabase
        .from('staff_attendances')
        .select('staff_name, role, attendance_date, location_id')
        .eq('location_id', selectedLocation)
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate);

      if (attError) throw attError;

      // Hitung total kehadiran unik per kru dan catat jabatannya dari DB HR
      const workDaysMap = new Map<string, Set<string>>();
      const staffRoleMap = new Map<string, string>();

      (attendanceData || []).forEach((att) => {
        const staff = (att.staff_name || '').trim().toUpperCase();
        if (staff && !staff.includes('SISTEM') && !staff.includes('ADMIN') && att.role !== 'HR') {
          if (!workDaysMap.has(staff)) {
            workDaysMap.set(staff, new Set());
          }
          if (att.attendance_date) {
            workDaysMap.get(staff)?.add(att.attendance_date);
          }
          if (att.role && !staffRoleMap.has(staff)) {
            staffRoleMap.set(staff, att.role);
          }
        }
      });

      // Gabungkan nama kru presensi HR dengan yang sudah tersimpan
      const allStaffNames = new Set<string>();
      workDaysMap.forEach((_, staff) => allStaffNames.add(staff));
      existingMap.forEach((_, staff) => allStaffNames.add(staff));

      // Susun baris penggajian
      const rows: StaffPayrollRow[] = Array.from(allStaffNames).map((staffName) => {
        const exist = existingMap.get(staffName);
        const daysFromHRDB = workDaysMap.get(staffName)?.size || 0;
        
        const daysWorked = exist ? exist.days_worked : daysFromHRDB;
        const thp = exist ? Number(exist.total_net_salary || 0) : 0;
        const bonus = exist ? Number(exist.bonus_omzet || 0) : 0;
        const role = exist?.role || staffRoleMap.get(staffName) || 'CREW';

        // Default centang:
        // - GAJI (Tgl 28): Otomatis centang jika punya presensi bulan berjalan
        // - BONUS (Tgl 5): Default false, HR centang siapa saja yang berhak
        const isSelected = exist ? true : (disbursementType === 'GAJI' ? daysFromHRDB > 0 : false);

        return {
          staff_name: staffName,
          role: role,
          is_selected: isSelected,
          days_worked: daysWorked,
          take_home_pay: thp,
          bonus_nominal: bonus,
          notes: exist?.notes || '',
          is_saved: !!exist
        };
      });

      rows.sort((a, b) => a.staff_name.localeCompare(b.staff_name));
      setPayrollRows(rows);
    } catch (err: any) {
      console.error('Gagal mengambil data presensi HR:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayrollData();
  }, [selectedLocation, selectedMonth, disbursementType]);

  const handleToggleSelect = (index: number) => {
    setPayrollRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], is_selected: !next[index].is_selected };
      return next;
    });
  };

  const handleValueChange = (index: number, field: keyof StaffPayrollRow, val: any) => {
    setPayrollRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  // Simpan data ke store_payroll
  const handleSavePayroll = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const submitter = currentUser?.active_staff_name || currentUser?.username || 'HR Officer';
      const targetRows = payrollRows.filter((r) => r.is_selected);

      if (targetRows.length === 0) {
        throw new Error('Pilih minimal satu staf yang akan dicairkan.');
      }

      const payloads = targetRows.map((r) => {
        const isGaji = disbursementType === 'GAJI';
        const totalNet = isGaji ? Number(r.take_home_pay || 0) : Number(r.bonus_nominal || 0);

        return {
          period_month: selectedMonth,
          location_id: selectedLocation,
          staff_name: r.staff_name,
          role: r.role,
          disbursement_type: disbursementType,
          days_worked: isGaji ? Number(r.days_worked || 0) : 0,
          daily_rate: 0,
          base_salary: isGaji ? Number(r.take_home_pay || 0) : 0,
          bonus_omzet: !isGaji ? Number(r.bonus_nominal || 0) : 0,
          bonus_performance: 0,
          deduction_late: 0,
          deduction_kasbon: 0,
          total_net_salary: totalNet,
          notes: r.notes?.trim() || null,
          submitted_by: submitter,
          payment_status: 'PAID',
          // Tgl 28 untuk Gaji, Tgl 05 untuk Bonus
          payment_date: isGaji ? `${selectedMonth}-28` : `${selectedMonth}-05`,
          updated_at: new Date().toISOString()
        };
      });

      const { error } = await supabase
        .from('store_payroll')
        .upsert(payloads, { onConflict: 'period_month,location_id,staff_name,disbursement_type' });

      if (error) throw error;

      setMessage({
        text: `Berhasil menyimpan data ${disbursementType === 'GAJI' ? 'Gaji Kru (Tgl 28)' : 'Bonus Kru (Tgl 5)'}! (${payloads.length} kru tersimpan)`,
        type: 'success'
      });

      await loadPayrollData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menyimpan data.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const totalNominalTerpilih = useMemo(() => {
    return payrollRows
      .filter((r) => r.is_selected)
      .reduce((sum, r) => sum + (disbursementType === 'GAJI' ? Number(r.take_home_pay || 0) : Number(r.bonus_nominal || 0)), 0);
  }, [payrollRows, disbursementType]);

  const jumlahKruTerpilih = useMemo(() => {
    return payrollRows.filter((r) => r.is_selected).length;
  }, [payrollRows]);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-xs space-y-6 font-sans">
      
      {/* Header Utama Form */}
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
              Presensi ditarik dari DB HR (<code className="text-indigo-600 font-bold">staff_attendances</code>). Gaji per Tgl 28 & Bonus per Tgl 5.
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
            title="Segarkan Data Presensi HR"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* PILIHAN 2 SIKLUS: TGL 28 & TGL 5 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setDisbursementType('GAJI')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            disbursementType === 'GAJI'
              ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-500/20'
              : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-xs text-indigo-950">
              <DollarSign className="w-4 h-4 text-indigo-600" />
              <span>1. Penggajian Pokok (Setiap Tanggal 28)</span>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
              Bulan Berjalan
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium leading-relaxed">
            Menampilkan kru yang hadir di DB presensi bulan ini. Cukup input <b>Take Home Pay (THP)</b>. Kru resign hari masuknya otomatis sesuai absensi terakhir.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setDisbursementType('BONUS')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            disbursementType === 'BONUS'
              ? 'bg-amber-50/70 border-amber-500 ring-2 ring-amber-500/20'
              : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-xs text-amber-950">
              <Gift className="w-4 h-4 text-amber-600" />
              <span>2. Bonus Cabang (Setiap Tanggal 5)</span>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">
              Bulan Berikutnya
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium leading-relaxed">
            Hanya input <b>Nominal Bonus</b> untuk kru yang berhak. Kru yang resign atau tidak lolos kualifikasi cukup dinonaktifkan centangnya.
          </p>
        </button>
      </div>

      {/* Ringkasan Total Pencairan */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 ${
        disbursementType === 'GAJI' 
          ? 'bg-indigo-50/50 border-indigo-100' 
          : 'bg-amber-50/50 border-amber-100'
      }`}>
        <div>
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-500">
            Total {disbursementType === 'GAJI' ? 'Penggajian THP (Tgl 28)' : 'Bonus Kru (Tgl 5)'} ({cleanLocationName(locations.find(l => String(l.id) === selectedLocation)?.name)})
          </span>
          <div className={`text-xl font-black mt-0.5 ${disbursementType === 'GAJI' ? 'text-indigo-950' : 'text-amber-900'}`}>
            Rp {totalNominalTerpilih.toLocaleString('id-ID')}
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-600 font-bold">
          {jumlahKruTerpilih} dari {payrollRows.length} Kru Dicentang untuk Dicairkan
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

      {/* TABEL FORM INPUT */}
      <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto max-h-[34rem] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 sticky top-0 border-b border-slate-100 z-10 backdrop-blur-xs">
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3 text-center w-12">Pilih</th>
                <th className="py-3 px-4 min-w-[180px]">Nama Kru & Jabatan</th>
                
                {disbursementType === 'GAJI' ? (
                  <>
                    <th className="py-3 px-3 text-center w-32">Hari Masuk (Presensi HR)</th>
                    <th className="py-3 px-4 text-right min-w-[160px] font-black text-indigo-900 bg-indigo-50/50">
                      Take Home Pay (THP) Bersih (Rp)
                    </th>
                  </>
                ) : (
                  <th className="py-3 px-4 text-right min-w-[160px] font-black text-amber-900 bg-amber-50/50">
                    Nominal Bonus (Rp)
                  </th>
                )}
                
                <th className="py-3 px-4 min-w-[160px]">Catatan / Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={disbursementType === 'GAJI' ? 5 : 4} className="py-16 text-center text-slate-400 font-bold">
                    Mengambil rekapan presensi staf dari database HR...
                  </td>
                </tr>
              ) : payrollRows.length === 0 ? (
                <tr>
                  <td colSpan={disbursementType === 'GAJI' ? 5 : 4} className="py-16 text-center text-slate-400 font-bold">
                    Belum ada presensi staf tercatat di database HR untuk cabang ini pada periode {selectedMonth}.
                  </td>
                </tr>
              ) : (
                payrollRows.map((row, idx) => (
                  <tr 
                    key={row.staff_name} 
                    className={`transition-colors ${row.is_selected ? 'bg-white hover:bg-slate-50/60' : 'bg-slate-50/40 opacity-50'}`}
                  >
                    {/* Centang Penerima */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleSelect(idx)}
                        className="text-slate-500 hover:text-indigo-600 transition-colors"
                        title={row.is_selected ? "Batalkan Pencairan" : "Sertakan Kru Ini"}
                      >
                        {row.is_selected ? (
                          <CheckSquare className="w-5 h-5 text-indigo-600 inline" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-300 inline" />
                        )}
                      </button>
                    </td>

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

                    {/* SIKLUS 1: GAJI (Tgl 28) */}
                    {disbursementType === 'GAJI' && (
                      <>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            disabled={!row.is_selected}
                            value={row.days_worked}
                            onChange={(e) => handleValueChange(idx, 'days_worked', parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1.5 text-center bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </td>

                        <td className="py-2 px-4 text-right bg-indigo-50/20">
                          <input
                            type="number"
                            step="10000"
                            min="0"
                            disabled={!row.is_selected}
                            value={row.take_home_pay}
                            onChange={(e) => handleValueChange(idx, 'take_home_pay', parseFloat(e.target.value) || 0)}
                            className="w-36 px-3 py-1.5 text-right bg-white border border-indigo-200 rounded-xl font-black text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400"
                            placeholder="0"
                          />
                        </td>
                      </>
                    )}

                    {/* SIKLUS 2: BONUS (Tgl 5) */}
                    {disbursementType === 'BONUS' && (
                      <td className="py-2 px-4 text-right bg-amber-50/20">
                        <input
                          type="number"
                          step="10000"
                          min="0"
                          disabled={!row.is_selected}
                          value={row.bonus_nominal}
                          onChange={(e) => handleValueChange(idx, 'bonus_nominal', parseFloat(e.target.value) || 0)}
                          className="w-36 px-3 py-1.5 text-right bg-white border border-amber-200 rounded-xl font-black text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400"
                          placeholder="0"
                        />
                      </td>
                    )}

                    {/* Catatan / Keterangan */}
                    <td className="py-2 px-4">
                      <input
                        type="text"
                        disabled={!row.is_selected}
                        value={row.notes}
                        onChange={(e) => handleValueChange(idx, 'notes', e.target.value)}
                        placeholder="Contoh: Resign tgl 14 / Bonus target..."
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-300"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tombol Simpan */}
      <button
        type="button"
        onClick={handleSavePayroll}
        disabled={saving || jumlahKruTerpilih === 0}
        className={`w-full py-3.5 text-white font-black text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-40 ${
          disbursementType === 'GAJI'
            ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25'
            : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/25'
        }`}
      >
        <Save className="w-4 h-4" />
        <span>
          {saving 
            ? 'Menyimpan...' 
            : `Simpan Data ${disbursementType === 'GAJI' ? 'Gaji THP (Tgl 28)' : 'Bonus Kru (Tgl 5)'} (${jumlahKruTerpilih} Kru Terpilih)`}
        </span>
      </button>

    </div>
  );
}