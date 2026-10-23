'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  FileSpreadsheet, 
  Download, 
  Calendar, 
  MapPin, 
  RefreshCw, 
  Users, 
  CheckCircle2, 
  Clock, 
  Building2 
} from 'lucide-react';

interface Props {
  user?: any;
}

export default function StaffAttendanceExport({ user }: Props) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

  const [selectedMonth, setSelectedMonth] = useState<string>(`${currentYear}-${currentMonth}`);
  const [selectedLoc, setSelectedLoc] = useState<string>('all');
  const [locations, setLocations] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function fetchLocations() {
      const { data } = await supabase.from('locations').select('id, name');
      if (data) setLocations(data);
    }
    fetchLocations();
  }, []);

  const fetchMonthlyAttendance = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const startDate = `${selectedMonth}-01`;
      const endDate = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

      // Query sesuai skema tabel staff_attendances Anda
      let query = supabase
        .from('staff_attendances')
        .select(`
          id,
          staff_name,
          role,
          shift,
          attendance_date,
          clock_in,
          clock_out,
          location_id,
          locations(name)
        `)
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate)
        .order('attendance_date', { ascending: false });

      if (selectedLoc !== 'all') {
        query = query.eq('location_id', selectedLoc);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAttendanceData(data || []);
    } catch (err: any) {
      console.error('Gagal mengambil histori presensi:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyAttendance();
  }, [selectedMonth, selectedLoc]);

  // Hitung durasi kerja dalam format "X jam Y mnt"
  const getWorkDuration = (inTimeStr?: string, outTimeStr?: string) => {
    if (!inTimeStr || !outTimeStr) return '-';
    const start = new Date(inTimeStr).getTime();
    const end = new Date(outTimeStr).getTime();
    const diffMs = end - start;
    if (diffMs <= 0) return '-';

    const diffMins = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}j ${mins}m`;
  };

  // Format jam WITA (HH:mm)
  const formatTimeWita = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Makassar',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(new Date(isoString));
    } catch {
      return '-';
    }
  };

  // Statistik Ringkas
  const totalRecords = attendanceData.length;
  const sudahCheckoutCount = attendanceData.filter((a) => !!a.clock_out).length;
  const belumCheckoutCount = totalRecords - sudahCheckoutCount;

  // Ekspor Excel / CSV
  const handleDownloadCSV = () => {
    if (attendanceData.length === 0) {
      alert('Tidak ada data presensi pada bulan ini.');
      return;
    }

    setDownloading(true);
    try {
      const locLabel = selectedLoc === 'all' 
        ? 'Semua_Outlet' 
        : locations.find((l) => l.id === selectedLoc)?.name || 'Cabang';

      const headers = [
        'Tanggal',
        'Nama Staf',
        'Jabatan / Posisi',
        'Shift',
        'Outlet Cabang',
        'Jam Masuk (Clock-in)',
        'Jam Pulang (Clock-out)',
        'Durasi Kerja',
        'Status Selesai'
      ];

      const rows = attendanceData.map((row) => {
        const outletName = row.locations?.name ? `Outlet ${row.locations.name}` : '-';
        const inWita = formatTimeWita(row.clock_in);
        const outWita = formatTimeWita(row.clock_out);
        const duration = getWorkDuration(row.clock_in, row.clock_out);
        const shiftLabel = row.shift === 'SHIFT_2' ? 'Shift 2 (Malam)' : row.shift === 'FULL_DAY' ? 'Full Day' : 'Shift 1 (Siang)';
        const statusSelesai = row.clock_out ? 'SELESAI (SUDAH CHECKOUT)' : 'BELUM CHECKOUT';

        return [
          `"${row.attendance_date}"`,
          `"${row.staff_name}"`,
          `"${row.role || 'Kru'}"`,
          `"${shiftLabel}"`,
          `"${outletName}"`,
          `"${inWita}"`,
          `"${outWita}"`,
          `"${duration}"`,
          `"${statusSelesai}"`
        ].join(';');
      });

      const csvContent = [headers.join(';'), ...rows].join('\r\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Histori_Absensi_SDM_${locLabel}_${selectedMonth}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-xs space-y-6 font-sans">
      {/* Header Widget */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-xs">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              Histori & Unduh Presensi Bulanan SDM
            </h2>
            <p className="text-xs font-medium text-slate-400">
              Rekap absensi masuk & pulang seluruh kru outlet untuk arsip HR dan payroll.
            </p>
          </div>
        </div>

        {/* Tombol Ekspor CSV */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchMonthlyAttendance}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl border border-slate-200 transition-all"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleDownloadCSV}
            disabled={downloading || loading || attendanceData.length === 0}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-sm shadow-emerald-600/20 transition-all shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? 'Mengekspor...' : 'Unduh Rekap Bulanan (.CSV)'}</span>
          </button>
        </div>
      </div>

      {/* Filter: Periode Bulan & Outlet */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" /> Pilih Periode Bulan
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400" /> Filter Cabang Outlet
          </label>
          <select
            value={selectedLoc}
            onChange={(e) => setSelectedLoc(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none"
          >
            <option value="all">Semua Cabang Outlet</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                Outlet {loc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Kartu Ringkasan Statistik */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
          <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Total Kehadiran
          </span>
          <span className="text-xl font-black text-slate-900 mt-1 block">
            {totalRecords} <span className="text-xs font-normal text-slate-400">sesi kerja</span>
          </span>
          <span className="text-[10px] text-slate-400">Bulan {selectedMonth}</span>
        </div>

        <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
          <span className="text-[10px] font-black uppercase text-emerald-700 block tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Tugas Selesai (Clock-out)
          </span>
          <span className="text-xl font-black text-emerald-700 mt-1 block">
            {sudahCheckoutCount} <span className="text-xs font-normal text-emerald-600">sesi</span>
          </span>
          <span className="text-[10px] text-emerald-600">Presensi lengkap</span>
        </div>

        <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl">
          <span className="text-[10px] font-black uppercase text-amber-700 block tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-600" /> Belum Check-Out
          </span>
          <span className="text-xl font-black text-amber-700 mt-1 block">
            {belumCheckoutCount} <span className="text-xs font-normal text-amber-600">sesi</span>
          </span>
          <span className="text-[10px] text-amber-600">Sesi masih berjalan / terlewat</span>
        </div>
      </div>

      {/* Tabel Cuplikan Data Presensi */}
      <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto max-h-[30rem] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-50/95 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider backdrop-blur-xs">
              <tr>
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Nama Staf & Posisi</th>
                <th className="py-3 px-3">Shift</th>
                <th className="py-3 px-3">Cabang</th>
                <th className="py-3 px-3 text-center">Clock-In</th>
                <th className="py-3 px-3 text-center">Clock-Out</th>
                <th className="py-3 px-3 text-center">Durasi</th>
                <th className="py-3 px-4 text-center">Status Selesai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Memuat data presensi bulan {selectedMonth}...
                  </td>
                </tr>
              ) : attendanceData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Belum ada data presensi pada bulan {selectedMonth}.
                  </td>
                </tr>
              ) : (
                attendanceData.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-4 font-bold text-slate-800">
                      {item.attendance_date}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-extrabold text-slate-900">{item.staff_name}</div>
                      <div className="text-[10px] text-slate-400 uppercase">{item.role || 'Kru'}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
                        {item.shift === 'SHIFT_2' ? 'Shift 2' : item.shift === 'FULL_DAY' ? 'Full Day' : 'Shift 1'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {item.locations?.name ? `Outlet ${item.locations.name}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-black text-indigo-700">
                      {formatTimeWita(item.clock_in)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-black text-slate-700">
                      {formatTimeWita(item.clock_out)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-500">
                      {getWorkDuration(item.clock_in, item.clock_out)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        item.clock_out 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {item.clock_out ? '✓ Selesai' : 'Aktif (Belum Out)'}
                      </span>
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