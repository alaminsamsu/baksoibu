zz'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Users, 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  MapPin, 
  Activity, 
  UserCheck, 
  RefreshCw,
  ExternalLink 
} from 'lucide-react';

export default function LiveExecutiveSummary() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const todayStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());
  }, []);

  const loadLiveData = async () => {
    setLoading(true);
    try {
      const [locRes, empRes, attRes] = await Promise.all([
        supabase.from('locations').select('id, name').order('name'),
        supabase.from('staff_profiles').select('*').eq('is_active', true),
        supabase.from('staff_attendances').select('*').eq('attendance_date', todayStr)
      ]);

      if (locRes.data) setLocations(locRes.data);
      if (empRes.data) setEmployees(empRes.data);
      if (attRes.data) setAttendances(attRes.data);
    } catch (err) {
      console.error('Gagal mengambil ringkasan live:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLiveData();
    // Auto-refresh setiap 60 detik untuk mode live
    const interval = setInterval(loadLiveData, 60000);
    return () => clearInterval(interval);
  }, [todayStr]);

  // Statistik Utama
  const stats = useMemo(() => {
    const totalPegawai = employees.length;
    // On duty = sudah check-in dan belum check-out
    const onDuty = attendances.filter((a) => a.clock_in && !a.clock_out);
    const sudahHadir = attendances.filter((a) => a.clock_in);
    const totalHadirCount = sudahHadir.length;
    const persentaseHadir = totalPegawai > 0 ? Math.round((totalHadirCount / totalPegawai) * 100) : 0;

    // Deteksi keterlambatan (asumsi shift 1 buka jam 09:30, toleransi s/d 10:00)
    const terlambat = attendances.filter((a) => {
      if (!a.clock_in) return false;
      const inDate = new Date(a.clock_in);
      const jam = inDate.getHours();
      const menit = inDate.getMinutes();
      return jam > 10 || (jam === 10 && menit > 0);
    });

    return {
      totalPegawai,
      onDutyCount: onDuty.length,
      totalHadirCount,
      persentaseHadir,
      terlambatCount: terlambat.length,
      terlambatList: terlambat
    };
  }, [employees, attendances]);

  // Group per Outlet
  const outletSummaries = useMemo(() => {
    return locations.map((loc) => {
      // Staf yang terdaftar di lokasi ini
      const staffInLoc = employees.filter((e) => e.primary_location_id === loc.id);
      
      // Presensi yang masuk di lokasi ini hari ini
      const attInLoc = attendances.filter((a) => a.location_id === loc.id);
      
      // Cari Leader yang sedang bertugas
      const activeLeader = attInLoc.find(
        (a) => (a.role === 'LEADER' || a.role === 'SUPERVISOR') && !a.clock_out
      );

      // Staf aktif bertugas (on-duty)
      const onDutyStaff = attInLoc.filter((a) => a.clock_in && !a.clock_out);

      // Cek apakah ada presensi tanpa GPS
      const hasMissingGps = attInLoc.some((a) => !a.clock_in_lat || a.clock_in_lat === 0);

      return {
        ...loc,
        totalRegistered: staffInLoc.length,
        attCount: attInLoc.length,
        onDutyStaff,
        activeLeaderName: activeLeader?.staff_name || null,
        hasMissingGps
      };
    });
  }, [locations, employees, attendances]);

  return (
    <div className="space-y-4">
      {/* Top Banner & Aksi Segarkan */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
            Live Kendali Operasional Staf & Outlet
          </h3>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            WITA (Real-Time)
          </span>
        </div>
        <button
          onClick={loadLiveData}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-xl border border-slate-100 text-[11px] font-bold transition-all"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync</span>
        </button>
      </div>

      {/* 4 Kartu Metrik Utama */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold">Tingkat Kehadiran</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{stats.persentaseHadir}%</span>
            <span className="text-[10px] font-bold text-slate-400">
              ({stats.totalHadirCount}/{stats.totalPegawai})
            </span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold">Sedang On-Duty</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-600">{stats.onDutyCount}</span>
            <span className="text-[10px] font-bold text-slate-400">Petugas Aktif</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold">Indikasi Telat</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-black ${stats.terlambatCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
              {stats.terlambatCount}
            </span>
            <span className="text-[10px] font-bold text-slate-400">Orang</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold">Belum Absen</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-rose-600">
              {stats.totalPegawai - stats.totalHadirCount}
            </span>
            <span className="text-[10px] font-bold text-slate-400">Orang</span>
          </div>
        </div>
      </div>

      {/* Status Tiap Outlet & Penanggung Jawab */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {outletSummaries.map((out) => (
          <div key={out.id} className="p-4 bg-white rounded-3xl border border-slate-100 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-600" />
                <span className="font-black text-sm text-slate-900">{out.name}</span>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                out.onDutyStaff.length > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {out.onDutyStaff.length > 0 ? 'Outlet Aktif' : 'Belum Ada Kru'}
              </span>
            </div>

            {/* Leader yang bertugas */}
            <div className="bg-slate-50 p-2.5 rounded-xl text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Leader Shift:</span>
                {out.activeLeaderName ? (
                  <span className="font-extrabold text-indigo-700 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                    {out.activeLeaderName}
                  </span>
                ) : (
                  <span className="font-bold text-amber-600 text-[10px]">
                    ⚠️ Belum Ada Leader On-Duty
                  </span>
                )}
              </div>
            </div>

            {/* Staf Bertugas Saat Ini */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                <span>Petugas di Tempat ({out.onDutyStaff.length})</span>
                {out.hasMissingGps ? (
                  <span className="text-amber-500 text-[9px]">Titik GPS Sebagian Null</span>
                ) : (
                  <span className="text-emerald-600 text-[9px]">✓ GPS Valid</span>
                )}
              </div>
              
              <div className="flex flex-wrap gap-1.5">
                {out.onDutyStaff.length === 0 ? (
                  <span className="text-[11px] text-slate-400 italic">Belum ada kru check-in</span>
                ) : (
                  out.onDutyStaff.map((staff: any) => (
                    <span 
                      key={staff.id} 
                      className="px-2 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg text-slate-700 font-bold text-[10px] flex items-center gap-1 transition-all"
                    >
                      <UserCheck className="w-3 h-3 text-emerald-600" />
                      {staff.staff_name}
                      {staff.clock_in_lat && (
                        <a 
                          href={`https://www.google.com/maps?q=${staff.clock_in_lat},${staff.clock_in_lng}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Lihat Peta"
                          className="text-slate-400 hover:text-indigo-600"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}