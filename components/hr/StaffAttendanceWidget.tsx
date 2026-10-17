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
  const activeStaffName = currentUser?.active_staff_name || currentUser?.username || '';
  const activeRole = currentUser?.role || 'CREW';

  const [activeAttendance, setActiveAttendance] = useState<any | null>(null);
  const [shift, setShift] = useState<'SHIFT_1' | 'SHIFT_2' | 'OFFICE'>('SHIFT_1');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const checkTodayAttendance = async () => {
    if (!activeStaffName || !activeLocationId) return;

    const { data } = await supabase
      .from('staff_attendances')
      .select('*')
      .eq('attendance_date', todayStr)
      .eq('staff_name', activeStaffName)
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setActiveAttendance(data[0]);
    } else {
      setActiveAttendance(null);
    }
  };

  useEffect(() => {
    checkTodayAttendance();
  }, [activeStaffName, activeLocationId]);

  // Fungsi helper mengambil titik koordinat GPS dari browser/HP
  const getCurrentCoordinates = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Perangkat / browser Anda tidak mendukung fitur lokasi GPS.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          let errMsg = 'Gagal mendeteksi lokasi GPS.';
          if (err.code === err.PERMISSION_DENIED) {
            errMsg = 'Izin lokasi (GPS) ditolak. Mohon aktifkan izin lokasi di browser Anda untuk presensi.';
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            errMsg = 'Sinyal GPS lokasi tidak terdeteksi.';
          } else if (err.code === err.TIMEOUT) {
            errMsg = 'Waktu deteksi lokasi habis. Silakan coba lagi.';
          }
          reject(new Error(errMsg));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const handleClockIn = async () => {
    setLoading(true);
    setMessage(null);
    try {
      if (!activeLocationId) throw new Error('Lokasi tugas outlet belum terdeteksi.');

      // 1. Ambil koordinat GPS perangkat
      const coords = await getCurrentCoordinates();

      // 2. Simpan presensi beserta koordinat lokasi
      const { data, error } = await supabase
        .from('staff_attendances')
        .insert({
          staff_name: activeStaffName,
          role: activeRole,
          location_id: activeLocationId,
          attendance_date: todayStr,
          shift,
          clock_in: new Date().toISOString(),
          clock_in_lat: coords.lat,
          clock_in_lng: coords.lng,
        })
        .select()
        .single();

      if (error) throw error;
      setActiveAttendance(data);
      setMessage({
        text: `Berhasil Check-In pada ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA dengan lokasi GPS terverifikasi.`,
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
      // 1. Ambil koordinat GPS saat pulang/selesai
      const coords = await getCurrentCoordinates();

      // 2. Update jam keluar dan koordinat
      const { data, error } = await supabase
        .from('staff_attendances')
        .update({
          clock_out: new Date().toISOString(),
          clock_out_lat: coords.lat,
          clock_out_lng: coords.lng,
        })
        .eq('id', activeAttendance.id)
        .select()
        .single();

      if (error) throw error;
      setActiveAttendance(data);
      setMessage({
        text: `Berhasil Check-Out pada ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA. Lokasi kepulangan tercatat.`,
        type: 'success',
      });
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal check-out', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs space-y-3">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">
              Presensi Tugas & Lokasi GPS
            </h3>
            <p className="text-[10px] text-slate-400">
              {currentUser?.location_name || 'Outlet'} • {activeRole}
            </p>
          </div>
        </div>

        {/* Pilihan Shift */}
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

      {/* Status Presensi & Info GPS */}
      <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl">
        <div className="space-y-0.5">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Petugas Saat Ini</div>
          <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
            <User className="w-3 h-3 text-indigo-600" />
            <span>{activeStaffName}</span>
          </div>
        </div>

        {activeAttendance?.clock_in && (
          <div className="text-right space-y-1">
            <div className="flex items-center justify-end gap-1">
              <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase">
                In: {new Date(activeAttendance.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {activeAttendance.clock_in_lat && (
                <a
                  href={`https://www.google.com/maps?q=${activeAttendance.clock_in_lat},${activeAttendance.clock_in_lng}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Lihat Titik GPS Masuk"
                  className="text-indigo-600 hover:text-indigo-800 bg-white p-1 rounded-md border border-slate-200 inline-flex items-center"
                >
                  <MapPin className="w-2.5 h-2.5" />
                </a>
              )}
            </div>

            {activeAttendance.clock_out && (
              <div className="flex items-center justify-end gap-1">
                <span className="text-[9px] font-black text-slate-500 bg-slate-200 px-2 py-0.5 rounded-md uppercase">
                  Out: {new Date(activeAttendance.clock_out).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {activeAttendance.clock_out_lat && (
                  <a
                    href={`https://www.google.com/maps?q=${activeAttendance.clock_out_lat},${activeAttendance.clock_out_lng}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Lihat Titik GPS Pulang"
                    className="text-indigo-600 hover:text-indigo-800 bg-white p-1 rounded-md border border-slate-200 inline-flex items-center"
                  >
                    <MapPin className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tombol Aksi */}
      {!activeAttendance ? (
        <button
          onClick={handleClockIn}
          disabled={loading || !activeStaffName}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>{loading ? 'Mendeteksi Lokasi...' : 'Check-In Masuk (Verifikasi Lokasi)'}</span>
        </button>
      ) : !activeAttendance.clock_out ? (
        <button
          onClick={handleClockOut}
          disabled={loading}
          className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{loading ? 'Merekam Lokasi Pulang...' : 'Check-Out Selesai Tugas'}</span>
        </button>
      ) : (
        <div className="text-center py-1 text-xs font-bold text-emerald-600">
          ✓ Tugas hari ini telah selesai (Sudah Check-Out).
        </div>
      )}
    </div>
  );
}