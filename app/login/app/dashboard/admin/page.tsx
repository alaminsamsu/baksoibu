'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  Factory, 
  Briefcase, 
  LogOut, 
  ShoppingBag, 
  Activity, 
  CheckCircle2, 
  Clock, 
  RefreshCw,
  MapPin,
  Calendar
} from 'lucide-react';
import BranchStockMonitor from '@/components/outlet/components/shared/BranchStockMonitor';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'monitor'>('orders');
  const [orderRequests, setOrderRequests] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLoc, setSelectedLoc] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('baksoibu_active_staff');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: locs } = await supabase.from('locations').select('*');
      if (locs) setLocations(locs);

      const today = new Date().toISOString().split('T')[0];
      const { data: orders } = await supabase
        .from('order_requests')
        .select('*, locations(name)')
        .order('created_at', { ascending: false });

      if (orders) setOrderRequests(orders);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('order_requests')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert('Gagal update status: ' + err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('baksoibu_active_staff');
    router.push('/login');
  };

  const filteredOrders = selectedLoc === 'all'
    ? orderRequests
    : orderRequests.filter((o) => o.location_id === selectedLoc);

  return (
    <div className="min-h-screen bg-[#f8f9fd] text-slate-800 flex flex-col font-sans">
      {/* Navbar Header */}
      <header className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-200">
            {user?.role === 'PRODUKSI' ? <Factory className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-slate-900 leading-none">
              Bakso Ibu {user?.role === 'PRODUKSI' ? 'Rumah Produksi' : 'Admin Operasional'}
            </h1>
            <p className="text-[11px] font-semibold text-slate-400 mt-1">
              Pusat Kendali & Rekap Kebutuhan Cabang
            </p>
          </div>
        </div>

        {/* Tab Navigasi */}
        <div className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm shadow-slate-200/60 border border-slate-100 text-xs font-bold text-slate-500">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3 py-1 rounded-full transition-all flex items-center gap-1.5 ${
              activeTab === 'orders' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:text-slate-800'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Rekap Pesanan Outlet
          </button>
          <button
            onClick={() => setActiveTab('monitor')}
            className={`px-3 py-1 rounded-full transition-all flex items-center gap-1.5 ${
              activeTab === 'monitor' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:text-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Monitor Stok Cabang
          </button>
        </div>

        {/* User Info & Out */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-extrabold text-slate-900 leading-tight">
              {user?.active_staff_name || 'Admin'}
            </div>
            <span className="inline-block text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
              {user?.role || 'ADMIN'}
            </span>
          </div>
          <button
            onClick={handleLogout}
            title="Keluar"
            className="w-9 h-9 rounded-2xl bg-white border border-slate-200/80 hover:bg-red-50 hover:border-red-200 text-slate-400 hover:text-red-600 flex items-center justify-center transition-all shadow-sm"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-4 space-y-6">
        {activeTab === 'orders' ? (
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm shadow-slate-200/50 space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Daftar Pesanan Masuk dari Outlet
                </h2>
                <p className="text-xs text-slate-400">
                  Total permintaan olahan bakso & bahan dari formulir request order malam.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={selectedLoc}
                    onChange={(e) => setSelectedLoc(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                  >
                    <option value="all">Semua Outlet</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={fetchData}
                  className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-100"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Waktu & Outlet</th>
                    <th className="py-3 px-3">Nama Barang</th>
                    <th className="py-3 px-3 text-right">Jumlah Order</th>
                    <th className="py-3 px-3">Catatan</th>
                    <th className="py-3 px-3 text-center">Status Produksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 font-medium">
                        Memuat data pesanan...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 font-medium">
                        Belum ada order masuk dari outlet.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-extrabold text-slate-800">
                            {ord.locations?.name || 'Outlet'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Oleh: {ord.requested_by || 'Petugas'} • {new Date(ord.created_at).toLocaleDateString('id-ID')}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">{ord.item_name}</td>
                        <td className="py-3 px-3 text-right font-black text-indigo-600">
                          {ord.quantity} {ord.unit}
                        </td>
                        <td className="py-3 px-3 text-slate-500 text-[11px] max-w-xs truncate">
                          {ord.notes || '-'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <select
                            value={ord.status || 'pending'}
                            onChange={(e) => handleUpdateStatus(ord.id, e.target.value)}
                            className={`px-2.5 py-1 rounded-xl text-xs font-extrabold border focus:outline-none cursor-pointer ${
                              ord.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : ord.status === 'processing'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-orange-50 text-orange-600 border-orange-200'
                            }`}
                          >
                            <option value="pending">⏳ Menunggu</option>
                            <option value="processing">👨‍🍳 Sedang Dimasak</option>
                            <option value="completed">✅ Siap Kirim</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <BranchStockMonitor />
        )}
      </main>
    </div>
  );
}