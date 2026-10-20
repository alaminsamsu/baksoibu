'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  ShieldCheck, 
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

  // Ambil tanggal hari ini dalam format lokal Indonesia & UTC untuk toleransi query
  const dateFilters = useMemo(() => {
    const wita = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());
    const utc = new Date().toISOString().split('T')[0];
    return Array.from(new Set([wita, utc]));
  }, []);

  const loadLiveData = async () => {
    setLoading(true);
    try {
      const [locRes, empRes, attRes] = await Promise.all([
        supabase.from('locations').select('id, name').order('name'),
        supabase.from('staff_profiles').select('*').eq('is_active', true),
        supabase.from('staff_attendances').select('*').in('attendance_date', dateFilters)
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
    const interval = setInterval(loadLiveData, 30000); // Sinkronisasi otomatis setiap 30 detik
    return () => clearInterval(interval);
  }, [dateFilters]);

  // Statistik Utama (Hanya On-Duty dan Total Masuk)
  const stats = useMemo(() => {
    const onDuty = attendances.filter((a) => a.clock_in && !a.clock_out);
    const sudahHadir = attendances.filter((a) => a.clock_in);

    return {
      onDutyCount: onDuty.length,
      totalHadirCount: sudahHadir.length
    };
  }, [attendances]);

  // Kelompokkan per Outlet + Kategori Cabang Bebas/Mobile
  const outletSummaries = useMemo(() => {
    const list = locations.map((loc) => {
      const attInLoc = attendances.filter((a) => String(a.location_id).toLowerCase() === String(loc.id).toLowerCase());
      const activeLeader = attInLoc.find(
        (a) => (a.role === 'LEADER' || a.role === 'SUPERVISOR') && !a.clock_out
      );
      const onDutyStaff = attInLoc.filter((a) => a.clock_in && !a.clock_out);

      return {
        id: loc.id,
        name: loc.name,
        attCount: attInLoc.length,
        onDutyStaff,
        activeLeaderName: activeLeader?.staff_name || null
      };
    });

    // Staf kantor pusat / mobile yang tidak cocok dengan ID outlet tertentu
    const otherAtt = attendances.filter((a) => 
      !locations.some((l) => String(l.id).toLowerCase() === String(a.location_id).toLowerCase())
    );

    if (otherAtt.length > 0) {
      list.push({
        id: 'other',
        name: 'Kantor Pusat / Mobile',
        attCount: otherAtt.length,
        onDutyStaff: otherAtt.filter((a) => a.clock_in && !a.clock_out),
        activeLeaderName: null
      });
    }

    return list;
  }, [locations, attendances]);

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
            Live Kendali Operasional Staf & Outlet
          </h3>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            Real-Time
          </span>
        </div>
        <button
          onClick={loadLiveData}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-slate-500 hover:text-indigo-600 bg-white hover:bg-indigo-50 rounded-xl border border-slate-200 text-[11px] font-bold shadow-2xs transition-all"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync Data</span>
        </button>
      </div>

      {/* 2 Kartu Metrik Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-2xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <span className="text-[11px] font-bold">Sedang On-Duty</span>
              <Activity className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-emerald-600">{stats.onDutyCount}</span>
              <span className="text-[10px] font-bold text-slate-400">Petugas Aktif di Cabang</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-2xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <span className="text-[11px] font-bold">Total Terdata Masuk</span>
              <Clock className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-800">{stats.totalHadirCount}</span>
              <span className="text-[10px] font-bold text-slate-400">Presensi Hari Ini</span>
            </div>
          </div>
        </div>
      </div>

      {/* Rincian Petugas di Tiap Outlet */}
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
                {out.onDutyStaff.length > 0 ? 'Aktif' : 'Kosong'}
              </span>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-xl text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Leader Shift:</span>
                {out.activeLeaderName ? (
                  <span className="font-extrabold text-indigo-700 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                    {out.activeLeaderName}
                  </span>
                ) : (
                  <span className="font-bold text-slate-400 text-[10px]">
                    Belum Ada Leader
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                Petugas di Tempat ({out.onDutyStaff.length})
              </span>
              
              <div className="flex flex-wrap gap-1.5">
                {out.onDutyStaff.length === 0 ? (
                  <span className="text-[11px] text-slate-400 italic">Belum ada kru check-in</span>
                ) : (
                  out.onDutyStaff.map((staff: any) => (
                    <span 
                      key={staff.id} 
                      className="px-2 py-1 bg-slate-100 rounded-lg text-slate-700 font-bold text-[10px] flex items-center gap-1"
                    >
                      <UserCheck className="w-3 h-3 text-emerald-600" />
                      {staff.staff_name}
                      {staff.clock_in_lat && (
                        <a 
                          href={`https://www.google.com/maps?q=${staff.clock_in_lat},${staff.clock_in_lng}`}
                          target="_blank"
                          rel="noreferrer"
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