'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Layers, RefreshCw, MapPin } from 'lucide-react';

interface StockRow {
  id: string;
  location_id: string;
  item_name: string;
  remaining_stock: number;
  unit: string;
  updated_by: string;
  updated_at: string;
  locations?: { name: string };
}

export default function BranchStockMonitor() {
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchStockData = async () => {
    setLoading(true);
    try {
      const { data: locData } = await supabase.from('locations').select('*');
      if (locData) setLocations(locData);

      const { data: stockData, error } = await supabase
        .from('branch_stocks')
        .select('*, locations(name)')
        .order('item_name', { ascending: true });

      if (!error && stockData) {
        setStocks(stockData as any);
      }
    } catch (err) {
      console.error('Gagal mengambil sisa stok:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockData();
  }, []);

  const filteredStocks = selectedFilter === 'all'
    ? stocks
    : stocks.filter((s) => s.location_id === selectedFilter);

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
      <div className="p-5 border-b border-neutral-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-200 text-amber-800">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-800">Monitor Sisa Stok Fisik Cabang</h2>
            <p className="text-xs text-neutral-500">Live pantauan sisa stok bahan dan porsi riil di setiap cabang.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <MapPin className="absolute left-3 top-2.5 w-3.5 h-3.5 text-neutral-400" />
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">Semua Cabang ({stocks.length} Item)</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchStockData}
            title="Perbarui Data"
            className="p-2 text-neutral-600 hover:text-amber-800 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-200 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-neutral-50/80 border-b border-neutral-200 text-neutral-600 font-bold uppercase tracking-wider">
              <th className="py-3 px-4">Lokasi Cabang</th>
              <th className="py-3 px-4">Nama Barang</th>
              <th className="py-3 px-4 text-right">Sisa Stok Fisik</th>
              <th className="py-3 px-4">Update Terakhir</th>
              <th className="py-3 px-4">Diinput Oleh</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 text-neutral-700">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-neutral-400">
                  Memuat rincian stok cabang...
                </td>
              </tr>
            ) : filteredStocks.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-neutral-400">
                  Belum ada laporan sisa stok fisik untuk cabang ini.
                </td>
              </tr>
            ) : (
              filteredStocks.map((item) => {
                const qty = Number(item.remaining_stock);
                return (
                  <tr key={item.id} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-neutral-800">
                      {item.locations?.name || 'Cabang'}
                    </td>
                    <td className="py-3 px-4 font-semibold text-neutral-900">{item.item_name}</td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-lg font-bold text-xs ${
                          qty <= 5
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : qty <= 15
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {qty} {item.unit}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-neutral-500 whitespace-nowrap">
                      {new Date(item.updated_at).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 font-medium text-neutral-600 whitespace-nowrap">
                      {item.updated_by || '-'}
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