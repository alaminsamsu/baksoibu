'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Clock, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  Navigation 
} from 'lucide-react';

interface Props {
  currentUser?: any;
  locationId?: string;
}

export default function StaffAttendanceWidget({ currentUser, locationId }: Props) {
  const activeLocationId = locationId || currentUser?.location_id;
  
  const [staffOptions, setStaffOptions] = useState<any[]>([]);
  const [selectedStaffNickname, setSelectedStaffNickname] = useState('');
  const [activeStaffProfile, setActiveStaffProfile] = useState<any | null>(null);

  const [activeAttendance, setActiveAttendance] = useState<any | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [shift, setShift] = useState<'SHIFT_1' | 'SHIFT_2' | 'FULL_DAY'>('SHIFT_1');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());

  useEffect(() => {
    const fetchStaffProfiles = async () => {
      let query = supabase
        .from('staff_profiles')
        .select('*')
        .eq('is_active', true)
        .order('nickname');

      if (activeLocationId) {
        query = query.or(`primary_location_id.eq.${activeLocationId},primary_location_id.is.null`);
      }

      const { data } = await query;
      if (data) {
        setStaffOptions(data);
        if (currentUser?.active_staff_name) {
          const matched = data.find(
            (s) => s.nickname.trim().toLowerCase() === currentUser.active_staff_name.trim().toLowerCase()
          );
          if (matched) {
            setSelectedStaffNickname(matched.nickname);
            setActiveStaffProfile(matched);
            checkTodayAttendance(matched.nickname);
          }
        }
      }
    };

    fetchStaffProfiles();
  }, [activeLocationId, currentUser]);

  // Cek apakah sudah lewat jam 01:00 WITA
  const checkIsPast1AM = (attendanceDate: string) => {
    if (attendanceDate < todayStr) return true;
    const now = new Date();
    const witaHour = parseInt(
      new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', hour: 'numeric', hour12: false }).format(now)
    );
    return witaHour >= 1;
  };

  const checkTodayAttendance = async (nickname: string) => {
    if (!nickname) {
      setActiveAttendance(null);
      setIsSessionExpired(false);
      return;
    }

    try {
      // 1. Cek sesi yang belum check-out
      const { data: openSession } = await supabase
        .from('staff_attendances')
        .select('*')
        .ilike('staff_name', nickname.trim())
        .is('clock_out', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (openSession && openSession.length > 0) {
        const session = openSession[0];
        // Jika sesi kemarin dan sudah lewat jam 1 malam, anggap expired (lupa checkout)
        if (checkIsPast1AM(session.attendance_date)) {
          setActiveAttendance(null);
          setIsSessionExpired(true);
          return;
        }
        setActiveAttendance(session);
        setIsSessionExpired(false);
        return;
      }

      // 2. Jika sudah checkout semua, cek status presensi hari ini
      const { data: todaySession } = await supabase
        .from('staff_attendances')
        .select('*')
        .ilike('staff_name', nickname.trim())
        .eq('attendance_date', todayStr)
        .order('created_at', { ascending: false })
        .limit(1);

      if (todaySession && todaySession.length > 0) {
        setActiveAttendance(todaySession[0]);
      } else {
        setActiveAttendance(null);
      }
      setIsSessionExpired(false);
    } catch (e) {
      console.error('Gagal membaca presensi:', e);
    }
  };

  const handleStaffChange = (nick: string) => {
    setSelectedStaffNickname(nick);
    const profile = staffOptions.find((s) => s.nickname === nick);
    setActiveStaffProfile(profile || null);
    checkTodayAttendance(nick);
    setMessage(null);
  };

  const getCurrentCoordinates = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        return resolve({ lat: 0, lng: 0 });
      }

      const timeoutId = setTimeout(() => {
        resolve({ lat: 0, lng: 0 });
      }, 2500);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timeoutId);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          clearTimeout(timeoutId);
          resolve({ lat: 0, lng: 0 });
        },
        { enableHighAccuracy: false, timeout: 2000, maximumAge: 60000 }
      );
    });
  };

  const handleClockIn = async () => {
    if (!selectedStaffNickname) {
      setMessage({ text: 'Pilih nama panggilan Anda terlebih dahulu!', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      if (!activeLocationId) throw new Error('Lokasi tugas outlet belum terdeteksi.');

      const coords = await getCurrentCoordinates();

      const newRecord = {
        staff_profile_id: activeStaffProfile?.id || null,
        staff_name: selectedStaffNickname,
        role: activeStaffProfile?.role || currentUser?.role || 'CREW',
        location_id: activeLocationId,
        attendance_date: todayStr,
        shift,
        clock_in: new Date().toISOString(),
        clock_in_lat: coords.lat !== 0 ? coords.lat : null,
        clock_in_lng: coords.lng !== 0 ? coords.lng : null,
      };

      const { data, error } = await supabase
        .from('staff_attendances')
        .insert(newRecord)
        .select()
        .single();

      if (error) throw error;
      setActiveAttendance(data);
      setIsSessionExpired(false);

      const hasGps = coords.lat !== 0;
      setMessage({
        text: `Berhasil Check-In pada ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA.${hasGps ? ' (GPS Terverifikasi)' : ''}`,
        type: 'success',
      });
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal check-in', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!activeAttendance?.id) {
      setMessage({ text: 'Data check-in tidak ditemukan. Coba pilih ulang nama Anda.', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const coords = await getCurrentCoordinates();
      const clockOutIso = new Date().toISOString();

      const updatePayload: any = {
        clock_out: clockOutIso,
      };

      if (coords.lat !== 0) {
        updatePayload.clock_out_lat = coords.lat;
        updatePayload.clock_out_lng = coords.lng;
      }

      const { error } = await supabase
        .from('staff_attendances')
        .update(updatePayload)
        .eq('id', activeAttendance.id);

      if (error) throw error;

      setActiveAttendance((prev: any) => ({
        ...prev,
        ...updatePayload,
      }));

      setMessage({
        text: `Berhasil Check-Out pada ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA. Terima kasih atas tugasnya!`,
        type: 'success',
      });
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal check-out', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs space-y-3 max-w-md mx-auto font-sans">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">
              Presensi Kehadiran Petugas
            </h3>
            <p className="text-[10px] text-slate-400">
              {currentUser?.location_name || 'Outlet'} • {activeStaffProfile?.role || 'Karyawan'}
            </p>
          </div>
        </div>

        {!activeAttendance && (
          <div className="flex bg-slate-100 p-1 rounded-xl text-[10px] font-black">
            <button
              type="button"
              onClick={() => setShift('SHIFT_1')}
              className={`px-2.5 py-1 rounded-lg ${
                shift === 'SHIFT_1' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-400'
              }`}
            >
              Shift 1
            </button>
            <button
              type="button"
              onClick={() => setShift('SHIFT_2')}
              className={`px-2.5 py-1 rounded-lg ${
                shift === 'SHIFT_2' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-400'
              }`}
            >
              Shift 2
            </button>
          </div>
        )}
      </div>

      {isSessionExpired && (
        <div className="p-2.5 rounded-xl text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
          ⚠️ Sesi tugas sebelumnya ditutup otomatis karena lewat jam 01:00 WITA (Lupa Check-Out). Anda bisa langsung Check-In untuk shift baru.
        </div>
      )}

      {message && (
        <div
          className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* DROPDOWN NAMA */}
      <div className="bg-slate-50 p-3.5 rounded-2xl space-y-2 border border-slate-100">
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
          Pilih Nama Panggilan Anda
        </label>
        <select
          value={selectedStaffNickname}
          onChange={(e) => handleStaffChange(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="">-- Pilih Nama Terdaftar --</option>
          {staffOptions.map((s) => (
            <option key={s.id} value={s.nickname}>
              {s.nickname} ({s.role} • {s.full_name})
            </option>
          ))}
        </select>

        {activeAttendance?.clock_in && (
          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-bold">
            <span className="text-[10px] text-slate-400 uppercase">Status Tugas:</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase">
                In: {new Date(activeAttendance.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {activeAttendance.clock_out && (
                <span className="text-[10px] font-black text-slate-600 bg-slate-200 px-2 py-0.5 rounded-md uppercase">
                  Out: {new Date(activeAttendance.clock_out).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* TOMBOL AKSI */}
      {!activeAttendance ? (
        <button
          onClick={handleClockIn}
          disabled={loading || !selectedStaffNickname}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-black text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>{loading ? 'Memverifikasi Presensi...' : 'Check-In Masuk Tugas'}</span>
        </button>
      ) : !activeAttendance.clock_out ? (
        <button
          onClick={handleClockOut}
          disabled={loading}
          className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-black text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{loading ? 'Menyimpan Selesai Tugas...' : 'Check-Out Selesai Tugas'}</span>
        </button>
      ) : (
        <div className="text-center py-2.5 bg-emerald-50 rounded-xl text-xs font-black text-emerald-700 border border-emerald-100 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Tugas hari ini telah selesai (Sudah Check-Out).</span>
        </div>
      )}
    </div>
  );
}