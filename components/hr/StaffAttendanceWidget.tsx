'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Clock, 
  LogIn, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  MapPin, 
  User, 
  Navigation,
  ExternalLink 
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
  const [shift, setShift] = useState<'SHIFT_1' | 'SHIFT_2' | 'FULL_DAY'>('SHIFT_1');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());

  // 1. Tarik daftar nama resmi pegawai aktif dari HR
  useEffect(() => {
    const fetchStaffProfiles = async () => {
      let query = supabase
        .from('staff_profiles')
        .select('*')
        .eq('is_active', true)
        .order('nickname');

      if (activeLocationId) {
        // Tampilkan staf cabang ini atau staf mobile
        query = query.or(`primary_location_id.eq.${activeLocationId},primary_location_id.is.null`);
      }

      const { data } = await query;
      if (data) {
        setStaffOptions(data);
        // Jika user yang login sudah ada nama panggilannya, set otomatis
        if (currentUser?.active_staff_name) {
          const matched = data.find((s) => s.nickname.toLowerCase() === currentUser.active_staff_name.toLowerCase());
          if (matched) {
            setSelectedStaffNickname(matched.nickname);
            setActiveStaffProfile(matched);
          }
        }
      }
    };

    fetchStaffProfiles();
  }, [activeLocationId, currentUser]);

  // 2. Cek status presensi hari ini jika nama pegawai dipilih
  const checkTodayAttendance = async (nickname: string) => {
    if (!nickname) {
      setActiveAttendance(null);
      return;
    }

    const { data } = await supabase
      .from('staff_attendances')
      .select('*')
      .eq('attendance_date', todayStr)
      .eq('staff_name', nickname)
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setActiveAttendance(data[0]);
    } else {
      setActiveAttendance(null);
    }
  };

  const handleStaffChange = (nick: string) => {
    setSelectedStaffNickname(nick);
    const profile = staffOptions.find((s) => s.nickname === nick);
    setActiveStaffProfile(profile || null);
    checkTodayAttendance(nick);
    setMessage(null);
  };

  // Koordinat GPS
  const getCurrentCoordinates = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: 0, lng: 0 });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => resolve({ lat: fallbackPos.coords.latitude, lng: fallbackPos.coords.longitude }),
            () => resolve({ lat: 0, lng: 0 }),
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
          );
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
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

      const { data, error } = await supabase
        .from('staff_attendances')
        .insert({
          staff_profile_id: activeStaffProfile?.id || null,
          staff_name: selectedStaffNickname,
          role: activeStaffProfile?.role || currentUser?.role || 'CREW',
          location_id: activeLocationId,
          attendance_date: todayStr,
          shift,
          clock_in: new Date().toISOString(),
          clock_in_lat: coords.lat !== 0 ? coords.lat : null,
          clock_in_lng: coords.lng !== 0 ? coords.lng : null,
        })
        .select()
        .single();

      if (error) throw error;
      setActiveAttendance(data);

      const hasGps = coords.lat !== 0;
      setMessage({
        text: `Berhasil Check-In pada ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA.${hasGps ? ' (Titik GPS terverifikasi)' : ' (Presensi tercatat)'}`,
        type: 'success',
      });
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal check-in', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!activeAttendance) return;
    setLoading(true);
    setMessage(null);
    try {
      const coords = await getCurrentCoordinates();

      const { data, error } = await supabase
        .from('staff_attendances')
        .update({
          clock_out: new Date().toISOString(),
          clock_out_lat: coords.lat !== 0 ? coords.lat : null,
          clock_out_lng: coords.lng !== 0 ? coords.lng : null,
        })
        .eq('id', activeAttendance.id)
        .select()
        .single();

      if (error) throw error;
      setActiveAttendance(data);
      setMessage({
        text: `Berhasil Check-Out pada ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA.`,
        type: 'success',
      });
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal check-out', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs space-y-3 max-w-md mx-auto">
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

      {/* DROPDOWN NAMA PANGGILAN RESMI DARI DATABASE HR */}
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
              {s.nickname} ({s.role} - {s.full_name})
            </option>
          ))}
        </select>

        {activeAttendance?.clock_in && (
          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-bold">
            <span className="text-[10px] text-slate-400 uppercase">Status Hari Ini:</span>
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
        <div className="text-center py-2 bg-emerald-50 rounded-xl text-xs font-black text-emerald-700 border border-emerald-100">
          ✓ Tugas hari ini telah selesai (Sudah Check-Out).
        </div>
      )}
    </div>
  );
}