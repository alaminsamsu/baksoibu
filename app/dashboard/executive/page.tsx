'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Crown, Wallet, Layers, Download, LogOut, ExternalLink } from 'lucide-react';
function BranchStockMonitor() {
  const [stocks, setStocks] = React.useState<any[]>([]);
  const [locations, setLocations] = React.useState<any[]>([]);
  const [selectedFilter, setSelectedFilter] = React.useState('all');
  const [loading, setLoading] = React.useState(true);

  const fetchStockData = async () => {
    setLoading(true);
    try {
      const { data: locData } = await supabase.from('locations').select('*');
      if (locData) setLocations(locData);

      const { data: stockData } = await supabase
        .from('branch_stocks')
        .select('*, locations(name)')
        .order('item_name', { ascending: true });

      if (stockData) setStocks(stockData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchStockData();
  }, []);

  const filteredStocks = selectedFilter === 'all'
    ? stocks
    : stocks.filter((s) => s.location_id === selectedFilter);

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
      <div className="p-5 border-b border-neutral-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-neutral-800">Monitor Sisa Stok Fisik Cabang</h2>
          <p className="text-xs text-neutral-500">Live pantauan sisa stok bahan dan porsi riil di setiap cabang.</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
            className="w-full sm:w-48 px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 focus:outline-none"
          >
            <option value="all">Semua Cabang ({stocks.length} Item)</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>

          <button
            onClick={fetchStockData}
            type="button"
            className="px-3 py-1.5 text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-all"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-neutral-50 text-neutral-600 font-bold uppercase tracking-wider border-b border-neutral-200">
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
                  Memuat data stok...
                </td>
              </tr>
            ) : filteredStocks.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-neutral-400">
                  Belum ada data stok tercatat.
                </td>
              </tr>
            ) : (
              filteredStocks.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="py-3 px-4 font-bold text-neutral-800">{item.locations?.name || '-'}</td>
                  <td className="py-3 px-4 font-semibold text-neutral-900">{item.item_name}</td>
                  <td className="py-3 px-4 text-right font-bold text-amber-900">
                    {item.remaining_stock} {item.unit}
                  </td>
                  <td className="py-3 px-4 text-neutral-500 whitespace-nowrap">
                    {new Date(item.updated_at).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-3 px-4 text-neutral-600 whitespace-nowrap">{item.updated_by || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default function ExecutiveDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [inventories, setInventories] = useState<any[]>([]);
  const [totalExpense, setTotalExpense] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('bakso_ibu_user');
    if (!saved) {
      router.push('/login');
      return;
    }
    const parsed = JSON.parse(saved);
    if (parsed.role !== 'owner' && parsed.role !== 'admin_ops') {
      router.push('/login');
      return;
    }
    setUser(parsed);
  }, [router]);

  useEffect(() => {
    async function fetchData() {
      const { data: expData } = await supabase
        .from('petty_cash_expenses')
        .select('*, locations(name)')
        .order('created_at', { ascending: false });

      if (expData) {
        setExpenses(expData);
        const sum = expData.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
        setTotalExpense(sum);
      }

      const { data: invData } = await supabase
        .from('inventories')
        .select('*, items(name, unit), locations(name)')
        .order('quantity', { ascending: true });

      if (invData) setInventories(invData);
    }
    fetchData();
  }, []);

  const handleExportCSV = () => {
    let csv = 'Tanggal,Cabang,Petugas,Barang,Jumlah,Total_Rp\n';
    expenses.forEach((e) => {
      csv += `"${e.created_at?.slice(0, 10)}","${e.locations?.name || '-'}","${e.staff_name || '-'}","${e.item_name}","${e.quantity} ${e.unit}",${e.amount}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rekap_Belanja_BaksoIbu_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const handleLogout = () => {
    localStorage.removeItem('bakso_ibu_user');
    router.push('/login');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      <header className="bg-amber-950 text-white shadow-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-900 border border-amber-800 flex items-center justify-center">
              <Crown className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h1 className="font-black text-base text-white">PANEL OWNER</h1>
              <p className="text-[11px] text-amber-300">Monitoring 3 Cabang & Kasir</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" /> Unduh CSV
            </button>
            <button
              onClick={handleLogout}
              className="p-2 bg-amber-900 hover:bg-amber-800 text-amber-200 rounded-xl"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-gray-500 font-semibold uppercase">Total Belanja Pasar Kasir</span>
              <p className="text-xl font-black text-gray-900">Rp {totalExpense.toLocaleString('id-ID')}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-2xl flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-gray-500 font-semibold uppercase">Total Item Dipantau</span>
              <p className="text-xl font-black text-gray-900">{inventories.length} Titik Stok</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-gray-800 flex items-center gap-2">
            <Wallet className="text-emerald-600" /> Bukti Nota Belanja Pasar Harian
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase border-b">
                <tr>
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Cabang</th>
                  <th className="p-3">Petugas</th>
                  <th className="p-3">Barang</th>
                  <th className="p-3">Nominal</th>
                  <th className="p-3 text-center">Foto Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y text-gray-700">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-gray-400">Belum ada transaksi belanja pasar.</td>
                  </tr>
                ) : (
                  expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="p-3">{e.created_at?.slice(0, 10)}</td>
                      <td className="p-3 font-semibold">{e.locations?.name || '-'}</td>
                      <td className="p-3">{e.staff_name || '-'}</td>
                      <td className="p-3">{e.item_name} ({e.quantity} {e.unit})</td>
                      <td className="p-3 font-bold text-emerald-700">Rp {Number(e.amount).toLocaleString('id-ID')}</td>
                      <td className="p-3 text-center">
                        {e.receipt_image_url ? (
                          <a
                            href={e.receipt_image_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline font-bold"
                          >
                            Buka Nota <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-gray-400">Tanpa Nota</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-gray-800 flex items-center gap-2">
            <Layers className="text-amber-800" /> Monitor Sisa Stok Fisik Cabang
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase border-b">
                <tr>
                  <th className="p-3">Lokasi</th>
                  <th className="p-3">Nama Barang</th>
                  <th className="p-3 text-right">Sisa Stok</th>
                </tr>
              </thead>
              <tbody className="divide-y text-gray-700">
                {inventories.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="p-3 font-semibold">{inv.locations?.name}</td>
                    <td className="p-3">{inv.items?.name}</td>
                    <td className="p-3 text-right font-bold text-amber-900">
                      {inv.quantity} {inv.items?.unit}
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