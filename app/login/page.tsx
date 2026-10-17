'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  Store, 
  Factory, 
  ShieldCheck, 
  Crown, 
  Users, 
  Lock, 
  User, 
  ArrowRight,
  AlertCircle 
} from 'lucide-react';

type RoleTab = 'outlet' | 'produksi' | 'admin' | 'hr' | 'owner';

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<RoleTab>('outlet');
  const [username, setUsername] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleTabChange = (tab: RoleTab) => {
    setActiveTab(tab);
    setErrorMsg(null);
    if (tab === 'admin') setUsername('admin');
    else if (tab === 'hr') setUsername('hr');
    else if (tab === 'owner') setUsername('owner');
    else setUsername('');
    setPinCode('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Cari data akun di tabel users
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username.trim().toLowerCase())
        .single();

      if (error || !user) {
        throw new Error('ID Akun tidak ditemukan.');
      }

      // 2. Validasi PIN / Password
      const inputPass = pinCode.trim();
      const validPass = user.pin_code || user.pin || user.password;

      if (validPass && inputPass !== String(validPass)) {
        throw new Error('Password / PIN salah.');
      }

      // 3. Simpan sesi aktif ke localStorage
      const sessionData = {
        id: user.id,
        username: user.username,
        role: user.role,
        location_id: user.location_id || null,
        location_name: user.location_name || (user.location_id ? 'Outlet Cabang' : 'Pusat')
      };
      localStorage.setItem('baksoibu_active_staff', JSON.stringify(sessionData));

      // 4. Arahkan ke rute dashboard sesuai peran
      const userRole = (user.role || '').toUpperCase();

      if (userRole === 'OWNER') {
        router.push('/dashboard/executive');
      } else if (userRole === 'HR') {
        // HR diarahkan langsung ke panel kendali HR
        router.push('/dashboard/executive');
      } else if (userRole === 'ADMIN') {
        router.push('/dashboard/admin');
      } else if (userRole === 'PRODUKSI' || userRole.includes('KITCHEN')) {
        router.push('/dashboard/produksi');
      } else {
        router.push('/dashboard/outlet');
      }

    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal masuk ke sistem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fd] flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full space-y-6">
        
        {/* Logo & Judul */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-3xl bg-indigo-600 text-white items-center justify-center shadow-lg shadow-indigo-600/30">
            <Store className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Bakso Ibu ERP
          </h1>
          <p className="text-xs font-semibold text-slate-400">
            Portal Akses Berdasarkan Peran & Divisi
          </p>
        </div>

        {/* Tab Pilihan Peran */}
        <div className="grid grid-cols-5 bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-xs gap-1">
          <button
            type="button"
            onClick={() => handleTabChange('outlet')}
            className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'outlet'
                ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 font-black shadow-xs'
                : 'text-slate-400 hover:text-slate-600 font-bold'
            }`}
          >
            <Store className="w-4 h-4" />
            <span className="text-[10px]">Outlet</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('produksi')}
            className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'produksi'
                ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 font-black shadow-xs'
                : 'text-slate-400 hover:text-slate-600 font-bold'
            }`}
          >
            <Factory className="w-4 h-4" />
            <span className="text-[10px]">Produksi</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('admin')}
            className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'admin'
                ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 font-black shadow-xs'
                : 'text-slate-400 hover:text-slate-600 font-bold'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="text-[10px]">Admin</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('hr')}
            className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'hr'
                ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 font-black shadow-xs'
                : 'text-slate-400 hover:text-slate-600 font-bold'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="text-[10px]">HR</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('owner')}
            className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'owner'
                ? 'bg-amber-50 border border-amber-200 text-amber-600 font-black shadow-xs'
                : 'text-slate-400 hover:text-slate-600 font-bold'
            }`}
          >
            <Crown className="w-4 h-4" />
            <span className="text-[10px]">Owner</span>
          </button>
        </div>

        {/* Card Form Login */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-xs font-black text-slate-800">
            {activeTab === 'owner' ? (
              <Crown className="w-4 h-4 text-amber-500" />
            ) : activeTab === 'hr' ? (
              <Users className="w-4 h-4 text-indigo-600" />
            ) : activeTab === 'admin' ? (
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
            ) : activeTab === 'produksi' ? (
              <Factory className="w-4 h-4 text-indigo-600" />
            ) : (
              <Store className="w-4 h-4 text-indigo-600" />
            )}
            <span>
              {activeTab === 'outlet' && 'Masuk Outlet & Kru Lapangan'}
              {activeTab === 'produksi' && 'Masuk Dapur Rumah Produksi'}
              {activeTab === 'admin' && 'Masuk Admin Operasional'}
              {activeTab === 'hr' && 'Masuk HR & Manajemen SDM'}
              {activeTab === 'owner' && 'Masuk Executive Owner'}
            </span>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200/80 rounded-2xl flex items-center gap-2 text-xs font-bold text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs font-bold">
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-slate-400 block font-black">
                ID Akun / Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase text-slate-400 block font-black">
                Password / PIN
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  placeholder="Masukkan PIN / Password"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-2xl text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all ${
                activeTab === 'owner'
                  ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/25'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25'
              } disabled:opacity-50`}
            >
              <span>{loading ? 'Memverifikasi...' : 'Buka Dashboard'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}