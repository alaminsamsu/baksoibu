'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Users, 
  UserPlus, 
  Calendar, 
  MapPin, 
  Phone, 
  Search, 
  RefreshCw, 
  ExternalLink,
  Home,
  Cake,
  Clock
} from 'lucide-react';

export default function StaffManagementView() {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  
  const [activeTab, setActiveTab] = useState<'attendance' | 'directory'>('attendance');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Form Modal Tambah Karyawan Baru
  const [showAddModal, setShowAddModal] = useState(false);
  const [nickname, setNickname] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('CREW');
  const [primaryLocationId, setPrimaryLocationId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [address, setAddress] = useState('');
  const [joinDate, setJoinDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [employmentType, setEmploymentType] = useState('FULL_TIME');

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: locs } = await supabase.from('locations').select('*').order('name');
      if (locs) setLocations(locs);

      // Ambil Database Seluruh Pegawai
      const { data: staffs } = await supabase
        .from('staff_profiles')
        .select('*, locations(name)')
        .order('full_name');
      if (staffs) setStaffList(staffs);

      // Ambil Rekap Presensi Tanggal Terpilih
      let attQuery = supabase
        .from('staff_attendances')
        .select('*, locations(name)')
        .eq('attendance_date', selectedDate)
        .order('clock_in', { ascending: false });

      if (selectedLocation !== 'all') {
        attQuery = attQuery.eq('location_id', selectedLocation);
      }

      const { data: atts } = await attQuery;
      if (atts) setAttendanceList(atts);
    } catch (e) {
      console.error('Gagal mengambil data HR:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate, selectedLocation]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      alert('Nama panggilan wajib diisi (kunci absen & login)!');
      return;
    }

    try {
      const { error } = await supabase.from('staff_profiles').insert({
        nickname: nickname.trim(),
        full_name: fullName.trim(),
        role,
        primary_location_id: primaryLocationId || null,
        phone_number: phoneNumber.trim() || null,
        birth_place: birthPlace.trim() || null,
        birth_date: birthDate || null,
        address: address.trim() || null,
        join_date: joinDate || null,
        employment_type: employmentType,
        is_active: true
      });

      if (error) throw error;

      setShowAddModal(false);
      // Reset isian
      setNickname('');
      setFullName('');
      setPhoneNumber('');
      setBirthPlace('');
      setBirthDate('');
      setAddress('');
      fetchData();
    } catch (err: any) {
      alert('Gagal menambah karyawan: ' + err.message);
    }
  };

  const getRoleBadgeColor = (r: string) => {
    switch (r) {
      case 'LEADER':
      case 'SUPERVISOR':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'HR':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'KASIR':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'LOGISTIK':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-xs space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 leading-tight">Administrasi & Presensi SDM</h2>
            <p className="text-xs text-slate-400">Database seluruh pegawai, verifikasi GPS lokasi & log presensi terpadu</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-black">
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'attendance' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'
              }`}
            >
              Log Presensi
            </button>
            <button
              onClick={() => setActiveTab('directory')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'directory' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'
              }`}
            >
              Database Pegawai
            </button>
          </div>

          {activeTab === 'directory' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Tambah Pegawai</span>
            </button>
          )}
        </div>
      </div>

      {/* FILTER BAR PRESENSI */}
      {activeTab === 'attendance' && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700"
              />
            </div>

            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700"
              >
                <option value="all">Semua Lokasi</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={fetchData}
            className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      {/* TAB 1: LOG PRESENSI HARIAN DENGAN LOKASI GPS */}
      {activeTab === 'attendance' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Nama Pegawai</th>
                <th className="py-2.5 px-2">Peran</th>
                <th className="py-2.5 px-2">Lokasi Outlet</th>
                <th className="py-2.5 px-2">Shift</th>
                <th className="py-2.5 px-2 text-emerald-600">Check-In</th>
                <th className="py-2.5 px-2 text-red-600">Check-Out</th>
                <th className="py-2.5 px-2 text-center">Titik GPS</th>
                <th className="py-2.5 px-3 text-right">Durasi Kerja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {attendanceList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    Tidak ada presensi tugas tercatat pada tanggal ini.
                  </td>
                </tr>
              ) : (
                attendanceList.map((att) => {
                  const inTime = att.clock_in ? new Date(att.clock_in) : null;
                  const outTime = att.clock_out ? new Date(att.clock_out) : null;
                  
                  let durationStr = 'Sedang Bertugas';
                  if (inTime && outTime) {
                    const diffMs = outTime.getTime() - inTime.getTime();
                    const hours = Math.floor(diffMs / (1000 * 60 * 60));
                    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    durationStr = `${hours}j ${mins}m`;
                  }

                  return (
                    <tr key={att.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-3 font-extrabold text-slate-900">{att.staff_name}</td>
                      <td className="py-3 px-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRoleBadgeColor(att.role)}`}>
                          {att.role}
                        </span>
                      </td>
                      <td className="py-3 px-2 font-semibold text-slate-700">{att.locations?.name || 'Cabang'}</td>
                      <td className="py-3 px-2 font-bold text-indigo-700">{att.shift}</td>
                      <td className="py-3 px-2 font-black text-emerald-600">
                        {inTime ? inTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="py-3 px-2 font-black text-red-600">
                        {outTime ? outTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {att.clock_in_lat ? (
                          <a
                            href={`https://www.google.com/maps?q=${att.clock_in_lat},${att.clock_in_lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-[10px] transition-colors"
                          >
                            <MapPin className="w-3 h-3 text-indigo-600" />
                            <span>Maps</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-800">{durationStr}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: DATABASE STAF */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama panggilan atau nama lengkap..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {staffList
              .filter((s) => 
                (s.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (s.nickname || '').toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((staff) => (
                <div key={staff.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-sm text-slate-900">{staff.nickname || staff.full_name}</span>
                        {staff.nickname && (
                          <span className="text-[10px] text-slate-400 font-bold">({staff.full_name})</span>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-block mt-1 ${getRoleBadgeColor(staff.role)}`}>
                        {staff.role}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {staff.is_active ? 'Aktif' : 'Non-Aktif'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-200/60">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{staff.locations?.name || 'Cabang Belum Diset'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{staff.phone_number || '-'}</span>
                    </div>
                    {(staff.birth_place || staff.birth_date) && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <Cake className="w-3 h-3 text-slate-400" />
                        <span>{staff.birth_place || '-'}, {staff.birth_date || '-'}</span>
                      </div>
                    )}
                    {staff.join_date && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Mulai Kerja: {staff.join_date}</span>
                      </div>
                    )}
                    {staff.address && (
                      <div className="flex items-start gap-1.5 text-[11px] text-slate-400">
                        <Home className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{staff.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* MODAL PENDAFTARAN LENGKAP KARYAWAN */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Pendaftaran Karyawan Baru</h3>
              <p className="text-[11px] text-slate-400">Data master personalia & akun presensi operasional</p>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3 text-xs">
              {/* Identitas Utama */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Nama Panggilan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Contoh: Rian"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <span className="text-[9px] text-slate-400">Dipakai login & absen</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Nama Lengkap Resmi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Contoh: Rian Hidayat"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* Jabatan & Penempatan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Jabatan / Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="CREW">Crew Outlet</option>
                    <option value="KASIR">Kasir Outlet</option>
                    <option value="LEADER">Leader Outlet</option>
                    <option value="ADMIN">Admin Operasional</option>
                    <option value="HR">HR Personalia</option>
                    <option value="LOGISTIK">Dapur Pusat / Logistik</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Penempatan Cabang</label>
                  <select
                    value={primaryLocationId}
                    onChange={(e) => setPrimaryLocationId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none"
                  >
                    <option value="">Semua Lokasi / Mobile</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                    <option value="kantor">Kantor Pusat</option>
                    <option value="dapur_pusat">Dapur Pusat</option>
                  </select>
                </div>
              </div>

              {/* TTL (Tempat, Tanggal Lahir) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Tempat Lahir</label>
                  <input
                    type="text"
                    value={birthPlace}
                    onChange={(e) => setBirthPlace(e.target.value)}
                    placeholder="Contoh: Makassar"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Tanggal Lahir</label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              {/* Tanggal Mulai Bekerja & Kontak */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Tanggal Mulai Bekerja</label>
                  <input
                    type="date"
                    value={joinDate}
                    onChange={(e) => setJoinDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">No. WhatsApp / HP</label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              {/* Alamat Domisili */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Alamat Tinggal / Domisili</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Alamat lengkap tempat tinggal saat ini..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              {/* Tombol Simpan */}
              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors shadow-xs"
                >
                  Simpan Pegawai
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}