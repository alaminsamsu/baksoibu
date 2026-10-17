'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  Store, 
  BarChart3, 
  Briefcase, 
  Users, 
  Crown, 
  ShieldCheck, 
  UserCheck,
  User, 
  Lock, 
  ArrowRight,
  AlertCircle,
  MapPin
} from 'lucide-react';

type RoleTab = 'outlet' | 'leader' | 'produksi' | 'admin' | 'hr' | 'owner';

export default function LoginPage() {
  const router = useRouter();
  const [locations, setLocations] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<RoleTab>('outlet');

  // State untuk Tab Outlet (Tanpa Password)
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [staffName, setStaffName] = useState('');

  // State untuk Tab Proteksi (Leader, Produksi, Admin, HR, Owner)
  const [username, setUsername] = useState('');
  const [pinCode, setPinCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Ambil daftar lokasi cabang
  useEffect(() => {
    const fetchLocations = async () => {
      const { data } = await supabase.from('locations').select('*').order('name');
      if (data && data.length > 0) {
        setLocations(data);
        setSelectedLocationId(data[0].id);
      }
    };
    fetchLocations();
  }, []);

  const handleTabChange = (tab: RoleTab) => {
    setActiveTab(tab);
    setErrorMsg(null);
    setPinCode('');

    if (tab === 'admin') setUsername('admin');
    else if (tab === 'hr') setUsername('hr');
    else if (tab === 'owner') setUsername('owner');
    else if (tab === 'produksi') setUsername('produksi');
    else if (tab === 'leader') setUsername('leader');
    else {
      setUsername('');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. JIKA TAB OUTLET (CREW LAPANGAN - TANPA PASSWORD/PIN)
      if (activeTab === 'outlet') {
        if (!staffName.trim()) {
          throw new Error('Silakan masukkan nama Anda.');
        }
        if (!selectedLocationId) {
          throw new Error('Silakan pilih lokasi outlet.');
        }

        const activeLoc = locations.find((l) => l.id === selectedLocationId);

        const sessionData = {
          id: selectedLocationId,
          active_staff_name: staffName.trim(),
          role: 'CREW',
          location_id: selectedLocationId,
          location_name: activeLoc ? activeLoc.name : 'Outlet Cabang'
        };

        localStorage.setItem('baksoibu_active_staff', JSON.stringify(sessionData));
        router.push('/dashboard/outlet');
        return;
      }

      // 2. JIKA TAB LAINNYA (LEADER, PRODUKSI, ADMIN, HR, OWNER) -> BUTUH PASSWORD/PIN
      if (!pinCode.trim()) {
        throw new Error('Silakan masukkan Password / PIN.');
      }

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username.trim().toLowerCase())
        .single();

      if (error || !user) {
        throw new Error(`Akun "${username}" tidak ditemukan.`);
      }

      const inputPass = pinCode.trim();
      const validPass = user.pin_code || user.pin || user.password;

      if (validPass && inputPass !== String(validPass)) {
        throw new Error('Password / PIN salah.');
      }

      // Tentukan lokasi jika belum ada
      const activeLoc = locations.find((l) => l.id === (user.location_id || selectedLocationId));

      const sessionData = {
        id: user.id,
        username: user.username,
        active_staff_name: user.username.toUpperCase(),
        role: user.role || activeTab.toUpperCase(),
        location_id: user.location_id || selectedLocationId || null,
        location_name: user.location_name || (activeLoc ? activeLoc.name : 'Pusat')
      };
      localStorage.setItem('baksoibu_active_staff', JSON.stringify(sessionData));

      const userRole = (user.role || activeTab).toUpperCase();
      if (userRole === 'OWNER' || userRole === 'HR') {
        router.push('/dashboard/executive');
      } else if (userRole === 'ADMIN') {
        router.push('/dashboard/admin');
      } else if (userRole === 'PRODUKSI' || userRole.includes('KITCHEN')) {
        router.push('/dashboard/produksi');
      } else {
        // Leader & Kasir masuk ke dashboard outlet dengan akses menu omset
        router.push('/dashboard/outlet');
      }

    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal masuk ke sistem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfbfe] flex flex-col justify-center items-center p-4 font-sans text-slate-700">
      <div className="max-w-[480px] w-full space-y-6">
        
        {/* Header Logo Toko Asli */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-[#5252ea] text-white items-center justify-center shadow-lg shadow-indigo-500/20">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Bakso Ibu ERP
          </h1>
          <p className="text-xs font-medium text-slate-400">
            Portal Akses Berdasarkan Peran & Divisi
          </p>
        </div>

        {/* Tab Pilihan Peran: Outlet, Leader, Produksi, Admin, HR, Owner */}
        <div className="bg-[#eef1f8] p-1.5 rounded-2xl flex items-center justify-between text-xs font-bold gap-1">
          <button
            type="button"
            onClick={() => handleTabChange('outlet')}
            className={`flex-1 py-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'outlet'
                ? 'bg-white text-[#5252ea] shadow-xs border border-slate-200/60 font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Store className="w-4 h-4" />
            <span className="text-[10px]">Outlet</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('leader')}
            className={`flex-1 py-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'leader'
                ? 'bg-white text-[#5252ea] shadow-xs border border-slate-200/60 font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span className="text-[10px]">Leader</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('produksi')}
            className={`flex-1 py-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'produksi'
                ? 'bg-white text-[#5252ea] shadow-xs border border-slate-200/60 font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span className="text-[10px]">Produksi</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('admin')}
            className={`flex-1 py-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'admin'
                ? 'bg-white text-[#5252ea] shadow-xs border border-slate-200/60 font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span className="text-[10px]">Admin</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('hr')}
            className={`flex-1 py-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'hr'
                ? 'bg-white text-[#5252ea] shadow-xs border border-slate-200/60 font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="text-[10px]">HR</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('owner')}
            className={`flex-1 py-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'owner'
                ? 'bg-white text-[#ff8a3d] shadow-xs border border-slate-200/60 font-black'
                : 'text-[#ff8a3d]/80 hover:text-[#ff8a3d]'
            }`}
          >
            <Crown className="w-4 h-4" />
            <span className="text-[10px]">Owner</span>
          </button>
        </div>

        {/* Card Form Login */}
        <div className="bg-white p-7 rounded-3xl border border-slate-100 shadow-xs space-y-5">
          <div className="flex items-center gap-2 text-sm font-black text-slate-800">
            <ShieldCheck className="w-4 h-4 text-[#5252ea]" />
            <span>
              {activeTab === 'outlet' && 'Masuk Outlet (Kru Lapangan)'}
              {activeTab === 'leader' && 'Masuk Leader & Kasir Outlet'}
              {activeTab === 'produksi' && 'Masuk Tim Rumah Produksi'}
              {activeTab === 'admin' && 'Masuk Admin Operasional'}
              {activeTab === 'hr' && 'Masuk Manajemen HR'}
              {activeTab === 'owner' && 'Masuk Executive Owner'}
            </span>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs font-bold">
            {/* JIKA TAB OUTLET: HANYA PILIH CABANG & KETIK NAMA (TANPA PASSWORD) */}
            {activeTab === 'outlet' ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-slate-400 font-extrabold block">
                    PILIH OUTLET
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <select
                      value={selectedLocationId}
                      onChange={(e) => setSelectedLocationId(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-[#f6f8fc] border border-slate-200/60 rounded-xl text-slate-800 font-bold focus:outline-none focus:bg-white focus:border-[#5252ea]"
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-slate-400 font-extrabold block">
                    NAMA ANDA
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      placeholder="Ketik nama Anda (contoh: Lisha)"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#f6f8fc] border border-slate-200/60 rounded-xl text-slate-800 font-bold focus:outline-none focus:bg-white focus:border-[#5252ea]"
                    />
                  </div>
                </div>
              </>
            ) : (
              /* JIKA TAB LEADER / PRODUKSI / ADMIN / HR / OWNER: MUNCUL PASSWORD / PIN */
              <>
                {/* Pilihan Outlet khusus jika login sebagai Leader */}
                {activeTab === 'leader' && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] uppercase tracking-wider text-slate-400 font-extrabold block">
                      OUTLET TUGAS
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                      <select
                        value={selectedLocationId}
                        onChange={(e) => setSelectedLocationId(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-[#f6f8fc] border border-slate-200/60 rounded-xl text-slate-800 font-bold focus:outline-none focus:bg-white focus:border-[#5252ea]"
                      >
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-slate-400 font-extrabold block">
                    ID AKUN
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="ID Akun"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#f6f8fc] border border-slate-200/60 rounded-xl text-slate-800 font-bold focus:outline-none focus:bg-white focus:border-[#5252ea]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-slate-400 font-extrabold block">
                    PASSWORD / PIN
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value)}
                      placeholder="••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#f6f8fc] border border-slate-200/60 rounded-xl text-slate-800 font-bold focus:outline-none focus:bg-white focus:border-[#5252ea]"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#5252ea] hover:bg-[#4343d6] disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all mt-2"
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