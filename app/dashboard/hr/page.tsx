'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  LogOut, 
  ShieldCheck, 
  Clock,
  CheckCircle2,
  Navigation,
  AlertCircle
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

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());

  useEffect(() => {
    const sessionStr = localStorage.getItem('baksoibu_active_staff');
    if (!sessionStr) {
      router.push('/login');
      return;
    }

    const session = JSON.parse(sessionStr);
    const role = (session.role || '').toUpperCase();

    if (role !== 'HR' && role !== 'OWNER' && !role.includes('ADMIN')) {
      router.push('/login');
      return;
    }

    setCurrentUser(session);

    const hrStaffName = session.active_staff_name || session.username || 'HR Officer';

    const loadHRAttendance = async () => {
      try {
        const { data: attData } = await supabase
          .from('staff_attendances')
          .select('*')
          .eq('attendance_date', todayStr)
          .ilike('staff_name', hrStaffName.trim())
          .maybeSingle();

        if (attData) {
          setAttendance(attData);
        }
      } catch (e) {
        console.error('Error fetching HR attendance:', e);
      }
    };

    loadHRAttendance();
  }, [router, todayStr]);

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
      return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fd] text-slate-800 font-sans flex flex-col">
      {/* Header Portal HR */}
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
              Bakso Ibu • Presensi Mandiri & Rekap Kehadiran Karyawan
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

      {/* Konten Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* WIDGET PRESENSI MANDIRI HR */}
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
            {/* Status Masuk */}
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

            {/* Status Pulang */}
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

        {/* SATU PUSAT KONTROL: LIVE PRESENSI, REKAP STATISTIK & DATABASE STAF */}
        <LiveExecutiveSummary />
      </main>
    </div>
  );
}