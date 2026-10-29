'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  ShoppingBag, 
  ArrowLeft, 
  FileDown, 
  Trash2, 
  RefreshCw, 
  Calendar, 
  Store, 
  Search,
  CheckCircle2
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
  is_ordered_by_leader?: boolean;
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
  const [successToast, setSuccessToast] = useState<string | null>(null);

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

  const handleDownloadPdf = () => {
    const originalTitle = document.title;
    const [year, month, day] = selectedDate.split('-');
    const formattedDate = `${day}-${month}-${year}`;
    
    document.title = `Order Bakso Ibu (${formattedDate})`;
    window.print();

    setTimeout(() => {
      document.title = originalTitle;
    }, 1500);
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    setSuccessToast(null);

    const isLeader = newStatus === 'ORDERED_LEADER' || newStatus === 'ORDERED_BY_LEADER';
    let dbStatus = newStatus;
    if (newStatus === 'ORDERED_LEADER') dbStatus = 'ORDERED_BY_LEADER';
    if (newStatus === 'PENDING') dbStatus = 'pending';

    try {
      const { error } = await supabase
        .from('order_requests')
        .update({ 
          status: dbStatus,
          is_ordered_by_leader: isLeader
        })
        .eq('id', orderId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((ord) => 
          ord.id === orderId 
            ? { ...ord, status: dbStatus, is_ordered_by_leader: isLeader } 
            : ord
        )
      );

      setSuccessToast('Status berhasil diperbarui!');
      setTimeout(() => setSuccessToast(null), 2500);
    } catch (err: any) {
      alert('Gagal memperbarui status: ' + (err.message || 'Periksa koneksi database.'));
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

  const groupedOrders = useMemo(() => {
    const groups: Record<string, OrderRecord[]> = {};
    filteredOrders.forEach((o) => {
      const sup = o.supplier || 'RUMAH PRODUKSI';
      if (!groups[sup]) groups[sup] = [];
      groups[sup].push(o);
    });
    return groups;
  }, [filteredOrders]);

  const getCleanOutletName = (rawName?: string) => {
    if (!rawName) return 'Outlet';
    const cleaned = rawName.replace(/^outlet\s+/i, '').trim();
    return `Outlet ${cleaned}`;
  };

  const getStatusBadge = (st?: string) => {
    const rawSt = (st || '').toUpperCase();
    if (rawSt === 'ORDERED_BY_LEADER' || rawSt === 'ORDERED_LEADER') {
      return {
        label: '✓ Diorder Leader',
        colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 print:bg-emerald-100 print:text-emerald-900',
        val: 'ORDERED_LEADER'
      };
    }
    if (rawSt === 'BOUGHT_CASHIER' || rawSt === 'KASIR') {
      return {
        label: '💵 Dibeli Kasir',
        colorClass: 'bg-blue-50 text-blue-800 border-blue-300 print:bg-blue-100 print:text-blue-900',
        val: 'BOUGHT_CASHIER'
      };
    }
    if (rawSt === 'PROCESSED_LOGISTICS' || rawSt === 'LOGISTIK') {
      return {
        label: '🚚 Diproses Logistik',
        colorClass: 'bg-purple-50 text-purple-800 border-purple-300 print:bg-purple-100 print:text-purple-900',
        val: 'PROCESSED_LOGISTICS'
      };
    }
    return {
      label: '⏳ Menunggu Pembelian',
      colorClass: 'bg-orange-50 text-orange-800 border-orange-300 print:bg-orange-100 print:text-orange-900',
      val: 'PENDING'
    };
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-xs space-y-6 font-sans print:p-0 print:m-0 print:border-none print:shadow-none">
      
      {/* CSS PRINT DENGAN MARGIN MINIMUM & WARNA ASLI */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0mm !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          body {
            background-color: #ffffff !important;
            padding: 8mm 6mm !important;
          }
          .no-print {
            display: none !important;
          }
          .print-header {
            display: block !important;
            margin-bottom: 10px;
            padding-bottom: 6px;
            border-bottom: 2px solid #0f172a;
          }
          .print-vendor-box {
            page-break-inside: avoid !important;
            margin-bottom: 8px !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 4px !important;
          }
          .print-vendor-header {
            background-color: #f1f5f9 !important;
            font-weight: 900 !important;
          }
          .print-table th {
            background-color: #f8fafc !important;
            border-bottom: 1px solid #cbd5e1 !important;
          }
          .print-table td {
            border-bottom: 1px solid #e2e8f0 !important;
          }
        }
      `}</style>

      {/* HEADER CETAK */}
      <div className="hidden print:block print-header">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-sm font-black text-slate-900 tracking-tight">
              BAKSO IBU • REKAP PERMINTAAN BELANJA MASUK
            </h1>
            <p className="text-[10px] text-slate-600 font-semibold mt-0.5">
              Tanggal: {new Date(selectedDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded text-indigo-900">
              Total {orders.length} Item
            </span>
          </div>
        </div>
      </div>

      {successToast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-2xl text-xs font-black shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2 no-print">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* HEADER KONTROL */}
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
              Kelola status pengadaan & unduh rekap PDF per vendor.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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
            onClick={handleDownloadPdf}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20"
          >
            <FileDown className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

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

      {/* DAFTAR PER VENDOR */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs font-bold">
          Memuat rekap permintaan belanja...
        </div>
      ) : Object.keys(groupedOrders).length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-xs font-medium bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          Tidak ada permintaan belanja masuk pada tanggal ini.
        </div>
      ) : (
        <div className="space-y-4 print:space-y-2.5">
          {Object.entries(groupedOrders).map(([supplierName, list]) => (
            <div key={supplierName} className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs print-vendor-box">
              <div className="bg-slate-100 px-3.5 py-1.5 border-b border-slate-200/80 flex justify-between items-center print-vendor-header">
                <span className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2 print:text-[10px]">
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
                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 bg-slate-50/60 print:text-[9px]">
                      <th className="py-2 px-3 min-w-[160px] print:w-[32%]">NAMA BARANG</th>
                      <th className="py-2 px-3 min-w-[110px] print:w-[15%]">OUTLET</th>
                      <th className="py-2 px-3 text-right min-w-[90px] print:w-[15%]">KUANTITAS</th>
                      <th className="py-2 px-3 min-w-[170px] print:w-[22%]">STATUS PEMESANAN</th>
                      <th className="py-2 px-3 min-w-[140px] print:w-[16%]">CATATAN</th>
                      <th className="py-2 px-2 text-center w-10 no-print">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-xs print:text-[10px]">
                    {list.map((item) => {
                      const isUpdating = updatingId === item.id;
                      const badge = getStatusBadge(item.status);
                      const isBtp = (item.locations?.name || '').toLowerCase().includes('btp');
                      
                      // Tampilkan catatan hanya jika diisi teks non-kosong, jika tidak maka '-'
                      const hasNote = item.notes && item.notes.trim() !== '' && !item.notes.includes('Mohon dikirim');
                      const displayNote = hasNote ? item.notes : '-';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-1.5 px-3 font-black text-slate-900 uppercase">
                            {item.item_name}
                          </td>
                          <td className="py-1.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              isBtp 
                                ? 'bg-blue-50 text-blue-700 border border-blue-200 print:bg-blue-100 print:text-blue-900' 
                                : 'bg-purple-50 text-purple-700 border border-purple-200 print:bg-purple-100 print:text-purple-900'
                            }`}>
                              {getCleanOutletName(item.locations?.name)}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-right font-black text-indigo-700 print:text-indigo-900">
                            {item.quantity}{' '}
                            <span className="text-[10px] text-slate-500 font-normal">{item.unit}</span>
                          </td>
                          
                          <td className="py-1.5 px-3">
                            <div className="no-print">
                              <select
                                value={badge.val}
                                onChange={(e) => handleStatusChange(item.id, e.target.value)}
                                disabled={isUpdating}
                                className={`px-2 py-1 rounded-xl text-[11px] font-black border transition-all focus:outline-none cursor-pointer ${badge.colorClass}`}
                              >
                                <option value="PENDING">⏳ Menunggu Pembelian</option>
                                <option value="ORDERED_LEADER">✓ Diorder Leader</option>
                                <option value="BOUGHT_CASHIER">💵 Dibeli Kasir</option>
                                <option value="PROCESSED_LOGISTICS">🚚 Diproses Logistik</option>
                              </select>
                            </div>

                            <span className={`hidden print:inline-block px-2 py-0.5 rounded border text-[9px] font-black ${badge.colorClass}`}>
                              {badge.label}
                            </span>
                          </td>

                          {/* KOLOM CATATAN BERSIH */}
                          <td className={`py-1.5 px-3 text-[10px] truncate max-w-[140px] print:max-w-none print:whitespace-normal ${hasNote ? 'text-slate-700 font-bold' : 'text-slate-400 font-normal'}`}>
                            {displayNote}
                          </td>

                          <td className="py-1.5 px-2 text-center no-print">
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