'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Activity, RefreshCw, MapPin, TrendingDown, AlertTriangle, Edit3, Check, X } from 'lucide-react';

interface MovementRow {
  id: string;
  item_name: string;
  location_id: string;
  location_name: string;
  initial_stock: number;
  received_stock: number;
  remaining_stock: number;
  waste_qty: number;
  usage_qty: number;
  unit: string;
  updated_at: string;
  updated_by: string;
}

export default function BranchStockMonitor() {
  const [dataList, setDataList] = useState<MovementRow[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInitial, setEditInitial] = useState<number>(0);
  const [editRemaining, setEditRemaining] = useState<number>(0);

  const fetchLiveStockMovement = async () => {
    setLoading(true);
    try {
      const { data: locs } = await supabase.from('locations').select('*');
      if (locs) setLocations(locs);

      const { data: stocks, error: stockErr } = await supabase
        .from('branch_stocks')
        .select('*, locations(name)')
        .order('item_name');

      if (stockErr) throw stockErr;

      const today = new Date().toISOString().split('T')[0];
      const { data: recData } = await supabase
        .from('receptions')
        .select('item_name, quantity, location_id')
        .gte('created_at', `${today}T00:00:00Z`);

      const { data: closingData } = await supabase
        .from('daily_closings')
        .select('item_name, waste_qty, location_id')
        .eq('closing_date', today);

      const computed: MovementRow[] = (stocks || []).map((s: any) => {
        const totalReceived = (recData || [])
          .filter((r) => r.location_id === s.location_id && r.item_name === s.item_name)
          .reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);

        const waste = (closingData || [])
          .filter((c) => c.location_id === s.location_id && c.item_name === s.item_name)
          .reduce((acc, curr) => acc + Number(curr.waste_qty || 0), 0);

        const init = Number(s.initial_stock || 0);
        const remain = Number(s.remaining_stock || 0);
        const usage = Math.max(0, init + totalReceived - remain - waste);

        return {
          id: s.id,
          item_name: s.item_name,
          location_id: s.location_id,
          location_name: s.locations?.name || 'Cabang',
          initial_stock: init,
          received_stock: totalReceived,
          remaining_stock: remain,
          waste_qty: waste,
          usage_qty: usage,
          unit: s.unit || 'Pcs',
          updated_at: s.updated_at,
          updated_by: s.updated_by,
        };
      });

      setDataList(computed);
    } catch (err) {
      console.error('Gagal memuat pergerakan stok:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveStockMovement();
  }, []);

  const handleStartEdit = (row: MovementRow) => {
    setEditingId(row.id);
    setEditInitial(row.initial_stock);
    setEditRemaining(row.remaining_stock);
  };

  const handleSaveEdit = async (row: MovementRow) => {
    try {
      const { error } = await supabase
        .from('branch_stocks')
        .update({
          initial_stock: editInitial,
          remaining_stock: editRemaining,
          updated_at: new Date().toISOString(),
          updated_by: 'Admin / Leader (Koreksi)',
        })
        .eq('id', row.id);

      if (error) throw error;
      setEditingId(null);
      fetchLiveStockMovement();
    } catch (err: any) {
      alert('Gagal menyimpan koreksi: ' + err.message);
    }
  };

  const filteredData = selectedLocation === 'all'
    ? dataList
    : dataList.filter((d) => d.location_id === selectedLocation);

  const totalUsage = filteredData.reduce((acc, curr) => acc + curr.usage_qty, 0);
  const totalWaste = filteredData.reduce((acc, curr) => acc + curr.waste_qty, 0);

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
      <div className="p-5 border-b border-neutral-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-200 text-amber-800">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-800">
              Insight & Monitor Pergerakan Stok Harian
            </h2>
            <p className="text-xs text-neutral-500">
              Pantau pemakaian bahan, barang masuk, waste, serta revisi stok awal jika terjadi salah input.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <MapPin className="absolute left-3 top-2.5 w-3.5 h-3.5 text-neutral-400" />
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">Semua Cabang</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchLiveStockMovement}
            title="Refresh Data"
            className="p-2 text-neutral-600 hover:text-amber-800 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-200 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-neutral-50/70 border-b border-neutral-100 text-xs">
        <div className="bg-white p-3 rounded-xl border border-neutral-200">
          <span className="text-neutral-500 text-[11px] font-semibold">Total Item Dipantau</span>
          <p className="text-base font-extrabold text-neutral-800 mt-0.5">{filteredData.length} Barang</p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-neutral-200">
          <span className="text-emerald-700 text-[11px] font-semibold flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5" /> Estimasi Total Terpakai
          </span>
          <p className="text-base font-extrabold text-emerald-800 mt-0.5">{totalUsage.toLocaleString()}</p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-neutral-200">
          <span className="text-red-700 text-[11px] font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Total Waste / Rusak
          </span>
          <p className="text-base font-extrabold text-red-700 mt-0.5">{totalWaste.toLocaleString()}</p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-neutral-200">
          <span className="text-amber-800 text-[11px] font-semibold">Fitur Koreksi</span>
          <p className="text-[11px] text-neutral-600 mt-1">Klik ikon pensil di tabel untuk revisi angka</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-bold uppercase tracking-wider">
              <th className="py-3 px-3">Cabang & Barang</th>
              <th className="py-3 px-2 text-right">Stok Awal</th>
              <th className="py-3 px-2 text-right text-emerald-700">+ Masuk</th>
              <th className="py-3 px-2 text-right text-neutral-800">Sisa Fisik</th>
              <th className="py-3 px-2 text-right text-red-700">Waste</th>
              <th className="py-3 px-2 text-right font-extrabold text-amber-900 bg-amber-50/50">Pemakaian</th>
              <th className="py-3 px-3 text-center">Aksi / Koreksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 text-neutral-700">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-neutral-400">
                  Menghitung pergerakan stok harian...
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-neutral-400">
                  Belum ada pergerakan stok yang tercatat untuk cabang ini.
                </td>
              </tr>
            ) : (
              filteredData.map((row) => {
                const isEditing = editingId === row.id;

                return (
                  <tr key={row.id} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-neutral-800">{row.item_name}</div>
                      <div className="text-[10px] text-neutral-400 font-medium">
                        {row.location_name} • Satuan: {row.unit}
                      </div>
                    </td>

                    <td className="py-2.5 px-2 text-right font-medium">
                      {isEditing ? (
                        <input
                          type="number"
                          step="any"
                          value={editInitial}
                          onChange={(e) => setEditInitial(parseFloat(e.target.value) || 0)}
                          className="w-16 px-1.5 py-0.5 border border-amber-400 rounded text-right text-xs"
                        />
                      ) : (
                        `${row.initial_stock} ${row.unit}`
                      )}
                    </td>

                    <td className="py-2.5 px-2 text-right font-semibold text-emerald-700">
                      +{row.received_stock}
                    </td>

                    <td className="py-2.5 px-2 text-right font-bold text-neutral-900">
                      {isEditing ? (
                        <input
                          type="number"
                          step="any"
                          value={editRemaining}
                          onChange={(e) => setEditRemaining(parseFloat(e.target.value) || 0)}
                          className="w-16 px-1.5 py-0.5 border border-amber-400 rounded text-right text-xs"
                        />
                      ) : (
                        `${row.remaining_stock} ${row.unit}`
                      )}
                    </td>

                    <td className="py-2.5 px-2 text-right font-semibold text-red-600">
                      {row.waste_qty > 0 ? `-${row.waste_qty}` : '0'}
                    </td>

                    <td className="py-2.5 px-2 text-right font-extrabold text-amber-950 bg-amber-50/50">
                      {row.usage_qty} {row.unit}
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleSaveEdit(row)}
                            className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                            title="Simpan Koreksi"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 bg-neutral-200 text-neutral-600 rounded hover:bg-neutral-300"
                            title="Batal"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEdit(row)}
                          className="p-1.5 text-neutral-400 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Koreksi Stok Awal / Sisa Fisik"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
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
  );
}