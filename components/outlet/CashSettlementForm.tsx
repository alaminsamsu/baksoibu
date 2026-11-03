'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Banknote, 
  QrCode, 
  ShoppingBag, 
  Wallet, 
  Save, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Calendar,
  Building2,
  Plus,
  Trash2,
  Coins,
  ArrowRightCircle,
  Camera,
  X,
  UploadCloud,
  Share2
} from 'lucide-react';

interface Props {
  user?: any;
  onBack?: () => void;
  locationId?: string;
  staffName?: string;
}

interface NonCashItem {
  id: string;
  category: string;
  nominal: number | string;
  notes: string;
}

export default function CashSettlementForm({ user, onBack, locationId: propLocId, staffName: propStaff }: Props) {
  const effectiveLocationId = propLocId || user?.location_id || user?.id || '';
  const effectiveStaffName = propStaff || user?.active_staff_name || user?.username || 'Kasir Outlet';
  const outletName = user?.location_name || 'Outlet Bakso Ibu';

  const getOperationalDateForShift = (targetShift: 'SHIFT_1' | 'SHIFT_2') => {
    const now = new Date();
    const witaHour = parseInt(
      new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', hour: 'numeric', hour12: false }).format(now)
    );
    const d = new Date();
    if (targetShift === 'SHIFT_2' && witaHour < 6) {
      d.setDate(d.getDate() - 1);
    }
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(d);
  };

  const [shift, setShift] = useState<'SHIFT_1' | 'SHIFT_2'>('SHIFT_1');
  const [settlementDate, setSettlementDate] = useState<string>(getOperationalDateForShift('SHIFT_1'));

  // Input Fields Omset
  const [openingCash, setOpeningCash] = useState<number | string>(0);
  const [totalBills, setTotalBills] = useState<number | string>('');
  const [cashNominal, setCashNominal] = useState<number | string>('');
  const [qrisNominal, setQrisNominal] = useState<number | string>('');
  const [grabNominal, setGrabNominal] = useState<number | string>('');
  const [gofoodNominal, setGofoodNominal] = useState<number | string>('');
  const [shopeeNominal, setShopeeNominal] = useState<number | string>('');
  
  // 1. Pengeluaran Kasir (Memotong Uang Laci)
  const [expenseNominal, setExpenseNominal] = useState<number | string>('');
  const [expenseNotes, setExpenseNotes] = useState<string>('');

  // 2. Pengeluaran Non-Kasir (Rumah Produksi & Vendor)
  const [nonCashList, setNonCashList] = useState<NonCashItem[]>([
    { id: '1', category: 'RUMAH_PRODUKSI', nominal: '', notes: '' }
  ]);

  // Uang Fisik, Sisa Laci, dan Uang Setoran
  const [actualTotalCashInHand, setActualTotalCashInHand] = useState<number | string>('');
  const [cashRetainedInDrawer, setCashRetainedInDrawer] = useState<number | string>('');
  const [notes, setNotes] = useState<string>('');

  // Foto Bukti Nota Kasir & Setoran
  const [expensePhotos, setExpensePhotos] = useState<string[]>([]);
  const [depositPhoto, setDepositPhoto] = useState<string | null>(null);
  const [uploadingExpensePhoto, setUploadingExpensePhoto] = useState(false);
  const [uploadingDepositPhoto, setUploadingDepositPhoto] = useState(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  const expenseFileInputRef = useRef<HTMLInputElement | null>(null);
  const depositFileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Kalkulasi Angka
  const numOpeningCash = Number(openingCash) || 0;
  const numCash = Number(cashNominal) || 0;
  const numQris = Number(qrisNominal) || 0;
  const numGrab = Number(grabNominal) || 0;
  const numGofood = Number(gofoodNominal) || 0;
  const numShopee = Number(shopeeNominal) || 0;
  const numExpense = Number(expenseNominal) || 0;

  const totalNonCashExpense = nonCashList.reduce((sum, item) => sum + (Number(item.nominal) || 0), 0);
  const numActualTotalInHand = Number(actualTotalCashInHand) || 0;
  const numRetained = Number(cashRetainedInDrawer) || 0;

  // Pemisahan Kanal Penjualan
  const omsetDineIn = numCash + numQris;
  const omsetOnline = numGrab + numGofood + numShopee;
  const totalOmset = omsetDineIn + omsetOnline;

  const expectedCashInDrawer = numOpeningCash + numCash - numExpense;
  const cashDifference = actualTotalCashInHand === '' ? 0 : numActualTotalInHand - expectedCashInDrawer;
  const netCashToDeposit = Math.max(0, numActualTotalInHand - numRetained);

  const handleShiftChange = (newShift: 'SHIFT_1' | 'SHIFT_2') => {
    setShift(newShift);
    setSettlementDate(getOperationalDateForShift(newShift));
  };

  useEffect(() => {
    loadExistingSettlement();
  }, [settlementDate, shift, effectiveLocationId]);

  const loadExistingSettlement = async () => {
    if (!effectiveLocationId) return;
    setLoading(true);
    setMsg(null);
    try {
      const { data, error } = await supabase
        .from('cash_settlements')
        .select('*')
        .eq('location_id', effectiveLocationId)
        .eq('settlement_date', settlementDate)
        .eq('shift', shift)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setOpeningCash(data.opening_cash ?? 0);
        setTotalBills(data.total_bills ?? '');
        setCashNominal(data.cash_nominal ?? '');
        setQrisNominal(data.qris_nominal ?? '');
        setGrabNominal(data.grab_nominal ?? '');
        setGofoodNominal(data.gofood_nominal ?? '');
        setShopeeNominal(data.shopee_nominal ?? '');
        setExpenseNominal(data.expense_nominal ?? '');
        setExpenseNotes(data.expense_notes ?? '');

        if (data.non_cash_expense_notes && data.non_cash_expense_notes.startsWith('[')) {
          try {
            const parsed = JSON.parse(data.non_cash_expense_notes);
            setNonCashList(parsed);
          } catch {
            setNonCashList([{
              id: '1',
              category: data.non_cash_expense_category || 'RUMAH_PRODUKSI',
              nominal: data.non_cash_expense_nominal || '',
              notes: data.non_cash_expense_notes || ''
            }]);
          }
        } else if (data.non_cash_expense_nominal > 0) {
          setNonCashList([{
            id: '1',
            category: data.non_cash_expense_category || 'RUMAH_PRODUKSI',
            nominal: data.non_cash_expense_nominal,
            notes: data.non_cash_expense_notes || ''
          }]);
        } else {
          setNonCashList([{ id: '1', category: 'RUMAH_PRODUKSI', nominal: '', notes: '' }]);
        }

        setActualTotalCashInHand(data.actual_cash_deposited ?? '');
        setCashRetainedInDrawer(data.cash_retained_in_drawer ?? '');
        setExpensePhotos(data.expense_receipt_photos || []);
        setDepositPhoto(data.deposit_receipt_photo || null);
        setNotes(data.notes ?? '');
      } else {
        setOpeningCash(0);
        setTotalBills('');
        setCashNominal('');
        setQrisNominal('');
        setGrabNominal('');
        setGofoodNominal('');
        setShopeeNominal('');
        setExpenseNominal('');
        setExpenseNotes('');
        setNonCashList([{ id: '1', category: 'RUMAH_PRODUKSI', nominal: '', notes: '' }]);
        setActualTotalCashInHand('');
        setCashRetainedInDrawer('');
        setExpensePhotos([]);
        setDepositPhoto(null);
        setNotes('');
      }
    } catch (err: any) {
      console.error('Error load settlement:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const maxWidth = 1200;
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Gagal kanvas'));

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Gagal kompres'));
            },
            'image/jpeg',
            0.7
          );
        };
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleUploadExpensePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingExpensePhoto(true);
    try {
      const newUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressedBlob = await compressImage(file);
        const fileName = `nota_${settlementDate}_${shift}_${Date.now()}_${i}.jpg`;

        const { error: uploadErr } = await supabase.storage
          .from('settlement-receipts')
          .upload(fileName, compressedBlob, { contentType: 'image/jpeg' });

        if (uploadErr) throw uploadErr;

        const { data: publicUrlData } = supabase.storage
          .from('settlement-receipts')
          .getPublicUrl(fileName);

        newUrls.push(publicUrlData.publicUrl);
      }

      setExpensePhotos((prev) => [...prev, ...newUrls]);
    } catch (err: any) {
      alert('Gagal upload nota: ' + err.message);
    } finally {
      setUploadingExpensePhoto(false);
      if (expenseFileInputRef.current) expenseFileInputRef.current.value = '';
    }
  };

  const handleRemoveExpensePhoto = (indexToRemove: number) => {
    setExpensePhotos((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleUploadDepositPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDepositPhoto(true);
    try {
      const compressedBlob = await compressImage(file);
      const fileName = `setor_bank_${settlementDate}_${shift}_${Date.now()}.jpg`;

      const { error: uploadErr } = await supabase.storage
        .from('settlement-receipts')
        .upload(fileName, compressedBlob, { contentType: 'image/jpeg' });

      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage
        .from('settlement-receipts')
        .getPublicUrl(fileName);

      setDepositPhoto(publicUrlData.publicUrl);
    } catch (err: any) {
      alert('Gagal upload bukti setoran: ' + err.message);
    } finally {
      setUploadingDepositPhoto(false);
      if (depositFileInputRef.current) depositFileInputRef.current.value = '';
    }
  };

  const handleAddNonCashRow = () => {
    setNonCashList((prev) => [
      ...prev,
      { id: Date.now().toString(), category: 'RUMAH_PRODUKSI', nominal: '', notes: '' }
    ]);
  };

  const handleRemoveNonCashRow = (id: string) => {
    if (nonCashList.length === 1) {
      setNonCashList([{ id: Date.now().toString(), category: 'RUMAH_PRODUKSI', nominal: '', notes: '' }]);
      return;
    }
    setNonCashList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateNonCashRow = (id: string, field: keyof NonCashItem, value: any) => {
    setNonCashList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Format Pesan Rekap Omset & Kas Kasir ke WhatsApp
  const handleShareToWhatsApp = () => {
    if (totalOmset === 0 && numActualTotalInHand === 0) {
      alert('Isi data omset atau kas terlebih dahulu sebelum membagikan ke WhatsApp!');
      return;
    }

    const diffText = cashDifference === 0 
      ? 'KLOP (Rp 0)' 
      : `${cashDifference < 0 ? 'MINUS' : 'LEBIH'} Rp ${Math.abs(cashDifference).toLocaleString('id-ID')}`;

    let text = `*REKAP OMSET & KAS KASIR*\n`;
    text += `📍 Outlet: *${outletName}*\n`;
    text += `📅 Tanggal: *${settlementDate}*\n`;
    text += `⏱️ Shift: *${shift === 'SHIFT_1' ? 'Shift 1 (Siang)' : 'Shift 2 (Malam)'}*\n`;
    text += `👤 Kasir: *${effectiveStaffName}*\n`;
    if (Number(totalBills) > 0) text += `🧾 Total Transaksi (TC): *${totalBills} Struk*\n`;
    text += `\n`;

    text += `*1. OMSET PENJUALAN SHIFT:*\n`;
    text += `• Dine In (Cash): Rp ${numCash.toLocaleString('id-ID')}\n`;
    text += `• Dine In (QRIS/Tf): Rp ${numQris.toLocaleString('id-ID')}\n`;
    if (numGrab > 0) text += `• GrabFood: Rp ${numGrab.toLocaleString('id-ID')}\n`;
    if (numGofood > 0) text += `• GoFood: Rp ${numGofood.toLocaleString('id-ID')}\n`;
    if (numShopee > 0) text += `• ShopeeFood: Rp ${numShopee.toLocaleString('id-ID')}\n`;
    text += `👉 *Total Omset: Rp ${totalOmset.toLocaleString('id-ID')}*\n\n`;

    text += `*2. PENGELUARAN KASIR (LACI):*\n`;
    text += `• Nominal Keluar: *Rp ${numExpense.toLocaleString('id-ID')}*\n`;
    if (expenseNotes.trim()) text += `• Keperluan: _${expenseNotes.trim()}_\n`;
    if (expensePhotos.length > 0) text += `• Bukti Nota: *${expensePhotos.length} Foto Terlampir*\n`;
    text += `\n`;

    const validNonCash = nonCashList.filter(i => Number(i.nominal) > 0);
    if (validNonCash.length > 0) {
      text += `*3. PENGELUARAN NON-KASIR (RP & VENDOR):*\n`;
      validNonCash.forEach((item, idx) => {
        text += `• ${item.category}: Rp ${Number(item.nominal).toLocaleString('id-ID')} ${item.notes ? `(${item.notes})` : ''}\n`;
      });
      text += `👉 *Total Beban Vendor: Rp ${totalNonCashExpense.toLocaleString('id-ID')}*\n\n`;
    }

    text += `*4. REKONSILIASI KAS LACI & SETORAN:*\n`;
    text += `• Modal Awal Laci: Rp ${numOpeningCash.toLocaleString('id-ID')}\n`;
    text += `• Seharusnya di Laci: Rp ${expectedCashInDrawer.toLocaleString('id-ID')}\n`;
    text += `• Total Fisik Nyata di Laci: *Rp ${numActualTotalInHand.toLocaleString('id-ID')}*\n`;
    text += `• Status Kasir: *${diffText}*\n`;
    text += `• Sisa Kas Ditinggal di Laci: *Rp ${numRetained.toLocaleString('id-ID')}*\n`;
    text += `------------------------------------\n`;
    text += `💰 *UANG BERSIH YANG DISETOR: Rp ${netCashToDeposit.toLocaleString('id-ID')}*\n`;
    if (depositPhoto) text += `📌 _(Bukti transfer/setoran ATM sudah diupload)_\n`;
    text += `------------------------------------\n`;
    text += `_Dilaporkan resmi via Sistem ERP Bakso Ibu_`;

    if (navigator.share) {
      navigator.share({
        title: `Rekap Kasir - ${outletName}`,
        text: text,
      }).catch(() => {
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        window.open(waUrl, '_blank');
      });
    } else {
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveLocationId) {
      setMsg({ text: 'Cabang / Lokasi tidak terdeteksi.', type: 'error' });
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const validNonCashItems = nonCashList.filter((item) => Number(item.nominal) > 0);
      const totalNonCash = validNonCashItems.reduce((acc, curr) => acc + Number(curr.nominal || 0), 0);

      const payload: Record<string, any> = {
        location_id: effectiveLocationId,
        settlement_date: settlementDate,
        shift: shift,
        opening_cash: numOpeningCash,
        total_bills: Number(totalBills) || 0,
        
        cash_nominal: numCash,
        qris_nominal: numQris,
        grab_nominal: numGrab,
        gofood_nominal: numGofood,
        shopee_nominal: numShopee,
        online_nominal: omsetOnline,

        omset_dine_in: omsetDineIn,
        omset_online: omsetOnline,

        expense_nominal: numExpense,
        expense_notes: expenseNotes.trim() || null,
        expense_receipt_photos: expensePhotos,

        non_cash_expense_nominal: totalNonCash,
        non_cash_expense_category: validNonCashItems.length > 0 ? validNonCashItems.map(i => i.category).join(', ') : null,
        non_cash_expense_notes: validNonCashItems.length > 0 ? JSON.stringify(validNonCashItems) : null,
        
        actual_cash_deposited: numActualTotalInHand,
        cash_retained_in_drawer: numRetained,
        net_cash_deposited: netCashToDeposit,
        deposit_receipt_photo: depositPhoto,
        cash_difference: cashDifference,
        notes: notes.trim() || null,
        reported_by: effectiveStaffName,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('cash_settlements')
        .upsert(payload, { onConflict: 'location_id,settlement_date,shift' });

      if (error) throw error;

      const { data: locData } = await supabase
        .from('locations')
        .select('name')
        .eq('id', effectiveLocationId)
        .maybeSingle();

      const outletTitle = locData?.name || outletName;

      try {
        await fetch('/api/send-wa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outletName: outletTitle,
            settlementDate,
            shift,
            reportedBy: effectiveStaffName,
            totalOmset,
            omsetDineIn,
            omsetOnline,
            cashNominal: numCash,
            qrisNominal: numQris,
            onlineNominal: omsetOnline,
            expenseNominal: numExpense,
            expenseNotes: expenseNotes.trim(),
            nonCashExpenseNominal: totalNonCash,
            actualCashInHand: numActualTotalInHand,
            cashRetainedInDrawer: numRetained,
            netCashDeposited: netCashToDeposit,
            cashDifference,
            expensePhotosCount: expensePhotos.length,
            hasDepositPhoto: !!depositPhoto
          }),
        });
      } catch (waErr) {
        console.warn('Gagal pemicu WA:', waErr);
      }

      setMsg({
        text: `Rekap kasir ${shift === 'SHIFT_1' ? 'Shift 1' : 'Shift 2'} (${settlementDate}) tersimpan! Total disetor: Rp ${netCashToDeposit.toLocaleString('id-ID')} (${expensePhotos.length} nota kasir terlampir)`,
        type: 'success'
      });
    } catch (err: any) {
      setMsg({ text: `Gagal simpan: ${err.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-xs space-y-5 max-w-2xl mx-auto font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-all mr-1 cursor-pointer"
              title="Kembali"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <Banknote className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
              Rekap Omset & Kas Kasir
            </h3>
            <p className="text-[10px] text-slate-400">
              Input omset, pengeluaran kasir, foto nota, cek selisih & uang setoran.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tombol Bagikan ke WhatsApp */}
          <button
            type="button"
            onClick={handleShareToWhatsApp}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            title="Bagikan format rekap omset dan setoran ini ke WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Bagikan ke WA</span>
          </button>

          <div className="text-right pl-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Petugas</span>
            <span className="text-xs font-black text-slate-800">{effectiveStaffName}</span>
          </div>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
          msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />}
          <span>{msg.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tanggal & Pilihan Shift */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Tanggal Operasional
            </label>
            <input
              type="date"
              value={settlementDate}
              onChange={(e) => setSettlementDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> Pilihan Shift
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => handleShiftChange('SHIFT_1')}
                className={`py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  shift === 'SHIFT_1' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Shift 1 (Siang)
              </button>
              <button
                type="button"
                onClick={() => handleShiftChange('SHIFT_2')}
                className={`py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  shift === 'SHIFT_2' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Shift 2 (Malam)
              </button>
            </div>
          </div>
        </div>

        {/* Modal Kas & Total Bill */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Modal Awal Laci Kasir (Rp)
            </label>
            <input
              type="number"
              min="0"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Total Transaksi / Bill (Struk)
            </label>
            <input
              type="number"
              min="0"
              value={totalBills}
              onChange={(e) => setTotalBills(e.target.value)}
              placeholder="Contoh: 85"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
            />
          </div>
        </div>

        {/* Rincian Omset Penjualan */}
        <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
              Rincian Omset Penjualan Shift
            </span>
            <div className="flex items-center gap-2 text-[10px] font-bold">
              <span className="text-emerald-700">Dine In: Rp {omsetDineIn.toLocaleString('id-ID')}</span>
              <span className="text-slate-300">•</span>
              <span className="text-orange-700">Online: Rp {omsetOnline.toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-emerald-600" /> Penjualan Tunai / Cash (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={cashNominal}
                onChange={(e) => setCashNominal(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-indigo-600" /> QRIS / Transfer (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={qrisNominal}
                onChange={(e) => setQrisNominal(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" /> GrabFood (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={grabNominal}
                onChange={(e) => setGrabNominal(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-red-600" /> GoFood (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={gofoodNominal}
                onChange={(e) => setGofoodNominal(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-orange-600" /> ShopeeFood (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={shopeeNominal}
                onChange={(e) => setShopeeNominal(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-200/60">
            <span className="text-xs font-bold text-slate-500">Total Omset Shift:</span>
            <span className="text-base font-black text-emerald-600">
              Rp {totalOmset.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* 1. PENGELUARAN KASIR + UPLOAD FOTO NOTA */}
        <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-rose-500 block tracking-wider flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> 1. Pengeluaran Kasir (Uang Laci)
            </span>
            <span className="text-[9px] font-bold text-rose-400 bg-rose-100/60 px-2 py-0.5 rounded-md">
              Memotong Fisik Kasir
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-rose-800 mb-1">
                Nominal Keluar (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={expenseNominal}
                onChange={(e) => setExpenseNominal(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-white border border-rose-200 rounded-xl text-xs font-black text-rose-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-rose-800 mb-1">
                Catatan Pengeluaran / Keperluan
              </label>
              <input
                type="text"
                value={expenseNotes}
                onChange={(e) => setExpenseNotes(e.target.value)}
                placeholder="Misal: Gas 3 kg : 3 buah, es batu kristal"
                className="w-full px-3 py-2 bg-white border border-rose-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
              />
            </div>
          </div>

          {/* Area Lampiran Foto Nota Belanja Kasir */}
          <div className="pt-2 border-t border-rose-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-rose-800 flex items-center gap-1">
                <Camera className="w-3.5 h-3.5 text-rose-600" /> Foto Nota / Bon Belanja Kasir:
              </span>
              <button
                type="button"
                onClick={() => expenseFileInputRef.current?.click()}
                disabled={uploadingExpensePhoto}
                className="px-2.5 py-1 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
              >
                <UploadCloud className="w-3 h-3 text-rose-600" />
                <span>{uploadingExpensePhoto ? 'Mengompres...' : '+ Foto Nota'}</span>
              </button>
              <input
                ref={expenseFileInputRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                className="hidden"
                onChange={handleUploadExpensePhoto}
              />
            </div>

            {expensePhotos.length > 0 ? (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-1">
                {expensePhotos.map((url, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden aspect-square border border-rose-200 bg-white shadow-2xs">
                    <img 
                      src={url} 
                      alt={`Nota ${idx + 1}`} 
                      className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => setPreviewPhotoUrl(url)}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveExpensePhoto(idx)}
                      className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-full transition-colors cursor-pointer"
                      title="Hapus foto"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-rose-400 italic">
                Belum ada foto nota dilampirkan. Klik tombol di atas untuk foto nota belanja lewat kamera HP.
              </p>
            )}
          </div>
        </div>

        {/* 2. PENGELUARAN NON-KASIR (TIDAK MEMOTONG UANG LACI) */}
        <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-indigo-700 block tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> 2. Pengeluaran Rumah Produksi & Vendor
              </span>
              <span className="text-[9px] font-bold text-indigo-600 bg-indigo-100/60 px-2 py-0.5 rounded-md">
                TIDAK Memotong Laci
              </span>
            </div>

            <button
              type="button"
              onClick={handleAddNonCashRow}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>+ Tambah Beban</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {nonCashList.map((item) => (
              <div key={item.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white p-2.5 rounded-xl border border-indigo-100 items-center">
                <div className="sm:col-span-4">
                  <select
                    value={item.category}
                    onChange={(e) => handleUpdateNonCashRow(item.id, 'category', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-indigo-900 focus:outline-none cursor-pointer"
                  >
                    <option value="RUMAH_PRODUKSI">Rumah Produksi</option>
                    <option value="VENDOR_PASAR">Vendor Pasar</option>
                    <option value="VENDOR_HAMDALAH">Vendor Hamdalah</option>
                    <option value="KARYA_HARAPAN">Karya Harapan</option>
                    <option value="SATU_SAMA">Satu Sama</option>
                    <option value="SUMBER_PLASTIK">Sumber Plastik</option>
                    <option value="VENDOR_GAS">Vendor Gas</option>
                    <option value="VENDOR_ES">Vendor Es Batu</option>
                    <option value="VENDOR_SUPPLIER">Vendor Supplier Lainnya</option>
                    <option value="LAINNYA">Tagihan Lainnya</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <input
                    type="number"
                    min="0"
                    value={item.nominal}
                    onChange={(e) => handleUpdateNonCashRow(item.id, 'nominal', e.target.value)}
                    placeholder="Rp Nominal"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-indigo-700 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-4">
                  <input
                    type="text"
                    value={item.notes}
                    onChange={(e) => handleUpdateNonCashRow(item.id, 'notes', e.target.value)}
                    placeholder="Keperluan / Catatan"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleRemoveNonCashRow(item.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Hapus baris ini"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalNonCashExpense > 0 && (
            <div className="flex justify-between items-center pt-2 border-t border-indigo-100 text-xs">
              <span className="font-bold text-indigo-900">Total Beban Non-Kasir:</span>
              <span className="font-black text-indigo-700">Rp {totalNonCashExpense.toLocaleString('id-ID')}</span>
            </div>
          )}
        </div>

        {/* UANG FISIK LACI, SISA MODAL, DAN UANG SETORAN BERSIH */}
        <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">
                Uang Seharusnya di Laci (Modal + Tunai - Pengeluaran Kasir)
              </span>
              <span className="text-base font-black text-white">
                Rp {expectedCashInDrawer.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                Total Uang Fisik di Laci (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={actualTotalCashInHand}
                onChange={(e) => setActualTotalCashInHand(e.target.value)}
                placeholder="Hitung semua lembaran di laci..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-black text-emerald-400 focus:outline-none"
                required
              />
              <span className="text-[9px] text-slate-400 mt-0.5 block">
                Total lembaran fisik kasir saat ini
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-amber-400" />
                Sisa Ditinggal di Laci (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={cashRetainedInDrawer}
                onChange={(e) => setCashRetainedInDrawer(e.target.value)}
                placeholder="0 (untuk modal shift esok)"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-black text-amber-400 focus:outline-none"
              />
              <span className="text-[9px] text-slate-400 mt-0.5 block">
                Modal kembalian yang tidak ikut disetor
              </span>
            </div>
          </div>

          {actualTotalCashInHand !== '' && (
            <div className={`p-2.5 rounded-xl border text-xs flex justify-between items-center ${
              cashDifference === 0 
                ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300' 
                : cashDifference < 0 
                ? 'bg-rose-950/40 border-rose-800/80 text-rose-300' 
                : 'bg-amber-950/40 border-amber-800/80 text-amber-300'
            }`}>
              <span className="font-bold">
                {cashDifference === 0 ? 'Status Kasir: Klop (Pas)' : cashDifference < 0 ? 'Status Kasir: Minus' : 'Status Kasir: Lebih'}
              </span>
              <span className="font-black text-xs">
                {cashDifference === 0 ? 'Rp 0' : `${cashDifference < 0 ? '-' : '+'}Rp ${Math.abs(cashDifference).toLocaleString('id-ID')}`}
              </span>
            </div>
          )}

          {/* Kotak Rekomendasi Nominal Bersih yang Disetor */}
          <div className="p-3 bg-emerald-950/50 rounded-xl border border-emerald-600/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRightCircle className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="text-[10px] uppercase font-black tracking-wider text-emerald-300 block">
                  Uang Bersih yang Wajib Disetor / Transfer
                </span>
                <span className="text-[9px] text-emerald-200/70">
                  (Total Fisik di Tangan - Sisa Ditinggal di Laci)
                </span>
              </div>
            </div>
            <span className="text-base font-black text-emerald-300">
              Rp {netCashToDeposit.toLocaleString('id-ID')}
            </span>
          </div>

          {/* Slot Upload Bukti Transfer Setoran (Bisa Menyusul) */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-300 block">
                  Bukti Transfer / Struk Setoran Bank
                </span>
                <span className="text-[9px] text-slate-400">
                  *Bisa menyusul setelah uang disetor ke ATM/bank
                </span>
              </div>

              <button
                type="button"
                onClick={() => depositFileInputRef.current?.click()}
                disabled={uploadingDepositPhoto}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
              >
                <Camera className="w-3 h-3 text-emerald-400" />
                <span>{depositPhoto ? 'Ganti Bukti' : '+ Upload Struk'}</span>
              </button>
              <input
                ref={depositFileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleUploadDepositPhoto}
              />
            </div>

            {depositPhoto && (
              <div className="flex items-center gap-2.5 p-2 bg-slate-800/80 rounded-xl border border-slate-700 w-fit">
                <img 
                  src={depositPhoto} 
                  alt="Bukti Transfer" 
                  className="w-12 h-12 object-cover rounded-lg cursor-pointer border border-slate-600"
                  onClick={() => setPreviewPhotoUrl(depositPhoto)}
                />
                <div>
                  <span className="text-[11px] font-bold text-emerald-400 block">✓ Struk Terlampir</span>
                  <button
                    type="button"
                    onClick={() => setDepositPhoto(null)}
                    className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                  >
                    Hapus Foto
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || loading}
          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Menyimpan Rekap...' : `Simpan Rekap Kasir (${shift === 'SHIFT_1' ? 'Shift 1' : 'Shift 2'})`}</span>
        </button>
      </form>

      {/* MODAL LIGHTBOX / PRATINJAU FOTO PERBESAR */}
      {previewPhotoUrl && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative max-w-lg w-full bg-slate-900 rounded-3xl p-3 border border-slate-800 space-y-3 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center px-2 pt-1">
              <span className="text-xs font-black text-white uppercase tracking-wider">
                Pratinjau Foto Nota / Bukti Fisik
              </span>
              <button
                type="button"
                onClick={() => setPreviewPhotoUrl(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden bg-black flex items-center justify-center max-h-[75vh]">
              <img 
                src={previewPhotoUrl} 
                alt="Nota Perbesar" 
                className="max-w-full max-h-[75vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}