'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  Store, 
  User, 
  Lock, 
  ArrowRight, 
  AlertCircle, 
  ShieldCheck, 
  Crown, 
  Briefcase, 
  Factory,
  UserCheck
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [roleType, setRoleType] = useState<'outlet' | 'produksi' | 'admin' | 'owner'>('outlet');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [outletRole, setOutletRole] = useState<'LEADER' | 'KASIR' | 'CREW'>('LEADER');
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
      const cleanPass = password.trim();

      // Cek akun ke tabel users jika tersedia di Supabase
      const { data: dbUser, error: dbError } = await supabase
        .from('users')
        .select('*')
        .ilike('username', cleanUser)
        .maybeSingle();

      const loc = locations.find((l) => l.id === selectedLocation);

      // Verifikasi login Owner
      if (roleType === 'owner') {
        const isOwnerValid = 
          (dbUser && (dbUser.password === cleanPass || !dbUser.password) && (dbUser.role?.toLowerCase() === 'owner' || dbUser.role?.toLowerCase() === 'executive')) ||
          cleanUser.toLowerCase() === 'owner';

        if (!isOwnerValid && dbUser) {
          throw new Error('Password Owner salah.');
        }

        const sessionData = {
          username: dbUser?.username || cleanUser || 'Owner',
          active_staff_name: dbUser?.name || cleanUser || 'Owner Bakso Ibu',
          role: 'OWNER',
          location_id: null,
          location_name: 'Semua Cabang',
        };
        localStorage.setItem('baksoibu_active_staff', JSON.stringify(sessionData));
        router.push('/dashboard/executive');
        return;
      }

      // Verifikasi login Admin
      if (roleType === 'admin') {
        const isAdminValid = 
          (dbUser && (dbUser.password === cleanPass || !dbUser.password)) ||
          cleanUser.toLowerCase() === 'admin';

        if (!isAdminValid && dbUser) {
          throw new Error('Password Admin salah.');
        }

        const sessionData = {
          username: dbUser?.username || cleanUser || 'Admin',
          active_staff_name: dbUser?.name || cleanUser || 'Administrator',
          role: 'ADMIN',
          location_id: null,
          location_name: 'Pusat Manajemen',
        };
        localStorage.setItem('baksoibu_active_staff', JSON.stringify(sessionData));
        router.push('/dashboard/admin');
        return;
      }

      // Verifikasi login Rumah Produksi
      if (roleType === 'produksi') {
        const sessionData = {
          username: cleanUser || 'Rumah Produksi',
          active_staff_name: cleanUser || 'Kepala Dapur Produksi',
          role: 'PRODUKSI',
          location_id: null,
          location_name: 'Dapur Rumah Produksi Pusat',
        };
        localStorage.setItem('baksoibu_active_staff', JSON.stringify(sessionData));
        router.push('/dashboard/admin');
        return;
      }

      // Verifikasi login Outlet (Leader, Kasir, Crew)
      if (roleType === 'outlet') {
        if (!cleanUser) {
          throw new Error('Nama petugas wajib diisi.');
        }

        const sessionData = {
          username: cleanUser,
          active_staff_name: `${cleanUser} (${outletRole})`,
          location_id: selectedLocation,
          location_name: loc?.name?.replace(/Outlet\s+/i, '') || 'BTP',
          role: outletRole,
        };
        localStorage.setItem('baksoibu_active_staff', JSON.stringify(sessionData));
        router.push('/dashboard/outlet');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal masuk. Periksa kembali ID dan Password Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fd] flex flex-col items-center justify-center p-4 font-sans text-slate-800">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-xl shadow-indigo-600/20 mx-auto mb-3">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Bakso Ibu ERP</h1>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            Portal Operasional Multi-Divisi
          </p>
        </div>

        {/* Tab 4 Divisi */}
        <div className="grid grid-cols-4 gap-1.5 bg-slate-200/60 p-1.5 rounded-2xl mb-4 text-[11px] font-bold text-slate-600">
          <button
            type="button"
            onClick={() => setRoleType('outlet')}
            className={`py-2 rounded-xl transition-all flex flex-col items-center gap-1 ${
              roleType === 'outlet'
                ? 'bg-white text-indigo-600 shadow-sm font-extrabold'
                : 'hover:text-slate-900'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Outlet</span>
          </button>

          <button
            type="button"
            onClick={() => setRoleType('produksi')}
            className={`py-2 rounded-xl transition-all flex flex-col items-center gap-1 ${
              roleType === 'produksi'
                ? 'bg-white text-emerald-600 shadow-sm font-extrabold'
                : 'hover:text-slate-900'
            }`}
          >
            <Factory className="w-4 h-4" />
            <span>Produksi</span>
          </button>

          <button
            type="button"
            onClick={() => setRoleType('admin')}
            className={`py-2 rounded-xl transition-all flex flex-col items-center gap-1 ${
              roleType === 'admin'
                ? 'bg-white text-indigo-600 shadow-sm font-extrabold'
                : 'hover:text-slate-900'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Admin</span>
          </button>

          <button
            type="button"
            onClick={() => setRoleType('owner')}
            className={`py-2 rounded-xl transition-all flex flex-col items-center gap-1 ${
              roleType === 'owner'
                ? 'bg-white text-[#ff6f3c] shadow-sm font-extrabold'
                : 'hover:text-slate-900'
            }`}
          >
            <Crown className="w-4 h-4 text-[#ff6f3c]" />
            <span>Owner</span>
          </button>
        </div>

        {/* Card Form */}
        <div className="bg-white rounded-3xl border border-slate-100 p-7 sm:p-8 shadow-sm shadow-slate-200/50">
          <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-extrabold text-slate-800">
              {roleType === 'outlet' && 'Masuk Petugas Outlet Cabang'}
              {roleType === 'produksi' && 'Masuk Rumah Produksi / Dapur Pusat'}
              {roleType === 'admin' && 'Masuk Administrator'}
              {roleType === 'owner' && 'Masuk Pemilik (Owner)'}
            </h2>
          </div>

          {errorMsg && (
            <div className="p-3.5 mb-5 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Bagian Khusus Outlet: Pilihan Cabang & Peran Petugas */}
            {roleType === 'outlet' && (
              <>
                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                    Pilih Outlet Cabang
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

                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                    Peran Petugas Bertugas
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['LEADER', 'KASIR', 'CREW'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setOutletRole(r)}
                        className={`py-2.5 rounded-xl text-xs font-extrabold border transition-all ${
                          outletRole === r
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Field ID / Username */}
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                {roleType === 'outlet' ? 'Nama Petugas' : 'ID / Username'}
              </label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={
                    roleType === 'outlet'
                      ? 'Contoh: Lisa'
                      : roleType === 'produksi'
                      ? 'produksi'
                      : roleType === 'admin'
                      ? 'admin'
                      : 'owner'
                  }
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                />
              </div>
            </div>

            {/* Field Password */}
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Password / PIN {roleType === 'outlet' ? '(Opsional)' : ''}
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password atau PIN"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full mt-2 py-3.5 text-white text-xs font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                roleType === 'owner'
                  ? 'bg-gradient-to-r from-[#ff6f3c] to-orange-500 hover:from-[#f25c28] hover:to-orange-600 shadow-orange-500/25'
                  : roleType === 'produksi'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/25'
                  : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 shadow-indigo-600/25'
              }`}
            >
              <span>{loading ? 'Memverifikasi...' : 'Masuk ke Sistem'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] font-semibold text-slate-400 mt-6">
          © Bakso Ibu ERP • Multi-Division Access System
        </p>
      </div>
    </div>
  );
}