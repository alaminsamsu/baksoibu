'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  ShoppingBag, 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  RefreshCw, 
  Printer, 
  Download, 
  Trash2, 
  Store, 
  CheckCircle2, 
  Clock 
} from 'lucide-react';

interface Props {
  user?: any;
  onBack: () => void;
}

export default function AdminOrderSummaryView({ user, onBack }: Props) {
  // Cut-off jam 06:00 WITA untuk hari operasional belanja
  const getOperationalDate = () => {
    const now = new Date();
    const witaHour = parseInt(
      new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', hour: 'numeric', hour12: false }).format(now)
    );
    const d = new Date();
    if (witaHour < 6) {
      d.setDate(d.getDate() - 1);
    }
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(d);
  };

  const [orderFilterDate, setOrderFilterDate] = useState<string>(getOperationalDate());
  const [selectedLoc, setSelectedLoc] = useState<string>('all');
  const [locations, setLocations] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data: locs } = await supabase.from('locations').select('*');
      if (locs) setLocations(locs);

      const startWita = new Date(`${orderFilterDate}T00:00:00+08:00`).toISOString();
      const endWita = new Date(`${orderFilterDate}T23:59:59+08:00`).toISOString();

      let query = supabase
        .from('order_requests')
        .select('*, locations(name)')
        .gte('created_at', startWita)
        .lte('created_at', endWita)
        .order('created_at', { ascending: false });

      if (selectedLoc !== 'all') {
        query = query.eq('location_id', selectedLoc);
      }

      const { data, error } = await query;
      if (error) throw error;
      setOrders(data || []);
    } catch (err: any) {
      console.error('Gagal mengambil pesanan:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [orderFilterDate, selectedLoc]);

  // Hapus item dari daftar belanja khusus Admin
  const handleDeleteOrder = async (id: string, itemName: string) => {
    const isConfirm = window.confirm(`Apakah Admin yakin ingin menghapus "${itemName}" dari daftar belanja?`);
    if (!isConfirm) return;

    setDeletingId(id);
    try {
      const { error } = await supabase
        .from('order_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setOrders((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      alert(`Gagal menghapus item: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Kelompokkan pesanan berdasarkan Vendor
  const groupedOrders = useMemo(() => {
    const groups: Record<string, any[]> = {};
    orders.forEach((o) => {
      const vendor = (o.target_type || o.source_type || o.supplier || 'RUMAH PRODUKSI').toUpperCase();
      if (!groups[vendor]) groups[vendor] = [];
      groups[vendor].push(o);
    });
    return groups;
  }, [orders]);

  // Statistik Pesanan
  const stats = useMemo(() => {
    const total = orders.length;
    const direct = orders.filter((o) => o.is_ordered_by_leader || o.status === 'ORDERED_BY_LEADER').length;
    return {
      total,
      direct,
      needAdmin: total - direct
    };
  }, [orders]);

  // Cetak / Simpan PDF
  const handlePrint = () => {
    if (orders.length === 0) return alert('Tidak ada data belanja.');
    window.print();
  };

  // Download CSV / Excel
  const handleDownloadCSV = () => {
    if (orders.length === 0) return alert('Tidak ada data belanja pada tanggal yang dipilih.');
    setDownloading(true);
    try {
      const headers = ['Tanggal', 'Outlet Cabang', 'Vendor / Supplier', 'Nama Barang', 'Jumlah Qty', 'Satuan', 'Status Pesanan', 'Catatan Kru'];
      const rows = orders.map((o) => {
        const isLeader = o.is_ordered_by_leader || o.status === 'ORDERED_BY_LEADER';
        return [
          `"${orderFilterDate}"`,
          `"${o.locations?.name || 'Cabang'}"`,
          `"${o.target_type || o.source_type || o.supplier || 'RUMAH PRODUKSI'}"`,
          `"${o.item_name}"`,
          Number(o.quantity || 0),
          `"${o.unit || 'Pcs'}"`,
          `"${isLeader ? 'SUDAH DIORDER LEADER' : 'PERLU DIBELI ADMIN'}"`,
          `"${(o.notes || '').replace(/"/g, '""')}"`
        ].join(';');
      });

      const csvContent = [headers.join(';'), ...rows].join('\r\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Permintaan_Belanja_Kru_${orderFilterDate}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-sm shadow-slate-200/50 space-y-5 font-sans print:p-0 print:border-none print:shadow-none">
      
      {/* CSS Cetak / Simpan PDF */}
      <style jsx global>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 8mm !important;
          }
          .no-print, header, nav, aside {
            display: none !important;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      `}</style>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3 no-print">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-all mr-1"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              Rekap Permintaan Belanja Masuk
            </h2>
            <p className="text-xs font-medium text-slate-400">
              Langsung unduh atau simpan berkas PDF belanjaan yang telah diinput kru cabang.
            </p>
          </div>
        </div>

        {/* Filter & Tombol Aksi */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={orderFilterDate}
              onChange={(e) => setOrderFilterDate(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
            />
          </div>

          <div className="relative">
            <MapPin className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedLoc}
              onChange={(e) => setSelectedLoc(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
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
            onClick={fetchOrders}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200"
            title="Segarkan"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Tombol Simpan / Cetak PDF */}
          <button
            onClick={handlePrint}
            disabled={orders.length === 0}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-40"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak / PDF</span>
          </button>

          {/* Tombol Download Excel/CSV */}
          <button
            onClick={handleDownloadCSV}
            disabled={downloading || orders.length === 0}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading ? 'Menyiapkan...' : 'Download Excel (.CSV)'}</span>
          </button>
        </div>
      </div>

      {/* Ringkasan Angka (Sembunyi saat cetak PDF) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 no-print">
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Item Diminta</span>
          <span className="text-xl font-black text-slate-900 mt-1 block">{stats.total} item</span>
        </div>

        <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100">
          <span className="text-[10px] font-bold text-emerald-700 uppercase block flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Sudah Diorder Leader
          </span>
          <span className="text-xl font-black text-emerald-700 mt-1 block">{stats.direct} item</span>
        </div>

        <div className="p-4 bg-orange-50/60 rounded-2xl border border-orange-100">
          <span className="text-[10px] font-bold text-[#ff6f3c] uppercase block flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#ff6f3c]" /> Perlu Dibeli / Diorder Admin
          </span>
          <span className="text-xl font-black text-[#ff6f3c] mt-1 block">{stats.needAdmin} item</span>
        </div>
      </div>

      {/* Header Khusus Saat Dicetak / PDF */}
      <div className="hidden print:block pb-3 mb-3 border-b-2 border-slate-900">
        <h1 className="text-base font-black uppercase text-slate-900">
          DAFTAR PERMINTAAN BELANJA OUTLET ({orderFilterDate})
        </h1>
        <div className="text-xs font-bold text-slate-600 mt-1 flex justify-between">
          <span>Outlet: {selectedLoc === 'all' ? 'Semua Cabang' : locations.find(l => l.id === selectedLoc)?.name}</span>
          <span>Dicetak: {new Date().toLocaleString('id-ID')}</span>
        </div>
      </div>

      {/* Daftar Tabel Belanjaan per Vendor (Tanpa Kolom CEK, dengan Tombol Hapus Admin) */}
      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-slate-400">
          Memuat rekap permintaan kru...
        </div>
      ) : orders.length === 0 ? (
        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <p className="text-xs font-bold text-slate-700">Belum ada permintaan belanja yang dikirim kru untuk tanggal {orderFilterDate}.</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Kru belum mengirim form belanja pada tanggal ini.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedOrders).map(([vendorName, groupItems]) => (
            <div key={vendorName} className="rounded-2xl border border-slate-100 overflow-hidden shadow-2xs print:border-slate-300">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between print:bg-slate-100">
                <span className="font-black text-xs uppercase text-slate-800 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-indigo-600 print:text-black" />
                  {vendorName}
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {groupItems.length} item
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 bg-white">
                      <th className="py-2.5 px-4">Nama Barang</th>
                      <th className="py-2.5 px-3">Outlet</th>
                      <th className="py-2.5 px-3 text-right">Kuantitas</th>
                      <th className="py-2.5 px-4 text-center">Status Pemesanan</th>
                      <th className="py-2.5 px-4">Catatan Kru</th>
                      <th className="no-print py-2.5 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {groupItems.map((item) => {
                      const isLeader = item.is_ordered_by_leader || item.status === 'ORDERED_BY_LEADER';
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 px-4 font-bold text-slate-800 uppercase">{item.item_name}</td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">{item.locations?.name || '-'}</td>
                          <td className="py-2.5 px-3 text-right font-black text-indigo-600">
                            {item.quantity} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                              isLeader ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-600'
                            }`}>
                              {isLeader ? '✓ Sudah Diorder Leader' : 'Perlu Dibeli Admin'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-400 text-[11px]">{item.notes || '-'}</td>
                          {/* Tombol Hapus Khusus Admin */}
                          <td className="no-print py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteOrder(item.id, item.item_name)}
                              disabled={deletingId === item.id}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Hapus permintaan belanja ini"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}