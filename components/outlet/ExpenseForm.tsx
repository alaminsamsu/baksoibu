'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Wallet, UploadCloud, CheckCircle2 } from 'lucide-react';

export default function ExpenseForm({ user, onBack }: { user: any; onBack: () => void }) {
  const [itemName, setItemName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('ikat');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      let receiptUrl = '';

      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${user.location_id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('nota-belanja')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from('nota-belanja')
          .getPublicUrl(filePath);

        receiptUrl = publicData.publicUrl;
      }

      const { error: insertError } = await supabase.from('petty_cash_expenses').insert({
        location_id: user.location_id,
        user_id: user.id,
        staff_name: user.active_staff_name || user.username,
        item_name: itemName,
        quantity: Number(qty) || 1,
        unit: unit,
        amount: Number(amount),
        receipt_image_url: receiptUrl,
        notes: notes,
      });

      if (insertError) throw insertError;

      alert('Pengeluaran kas kecil & bukti nota berhasil disimpan!');
      setItemName('');
      setQty('');
      setAmount('');
      setNotes('');
      setFile(null);
      onBack();
    } catch (err: any) {
      alert('Gagal mencatat pengeluaran: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg mx-auto bg-white p-6 rounded-2xl border shadow-sm">
      <div className="flex items-center justify-between border-b pb-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Wallet className="text-emerald-600" /> Catat Belanja Pasar (Kas Kecil)
        </h2>
        <button type="button" onClick={onBack} className="text-xs text-amber-900 font-semibold hover:underline">
          ← Batal
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-600">Nama Bahan Pasar / Belanja</label>
        <input
          type="text"
          required
          placeholder="Misal: Sawi Hijau, Jeruk Nipis, Es Batu, Galon"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          className="w-full p-2.5 border rounded-xl text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-600">Jumlah (Qty)</label>
          <input
            type="number"
            required
            placeholder="Misal: 5"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-full p-2.5 border rounded-xl text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-600">Satuan</label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full p-2.5 border rounded-xl text-sm bg-white"
          >
            <option value="ikat">Ikat</option>
            <option value="kg">Kg</option>
            <option value="butir">Butir</option>
            <option value="bungkus">Bungkus</option>
            <option value="balok">Balok</option>
            <option value="galon">Galon</option>
            <option value="porsi">Porsi</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-600">Total Nominal Belanja (Rp)</label>
        <input
          type="number"
          required
          placeholder="Misal: 45000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full p-2.5 border rounded-xl text-sm font-bold text-emerald-700"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-600">Foto Bukti Nota / Kuitansi</label>
        <div className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:bg-gray-50">
          <UploadCloud className="w-6 h-6 mx-auto text-gray-400 mb-1" />
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-xs text-gray-500 w-full"
          />
          <p className="text-[10px] text-gray-400 mt-1">Bisa langsung ambil foto lewat kamera HP</p>
        </div>
      </div>

      <button
        type="submit"
        disabled={uploading}
        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <CheckCircle2 className="w-4 h-4" />
        <span>{uploading ? 'Menyimpan & Upload Nota...' : 'Simpan Belanjaan'}</span>
      </button>
    </form>
  );
}