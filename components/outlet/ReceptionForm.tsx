'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { PackageCheck, Plus, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  locationId: string;
  staffName: string;
}

export default function ReceptionForm({ locationId, staffName }: Props) {
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [itemName, setItemName] = useState('');
  const [customItem, setCustomItem] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('Porsi');
  const [source, setSource] = useState<'Dapur Pusat' | 'Belanja Luar / Supplier'>('Dapur Pusat');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Ambil master barang
  useEffect(() => {
    async function fetchMasterItems() {
      const { data } = await supabase.from('items').select('*').order('name');
      if (data && data.length > 0) {
        setItemsList(data);
        setItemName(data[0].name);
        setUnit(data[0].default_unit || 'Porsi');
      }
    }
    fetchMasterItems();
  }, []);

  const handleItemSelect = (selectedName: string) => {
    setItemName(selectedName);
    const found = itemsList.find((i) => i.name === selectedName);
    if (found) {
      setUnit(found.default_unit || 'Porsi');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const finalItemName = itemName === '__custom__' ? customItem.trim() : itemName;
    const qtyNum = parseFloat(quantity);

    if (!finalItemName) {
      setMessage({ text: 'Nama barang tidak boleh kosong.', type: 'error' });
      setLoading(false);
      return;
    }

    if (isNaN(qtyNum) || qtyNum <= 0) {
      setMessage({ text: 'Jumlah barang harus lebih dari 0.', type: 'error' });
      setLoading(false);
      return;
    }

    try {
      // 1. Simpan ke riwayat penerimaan barang (goods_receipts / receptions)
      const { error: receiptError } = await supabase.from('receptions').insert([
        {
          location_id: locationId,
          item_name: finalItemName,
          quantity: qtyNum,
          unit,
          source,
          notes: notes.trim() || null,
          received_by: staffName,
        },
      ]);

      if (receiptError) throw receiptError;

      // 2. Update atau tambah stok fisik di branch_stocks (upsert)
      const { data: existingStock } = await supabase
        .from('branch_stocks')
        .select('*')
        .eq('location_id', locationId)
        .eq('item_name', finalItemName)
        .single();

      if (existingStock) {
        const newTotal = Number(existingStock.remaining_stock) + qtyNum;
        await supabase
          .from('branch_stocks')
          .update({
            remaining_stock: newTotal,
            updated_by: staffName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingStock.id);
      } else {
        await supabase.from('branch_stocks').insert([
          {
            location_id: locationId,
            item_name: finalItemName,
            remaining_stock: qtyNum,
            unit,
            updated_by: staffName,
          },
        ]);
      }

      setMessage({ text: `Berhasil menerima ${qtyNum} ${unit} ${finalItemName}!`, type: 'success' });
      setQuantity('');
      setNotes('');
      setCustomItem('');
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menyimpan penerimaan barang.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-100">
        <PackageCheck className="w-5 h-5 text-amber-800" />
        <div>
          <h2 className="text-base font-bold text-neutral-800">Penerimaan Barang Masuk</h2>
          <p className="text-xs text-neutral-500">Catat langsung barang yang tiba di cabang fisik.</p>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 mb-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">
            Asal Pengiriman / Sumber
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSource('Dapur Pusat')}
              className={`py-2 px-3 rounded-xl border text-center font-bold transition-all ${
                source === 'Dapur Pusat'
                  ? 'bg-amber-900 text-white border-amber-900'
                  : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              Dapur Pusat
            </button>
            <button
              type="button"
              onClick={() => setSource('Belanja Luar / Supplier')}
              className={`py-2 px-3 rounded-xl border text-center font-bold transition-all ${
                source === 'Belanja Luar / Supplier'
                  ? 'bg-amber-900 text-white border-amber-900'
                  : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              Belanja Luar / Supplier
            </button>
          </div>
        </div>

        <div>
          <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">
            Nama Barang
          </label>
          <select
            value={itemName}
            onChange={(e) => handleItemSelect(e.target.value)}
            className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {itemsList.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name} ({item.category})
              </option>
            ))}
            <option value="__custom__">+ Input Barang Lainnya...</option>
          </select>
        </div>

        {itemName === '__custom__' && (
          <div>
            <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">
              Ketik Nama Barang Baru
            </label>
            <input
              type="text"
              required
              value={customItem}
              onChange={(e) => setCustomItem(e.target.value)}
              placeholder="Contoh: Saus Sambal Jerigen"
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">
              Jumlah Diterima
            </label>
            <input
              type="number"
              step="any"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">
              Satuan
            </label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="Porsi">Porsi</option>
              <option value="Pcs">Pcs / Butir</option>
              <option value="Kg">Kg</option>
              <option value="Liter">Liter</option>
              <option value="Pack">Pack</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">
            Catatan Kondisi Barang
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Kondisi beku baik, plastik rapi, dll (opsional)"
            className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-medium text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-amber-900 hover:bg-amber-800 text-white font-bold rounded-xl shadow transition-all disabled:opacity-50"
        >
          {loading ? 'Menyimpan...' : 'Konfirmasi Barang Masuk'}
        </button>
      </form>
    </div>
  );
}