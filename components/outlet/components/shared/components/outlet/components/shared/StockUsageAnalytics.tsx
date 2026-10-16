'use client';

import React, { useMemo } from 'react';
import { TrendingUp, AlertTriangle, Flame, ShieldAlert, Sparkles } from 'lucide-react';

interface MovementRow {
  id: string;
  item_name: string;
  category: string;
  location_name: string;
  initial_stock: number;
  received_stock: number;
  remaining_stock: number;
  waste_qty: number;
  usage_qty: number;
  unit: string;
}

interface Props {
  data: MovementRow[];
  titleSuffix?: string;
}

export default function StockUsageAnalytics({ data, titleSuffix = '' }: Props) {
  // 1. Top 5 Bahan Paling Banyak Terpakai
  const topUsedItems = useMemo(() => {
    return [...data]
      .filter((i) => i.usage_qty > 0)
      .sort((a, b) => b.usage_qty - a.usage_qty)
      .slice(0, 5);
  }, [data]);

  // 2. Bahan dengan Waste / Terbuang Tertinggi
  const highWasteItems = useMemo(() => {
    return [...data]
      .filter((i) => i.waste_qty > 0)
      .sort((a, b) => b.waste_qty - a.waste_qty)
      .slice(0, 3);
  }, [data]);

  // 3. Peringatan Stok Kritis (Sisa Fisik <= 3 dan bukan 0 sebelum pemakaian)
  const lowStockAlerts = useMemo(() => {
    return data.filter(
      (i) => i.remaining_stock <= 3 && (i.initial_stock > 0 || i.received_stock > 0)
    );
  }, [data]);

  // 4. Hitung Rasio Efisiensi Global
  const totalUsage = useMemo(() => data.reduce((acc, curr) => acc + curr.usage_qty, 0), [data]);
  const totalWaste = useMemo(() => data.reduce((acc, curr) => acc + curr.waste_qty, 0), [data]);
  const wastePercentage = totalUsage + totalWaste > 0 
    ? ((totalWaste / (totalUsage + totalWaste)) * 100).toFixed(1) 
    : '0.0';

  return (
    <div className="space-y-4">
      {/* Header Analisa */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-indigo-600" />
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
          Analisis Pemakaian & Efisiensi Bahan {titleSuffix}
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Kolom 1: Top 5 Konsumsi Bahan */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm shadow-slate-200/40">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-[#ff6f3c]" />
              <span className="text-xs font-bold text-slate-800">Top Pemakaian Hari Ini</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-[#ff6f3c]">
              Terlaris
            </span>
          </div>

          {topUsedItems.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">Belum ada pemakaian tercatat.</p>
          ) : (
            <div className="space-y-2.5">
              {topUsedItems.map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-700 truncate">{item.item_name}</span>
                  </div>
                  <span className="font-black text-indigo-600 shrink-0 ml-2">
                    {item.usage_qty} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kolom 2: Rasio & Pantauan Waste */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm shadow-slate-200/40">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-slate-800">Rasio Terbuang (Waste)</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              Number(wastePercentage) > 3 
                ? 'bg-red-50 text-red-600 border border-red-200' 
                : 'bg-emerald-50 text-emerald-600'
            }`}>
              {wastePercentage}% dari stok keluar
            </span>
          </div>

          {highWasteItems.length === 0 ? (
            <div className="py-4 text-center">
              <span className="text-xs font-bold text-emerald-600">Zero Waste</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Tidak ada sisa bahan basi/rusak hari ini.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {highWasteItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 truncate">{item.item_name}</span>
                  <span className="font-black text-red-600">
                    -{item.waste_qty} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kolom 3: Early Warning / Stok Menipis */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm shadow-slate-200/40">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-800">Perlu Segera Restock</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {lowStockAlerts.length} item kritis
            </span>
          </div>

          {lowStockAlerts.length === 0 ? (
            <div className="py-4 text-center">
              <span className="text-xs font-bold text-indigo-600">Stok Aman</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Seluruh sisa fisik di atas ambang batas kritis.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {lowStockAlerts.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100">
                  <div className="truncate min-w-0 pr-2">
                    <div className="font-bold text-slate-800 truncate">{item.item_name}</div>
                    <div className="text-[9px] text-slate-400">{item.location_name}</div>
                  </div>
                  <span className="font-black text-amber-600 shrink-0">
                    Sisa {item.remaining_stock} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}