'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  LogOut, 
  ShieldCheck, 
  Clock,
  CheckCircle2,
  Navigation,
  AlertCircle,
  Award,
  UserX,
  RefreshCw
} from 'lucide-react';
import LiveExecutiveSummary from '@/components/hr/LiveExecutiveSummary';
import { supabase } from '@/lib/supabaseClient';

export default function HRDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);

  // State Presensi Mandiri HR
  const [attendance, setAttendance] = useState<any>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [attendanceMsg, setAttendanceMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // State Analisa Kedisiplinan Bulanan
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());
  const currentMonthStr = todayStr.slice(0, 7);

  const [analyticsMonth, setAnalyticsMonth] = useState<string>(currentMonthStr);
  const [analyticsLoc, setAnalyticsLoc] = useState<string>('all');
  const [locations, setLocations] = useState<any[]>([]);
  const [monthAttendances, setMonthAttendances] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  useEffect(() => {
    const sessionStr = localStorage.getItem('baksoibu_active_staff');
    if (!sessionStr) {
      router.push('/login');
      return;
    }

    try {
      const session = JSON.parse(sessionStr);
      const role = (session.role || '').toUpperCase();

      if (role !== 'HR' && role !== 'OWNER' && !role.includes('ADMIN')) {
        router.push('/login');
        return;
      }

      setCurrentUser(session);

      const hrStaffName = session.active_staff_name || session.username || 'HR Officer';
      loadHRAttendance(hrStaffName);
    } catch {
      router.push('/login');
    }
  }, [router]);

  const loadHRAttendance = async (hrStaffName: string) => {
    try {
      const { data: attData } = await supabase
        .from('staff_attendances')
        .select('*')
        .eq('attendance_date', todayStr)
        .ilike('staff_name', hrStaffName.trim())
        .maybeSingle();

      if (attData) setAttendance(attData);
    } catch (e) {
      console.error('Error fetching HR attendance:', e);
    }
  };

  useEffect(() => {
    async function fetchLocations() {
      const { data } = await supabase.from('locations').select('id, name');
      if (data) setLocations(data);
    }
    fetchLocations();
  }, []);

  const fetchMonthlyAnalyticsData = async () => {
    setLoadingAnalytics(true);
    try {
      const [year, month] = analyticsMonth.split('-');
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const startDate = `${analyticsMonth}-01`;
      const endDate = `${analyticsMonth}-${String(lastDay).padStart(2, '0')}`;

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
        .lte('attendance_date', endDate);

      if (analyticsLoc !== 'all') {
        query = query.eq('location_id', analyticsLoc);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMonthAttendances(data || []);
    } catch (err: any) {
      console.error('Gagal mengambil data analisa bulanan:', err.message);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    fetchMonthlyAnalyticsData();
  }, [analyticsMonth, analyticsLoc]);

  // Parsing waktu aman anti-crash
  const analyzedSessions = useMemo(() => {
    if (!Array.isArray(monthAttendances)) return [];

    return monthAttendances.map((item) => {
      let isLate = false;
      let lateMinutes = 0;

      if (item.clock_in) {
        try {
          const d = new Date(item.clock_in);
          if (!isNaN(d.getTime())) {
            const timeStr = new Intl.DateTimeFormat('en-GB', {
              timeZone: 'Asia/Makassar',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }).format(d);

            const parts = timeStr.replace('.', ':').split(':');
            const h = parseInt(parts[0], 10) || 0;
            const m = parseInt(parts[1], 10) || 0;
            const inMinutes = h * 60 + m;

            // Shift 1: Jam 08.15 toleransi
            if (item.shift === 'SHIFT_1' || !item.shift) {
              if (inMinutes > 8 * 60 + 15) {
                isLate = true;
                lateMinutes = inMinutes - (8 * 60);
              }
            } 
            // Shift 2: Jam 15.15 toleransi
            else if (item.shift === 'SHIFT_2') {
              if (inMinutes > 15 * 60 + 15) {
                isLate = true;
                lateMinutes = inMinutes - (15 * 60);
              }
            }
          }
        } catch {
          // ignore parsing error
        }
      }

      const isOld = (item.attendance_date || '') < todayStr;
      const isForgotten = !item.clock_out && isOld;

      let durationHours = 0;
      if (item.clock_in && item.clock_out) {
        const start = new Date(item.clock_in).getTime();
        const end = new Date(item.clock_out).getTime();
        if (!isNaN(start) && !isNaN(end) && end > start) {
          durationHours = (end - start) / (1000 * 60 * 60);
        }
      } else if (isForgotten) {
        durationHours = item.shift === 'FULL_DAY' ? 12 : 8;
      }

      return {
        ...item,
        isLate,
        lateMinutes,
        isForgotten,
        durationHours
      };
    });
  }, [monthAttendances, todayStr]);

  // Rapor Ranking Disiplin per Staf
  const staffDisciplineRanking = useMemo(() => {
    const summary: Record<string, {
      name: string;
      role: string;
      totalDays: number;
      totalHours: number;
      lateCount: number;
      forgottenCount: number;
    }> = {};

    analyzedSessions.forEach((s) => {
      const name = s.staff_name || 'Tanpa Nama';
      if (!summary[name]) {
        summary[name] = {
          name,
          role: s.role || 'CREW',
          totalDays: 0,
          totalHours: 0,
          lateCount: 0,
          forgottenCount: 0
        };
      }

      summary[name].totalDays += 1;
      summary[name].totalHours += Number(s.durationHours || 0);
      if (s.isLate) summary[name].lateCount += 1;
      if (s.isForgotten) summary[name].forgottenCount += 1;
    });

    return Object.values(summary).map((st) => {
      const onTimeSessions = st.totalDays - st.lateCount;
      const disciplineScore = st.totalDays > 0 ? Math.round((onTimeSessions / st.totalDays) * 100) : 100;
      return {
        ...st,
        disciplineScore
      };
    }).sort((a, b) => b.disciplineScore - a.disciplineScore);
  }, [analyzedSessions]);

  const totalSessions = analyzedSessions.length;
  const totalLates = analyzedSessions.filter((s) => s.isLate).length;
  const totalForgotten = analyzedSessions.filter((s) => s.isForgotten).length;
  const overallOnTimeRate = totalSessions > 0 ? Math.round(((totalSessions - totalLates) / totalSessions) * 100) : 100;

  const getCoordinates = async (): Promise<{ lat: number; lng: number } | null> => {
    if (typeof window === 'undefined' || !navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 3500, maximumAge: 60000 }
      );
    });
  };

  const handleClockIn = async () => {
    setLoadingAttendance(true);
    setAttendanceMsg(null);
    try {
      const nowIso = new Date().toISOString();
      const coords = await getCoordinates();
      const hrStaffName = currentUser?.active_staff_name || currentUser?.username || 'HR Officer';

      const payload: any = {
        staff_name: hrStaffName,
        role: 'HR',
        shift: 'SHIFT_1',
        attendance_date: todayStr,
        clock_in: nowIso,
        location_id: currentUser?.location_id || null,
        status: 'HADIR'
      };

      if (coords) {
        payload.clock_in_lat = coords.lat;
        payload.clock_in_lng = coords.lng;
      }

      const { data, error } = await supabase
        .from('staff_attendances')
        .upsert(payload, { onConflict: 'staff_name,attendance_date' })
        .select()
        .single();

      if (error) throw error;
      setAttendance(data);
      const timeDisplay = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }).format(new Date(nowIso));
      setAttendanceMsg({ text: `Check-in berhasil pukul ${timeDisplay} WITA`, type: 'success' });
    } catch (err: any) {
      setAttendanceMsg({ text: `Gagal Check-in: ${err.message}`, type: 'error' });
    } finally {
      setLoadingAttendance(false);
    }
  };

  const handleClockOut = async () => {
    if (!attendance?.id) return;
    setLoadingAttendance(true);
    setAttendanceMsg(null);
    try {
      const nowIso = new Date().toISOString();
      const coords = await getCoordinates();

      const payload: any = {
        clock_out: nowIso
      };

      if (coords) {
        payload.clock_out_lat = coords.lat;
        payload.clock_out_lng = coords.lng;
      }

      const { data, error } = await supabase
        .from('staff_attendances')
        .update(payload)
        .eq('id', attendance.id)
        .select()
        .single();

      if (error) throw error;
      setAttendance(data);
      const timeDisplay = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }).format(new Date(nowIso));
      setAttendanceMsg({ text: `Check-out berhasil pukul ${timeDisplay} WITA`, type: 'success' });
    } catch (err: any) {
      setAttendanceMsg({ text: `Gagal Check-out: ${err.message}`, type: 'error' });
    } finally {
      setLoadingAttendance(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('baksoibu_active_staff');
    router.push('/login');
  };

  const formatDisplayTime = (iso?: string) => {
    if (!iso) return '--:--';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '--:--';
      return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }).format(d);
    } catch {
      return '--:--';
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fd] text-slate-800 font-sans flex flex-col">
      <header className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-5 pb-4 flex items-center justify-between border-b border-slate-200/60 bg-white sm:rounded-b-3xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-tight text-slate-900 leading-none">
                Portal Administrasi HR
              </h1>
              <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                SDM & Presensi
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-400 mt-1">
              Bakso Ibu • Presensi Mandiri, Rekap Kehadiran & Analisa Kedisiplinan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <span className="text-xs font-black text-slate-800 block leading-tight">
              {currentUser?.active_staff_name || currentUser?.username?.toUpperCase() || 'PETUGAS HR'}
            </span>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center justify-end gap-1">
              <ShieldCheck className="w-3 h-3" /> Tim HR Aktif
            </span>
          </div>

          <button
            onClick={handleLogout}
            title="Keluar"
            className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-400 hover:text-red-600 flex items-center justify-center transition-all shadow-xs"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* 1. PRESENSI MANDIRI HR */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-black text-slate-800">
                Presensi Mandiri Petugas HR ({currentUser?.active_staff_name || currentUser?.username?.toUpperCase() || 'HR'})
              </span>
            </div>
            <span className="text-[11px] font-bold text-slate-400">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>

          {attendanceMsg && (
            <div className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
              attendanceMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
            }`}>
              {attendanceMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{attendanceMsg.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Jam Masuk (Check-In)</span>
                <span className="text-sm font-black text-slate-800">
                  {formatDisplayTime(attendance?.clock_in)}
                </span>
                {attendance?.clock_in_lat && (
                  <span className="text-[10px] text-indigo-600 font-bold block flex items-center gap-1 mt-0.5">
                    <Navigation className="w-2.5 h-2.5" /> GPS Terkunci
                  </span>
                )}
              </div>
              {!attendance?.clock_in && (
                <button
                  onClick={handleClockIn}
                  disabled={loadingAttendance}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50"
                >
                  {loadingAttendance ? 'Mengunci GPS...' : 'Check-In Masuk'}
                </button>
              )}
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Jam Pulang (Check-Out)</span>
                <span className="text-sm font-black text-slate-800">
                  {formatDisplayTime(attendance?.clock_out)}
                </span>
                {attendance?.clock_out_lat && (
                  <span className="text-[10px] text-indigo-600 font-bold block flex items-center gap-1 mt-0.5">
                    <Navigation className="w-2.5 h-2.5" /> GPS Terkunci
                  </span>
                )}
              </div>
              {attendance?.clock_in && !attendance?.clock_out && (
                <button
                  onClick={handleClockOut}
                  disabled={loadingAttendance}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50"
                >
                  {loadingAttendance ? 'Mengunci GPS...' : 'Check-Out Pulang'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2. PUSAT LOG HARIAN & DOWNLOAD CSV LENGKAP */}
        <LiveExecutiveSummary />

        {/* 3. MODUL ANALISA KEDISIPLINAN KRU */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-slate-100 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shadow-xs">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Analisa Kedisiplinan Kru & Evaluasi Kehadiran
                </h2>
                <p className="text-xs font-medium text-slate-400">
                  Monitoring ketepatan waktu per shift, frekuensi lupa check-out, dan ranking kepatuhan jam kerja bulanan.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="month"
                value={analyticsMonth}
                onChange={(e) => setAnalyticsMonth(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
              />

              <select
                value={analyticsLoc}
                onChange={(e) => setAnalyticsLoc(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
              >
                <option value="all">Semua Outlet</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    Outlet {loc.name}
                  </option>
                ))}
              </select>

              <button
                onClick={fetchMonthlyAnalyticsData}
                className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100"
                title="Segarkan Analisa"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAnalytics ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                Total Sesi Kerja
              </span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {totalSessions} <span className="text-xs font-medium text-slate-400">Shift</span>
              </span>
              <span className="text-[10px] text-slate-400">Bulan {analyticsMonth}</span>
            </div>

            <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-emerald-700 block tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Skor Ketepatan Waktu
              </span>
              <span className="text-2xl font-black text-emerald-700 mt-1 block">
                {overallOnTimeRate}%
              </span>
              <span className="text-[10px] text-emerald-600 font-medium">Hadir sebelum batas toleransi</span>
            </div>

            <div className="p-4 bg-amber-50/60 border border-amber-100 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-amber-700 block tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Total Terlambat
              </span>
              <span className="text-2xl font-black text-amber-700 mt-1 block">
                {totalLates} <span className="text-xs font-medium text-amber-600">Kejadian</span>
              </span>
              <span className="text-[10px] text-amber-600 font-medium">Lewat dari 15 menit awal shift</span>
            </div>

            <div className="p-4 bg-rose-50/60 border border-rose-100 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-rose-700 block tracking-wider flex items-center gap-1.5">
                <UserX className="w-3.5 h-3.5" /> Lupa Check-Out
              </span>
              <span className="text-2xl font-black text-rose-700 mt-1 block">
                {totalForgotten} <span className="text-xs font-medium text-rose-600">Kali</span>
              </span>
              <span className="text-[10px] text-rose-500 font-medium">Sesi terlewat jam 01:00 WITA</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Award className="w-4 h-4 text-indigo-600" />
                Rapor Kedisiplinan Staf (Ranking Kepatuhan)
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                Total {staffDisciplineRanking.length} Staf Bertugas
              </span>
            </div>

            <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider bg-slate-50/70">
                      <th className="py-3 px-4">Nama Kru</th>
                      <th className="py-3 px-3">Jabatan</th>
                      <th className="py-3 px-3 text-center">Hari Masuk</th>
                      <th className="py-3 px-3 text-center text-amber-700">Terlambat</th>
                      <th className="py-3 px-3 text-center text-rose-600">Lupa Check-Out</th>
                      <th className="py-3 px-3 text-right">Akumulasi Jam</th>
                      <th className="py-3 px-4 text-center">Skor Disiplin</th>
                      <th className="py-3 px-4 text-center">Evaluasi HR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold">
                    {loadingAnalytics ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                          Menganalisis data kedisiplinan kru...
                        </td>
                      </tr>
                    ) : staffDisciplineRanking.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 font-bold bg-slate-50/50">
                          Belum ada rekaman presensi pada bulan {analyticsMonth}.
                        </td>
                      </tr>
                    ) : (
                      staffDisciplineRanking.map((staf, idx) => {
                        const isPerfect = staf.disciplineScore === 100 && staf.forgottenCount === 0;
                        const needsAttention = staf.disciplineScore < 75 || staf.forgottenCount >= 3;

                        return (
                          <tr key={staf.name} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                                {idx === 0 && <span title="Paling Disiplin">🥇</span>}
                                {idx === 1 && <span title="Peringkat 2">🥈</span>}
                                {idx === 2 && <span title="Peringkat 3">🥉</span>}
                                <span>{staf.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase">
                                {staf.role}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-slate-800">
                              {staf.totalDays} hari
                            </td>
                            <td className="py-3 px-3 text-center font-black text-amber-600">
                              {staf.lateCount > 0 ? `${staf.lateCount}x` : '-'}
                            </td>
                            <td className="py-3 px-3 text-center font-black text-rose-500">
                              {staf.forgottenCount > 0 ? `${staf.forgottenCount}x` : '-'}
                            </td>
                            <td className="py-3 px-3 text-right font-black text-indigo-700">
                              {Math.round(staf.totalHours)} Jam
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                staf.disciplineScore >= 90
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : staf.disciplineScore >= 75
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                {staf.disciplineScore}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isPerfect ? (
                                <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                                  Sangat Disiplin ⭐
                                </span>
                              ) : needsAttention ? (
                                <span className="text-[10px] font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                                  Perlu Teguran ⚠️
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-slate-400">
                                  Standar Normal
                                </span>
                              )}
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
        </div>

      </main>
    </div>
  );
}