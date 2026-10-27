'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Users, 
  Calendar, 
  MapPin, 
  RefreshCw, 
  ExternalLink,
  Download,
  Building2,
  ShieldCheck,
  AlertCircle,
  FileSpreadsheet,
  Camera,
  X
} from 'lucide-react';

export default function LiveExecutiveSummary() {
  const todayWita = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());
  const currentMonthWita = todayWita.slice(0, 7);

  const [selectedDate, setSelectedDate] = useState<string>(todayWita);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthWita);
  const [selectedLoc, setSelectedLoc] = useState<string>('all');
  const [activeSubTab, setActiveSubTab] = useState<'log' | 'database'>('log');

  const [locations, setLocations] = useState<any[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<any[]>([]);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingDaily, setDownloadingDaily] = useState(false);
  const [downloadingMonthly, setDownloadingMonthly] = useState(false);

  // State Modal Preview Foto Selfie
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    async function fetchMasterData() {
      const { data: locs } = await supabase.from('locations').select('*').order('name');
      if (locs) setLocations(locs);

      const { data: profiles } = await supabase
        .from('staff_profiles')
        .select('*')
        .order('nickname');
      if (profiles) setStaffProfiles(profiles);
    }
    fetchMasterData();
  }, []);

  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
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
          clock_in_lat,
          clock_in_lng,
          photo_url,
          location_id,
          locations(name)
        `)
        .eq('attendance_date', selectedDate)
        .order('clock_in', { ascending: true });

      if (selectedLoc !== 'all') {
        query = query.eq('location_id', selectedLoc);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAttendances(data || []);
    } catch (err: any) {
      console.error('Gagal mengambil presensi SDM:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
  }, [selectedDate, selectedLoc]);

  const getLocationName = (item: any) => {
    if (!item?.locations) return '-';
    if (Array.isArray(item.locations)) {
      return item.locations[0]?.name || '-';
    }
    return (item.locations as any)?.name || '-';
  };

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

  const evaluateAttendanceStatus = (item: any) => {
    if (item.clock_out) {
      const start = new Date(item.clock_in).getTime();
      const end = new Date(item.clock_out).getTime();
      const diffMs = end - start;
      if (diffMs > 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return {
          isForgotten: false,
          checkOutDisplay: formatTimeWita(item.clock_out),
          durationDisplay: `${hours} Jam ${mins} Menit`,
          statusDisplay: 'SELESAI'
        };
      }
    }

    const now = new Date();
    const witaHour = parseInt(
      new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', hour: 'numeric', hour12: false }).format(now)
    );

    const isOldDate = item.attendance_date < todayWita;
    const isPast1AMDawn = item.attendance_date === todayWita && (witaHour >= 1 && witaHour < 6);
    const isForgotten = isOldDate || isPast1AMDawn;

    if (isForgotten) {
      const defaultDuration = item.shift === 'FULL_DAY' ? '12 Jam (Standar)' : '8 Jam (Standar)';
      return {
        isForgotten: true,
        checkOutDisplay: 'Lupa Check-Out',
        durationDisplay: defaultDuration,
        statusDisplay: 'LUPA CHECK-OUT'
      };
    }

    return {
      isForgotten: false,
      checkOutDisplay: '-',
      durationDisplay: 'Sedang Bertugas',
      statusDisplay: 'SEDANG BERTUGAS'
    };
  };

  const totalActiveStaff = staffProfiles.filter((s) => s.is_active !== false).length;
  const totalHadirHariIni = attendances.length;
  const totalOutletCount = locations.length;

  const outletAttendanceCards = useMemo(() => {
    return locations.map((loc) => {
      const locAttendances = attendances.filter((a) => a.location_id === loc.id);
      const leader = locAttendances.find(
        (a) => (a.role || '').toUpperCase().includes('LEADER') || (a.role || '').toUpperCase().includes('KEPALA')
      );
      return {
        id: loc.id,
        name: loc.name,
        leaderName: leader ? leader.staff_name : null,
        staffList: locAttendances.map((a) => a.staff_name),
      };
    });
  }, [locations, attendances]);

  // Ekspor CSV Harian
  const handleDownloadDailyCSV = () => {
    if (attendances.length === 0) {
      alert(`Tidak ada rekaman presensi pada tanggal ${selectedDate}.`);
      return;
    }

    setDownloadingDaily(true);
    try {
      const locLabel = selectedLoc === 'all' 
        ? 'Semua_Lokasi' 
        : locations.find((l) => l.id === selectedLoc)?.name || 'Cabang';

      const headers = [
        'Tanggal Presensi',
        'Nama Pegawai',
        'Peran / Jabatan',
        'Lokasi Outlet',
        'Shift',
        'Jam Masuk (Check-In)',
        'Jam Pulang (Check-Out)',
        'Durasi Kerja',
        'Status Presensi',
        'Titik GPS Terdeteksi',
        'Link Foto Selfie'
      ];

      const rows = attendances.map((item) => {
        const evaluated = evaluateAttendanceStatus(item);
        const checkIn = formatTimeWita(item.clock_in);
        const shiftLabel = item.shift === 'SHIFT_2' ? 'Shift 2' : item.shift === 'FULL_DAY' ? 'Full Day' : 'Shift 1';
        const locName = getLocationName(item);
        const gpsStatus = (item.clock_in_lat && item.clock_in_lng) ? 'YA (TERVERIFIKASI)' : 'TIDAK';
        const photo = item.photo_url || '-';

        return [
          `"${item.attendance_date || selectedDate}"`,
          `"${item.staff_name}"`,
          `"${item.role || 'CREW'}"`,
          `"${locName !== '-' ? `Outlet ${locName}` : '-'}"`,
          `"${shiftLabel}"`,
          `"${checkIn}"`,
          `"${evaluated.checkOutDisplay}"`,
          `"${evaluated.durationDisplay}"`,
          `"${evaluated.statusDisplay}"`,
          `"${gpsStatus}"`,
          `"${photo}"`
        ].join(';');
      });

      const csvContent = 'sep=;\r\n' + [headers.join(';'), ...rows].join('\r\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Presensi_Harian_${locLabel}_${selectedDate}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloadingDaily(false);
    }
  };

  // Ekspor CSV Bulanan
  const handleDownloadMonthlyCSV = async () => {
    setDownloadingMonthly(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const startDate = `${selectedMonth}-01`;
      const endDate = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

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
          clock_in_lat,
          clock_in_lng,
          photo_url,
          location_id,
          locations(name)
        `)
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate)
        .order('attendance_date', { ascending: true })
        .order('clock_in', { ascending: true });

      if (selectedLoc !== 'all') {
        query = query.eq('location_id', selectedLoc);
      }

      const { data: monthData, error } = await query;
      if (error) throw error;

      if (!monthData || monthData.length === 0) {
        alert(`Tidak ada rekaman presensi pada bulan ${selectedMonth}.`);
        return;
      }

      const locLabel = selectedLoc === 'all' 
        ? 'Semua_Lokasi' 
        : locations.find((l) => l.id === selectedLoc)?.name || 'Cabang';

      const headers = [
        'Tanggal Presensi',
        'Nama Pegawai',
        'Peran / Jabatan',
        'Lokasi Outlet',
        'Shift',
        'Jam Masuk (Check-In)',
        'Jam Pulang (Check-Out)',
        'Durasi Kerja',
        'Status Presensi',
        'Titik GPS',
        'Link Foto Selfie'
      ];

      const rows = monthData.map((item) => {
        const evaluated = evaluateAttendanceStatus(item);
        const checkIn = formatTimeWita(item.clock_in);
        const shiftLabel = item.shift === 'SHIFT_2' ? 'Shift 2' : item.shift === 'FULL_DAY' ? 'Full Day' : 'Shift 1';
        const locName = getLocationName(item);
        const gpsStatus = (item.clock_in_lat && item.clock_in_lng) ? 'YA' : 'TIDAK';
        const photo = item.photo_url || '-';

        return [
          `"${item.attendance_date}"`,
          `"${item.staff_name}"`,
          `"${item.role || 'CREW'}"`,
          `"${locName !== '-' ? `Outlet ${locName}` : '-'}"`,
          `"${shiftLabel}"`,
          `"${checkIn}"`,
          `"${evaluated.checkOutDisplay}"`,
          `"${evaluated.durationDisplay}"`,
          `"${evaluated.statusDisplay}"`,
          `"${gpsStatus}"`,
          `"${photo}"`
        ].join(';');
      });

      const csvContent = 'sep=;\r\n' + [headers.join(';'), ...rows].join('\r\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Presensi_Bulanan_SDM_${locLabel}_${selectedMonth}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(`Gagal mengekspor data bulanan: ${err.message}`);
    } finally {
      setDownloadingMonthly(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Monitoring Outlet */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {outletAttendanceCards.map((card) => (
          <div key={card.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span className="font-black text-xs text-slate-800 uppercase tracking-wider">
                  Outlet {card.name}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">LEADER SHIFT:</span>
              {card.leaderName ? (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 font-extrabold text-xs rounded-xl">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {card.leaderName}
                </span>
              ) : (
                <span className="text-slate-400 font-bold text-xs">Belum Ada Leader</span>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                PETUGAS DI TEMPAT ({card.staffList.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {card.staffList.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">Belum ada kru check-in</span>
                ) : (
                  card.staffList.map((name, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-100 text-[11px] font-bold text-slate-700 flex items-center gap-1"
                    >
                      <Users className="w-3 h-3 text-slate-400" />
                      {name}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 2. Statistik Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
              TOTAL KARYAWAN AKTIF
            </span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">
              {totalActiveStaff} <span className="text-xs font-semibold text-slate-400">Orang</span>
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
              HADIR HARI INI
            </span>
            <span className="text-2xl font-black text-emerald-600 mt-1 block">
              {totalHadirHariIni} <span className="text-xs font-semibold text-slate-400">Presensi</span>
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
              CAKUPAN OUTLET
            </span>
            <span className="text-2xl font-black text-blue-600 mt-1 block">
              {totalOutletCount} <span className="text-xs font-semibold text-slate-400">Lokasi</span>
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Panel Administrasi Presensi */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Administrasi & Presensi SDM
              </h2>
              <p className="text-xs font-medium text-slate-400">
                Database seluruh pegawai, verifikasi GPS & foto selfie presensi.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadDailyCSV}
              disabled={downloadingDaily || attendances.length === 0}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloadingDaily ? 'Mengekspor...' : 'Unduh Harian'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadMonthlyCSV}
              disabled={downloadingMonthly}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-xs transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{downloadingMonthly ? 'Menyiapkan...' : 'Unduh Bulanan (.CSV)'}</span>
            </button>

            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setActiveSubTab('log')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeSubTab === 'log' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Log Presensi
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('database')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeSubTab === 'database' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Database Pegawai
              </button>
            </div>
          </div>
        </div>

        {activeSubTab === 'log' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="flex flex-wrap items-center gap-2.5">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block mb-1">Tanggal Harian:</span>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 block mb-1">Periode Bulan:</span>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 block mb-1">Filter Outlet:</span>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <select
                      value={selectedLoc}
                      onChange={(e) => setSelectedLoc(e.target.value)}
                      className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="all">Semua Lokasi</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          Outlet {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="self-end pb-0.5">
                <button
                  type="button"
                  onClick={fetchAttendanceData}
                  className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 transition-all"
                  title="Segarkan Data"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider bg-slate-50/60">
                      <th className="py-3 px-3 text-center">FOTO</th>
                      <th className="py-3 px-4">NAMA PEGAWAI</th>
                      <th className="py-3 px-3">PERAN</th>
                      <th className="py-3 px-3">LOKASI OUTLET</th>
                      <th className="py-3 px-3">SHIFT</th>
                      <th className="py-3 px-3 text-emerald-600 font-black">CHECK-IN</th>
                      <th className="py-3 px-3 text-rose-500 font-black">CHECK-OUT</th>
                      <th className="py-3 px-3 text-center">TITIK GPS</th>
                      <th className="py-3 px-4 text-right">DURASI KERJA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold">
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                          Memuat log presensi...
                        </td>
                      </tr>
                    ) : attendances.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400 font-bold bg-slate-50/50">
                          Tidak ada rekaman presensi pada tanggal {selectedDate}.
                        </td>
                      </tr>
                    ) : (
                      attendances.map((row) => {
                        const evaluated = evaluateAttendanceStatus(row);
                        const inTime = formatTimeWita(row.clock_in);
                        const isLeader = (row.role || '').toUpperCase().includes('LEADER');
                        const hasGps = row.clock_in_lat && row.clock_in_lng;
                        const locName = getLocationName(row);

                        return (
                          <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                            {/* THUMBNAIL FOTO SELFIE */}
                            <td className="py-3 px-3 text-center">
                              {row.photo_url ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewPhoto({ url: row.photo_url, name: row.staff_name })}
                                  className="group relative inline-block focus:outline-none"
                                  title="Klik untuk melihat foto selfie"
                                >
                                  <img
                                    src={row.photo_url}
                                    alt={row.staff_name}
                                    className="w-8 h-8 rounded-full object-cover border-2 border-indigo-200 group-hover:scale-110 group-hover:border-indigo-600 transition-all shadow-xs"
                                  />
                                </button>
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto" title="Belum ada foto">
                                  <Camera className="w-3.5 h-3.5" />
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 font-extrabold text-slate-900">
                              {row.staff_name}
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                isLeader ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {row.role || 'CREW'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-600">
                              {locName !== '-' ? `Outlet ${locName}` : '-'}
                            </td>
                            <td className="py-3 px-3 font-bold text-indigo-700">
                              {row.shift || 'SHIFT_1'}
                            </td>
                            <td className="py-3 px-3 font-black text-emerald-600">
                              {inTime}
                            </td>
                            <td className="py-3 px-3">
                              {evaluated.isForgotten ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 font-black text-[10px] border border-rose-200">
                                  <AlertCircle className="w-3 h-3" />
                                  Lupa Check-Out
                                </span>
                              ) : (
                                <span className="font-black text-slate-700">
                                  {evaluated.checkOutDisplay}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {hasGps ? (
                                <a
                                  href={`https://www.google.com/maps?q=${row.clock_in_lat},${row.clock_in_lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-[10px] font-bold transition-colors"
                                  title="Lihat GPS Maps"
                                >
                                  <span>Maps</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                            <td className={`py-3 px-4 text-right font-black ${
                              evaluated.isForgotten ? 'text-amber-600' : 'text-slate-800'
                            }`}>
                              {evaluated.durationDisplay}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'database' && (
          <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider bg-slate-50/60">
                    <th className="py-3 px-4">Nama Lengkap</th>
                    <th className="py-3 px-3">Nama Panggilan</th>
                    <th className="py-3 px-3">Peran / Jabatan</th>
                    <th className="py-3 px-3">Penempatan Utama</th>
                    <th className="py-3 px-4 text-center">Status Akun</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold">
                  {staffProfiles.map((p) => {
                    const primaryLoc = locations.find((l) => l.id === p.primary_location_id);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-bold text-slate-900">{p.full_name || '-'}</td>
                        <td className="py-3 px-3 text-indigo-600 font-black">{p.nickname}</td>
                        <td className="py-3 px-3 text-slate-700">{p.role || 'CREW'}</td>
                        <td className="py-3 px-3 text-slate-600">{primaryLoc ? `Outlet ${primaryLoc.name}` : 'Semua Cabang'}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            p.is_active !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
                          }`}>
                            {p.is_active !== false ? 'Aktif' : 'Non-Aktif'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL POPUP LIHAT FOTO LENGKAP */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-black text-slate-900">{previewPhoto.name}</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Bukti Foto Masuk Shift</p>
              </div>
              <button 
                onClick={() => setPreviewPhoto(null)} 
                className="p-1 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden aspect-4/3 bg-black">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.name}
                className="w-full h-full object-cover"
              />
            </div>

            <button
              onClick={() => setPreviewPhoto(null)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}