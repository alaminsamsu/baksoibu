'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { Store, Lock, User, ShieldAlert, ArrowRight, MapPin } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [staffName, setStaffName] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  
  const [loginType, setLoginType] = useState<'outlet' | 'management'>('outlet');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchLocations() {
      const { data } = await supabase.from('locations').select('*');
      if (data && data.length > 0) {
        setLocations(data);
        const defaultOutlet = data.find((l) => l.type === 'outlet') || data[0];
        if (defaultOutlet) setSelectedLocation(defaultOutlet.id);
      }
    }
    fetchLocations();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (loginType === 'outlet') {
        if (!staffName.trim()) throw new Error('Harap masukkan nama petugas.');
        if (!selectedLocation) throw new Error('Pilih cabang tempat Anda bertugas.');

        const { data, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('location_id', selectedLocation)
          .eq('pin_code', pin.trim())
          .limit(1);

        if (fetchError || !data || data.length === 0) {
          throw new Error('PIN outlet salah atau tidak ditemukan.');
        }

        const userRecord = data[0];
        const selectedLocData = locations.find((l) => l.id === selectedLocation);

        const sessionData = {
          ...userRecord,
          active_staff_name: staffName.trim(),
          locations: selectedLocData || null,
        };

        localStorage.setItem('bakso_ibu_user', JSON.stringify(sessionData));
        router.push('/dashboard/outlet');

      } else {
        const { data, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('username', username.trim().toLowerCase())
          .eq('pin_code', pin.trim())
          .limit(1);

        if (fetchError || !data || data.length === 0) {
          throw new Error('Username atau PIN tidak sesuai.');
        }

        const userRecord = data[0];
        const locData = locations.find((l) => l.id === userRecord.location_id);

        const sessionData = {
          ...userRecord,
          active_staff_name: userRecord.username,
          locations: locData || null,
        };

        localStorage.setItem('bakso_ibu_user', JSON.stringify(sessionData));

        if (userRecord.role === 'owner' || userRecord.role === 'admin_ops') {
          router.push('/dashboard/executive');
        } else if (userRecord.role === 'kitchen_prod') {
          router.push('/dashboard/production');
        } else {
          router.push('/dashboard/outlet');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat masuk.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4 font-sans text-neutral-800">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-200">
        
        <div className="bg-amber-900 text-white p-7 text-center">
          <div className="w-14 h-14 bg-amber-800 border-2 border-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
            <Store className="w-7 h-7 text-amber-100" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">BAKSO IBU</h1>
          <p className="text-xs text-amber-200 mt-0.5">Sistem ERP & Operasional Harian</p>

          <div className="flex bg-amber-950/60 p-1 rounded-xl mt-5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setLoginType('outlet'); setError(''); }}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                loginType === 'outlet' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-200 hover:text-white'
              }`}
            >
              Kru / Kasir Outlet
            </button>
            <button
              type="button"
              onClick={() => { setLoginType('management'); setError(''); }}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                loginType === 'management' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-200 hover:text-white'
              }`}
            >
              Owner / Dapur Pusat
            </button>
          </div>
        </div>

        <form onSubmit={handleLogin} className="p-7 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loginType === 'outlet' ? (
            <>
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">Pilih Cabang</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>