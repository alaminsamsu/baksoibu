'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  ShoppingBag, 
  ArrowLeft, 
  Download, 
  Printer, 
  Trash2, 
  RefreshCw, 
  Calendar, 
  Store, 
  CheckCircle2, 
  Clock, 
  Truck, 
  Wallet,
  Search
} from 'lucide-react';

interface Props {
  user?: any;
  onBack?: () => void;
}

interface OrderRecord {
  id: string;
  location_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  supplier: string;
  target_type?: string;
  source_type?: string;
  notes?: string;
  requested_by?: string;
  status: string;
  created_at: string;
  locations?: { name: string };
}

export default function AdminOrderSummaryView({ user, onBack }: Props) {
  const getTodayWita = () => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayWita());
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [locations, setLocations] = useState<any[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLocations() {
      const { data } = await supabase.from('locations').select('id, name').order('name');
      if (data) setLocations(data);
    }
    fetchLocations();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const startDate = `${selectedDate}T00:00:00`;
      const endDate = `${selectedDate}T23:59:59`;

      let query = supabase
        .from('order_requests')
        .select('*, locations(name)')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('supplier', { ascending: true })
        .order('item_name', { ascending: true });

      if (selectedLocation !== 'all') {
        query = query.eq('location_id', selectedLocation);
      }

      const { data, error } = await query;
      if (error) throw error;
      setOrders(data || []);
    } catch (err: any) {
      console.error('Gagal mengambil data order:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [selectedDate, selectedLocation]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      const { error } = await supabase
        .from('order_requests')
        .update({ 
          status: newStatus,
          is_ordered_by_leader: newStatus === 'ORDERED_BY_LEADER' || newStatus === 'ORDERED_LEADER'
        })
        .eq('id', orderId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((ord) => (ord.id === orderId ? { ...ord, status: newStatus } : ord))
      );
    } catch (err: any) {
      alert('Gagal memperbarui status: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Yakin ingin menghapus item permintaan ini?')) return;
    try {
      const { error } = await supabase.from('order_requests').delete().eq('id', orderId);
      if (error) throw error;
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (err: any) {
      alert('Gagal menghapus: ' + err.message);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const s = searchTerm.toLowerCase();
      return (
        o.item_name.toLowerCase().includes(s) ||
        (o.supplier || '').toLowerCase().includes(s) ||
        (o.locations?.name || '').toLowerCase().includes(s)
      );
    });
  }, [orders, searchTerm]);

  const metrics = useMemo(() => {
    const total = orders.length;
    let pending = 0;
    let leader = 0;
    let cashier = 0;
    let logistics = 0;

    orders.forEach((o) => {
      const st = (o.status || '').toUpperCase();
      if (st === 'ORDERED_BY_LEADER' || st === 'ORDERED_LEADER') {
        leader++;
      } else if (st === 'BOUGHT_CASHIER' || st === 'KASIR') {
        cashier++;
      } else if (st === 'PROCESSED_LOGISTICS' || st === 'LOGISTIK') {
        logistics++;
      } else {
        pending++;
      }
    });

    return { total, pending, leader, cashier, logistics };
  }, [orders]);

  const groupedOrders = useMemo(() => {
    const groups: Record<string, OrderRecord[]> = {};
    filteredOrders.forEach((o) => {
      const sup = o.supplier || 'RUMAH PRODUKSI';
      if (!groups[sup]) groups[sup] = [];
      groups[sup].push(o);
    });
    return groups;
  }, [filteredOrders]);

  const handleExportCSV = () => {
    if (orders.length === 0) {
      alert('Tidak ada data belanja untuk diexport.');
      return;
    }
    const headers = ['Supplier/Vendor', 'Nama Barang', 'Outlet', 'Kuantitas', 'Satuan', 'Status Pemesanan', 'Catatan Kru', 'Waktu'];
    const rows = orders.map((o) => {
      const locClean = (o.locations?.name || 'Cabang').replace(/^outlet\s+/i, '');
      return [
        `"${o.supplier || 'RUMAH PRODUKSI'}"`,
        `"${o.item_name}"`,
        `"Outlet ${locClean}"`,
        o.quantity,
        `"${o.unit}"`,
        `"${o.status}"`,
        `"${(o.notes || '-').replace(/"/g, '""')}"`,
        `"${new Date(o.created_at).toLocaleTimeString('id-ID')}"`
      ].join(';');
    });

    const csvContent = [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Permintaan_Belanja_${selectedDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper pembersih label outlet agar tidak menjadi "Outlet Outlet BTP"
  const getCleanOutletName = (rawName?: string) => {
    if (!rawName) return 'Outlet';
    const cleaned = rawName.replace(/^outlet\s+/i, '').trim();
    return `Outlet ${cleaned}`;
  };

  // Helper tampilan status teks saat dicetak
  const getStatusPrintLabel = (st?: string) => {
    const rawSt = (st || '').toUpperCase();
    if (rawSt === 'ORDERED_BY_LEADER' || rawSt === 'ORDERED_LEADER') return '✓ Diorder Leader';
    if (rawSt === 'BOUGHT_CASHIER' || rawSt === 'KASIR') return '💵 Dibeli Kasir';
    if (rawSt === 'PROCESSED_LOGISTICS' || rawSt === 'LOGISTIK') return '🚚 Diproses Logistik';
    return '⏳ Menunggu Pembelian';
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-xs space-y-6 font-sans print:p-2 print:border-none print:shadow-none">
      
      {/* CSS KHUSUS PRINT CETAK / PDF */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 10mm;
          }
          body {
            background: white !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .print-header {
            display: block !important;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e2e8f0;
          }
          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 10px !important;
          }
          .print-table th, .print-table td {
            padding: 4px 6px !important;
            border-bottom: 1px solid #f1f5f9 !important;
          }
          .print-vendor-box {
            page-break-inside: avoid !important;
            margin-bottom: 12px !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 8px !important;
          }
        }
      `}</style>

      {/* HEADER CETAK (HANYA MUNCUL DI PDF/PRINT) */}
      <div className="hidden print:block print-header">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-base font-black text-slate-900 tracking-tight">
              BAKSO IBU • REKAP PERMINTAAN BELANJA MASUK
            </h1>
            <p className="text-[10px] text-slate-500 font-semibold">
              Tanggal Operasional: {new Date(selectedDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black bg-slate-100 px-2.5 py-1 rounded-md text-slate-700 uppercase">
              Total {orders.length} Item Bahan
            </span>
          </div>
        </div>
      </div>

      {/* HEADER DI LAYAR MONITOR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-slate-100 gap-4 no-print">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-500 mr-1"
              title="Kembali"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              Rekap Permintaan Belanja Masuk
            </h2>
            <p className="text-xs font-medium text-slate-400">
              Kelola status pengadaan: Leader, Kasir, Logistik/Dapur Pusat, atau Admin.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex items-center">
            <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
            />
          </div>

          <div className="relative">
            <Store className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Outlet</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  Outlet {loc.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchOrders}
            className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-500"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak / PDF</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4 SCORECARD STATUS (HANYA DITAMPILKAN DI MONITOR, OTOMATIS HILANG SAAT CETAK / PDF) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
        <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-black uppercase">
            <Clock className="w-3.5 h-3.5 text-orange-500" />
            <span>Menunggu Pembelian</span>
          </div>
          <p className="text-xl font-black text-slate-900 mt-1">{metrics.pending} <span className="text-xs font-semibold text-slate-400">item</span></p>
        </div>

        <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
          <div className="flex items-center gap-1.5 text-emerald-700 text-[10px] font-black uppercase">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Diorder Leader</span>
          </div>
          <p className="text-xl font-black text-emerald-700 mt-1">{metrics.leader} <span className="text-xs font-semibold text-emerald-600">item</span></p>
        </div>

        <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-2xl">
          <div className="flex items-center gap-1.5 text-blue-700 text-[10px] font-black uppercase">
            <Wallet className="w-3.5 h-3.5 text-blue-600" />
            <span>Dibeli Kasir</span>
          </div>
          <p className="text-xl font-black text-blue-700 mt-1">{metrics.cashier} <span className="text-xs font-semibold text-blue-600">item</span></p>
        </div>

        <div className="p-3.5 bg-purple-50/50 border border-purple-100 rounded-2xl">
          <div className="flex items-center gap-1.5 text-purple-700 text-[10px] font-black uppercase">
            <Truck className="w-3.5 h-3.5 text-purple-600" />
            <span>Diproses Logistik</span>
          </div>
          <p className="text-xl font-black text-purple-700 mt-1">{metrics.logistics} <span className="text-xs font-semibold text-purple-600">item</span></p>
        </div>
      </div>

      {/* FILTER SEARCH (HILANG SAAT CETAK) */}
      <div className="relative no-print">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
        <input
          type="text"
          placeholder="Cari nama barang, supplier, atau cabang..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none"
        />
      </div>

      {/* DAFTAR PER VENDOR / SUPPLIER */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs font-bold">
          Memuat rekap permintaan belanja...
        </div>
      ) : Object.keys(groupedOrders).length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-xs font-medium bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          Tidak ada permintaan belanja masuk pada tanggal ini.
        </div>
      ) : (
        <div className="space-y-5 print:space-y-3">
          {Object.entries(groupedOrders).map(([supplierName, list]) => (
            <div key={supplierName} className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs print-vendor-box">
              <div className="bg-slate-100/90 px-4 py-2 border-b border-slate-200/80 flex justify-between items-center print:py-1 print:px-2.5">
                <span className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2 print:text-[11px]">
                  <Store className="w-3.5 h-3.5 text-indigo-600 print:hidden" />
                  {supplierName}
                </span>
                <span className="text-[10px] font-bold text-slate-500 print:text-[9px]">
                  {list.length} item
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse print-table">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 bg-slate-50/60 print:bg-slate-50 print:text-[9px]">
                      <th className="py-2.5 px-3 min-w-[150px] print:w-[30%]">NAMA BARANG</th>
                      <th className="py-2.5 px-3 min-w-[110px] print:w-[15%]">OUTLET</th>
                      <th className="py-2.5 px-3 text-right min-w-[90px] print:w-[15%]">KUANTITAS</th>
                      <th className="py-2.5 px-3 min-w-[160px] print:w-[22%]">STATUS PEMESANAN</th>
                      <th className="py-2.5 px-3 min-w-[140px] print:w-[18%]">CATATAN</th>
                      <th className="py-2.5 px-2 text-center w-10 no-print">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-xs print:text-[10px]">
                    {list.map((item) => {
                      const isUpdating = updatingId === item.id;
                      const rawSt = (item.status || '').toUpperCase();
                      const isLeader = rawSt === 'ORDERED_BY_LEADER' || rawSt === 'ORDERED_LEADER';
                      const isCashier = rawSt === 'BOUGHT_CASHIER' || rawSt === 'KASIR';
                      const isLogistics = rawSt === 'PROCESSED_LOGISTICS' || rawSt === 'LOGISTIK';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2 px-3 font-extrabold text-slate-900 uppercase">
                            {item.item_name}
                          </td>
                          <td className="py-2 px-3 text-slate-600 font-bold">
                            {getCleanOutletName(item.locations?.name)}
                          </td>
                          <td className="py-2 px-3 text-right font-black text-indigo-700">
                            {item.quantity}{' '}
                            <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span>
                          </td>
                          
                          {/* STATUS: TAMPIL DROPDOWN DI MONITOR, TAMPIL BADGE BERSIH DI CETAKAN */}
                          <td className="py-2 px-3">
                            <div className="no-print">
                              <select
                                value={
                                  isLeader
                                    ? 'ORDERED_LEADER'
                                    : isCashier
                                    ? 'BOUGHT_CASHIER'
                                    : isLogistics
                                    ? 'PROCESSED_LOGISTICS'
                                    : 'PENDING'
                                }
                                onChange={(e) => handleStatusChange(item.id, e.target.value)}
                                disabled={isUpdating}
                                className={`px-2 py-1 rounded-xl text-[11px] font-black border transition-all focus:outline-none cursor-pointer ${
                                  isLeader
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : isCashier
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : isLogistics
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : 'bg-orange-50 text-orange-700 border-orange-200'
                                }`}
                              >
                                <option value="PENDING">⏳ Menunggu Pembelian</option>
                                <option value="ORDERED_LEADER">✓ Diorder Leader</option>
                                <option value="BOUGHT_CASHIER">💵 Dibeli Kasir</option>
                                <option value="PROCESSED_LOGISTICS">🚚 Diproses Logistik</option>
                              </select>
                            </div>

                            <span className="hidden print:inline-block font-bold text-[9px] text-slate-800">
                              {getStatusPrintLabel(item.status)}
                            </span>
                          </td>

                          {/* KOLOM CATATAN RINGKAS */}
                          <td className="py-2 px-3 text-slate-500 font-medium text-[10px] truncate max-w-[140px] print:max-w-none print:whitespace-normal">
                            {item.notes || '-'}
                          </td>

                          <td className="py-2 px-2 text-center no-print">
                            <button
                              onClick={() => handleDeleteOrder(item.id)}
                              title="Hapus Baris"
                              className="p-1 text-slate-300 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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