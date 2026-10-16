'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Store, User, Lock, ArrowRight, AlertCircle, ShieldCheck, Crown, Briefcase } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [roleType, setRoleType] = useState<'owner' | 'admin' | 'outlet'>('outlet');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function getLocations() {
      const { data } = await supabase.from('locations').select('*').order('name');
      if (data && data.length > 0) {
        setLocations(data);
        setSelectedLocation(data[0].id);
      }
    }
    getLocations();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const cleanUser = username.trim();
      const loc = locations.find((l) => l.id === selectedLocation);

      if (roleType === 'owner') {
        const sessionData = {
          username: cleanUser || 'Owner',
          active_staff_name: cleanUser || 'Owner',
          role: 'OWNER',
          location_id: null,
          location_name: 'Semua Cabang (Pusat)',
        };
        localStorage.setItem('baksoibu_active_staff', JSON.stringify(sessionData));
        router.push('/dashboard/executive');
        return;
      }

      if (roleType === 'admin') {
        const sessionData = {
          username: cleanUser || 'Admin Pusat',
          active_staff_name: cleanUser || 'Admin Pusat',
          role: 'ADMIN',
          location_id: null,
          location_name: 'Pusat Operasional',
        };
        localStorage.setItem('baksoibu_active_staff', JSON.stringify(sessionData));
        router.push('/dashboard/admin');
        return;
      }

      // Role Outlet / Leader
      const sessionData = {
        username: cleanUser,
        active_staff_name: cleanUser,
        location_id: selectedLocation,
        location_name: loc?.name?.replace(/Outlet\s+/i, '') || 'BTP',
        role: 'LEADER',
      };
      localStorage.setItem('baksoibu_active_staff', JSON.stringify(sessionData));
      router.push('/dashboard/outlet');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal masuk ke sistem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fd] flex flex-col items-center justify-center p-4 font-sans text-slate-800">
      <div className="w-full max-w-md">
        {/* Brand Icon & Heading */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-xl shadow-indigo-600/20 mx-auto mb-3">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Bakso Ibu ERP</h1>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            Pusat Kendali Inventori, Monitoring & Operasional
          </p>
        </div>

        {/* Tab Pilihan Peran (Owner, Admin, Kru Outlet) */}
        <div className="grid grid-cols-3 gap-2 bg-slate-200/60 p-1.5 rounded-2xl mb-4 text-xs font-bold text-slate-600">
          <button
            type="button"
            onClick={() => setRoleType('outlet')}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              roleType === 'outlet'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'hover:text-slate-900'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Outlet</span>
          </button>
          <button
            type="button"
            onClick={() => setRoleType('admin')}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              roleType === 'admin'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'hover:text-slate-900'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Admin</span>
          </button>
          <button
            type="button"
            onClick={() => setRoleType('owner')}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              roleType === 'owner'
                ? 'bg-white text-[#ff6f3c] shadow-sm'
                : 'hover:text-slate-900'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-[#ff6f3c]" />
            <span>Owner</span>
          </button>
        </div>

        {/* Card Login */}
        <div className="bg-white rounded-3xl border border-slate-100 p-7 sm:p-8 shadow-sm shadow-slate-200/50">
          <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-extrabold text-slate-800">
              {roleType === 'owner' && 'Login Pemilik (Owner Dashboard)'}
              {roleType === 'admin' && 'Login Administrator Operasional'}
              {roleType === 'outlet' && 'Masuk Akun Petugas Outlet'}
            </h2>
          </div>

          {errorMsg && (
            <div className="p-3.5 mb-5 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Pilihan Outlet Khusus Petugas Outlet */}
            {roleType === 'outlet' && (
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                  Pilih Outlet Bertugas
                </label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      Outlet {loc.name?.replace(/Outlet\s+/i, '')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Nama / Username */}
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                {roleType === 'owner' ? 'Nama / Akun Owner' : roleType === 'admin' ? 'Username Admin' : 'Nama Petugas / Kasir'}
              </label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={
                    roleType === 'owner'
                      ? 'Owner / Direksi'
                      : roleType === 'admin'
                      ? 'admin'
                      : 'Contoh: Lisa (Leader Shift)'
                  }
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                />
              </div>
            </div>

            {/* PIN / Password */}
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                PIN Akses (Opsional)
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Ketik PIN jika ada"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                />
              </div>
            </div>

            {/* Tombol Masuk */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full mt-2 py-3.5 text-white text-xs font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                roleType === 'owner'
                  ? 'bg-gradient-to-r from-[#ff6f3c] to-orange-500 hover:from-[#f25c28] hover:to-orange-600 shadow-orange-500/25'
                  : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 shadow-indigo-600/25'
              }`}
            >
              <span>
                {loading
                  ? 'Membuka Sesi...'
                  : roleType === 'owner'
                  ? 'Buka Dashboard Owner'
                  : roleType === 'admin'
                  ? 'Buka Dashboard Admin'
                  : 'Masuk ke Dashboard Outlet'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] font-semibold text-slate-400 mt-6">
          © Bakso Ibu Management ERP • Multi-role Access
        </p>
      </div>
    </div>
  );
}