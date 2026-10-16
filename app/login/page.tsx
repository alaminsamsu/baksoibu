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
  Factory 
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
      const cleanPass = password.trim();
      const loc = locations.find((l) => l.id === selectedLocation) || locations[0];

      // 1. OWNER
      if (roleType === 'owner') {
        if (cleanPass !== '123456' && cleanPass !== '') {
          throw new Error('Password Owner salah. Gunakan: 123456');
        }
        localStorage.setItem('baksoibu_active_staff', JSON.stringify({
          username: username.trim() || 'owner',
          active_staff_name: 'Owner Bakso Ibu',
          role: 'OWNER',
          location_id: null,
          location_name: 'Semua Cabang',
        }));
        router.push('/dashboard/executive');
        return;
      }

      // 2. PRODUKSI (Dapur Pusat)
      if (roleType === 'produksi') {
        if (cleanPass !== '123456' && cleanPass !== '') {
          throw new Error('Password Produksi salah. Gunakan: 123456');
        }
        localStorage.setItem('baksoibu_active_staff', JSON.stringify({
          username: username.trim() || 'produksi',
          active_staff_name: username.trim() || 'Tim Dapur Pusat',
          role: 'PRODUKSI',
          location_id: null,
          location_name: 'Rumah Produksi Pusat',
        }));
        router.push('/dashboard/production');
        return;
      }

      // 3. ADMIN OPERASIONAL
      if (roleType === 'admin') {
        if (cleanPass !== '123456' && cleanPass !== '') {
          throw new Error('Password Admin salah. Gunakan: 123456');
        }
        localStorage.setItem('baksoibu_active_staff', JSON.stringify({
          username: username.trim() || 'admin',
          active_staff_name: username.trim() || 'Admin Operasional',
          role: 'ADMIN',
          location_id: null,
          location_name: 'Kantor Pusat',
        }));
        router.push('/dashboard/admin');
        return;
      }

      // 4. OUTLET (Leader / Kasir / Crew)
      if (roleType === 'outlet') {
        if (!username.trim()) throw new Error('Nama petugas wajib diisi.');
        localStorage.setItem('baksoibu_active_staff', JSON.stringify({
          username: username.trim(),
          active_staff_name: `${username.trim()} (${outletRole})`,
          location_id: selectedLocation || loc?.id,
          location_name: loc?.name?.replace(/Outlet\s+/i, '') || 'BTP',
          role: outletRole,
        }));
        router.push('/dashboard/outlet');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal masuk ke sistem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fd] flex flex-col items-center justify-center p-4 font-sans text-slate-800">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-xl shadow-indigo-600/20 mx-auto mb-3">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Bakso Ibu ERP</h1>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            Portal Akses Berdasarkan Peran & Divisi
          </p>
        </div>

        {/* Tab 4 Role */}
        <div className="grid grid-cols-4 gap-1.5 bg-slate-200/60 p-1.5 rounded-2xl mb-4 text-[11px] font-bold text-slate-600">
          <button
            type="button"
            onClick={() => { setRoleType('outlet'); setUsername(''); setPassword(''); setErrorMsg(''); }}
            className={`py-2 rounded-xl transition-all flex flex-col items-center gap-1 ${roleType === 'outlet' ? 'bg-white text-indigo-600 shadow-sm font-extrabold' : 'hover:text-slate-900'}`}
          >
            <Store className="w-4 h-4" />
            <span>Outlet</span>
          </button>
          <button
            type="button"
            onClick={() => { setRoleType('produksi'); setUsername('produksi'); setPassword('123456'); setErrorMsg(''); }}
            className={`py-2 rounded-xl transition-all flex flex-col items-center gap-1 ${roleType === 'produksi' ? 'bg-white text-emerald-600 shadow-sm font-extrabold' : 'hover:text-slate-900'}`}
          >
            <Factory className="w-4 h-4" />
            <span>Produksi</span>
          </button>
          <button
            type="button"
            onClick={() => { setRoleType('admin'); setUsername('admin'); setPassword('123456'); setErrorMsg(''); }}
            className={`py-2 rounded-xl transition-all flex flex-col items-center gap-1 ${roleType === 'admin' ? 'bg-white text-indigo-600 shadow-sm font-extrabold' : 'hover:text-slate-900'}`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Admin</span>
          </button>
          <button
            type="button"
            onClick={() => { setRoleType('owner'); setUsername('owner'); setPassword('123456'); setErrorMsg(''); }}
            className={`py-2 rounded-xl transition-all flex flex-col items-center gap-1 ${roleType === 'owner' ? 'bg-white text-[#ff6f3c] shadow-sm font-extrabold' : 'hover:text-slate-900'}`}
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
              {roleType === 'produksi' && 'Masuk Rumah Produksi (Dapur Pusat)'}
              {roleType === 'admin' && 'Masuk Admin Operasional'}
              {roleType === 'owner' && 'Masuk Pemilik (Owner Dashboard)'}
            </h2>
          </div>

          {errorMsg && (
            <div className="p-3.5 mb-5 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {roleType === 'outlet' && (
              <>
                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Pilih Outlet</label>
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>Outlet {loc.name?.replace(/Outlet\s+/i, '')}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Peran</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['LEADER', 'KASIR', 'CREW'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setOutletRole(r)}
                        className={`py-2 rounded-xl text-xs font-extrabold border transition-all ${outletRole === r ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-100'}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                {roleType === 'outlet' ? 'Nama Petugas' : 'ID Akun'}
              </label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={roleType === 'outlet' ? 'Contoh: Lisa' : roleType}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Password {roleType === 'outlet' ? '(Opsional)' : ''}
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ketik password (123456)"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full mt-2 py-3.5 text-white text-xs font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                roleType === 'owner' ? 'bg-gradient-to-r from-[#ff6f3c] to-orange-500' :
                roleType === 'produksi' ? 'bg-gradient-to-r from-emerald-600 to-teal-600' :
                'bg-gradient-to-r from-indigo-600 to-indigo-500'
              }`}
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