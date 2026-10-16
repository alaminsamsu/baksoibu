'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Factory, LogOut, RefreshCw, ChefHat, Truck, Clock, CheckCircle2 } from 'lucide-react';

export default function ProductionDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('order_requests')
        .select('*, locations(name)')
        .order('created_at', { ascending: false });
      if (data) setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleStatusChange = async (id: string, status: string) => {
    await supabase.from('order_requests').update({ status }).eq('id', id);
    fetchOrders();
  };

  // Konsolidasi: Total kebutuhan produksi gabungan seluruh cabang
  const consolidated = useMemo(() => {
    const summary: Record<string, { qty: number; unit: string; count: number }> = {};
    orders.filter(o => o.status !== 'completed').forEach(o => {
      if (!summary[o.item_name]) {
        summary[o.item_name] = { qty: 0, unit: o.unit || 'Pcs', count: 0 };
      }
      summary[o.item_name].qty += Number(o.quantity || 0);
      summary[o.item_name].count += 1;
    });
    return summary;
  }, [orders]);

  return (
    <div className="min-h-screen bg-[#f8f9fd] text-slate-800 font-sans">
      <header className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20">
            <Factory className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 leading-tight">Rumah Produksi (Dapur Pusat)</h1>
            <p className="text-xs text-slate-400 font-semibold">Konsolidasi Kebutuhan Masak & Dispatch Cabang</p>
          </div>
        </div>
        <button
          onClick={() => { localStorage.removeItem('baksoibu_active_staff'); router.push('/login'); }}
          className="p-2.5 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-red-600 shadow-xs"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 space-y-6">
        {/* Konsolidasi Kebutuhan Masak */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm shadow-slate-200/50">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-emerald-600" />
              <h2 className="text-sm font-black text-slate-900">Total Kebutuhan Masak Malam Ini (Gabungan Cabang)</h2>
            </div>
            <button onClick={fetchOrders} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.keys(consolidated).length === 0 ? (
              <p className="text-xs text-slate-400 py-4 col-span-4">Belum ada request order masuk dari cabang.</p>
            ) : (
              Object.entries(consolidated).map(([name, data]) => (
                <div key={name} className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/70">
                  <span className="text-[11px] font-bold text-slate-600">{name}</span>
                  <p className="text-xl font-black text-emerald-800 mt-1">{data.qty} {data.unit}</p>
                  <span className="text-[10px] text-emerald-600 font-semibold">Dari {data.count} request cabang</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Tabel Order & Status Dispatch */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm shadow-slate-200/50">
          <h2 className="text-sm font-black text-slate-900 mb-4">Rincian Permintaan Tiap Cabang</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-400 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3 px-4">Cabang Pemesan</th>
                  <th className="p-3">Barang & Qty</th>
                  <th className="p-3">Catatan</th>
                  <th className="p-3 text-center">Status Produksi & Kirim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 px-4">
                      <div className="font-extrabold text-slate-800">{o.locations?.name || 'Cabang'}</div>
                      <div className="text-[10px] text-slate-400">Oleh: {o.requested_by || 'Petugas'}</div>
                    </td>
                    <td className="p-3 font-black text-slate-900">{o.item_name}: <span className="text-emerald-700">{o.quantity} {o.unit}</span></td>
                    <td className="p-3 text-slate-500 text-[11px]">{o.notes || '-'}</td>
                    <td className="p-3 text-center">
                      <select
                        value={o.status || 'pending'}
                        onChange={(e) => handleStatusChange(o.id, e.target.value)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${
                          o.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : o.status === 'processing'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-orange-50 text-orange-600 border-orange-200'
                        }`}
                      >
                        <option value="pending">⏳ Antrian Masak</option>
                        <option value="processing">🔥 Sedang Dimasak</option>
                        <option value="completed">🚚 Siap Kirim</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}