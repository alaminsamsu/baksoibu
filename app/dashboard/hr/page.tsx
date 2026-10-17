'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  LogOut, 
  ShieldCheck, 
  MapPin, 
  CalendarCheck,
  UserCheck
} from 'lucide-react';
import StaffManagementView from '@/components/hr/StaffManagementView';
import { supabase } from '@/lib/supabaseClient';

export default function HRDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [stats, setStats] = useState({
    totalStaff: 0,
    presentToday: 0,
    activeLocations: 0
  });

  useEffect(() => {
    const sessionStr = localStorage.getItem('baksoibu_active_staff');
    if (!sessionStr) {
      router.push('/login');
      return;
    }

    const session = JSON.parse(sessionStr);
    const role = (session.role || '').toUpperCase();

    if (role !== 'HR' && role !== 'OWNER') {
      router.push('/login');
      return;
    }

    setCurrentUser(session);

    const fetchHRStats = async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0];

        const [{ count: totalStaffCount }, { count: presentCount }, { data: locs }] = await Promise.all([
          supabase.from('staff_profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('staff_attendances').select('*', { count: 'exact', head: true }).eq('attendance_date', todayStr),
          supabase.from('locations').select('id')
        ]);

        setStats({
          totalStaff: totalStaffCount || 0,
          presentToday: presentCount || 0,
          activeLocations: locs ? locs.length : 0
        });
      } catch (e) {
        console.error('Error fetching HR stats:', e);
      }
    };

    fetchHRStats();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('baksoibu_active_staff');
    router.push('/login');
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
                HR Management Portal
              </h1>
              <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                SDM & Presensi
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-400 mt-1">
              Bakso Ibu • Pemantauan Presensi GPS, Jam Kerja & Direktori Karyawan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <span className="text-xs font-black text-slate-800 block leading-tight">
              {currentUser?.username?.toUpperCase() || 'TIM HR'}
            </span>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center justify-end gap-1">
              <ShieldCheck className="w-3 h-3" /> Akses Terverifikasi
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

      {/* Konten Dashboard Khusus HR */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Karyawan Aktif
              </span>
              <p className="text-xl font-black text-slate-900 mt-0.5">
                {stats.totalStaff} <span className="text-xs font-medium text-slate-400">Orang</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Presensi Hari Ini
              </span>
              <p className="text-xl font-black text-emerald-600 mt-0.5">
                {stats.presentToday} <span className="text-xs font-medium text-slate-400">Tercatat</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CalendarCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Cakupan Unit Outlet
              </span>
              <p className="text-xl font-black text-slate-800 mt-0.5">
                {stats.activeLocations} <span className="text-xs font-medium text-slate-400">Lokasi</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Tabel Rekap Presensi GPS & Database Karyawan */}
        <StaffManagementView />
      </main>
    </div>
  );
}