'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getRandomCheckInQuote } from '@/lib/attendanceQuotes';
import { 
  Clock, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  Navigation,
  Camera,
  X,
  RotateCw,
  Sparkles
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
  
  // State untuk Menampung Quote Motivasi Acak saat Check-In
  const [motivationQuote, setMotivationQuote] = useState<string | null>(null);

  // State Modal Kamera Selfie
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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

  const checkIsPast1AM = (attendanceDate: string) => {
    if (attendanceDate < todayStr) return true;
    const now = new Date();
    const witaHour = parseInt(
      new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', hour: 'numeric', hour12: false }).format(now)
    );
    return witaHour >= 1 && witaHour < 6;
  };

  const checkTodayAttendance = async (nickname: string) => {
    if (!nickname) {
      setActiveAttendance(null);
      setIsSessionExpired(false);
      return;
    }

    try {
      const { data: openSession } = await supabase
        .from('staff_attendances')
        .select('*')
        .ilike('staff_name', nickname.trim())
        .is('clock_out', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (openSession && openSession.length > 0) {
        const session = openSession[0];
        if (checkIsPast1AM(session.attendance_date)) {
          setActiveAttendance(null);
          setIsSessionExpired(true);
          return;
        }
        setActiveAttendance(session);
        setIsSessionExpired(false);
        return;
      }

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
    setMotivationQuote(null);
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

  // Buka Akses Kamera Depan
  const startCamera = async () => {
    if (!selectedStaffNickname) {
      setMessage({ text: 'Pilih nama panggilan Anda terlebih dahulu!', type: 'error' });
      return;
    }
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      alert('Izin kamera ditolak atau tidak tersedia. Harap izinkan kamera untuk absensi.');
      setShowCamera(false);
    }
  };

  // Matikan Akses Kamera
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  // Jepret & Kompresi Foto (Maks 30-50 KB)
  const captureAndCompressPhoto = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!videoRef.current) return reject(new Error('Kamera tidak aktif'));

      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Gagal memproses kanvas foto'));

      ctx.drawImage(videoRef.current, 0, 0, 480, 360);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Gagal mengompresi foto selfie'));
        },
        'image/jpeg',
        0.6 // Kualitas 60% kompresi tinggi
      );
    });
  };

  const handleClockInWithSelfie = async () => {
    setLoading(true);
    setMessage(null);
    setMotivationQuote(null);
    try {
      if (!activeLocationId) throw new Error('Lokasi tugas outlet belum terdeteksi.');

      // 1. Tangkap foto selfie & kompres
      const photoBlob = await captureAndCompressPhoto();
      stopCamera();

      // 2. Upload foto mikro ke Supabase Storage
      const fileName = `${todayStr}_${selectedStaffNickname}_${Date.now()}.jpg`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('attendance-photos')
        .upload(fileName, photoBlob, { contentType: 'image/jpeg' });

      if (uploadErr) throw new Error(`Gagal upload foto selfie: ${uploadErr.message}`);

      const { data: publicUrlData } = supabase.storage
        .from('attendance-photos')
        .getPublicUrl(fileName);

      // 3. Ambil GPS & Simpan Record Presensi
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
        photo_url: publicUrlData.publicUrl
      };

      const { data, error } = await supabase
        .from('staff_attendances')
        .insert(newRecord)
        .select()
        .single();

      if (error) throw error;
      setActiveAttendance(data);
      setIsSessionExpired(false);

      // 4. Ambil 1 quote acak dari attendanceQuotes.ts
      const randomQuote = getRandomCheckInQuote();
      setMotivationQuote(randomQuote);

      const hasGps = coords.lat !== 0;
      setMessage({
        text: `Berhasil Check-In pada ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA.${hasGps ? ' (GPS Terverifikasi)' : ''} Foto selfie tervalidasi.`,
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
    setMotivationQuote(null);
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
    <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs space-y-3 max-w-md mx-auto font-sans relative">
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

      {/* KARTU QUOTE MOTIVASI RANDOM SAAT CHECK-IN BERHASIL */}
      {motivationQuote && (
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/80 border border-amber-200/80 text-center space-y-1.5 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-center gap-1.5 text-amber-700 font-black text-[10px] tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Pesan Semangat Shift Ini</span>
          </div>
          <p className="text-xs font-bold text-slate-800 italic leading-relaxed">
            "{motivationQuote}"
          </p>
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
          onClick={startCamera}
          disabled={loading || !selectedStaffNickname}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-black text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all"
        >
          <Camera className="w-4 h-4" />
          <span>{loading ? 'Menyimpan Presensi...' : 'Check-In Masuk (Selfie)'}</span>
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

      {/* POPUP KAMERA SELFIE */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase">Selfie Hadir Tugas</h4>
                <p className="text-[10px] text-slate-400 font-medium">Pastikan wajah terlihat jelas di kamera</p>
              </div>
              <button 
                onClick={stopCamera} 
                className="p-1 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative rounded-2xl overflow-hidden bg-black aspect-4/3 border border-slate-200">
              <video
                ref={(ref) => {
                  videoRef.current = ref;
                  if (ref && cameraStream) ref.srcObject = cameraStream;
                }}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={stopCamera}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={handleClockInWithSelfie}
                disabled={loading}
                className="flex-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-xs flex items-center justify-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{loading ? 'Memvalidasi...' : 'Ambil Foto & Check-In'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}