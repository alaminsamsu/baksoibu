'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ChefHat, Truck, PlusCircle, CheckCircle2, LogOut } from 'lucide-react';

export default function ProductionDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'cook'>('orders');
  const [orders, setOrders] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [cookItemId, setCookItemId] = useState('');
  const [cookQty, setCookQty] = useState('');
  const [dispatchQty, setDispatchQty] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('bakso_ibu_user');
    if (!saved) {
      router.push('/login');
      return;
    }
    setUser(JSON.parse(saved));
  }, [router]);

  const loadData = async () => {
    setLoading(true);
    const { data: orderData } = await supabase
      .from('stock_transfers')
      .select('*, locations!stock_transfers_to_location_id_fkey(name), stock_transfer_items(*, items(name, unit))')
      .eq('status', 'requested')
      .order('created_at', { ascending: false });

    if (orderData) setOrders(orderData);

    const { data: itemData } = await supabase
      .from('items')
      .select('*')
      .eq('source_type', 'central_kitchen');

    if (itemData) {
      setItems(itemData);
      if (itemData.length > 0) setCookItemId(itemData[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const handleShipOrder = async (order: any) => {
    try {
      for (const item of order.stock_transfer_items) {
        const qtyToShip = dispatchQty[item.id] ?? item.qty_requested;
        await supabase
          .from('stock_transfer_items')
          .update({ qty_dispatched: qtyToShip })
          .eq('id', item.id);
      }

      await supabase
        .from('stock_transfers')
        .update({
          status: 'shipped',
          shipped_at: new Date().toISOString(),
          shipped_by_staff_name: user.active_staff_name || user.username,
        })
        .eq('id', order.id);

      alert('Pesanan berhasil ditandai DIKIRIM ke outlet!');
      loadData();
    } catch (err: any) {
      alert('Gagal mengirim pesanan: ' + err.message);
    }
  };

  const handleRecordCook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookQty || Number(cookQty) <= 0) return;

    try {
      const { data: inv } = await supabase
        .from('inventories')
        .select('id, quantity')
        .eq('location_id', user.location_id)
        .eq('item_id', cookItemId)
        .single();

      if (inv) {
        await supabase
          .from('inventories')
          .update({
            quantity: Number(inv.quantity) + Number(cookQty),
            last_updated: new Date().toISOString(),
          })
          .eq('id', inv.id);
      } else {
        await supabase.from('inventories').insert({
          location_id: user.location_id,
          item_id: cookItemId,
          quantity: Number(cookQty),
        });
      }

      alert('Hasil masak berhasil dicatat ke stok Dapur Pusat!');
      setCookQty('');
    } catch (err: any) {
      alert('Gagal mencatat hasil masak: ' + err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('bakso_ibu_user');
    router.push('/login');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      <header className="bg-amber-950 text-white shadow-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-900 border border-amber-800 flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h1 className="font-black text-base text-white">RUMAH PRODUKSI</h1>
              <p className="text-[11px] text-amber-300">Dapur Pusat Bakso Ibu</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold text-amber-200 hidden sm:inline">
              Koki: {user.active_staff_name || user.username}
            </span>
            <button
              onClick={handleLogout}
              className="p-2 bg-amber-900 hover:bg-amber-800 text-amber-200 rounded-xl"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-5">
        <div className="flex gap-2 bg-white p-1.5 rounded-2xl border shadow-xs">
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'orders' ? 'bg-amber-900 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Truck className="w-4 h-4" /> Pesanan Masuk Cabang ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('cook')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'cook' ? 'bg-amber-900 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <PlusCircle className="w-4 h-4" /> Input Hasil Masak Hari Ini
          </button>
        </div>

        {activeTab === 'orders' && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-dashed text-center text-gray-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold">Belum ada pesanan baru dari cabang.</p>
              </div>
            ) : (
              orders.map((o) => (
                <div key={o.id} className="bg-white border rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex justify-between items-center text-xs border-b pb-2">
                    <span className="font-bold text-gray-800">Tujuan: {o.locations?.name || 'Cabang'}</span>
                    <span className="text-gray-500">Pemesan: {o.requested_by_staff_name || '-'}</span>
                  </div>

                  <div className="space-y-2">
                    {o.stock_transfer_items?.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-xl text-xs">
                        <span className="font-bold">{item.items?.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Minta: {item.qty_requested} {item.items?.unit}</span>
                          <span className="text-gray-400">|</span>
                          <label className="font-bold">Kirim:</label>
                          <input
                            type="number"
                            defaultValue={item.qty_requested}
                            onChange={(e) => setDispatchQty({ ...dispatchQty, [item.id]: Number(e.target.value) })}
                            className="w-16 p-1 border rounded-lg bg-white text-right font-bold"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleShipOrder(o)}
                    className="w-full py-2.5 bg-amber-900 hover:bg-amber-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Truck className="w-4 h-4" /> Kirim Barang Sekarang
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'cook' && (
          <form onSubmit={handleRecordCook} className="bg-white p-6 rounded-2xl border shadow-xs max-w-md mx-auto space-y-4">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 border-b pb-3">
              <PlusCircle className="text-amber-700" /> Catat Hasil Produksi Dapur
            </h3>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600">Pilih Item Olahan</label>
              <select
                value={cookItemId}
                onChange={(e) => setCookItemId(e.target.value)}
                className="w-full p-2.5 border rounded-xl text-xs bg-white"
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600">Jumlah Hasil Masak</label>
              <input
                type="number"
                required
                min="1"
                placeholder="Misal: 500"
                value={cookQty}
                onChange={(e) => setCookQty(e.target.value)}
                className="w-full p-2.5 border rounded-xl text-sm font-bold text-amber-900"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-amber-900 hover:bg-amber-800 text-white font-bold rounded-xl text-xs shadow-xs"
            >
              Tambah ke Stok Dapur Pusat
            </button>
          </form>
        )}
      </main>
    </div>
  );
}