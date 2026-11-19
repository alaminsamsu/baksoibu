'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  PackageCheck, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Check, 
  RefreshCw,
  Share2,
  Calendar,
  Plus,
  Trash2,
  CheckCheck,
  Store,
  AlertTriangle
} from 'lucide-react';

interface Props {
  user?: any;
  onBack?: () => void;
  locationId?: string;
  staffName?: string;
}

interface MasterItem {
  id: string;
  name: string;
  category: string;
  uom: string;
  supplier?: string;
}

interface OrderRequestRow {
  id: string;
  order_date: string;
  item_name: string;
  quantity: number;
  unit: string;
  supplier?: string;
  target_type?: string;
  status: string;
  notes?: string | null;
}

interface AdHocItem {
  id: string;
  item_name: string;
  quantity: string;
  unit: string;
  notes: string;
}

export default function ReceptionForm({ user, onBack, locationId, staffName }: Props) {
  const activeLocationId = locationId || user?.location_id;
  const activeStaffName = staffName || user?.active_staff_name || user?.username || 'Petugas Outlet';
  const outletName = user?.location_name || 'Outlet Bakso Ibu';

  const getTodayWita = () => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());
  };

  const [usageDate, setUsageDate] = useState<string>(getTodayWita());
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  const [orderList, setOrderList] = useState<OrderRequestRow[]>([]);
  const [receivedQtys, setReceivedQtys] = useState<Record<string, string>>({});
  const [adHocItems, setAdHocItems] = useState<AdHocItem[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const normalizeUnit = (itemName: string, rawUnit?: string) => {
    const lower = (itemName || '').toLowerCase();
    if (lower.includes('bihun')) {
      return 'Bungkus';
    }
    if (lower.includes('masako')) {
      return 'Saset';
    }
    if (lower.includes('kwetiau') || lower.includes('kwetiaw')) {
      return 'kg';
    }
    if (lower.includes('kecap nasional')) {
      return 'Liter';
    }
    if (lower.includes('air mineral') || lower.includes('air botol')) {
      return 'Pcs';
    }
    if (lower.includes('bumbu kuah')) {
      return 'Bungkus';
    }
    return rawUnit || 'Pcs';
  };

  const normalizeCategory = (rawCat?: string, itemName?: string) => {
    const cat = (rawCat || '').trim();
    const name = (itemName || '').trim().toUpperCase();

    if (
      cat === 'Bahan Utama & Dapur' || 
      cat === 'Bahan Dapur & Bumbu' ||
      cat === 'Sayur, Mie & Pelengkap' ||
      cat === 'Bakso & Olahan Frozen' ||
      name.includes('AYAM') || name.includes('BUMBU') || name.includes('MASAKO') ||
      name.includes('GARAM') || name.includes('LADAKU') || name.includes('VITSIN') ||
      name.includes('MSG') || name.includes('MINYAK') || name.includes('TELUR') ||
      name.includes('BAKSO') || name.includes('BIHUN') || name.includes('BAWANG') ||
      name.includes('BURAS') || name.includes('CUKA') || name.includes('TAHU')
    ) {
      return 'Bahan Utama & Dapur';
    }
    if (cat === 'Kondimen & Pelengkap' || name.includes('KECAP') || name.includes('SAOS') || name.includes('SAUS') || name.includes('SAMBAL')) {
      return 'Kondimen & Pelengkap';
    }
    if (cat === 'Minuman & Es' || name.includes('TEH') || name.includes('AIR MINERAL') || name.includes('SIRUP')) {
      return 'Minuman & Es';
    }
    if (
      cat === 'Kemasan & Operasional' || name.includes('SEDOTAN') || name.includes('PIPET') ||
      name.includes('TISU') || name.includes('TISSUE') || name.includes('PLASTIK') ||
      name.includes('CUP') || name.includes('KERTAS') || name.includes('TALI')
    ) {
      return 'Kemasan & Operasional';
    }
    return 'Bahan Utama & Dapur';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ORDERED_LEADER':
        return { label: '✓ Diorder Leader', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'BOUGHT_CASHIER':
        return { label: '💵 Dibeli Kasir', className: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'PROCESSED_LOGISTICS':
        return { label: '🚚 Diproses Logistik', className: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'RECEIVED':
        return { label: '✅ Sudah Diterima', className: 'bg-slate-100 text-slate-600 border-slate-300' };
      case 'PARTIAL_RECEIVED':
        return { label: '⚠️ Diterima Sebagian', className: 'bg-amber-50 text-amber-700 border-amber-200' };
      default:
        return { label: status || 'Order Aktif', className: 'bg-slate-50 text-slate-600 border-slate-200' };
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: itemsData } = await supabase.from('items').select('*').order('name');
      if (itemsData) {
        setMasterItems(
          itemsData.map((i: any) => ({
            ...i,
            uom: normalizeUnit(i.name, i.uom)
          }))
        );
      }

      if (activeLocationId) {
        const { data: ordersData, error: ordersErr } = await supabase
          .from('order_requests')
          .select('*')
          .eq('location_id', activeLocationId)
          .eq('order_date', usageDate)
          .order('created_at', { ascending: true });

        if (ordersErr) throw ordersErr;

        const mappedOrders: OrderRequestRow[] = (ordersData || []).map((o: any) => ({
          ...o,
          unit: normalizeUnit(o.item_name, o.unit)
        }));

        setOrderList(mappedOrders);

        const initialQtys: Record<string, string> = {};
        mappedOrders.forEach((o) => {
          initialQtys[o.id] = '';
        });
        setReceivedQtys(initialQtys);
      }
    } catch (err: any) {
      console.error('Gagal mengambil data penerimaan:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [usageDate, activeLocationId]);

  const handleQtyChange = (orderId: string, val: string) => {
    setReceivedQtys((prev) => ({
      ...prev,
      [orderId]: val
    }));
  };

  const handleFillAllMatchOrder = () => {
    const updated: Record<string, string> = { ...receivedQtys };
    orderList.forEach((o) => {
      if (o.status !== 'RECEIVED') {
        updated[o.id] = String(o.quantity);
      }
    });
    setReceivedQtys(updated);
  };

  const handleAddAdHocRow = () => {
    setAdHocItems((prev) => [
      ...prev,
      {
        id: `adhoc-${Date.now()}`,
        item_name: masterItems[0]?.name || '',
        quantity: '',
        unit: masterItems[0]?.uom || 'Pcs',
        notes: ''
      }
    ]);
  };

  const handleUpdateAdHocRow = (id: string, field: keyof AdHocItem, value: string) => {
    setAdHocItems((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        if (field === 'item_name') {
          const found = masterItems.find((m) => m.name === value);
          return {
            ...row,
            item_name: value,
            unit: normalizeUnit(value, found?.uom)
          };
        }
        return { ...row, [field]: value };
      })
    );
  };

  const handleRemoveAdHocRow = (id: string) => {
    setAdHocItems((prev) => prev.filter((row) => row.id !== id));
  };

  const filteredOrders = useMemo(() => {
    return orderList.filter((o) => {
      const matchSearch =
        o.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.supplier || o.target_type || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [orderList, searchTerm, statusFilter]);

  const totalFilledCount = useMemo(() => {
    const fromOrders = Object.values(receivedQtys).filter((v) => parseFloat(v) > 0).length;
    const fromAdHoc = adHocItems.filter((a) => a.item_name && parseFloat(a.quantity) > 0).length;
    return fromOrders + fromAdHoc;
  }, [receivedQtys, adHocItems]);

  const handleShareToWhatsApp = () => {
    const filledOrders = orderList.filter((o) => parseFloat(receivedQtys[o.id] || '0') > 0);
    const validAdHoc = adHocItems.filter((a) => a.item_name && parseFloat(a.quantity || '0') > 0);

    if (filledOrders.length === 0 && validAdHoc.length === 0) {
      alert('Isi minimal 1 jumlah barang yang diterima untuk dibagikan ke WhatsApp!');
      return;
    }

    const timeStr = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Makassar',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date());

    let text = `📦 *[BARANG MASUK] • ${outletName}*\n`;
    text += `📅 Pakai: *${usageDate}* • 👤 *${activeStaffName}* (${timeStr})\n\n`;

    if (filledOrders.length > 0) {
      text += `*1. Realisasi Order (${filledOrders.length} Item):*\n`;
      filledOrders.forEach((o) => {
        const recQty = parseFloat(receivedQtys[o.id] || '0');
        const diff = recQty - Number(o.quantity);

        if (diff === 0) {
          text += `✅ ${o.item_name}: *${recQty} ${o.unit}*\n`;
        } else if (diff < 0) {
          text += `⚠️ ${o.item_name}: *${recQty}/${o.quantity} ${o.unit}* _(Kurang ${Math.abs(diff)})_\n`;
        } else {
          text += `➕ ${o.item_name}: *${recQty}/${o.quantity} ${o.unit}* _(Lebih +${diff})_\n`;
        }
      });
      text += `\n`;
    }

    if (validAdHoc.length > 0) {
      text += `*2. Di Luar Order:*\n`;
      validAdHoc.forEach((a) => {
        text += `🔸 ${a.item_name}: *${a.quantity} ${a.unit}*${a.notes ? ` _(${a.notes})_` : ''}\n`;
      });
      text += `\n`;
    }

    if (notes.trim()) {
      text += `📝 _${notes.trim()}_`;
    }

    text = text.trim();

    if (navigator.share) {
      navigator.share({ title: `Barang Masuk - ${outletName}`, text }).catch(() => {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
      });
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLocationId) {
      setMessage({ text: 'Cabang / lokasi tidak terdeteksi.', type: 'error' });
      return;
    }

    const filledOrders = orderList.filter((o) => parseFloat(receivedQtys[o.id] || '0') > 0);
    const validAdHoc = adHocItems.filter((a) => a.item_name && parseFloat(a.quantity || '0') > 0);

    if (filledOrders.length === 0 && validAdHoc.length === 0) {
      alert('Isi minimal 1 barang dengan jumlah diterima lebih dari 0.');
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const nowIso = new Date().toISOString();

      for (const order of filledOrders) {
        const recQty = parseFloat(receivedQtys[order.id]);
        const diff = recQty - Number(order.quantity);
        const masterMeta = masterItems.find((m) => m.name === order.item_name);
        const category = normalizeCategory(masterMeta?.category, order.item_name);

        let movementNote = `Terima order tgl ${usageDate} (Order: ${order.quantity} ${order.unit}, Terima: ${recQty} ${order.unit})`;
        if (diff < 0) movementNote += ` [KURANG ${Math.abs(diff)} ${order.unit}]`;
        if (diff > 0) movementNote += ` [LEBIH +${diff} ${order.unit}]`;
        if (notes.trim()) movementNote += ` - ${notes.trim()}`;

        await supabase.from('stock_movements').insert([
          {
            location_id: activeLocationId,
            item_name: order.item_name,
            quantity: recQty,
            unit: order.unit,
            movement_type: 'MASUK',
            notes: movementNote,
            recorded_by: activeStaffName,
            created_at: nowIso
          }
        ]);

        await supabase.from('branch_stocks').upsert(
          {
            location_id: activeLocationId,
            item_name: order.item_name,
            unit: order.unit,
            category,
            updated_by: `${activeStaffName} (Terima Order)`,
            last_updated_by: `${activeStaffName} (Terima Order)`,
            updated_at: nowIso,
            last_updated: nowIso
          },
          { onConflict: 'location_id,item_name' }
        );

        const nextStatus = recQty < Number(order.quantity) ? 'PARTIAL_RECEIVED' : 'RECEIVED';
        await supabase
          .from('order_requests')
          .update({ status: nextStatus })
          .eq('id', order.id);
      }

      for (const adhoc of validAdHoc) {
        const qtyNum = parseFloat(adhoc.quantity);
        const masterMeta = masterItems.find((m) => m.name === adhoc.item_name);
        const category = normalizeCategory(masterMeta?.category, adhoc.item_name);
        const adhocNote = `Barang masuk di luar order tgl ${usageDate}${adhoc.notes ? `: ${adhoc.notes}` : ''}${notes.trim() ? ` (${notes.trim()})` : ''}`;

        await supabase.from('stock_movements').insert([
          {
            location_id: activeLocationId,
            item_name: adhoc.item_name,
            quantity: qtyNum,
            unit: adhoc.unit,
            movement_type: 'MASUK',
            notes: adhocNote,
            recorded_by: activeStaffName,
            created_at: nowIso
          }
        ]);

        await supabase.from('branch_stocks').upsert(
          {
            location_id: activeLocationId,
            item_name: adhoc.item_name,
            unit: adhoc.unit,
            category,
            updated_by: `${activeStaffName} (Belanja Tambahan)`,
            last_updated_by: `${activeStaffName} (Belanja Tambahan)`,
            updated_at: nowIso,
            last_updated: nowIso
          },
          { onConflict: 'location_id,item_name' }
        );
      }

      setMessage({
        text: `Berhasil mencatat ${filledOrders.length + validAdHoc.length} item barang masuk! Stok (+ Masuk) & status permintaan belanja otomatis diperbarui.`,
        type: 'success'
      });

      setAdHocItems([]);
      setNotes('');
      await fetchData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menyimpan penerimaan barang.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-xs max-w-5xl mx-auto space-y-6 font-sans">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Dashboard
        </button>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Lembar Penerimaan Barang Datang
            </h2>
            <p className="text-xs font-medium text-slate-400">
              Acuan otomatis dari Permintaan Belanja • Cek selisih kurang/lebih & belanja tambahan.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleShareToWhatsApp}
            disabled={totalFilledCount === 0}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Bagikan ke WA</span>
          </button>

          <div className="text-xs font-black px-3.5 py-2 bg-indigo-50 text-indigo-600 border border-indigo-200/60 rounded-xl">
            {totalFilledCount} item terisi
          </div>

          <button
            type="button"
            onClick={fetchData}
            className="p-2 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
            title="Segarkan Data Order"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
        <div className="md:col-span-3">
          <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-indigo-600" /> Tanggal Pemakaian Order
          </label>
          <input
            type="date"
            value={usageDate}
            onChange={(e) => setUsageDate(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none cursor-pointer"
          />
        </div>

        <div className="md:col-span-3">
          <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
            Filter Status Order
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Semua Status ({orderList.length})</option>
            <option value="ORDERED_LEADER">✓ Diorder Leader</option>
            <option value="BOUGHT_CASHIER">💵 Dibeli Kasir</option>
            <option value="PROCESSED_LOGISTICS">🚚 Diproses Logistik</option>
            <option value="PARTIAL_RECEIVED">⚠️ Diterima Sebagian</option>
            <option value="RECEIVED">✅ Sudah Diterima</option>
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
            Cari Bahan / Supplier
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ketik nama bahan..."
              className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
            />
          </div>
        </div>

        <div className="md:col-span-3">
          <button
            type="button"
            onClick={handleFillAllMatchOrder}
            disabled={orderList.length === 0}
            className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Semua Sesuai Order</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-xs text-slate-400 font-bold">
          Memuat daftar permintaan belanja untuk tanggal {usageDate}...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-slate-700 tracking-wider">
                1. Daftar Permintaan Belanja ({filteredOrders.length} Item)
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                Isi jumlah fisik yang tiba; kosongkan jika barang belum datang
              </span>
            </div>

            <div className="border border-slate-100 rounded-2xl overflow-hidden overflow-x-auto shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4 min-w-[190px]">Nama Bahan & Supplier</th>
                    <th className="py-3 px-3 text-center w-40">Status Order</th>
                    <th className="py-3 px-3 text-right w-28">Qty Order</th>
                    <th className="py-3 px-4 text-right w-40">Fisik Diterima</th>
                    <th className="py-3 px-3 text-center w-36">Selisih / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 font-medium">
                        Tidak ada permintaan belanja ditemukan untuk tanggal pemakaian <b>{usageDate}</b>.
                        <br />
                        <span className="text-[11px]">Gunakan tombol <b>+ Tambah Barang</b> di bawah jika ada barang datang tanpa order.</span>
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const valStr = receivedQtys[order.id] ?? '';
                      const hasInput = valStr !== '' && parseFloat(valStr) > 0;
                      const numRec = parseFloat(valStr) || 0;
                      const diff = numRec - Number(order.quantity);
                      const badge = getStatusBadge(order.status);

                      return (
                        <tr
                          key={order.id}
                          className={`transition-colors ${
                            hasInput ? 'bg-indigo-50/40' : order.status === 'RECEIVED' ? 'bg-slate-50/60 opacity-75' : 'hover:bg-slate-50/60'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="font-extrabold text-slate-900 uppercase leading-tight">
                              {order.item_name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-semibold mt-0.5 flex items-center gap-1">
                              <Store className="w-3 h-3" />
                              <span>{order.supplier || order.target_type || 'RUMAH PRODUKSI'}</span>
                            </div>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border inline-block ${badge.className}`}>
                              {badge.label}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right font-black text-slate-700">
                            {order.quantity}{' '}
                            <span className="text-[10px] font-medium text-slate-400">{order.unit}</span>
                          </td>

                          <td className="py-2.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={valStr}
                                onChange={(e) => handleQtyChange(order.id, e.target.value)}
                                placeholder="0"
                                className={`w-20 px-2.5 py-1.5 text-right rounded-xl text-xs font-black border transition-all focus:outline-none ${
                                  hasInput
                                    ? 'bg-white border-indigo-600 text-indigo-700 ring-2 ring-indigo-500/20'
                                    : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-500'
                                }`}
                              />
                              <span className="text-[11px] text-slate-500 w-12 text-left font-semibold">
                                {order.unit}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-3 text-center">
                            {!hasInput ? (
                              <span className="text-[10px] text-slate-300 italic">Menunggu input</span>
                            ) : diff === 0 ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black">
                                ✓ Sesuai
                              </span>
                            ) : diff < 0 ? (
                              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-black">
                                Kurang {Math.abs(diff)} {order.unit}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-black">
                                Lebih +{diff} {order.unit}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-4 bg-amber-50/40 rounded-2xl border border-amber-200/70 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-black uppercase text-amber-900 tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  2. Barang Tambahan di Luar Permintaan Belanja (Opsional)
                </span>
                <p className="text-[10px] text-amber-700/80">
                  Isi jika ada kiriman ekstra dari dapur pusat atau belanja mendadak yang tidak tercatat di order.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddAdHocRow}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[11px] font-black flex items-center gap-1 shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Tambah Barang</span>
              </button>
            </div>

            {adHocItems.length > 0 && (
              <div className="space-y-2">
                {adHocItems.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white p-2.5 rounded-xl border border-amber-200/80 items-center"
                  >
                    <div className="sm:col-span-5">
                      <select
                        value={row.item_name}
                        onChange={(e) => handleUpdateAdHocRow(row.id, 'item_name', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-extrabold text-slate-800 focus:outline-none cursor-pointer"
                      >
                        {masterItems.map((m) => (
                          <option key={m.id} value={m.name}>
                            {m.name} ({m.uom})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-3 flex items-center gap-1.5">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={row.quantity}
                        onChange={(e) => handleUpdateAdHocRow(row.id, 'quantity', e.target.value)}
                        placeholder="Jumlah"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-amber-700 focus:outline-none"
                      />
                      <span className="text-[11px] font-bold text-slate-500 shrink-0">{row.unit}</span>
                    </div>

                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        value={row.notes}
                        onChange={(e) => handleUpdateAdHocRow(row.id, 'notes', e.target.value)}
                        placeholder="Alasan / Sumber..."
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveAdHocRow(row.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Hapus baris"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
              Catatan Umum Kondisi Barang Datang
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Misal: Ayam beku baik, sisa 2 kg menyusul sore dari pasar..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || totalFilledCount === 0}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white text-xs font-black rounded-2xl shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>
              {submitting
                ? 'Menyimpan Penerimaan...'
                : `Konfirmasi Penerimaan Barang (${totalFilledCount} Item)`}
            </span>
          </button>
        </form>
      )}
    </div>
  );
}