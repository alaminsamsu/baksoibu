'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Users, 
  UserPlus, 
  Calendar, 
  MapPin, 
  Phone, 
  Clock, 
  Search, 
  RefreshCw, 
  ExternalLink 
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

  // Form Tambah Karyawan Baru
  const [showAddModal, setShowAddModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('KITCHEN_CREW');
  const [primaryLocationId, setPrimaryLocationId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [employmentType, setEmploymentType] = useState('FULL_TIME');

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: locs } = await supabase.from('locations').select('*').order('name');
      if (locs) setLocations(locs);

      // Ambil Database Karyawan
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
    try {
      const { error } = await supabase.from('staff_profiles').insert({
        full_name: fullName.trim(),
        role,
        primary_location_id: primaryLocationId || null,
        phone_number: phoneNumber.trim() || null,
        employment_type: employmentType,
        is_active: true
      });
      if (error) throw error;
      setShowAddModal(false);
      setFullName('');
      setPhoneNumber('');
      fetchData();
    } catch (err: any) {
      alert('Gagal menambah karyawan: ' + err.message);
    }
  };

  const getRoleBadgeColor = (r: string) => {
    switch (r) {
      case 'OWNER':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'MANAGER':
      case 'SUPERVISOR':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'KASIR':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'LOGISTIK':
        return 'bg-blue-100 text-blue-800 border-blue-200';
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
            <p className="text-xs text-slate-400">Database staf operasional, verifikasi GPS lokasi & log jam kerja</p>
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