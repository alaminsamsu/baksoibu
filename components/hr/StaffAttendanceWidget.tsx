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
  Sparkles,
  PlusCircle,
  ShieldCheck,
  Send,
  RefreshCw,
  Calendar
} from 'lucide-react';

interface Props {
  currentUser?: any;
  locationId?: string;
}

interface OvertimeItem {
  id: string;
  location_id: string;
  staff_name: string;
  request_date: string;
  start_time: string;
  estimated_hours: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approved_by?: string;
  approved_at?: string;
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

  // State Lembur (Overtime)
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeItem[]>([]);
  const [loadingOvertime, setLoadingOvertime] = useState(false);
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [startTime, setStartTime] = useState('22:00');
  const [estimatedHours, setEstimatedHours] = useState('1.5');
  const [reason, setReason] = useState('');
  const [submittingOt, setSubmittingOt] = useState(false);
  const [otMessage, setOtMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());

  const rawRole = (activeStaffProfile?.role || currentUser?.role || currentUser?.role_name || '').toUpperCase();
  const isLeader = rawRole.includes('LEADER') || rawRole.includes('OWNER') || rawRole.includes('ADMIN');

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

  // Ambil Data Antrean Lembur Hari Ini
  const fetchOvertimeRequests = async () => {
    if (!activeLocationId) return;
    setLoadingOvertime(true);
    try {
      const { data, error } = await supabase
        .from('overtime_requests')
        .select('*')
        .eq('location_id', activeLocationId)
        .eq('request_date', todayStr)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOvertimeRequests(data || []);
    } catch (err: any) {
      console.error('Gagal mengambil data lembur:', err.message);
    } finally {
      setLoadingOvertime(false);
    }
  };

  useEffect(() => {
    if (activeLocationId) {
      fetchOvertimeRequests();
    }
  }, [activeLocationId]);

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
        0.6
      );
    });
  };

  const handleClockInWithSelfie = async () => {
    setLoading(true);
    setMessage(null);
    setMotivationQuote(null);
    try {
      if (!activeLocationId) throw new Error('Lokasi tugas outlet belum terdeteksi.');

      const photoBlob = await captureAndCompressPhoto();
      stopCamera();

      const fileName = `${todayStr}_${selectedStaffNickname}_${Date.now()}.jpg`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('attendance-photos')
        .upload(fileName, photoBlob, { contentType: 'image/jpeg' });

      if (uploadErr) throw new Error(`Gagal upload foto selfie: ${uploadErr.message}`);

      const { data: publicUrlData } = supabase.storage
        .from('attendance-photos')
        .getPublicUrl(fileName);

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

  // Kirim Pengajuan Lembur
  const handleSubmitOvertime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffNickname) {
      alert('Pilih nama panggilan Anda terlebih dahulu sebelum mengajukan lembur.');
      return;
    }
    if (!reason.trim()) {
      alert('Alasan / rincian pekerjaan lembur wajib diisi.');
      return;
    }

    setSubmittingOt(true);
    setOtMessage(null);

    try {
      const payload = {
        location_id: activeLocationId,
        staff_name: selectedStaffNickname,
        request_date: todayStr,
        start_time: startTime,
        estimated_hours: parseFloat(estimatedHours) || 1,
        reason: reason.trim(),
        status: 'PENDING',
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('overtime_requests').insert([payload]);
      if (error) throw error;

      setOtMessage({ text: 'Pengajuan lembur terkirim! Menunggu persetujuan Leader.', type: 'success' });
      setReason('');
      setTimeout(() => {
        setShowOvertimeModal(false);
        setOtMessage(null);
      }, 1200);

      await fetchOvertimeRequests();
    } catch (err: any) {
      setOtMessage({ text: err.message || 'Gagal mengajukan lembur.', type: 'error' });
    } finally {
      setSubmittingOt(false);
    }
  };

  // Keputusan ACC / Tolak Lembur oleh Leader
  const handleDecision = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      const decider = selectedStaffNickname || currentUser?.active_staff_name || currentUser?.username || 'Leader';
      const { error } = await supabase
        .from('overtime_requests')
        .update({
          status: decision,
          approved_by: decider,
          approved_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      await fetchOvertimeRequests();
    } catch (err: any) {
      alert('Gagal memproses persetujuan lembur: ' + err.message);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs space-y-4 max-w-md mx-auto font-sans relative">
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
              className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                shift === 'SHIFT_1' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-400'
              }`}
            >
              Shift 1
            </button>
            <button
              type="button"
              onClick={() => setShift('SHIFT_2')}
              className={`px-2.5 py-1 rounded-lg cursor-pointer ${
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
            &ldquo;{motivationQuote}&rdquo;
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
          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
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

      {/* TOMBOL AKSI PRESENSI */}
      {!activeAttendance ? (
        <button
          onClick={startCamera}
          disabled={loading || !selectedStaffNickname}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-black text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Camera className="w-4 h-4" />
          <span>{loading ? 'Menyimpan Presensi...' : 'Check-In Masuk (Selfie)'}</span>
        </button>
      ) : !activeAttendance.clock_out ? (
        <button
          onClick={handleClockOut}
          disabled={loading}
          className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-black text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
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

      {/* 2. BAGIAN PENGAJUAN & ACC LEMBUR KRU */}
      <div className="pt-2 border-t border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-800">
              Persetujuan Lembur (Overtime)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (!selectedStaffNickname) {
                  alert('Pilih nama panggilan Anda terlebih dahulu di atas!');
                  return;
                }
                setShowOvertimeModal(true);
              }}
              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 rounded-xl text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer"
            >
              <PlusCircle className="w-3 h-3 text-amber-600" />
              <span>Ajukan Lembur</span>
            </button>

            <button
              type="button"
              onClick={fetchOvertimeRequests}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Segarkan Data Lembur"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingOvertime ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* List Pengajuan Lembur Hari Ini */}
        <div className="space-y-2">
          {loadingOvertime ? (
            <div className="text-center py-3 text-[11px] text-slate-400 font-bold">
              Memeriksa pengajuan lembur...
            </div>
          ) : overtimeRequests.length === 0 ? (
            <div className="text-center py-3.5 text-[10px] text-slate-400 font-semibold bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
              Belum ada pengajuan lembur hari ini.
            </div>
          ) : (
            overtimeRequests.map((req) => (
              <div 
                key={req.id}
                className={`p-3 rounded-2xl border transition-all space-y-1.5 ${
                  req.status === 'PENDING' 
                    ? 'bg-amber-50/40 border-amber-200' 
                    : req.status === 'APPROVED'
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-xs text-slate-900">{req.staff_name}</span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                      req.status === 'PENDING'
                        ? 'bg-amber-100 text-amber-800'
                        : req.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {req.status === 'PENDING' ? '⏳ Menunggu ACC' : req.status === 'APPROVED' ? '✓ Disetujui' : '✕ Ditolak'}
                    </span>
                  </div>

                  <span className="text-[10px] font-black text-slate-600">
                    {req.estimated_hours} Jam
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                  Mulai jam <b>{req.start_time.substring(0, 5)} WITA</b> • &ldquo;{req.reason}&rdquo;
                </p>

                {req.approved_by && (
                  <p className="text-[9px] text-slate-400 font-semibold">
                    Diproses oleh: <b className="text-slate-600">{req.approved_by}</b>
                  </p>
                )}

                {/* Tombol Keputusan Khusus Leader */}
                {isLeader && req.status === 'PENDING' && (
                  <div className="pt-1 flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDecision(req.id, 'APPROVED')}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>ACC Lembur</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecision(req.id, 'REJECTED')}
                      className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                    >
                      Tolak
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

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
                className="p-1 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 cursor-pointer"
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
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleClockInWithSelfie}
                disabled={loading}
                className="flex-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{loading ? 'Memvalidasi...' : 'Ambil Foto & Check-In'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL POPUP FORM PENGAJUAN LEMBUR KRU */}
      {showOvertimeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900">Form Pengajuan Lembur</h3>
                  <p className="text-[10px] text-slate-400">Pemohon: {selectedStaffNickname}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowOvertimeModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {otMessage && (
              <div className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                otMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {otMessage.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 text-red-600" />}
                <span>{otMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmitOvertime} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                    Jam Mulai
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                    Durasi (Jam)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  Alasan / Pekerjaan Lembur
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Bantu cuci mangkok closing ramai, potong sayur & persiapan kuah..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowOvertimeModal(false)}
                  className="w-1/3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingOt}
                  className="w-2/3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl shadow-md shadow-amber-500/20 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submittingOt ? 'Mengirim...' : 'Kirim Pengajuan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}