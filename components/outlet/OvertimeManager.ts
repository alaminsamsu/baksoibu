'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Clock, 
  CheckCircle2, 
  Send, 
  RefreshCw,
  PlusCircle,
  X
} from 'lucide-react';

interface Props {
  locationId: string;
  staffName: string;
  isLeader: boolean;
}

interface OvertimeItem {
  id: string;
  location_id: string;
  staff_name: string;
  request_date: string;
  start_time: string;
  estimated_hours: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approved_by?: string;
}

export default function OvertimeManager({ locationId, staffName, isLeader }: Props) {
  const [requests, setRequests] = useState<OvertimeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);

  const [startTime, setStartTime] = useState('22:00');
  const [estimatedHours, setEstimatedHours] = useState('1.5');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const getTodayWita = () => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());
  };

  const fetchOvertimeRequests = async () => {
    setLoading(true);
    try {
      const today = getTodayWita();
      const { data, error } = await supabase
        .from('overtime_requests')
        .select('*')
        .eq('location_id', locationId)
        .eq('request_date', today)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err: any) {
      console.error('Gagal load lembur:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (locationId) {
      fetchOvertimeRequests();
    }
  }, [locationId]);

  const handleSubmitOvertime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('Alasan lembur wajib diisi.');
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const payload = {
        location_id: locationId,
        staff_name: staffName,
        request_date: getTodayWita(),
        start_time: startTime,
        estimated_hours: parseFloat(estimatedHours) || 1,
        reason: reason.trim(),
        status: 'PENDING',
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('overtime_requests').insert([payload]);
      if (error) throw error;

      setMessage({ text: 'Pengajuan lembur terkirim! Menunggu ACC Leader.', type: 'success' });
      setReason('');
      setTimeout(() => {
        setShowFormModal(false);
        setMessage(null);
      }, 1200);

      await fetchOvertimeRequests();
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal mengirim pengajuan.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecision = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      const { error } = await supabase
        .from('overtime_requests')
        .update({
          status: decision,
          approved_by: staffName,
          approved_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      await fetchOvertimeRequests();
    } catch (err: any) {
      alert('Gagal update persetujuan: ' + err.message);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs space-y-4 font-sans">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
              Persetujuan Lembur (Overtime ACC)
            </h3>
            <p className="text-[10px] text-slate-400">
              Lembur kru wajib diajukan & disetujui Leader sebelum dijalankan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isLeader && (
            <button
              type="button"
              onClick={() => setShowFormModal(true)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Ajukan Lembur</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchOvertimeRequests}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-500"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-6 text-xs text-slate-400 font-bold">
            Memuat pengajuan lembur...
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400 font-medium bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            Belum ada pengajuan lembur untuk hari ini.
          </div>
        ) : (
          requests.map((req) => (
            <div 
              key={req.id}
              className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                req.status === 'PENDING' 
                  ? 'bg-amber-50/40 border-amber-200' 
                  : req.status === 'APPROVED'
                  ? 'bg-emerald-50/40 border-emerald-200'
                  : 'bg-slate-50 border-slate-200 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xs text-slate-900">{req.staff_name}</span>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                    req.status === 'PENDING'
                      ? 'bg-amber-100 text-amber-800'
                      : req.status === 'APPROVED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {req.status === 'PENDING' ? '⏳ Menunggu ACC' : req.status === 'APPROVED' ? '✓ Disetujui' : '✕ Ditolak'}
                  </span>
                </div>
                
                <p className="text-[11px] text-slate-600 font-medium mt-1">
                  Mulai jam <b>{req.start_time.substring(0, 5)}</b> • Estimasi <b>{req.estimated_hours} Jam</b>
                </p>
                <p className="text-[10px] text-slate-400 italic mt-0.5">
                  &ldquo;{req.reason}&rdquo;
                </p>
                {req.approved_by && (
                  <p className="text-[9px] text-slate-400 font-semibold mt-1">
                    Diproses oleh: {req.approved_by}
                  </p>
                )}
              </div>

              {isLeader && req.status === 'PENDING' && (
                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleDecision(req.id, 'APPROVED')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-sm transition-all"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>ACC</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecision(req.id, 'REJECTED')}
                    className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-bold transition-all"
                  >
                    Tolak
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900">Form Pengajuan Lembur</h3>
                  <p className="text-[10px] text-slate-400">Pemohon: {staffName}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowFormModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {message && (
              <div className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {message.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5 text-red-600" />}
                <span>{message.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmitOvertime} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                    Jam Mulai
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                    Durasi (Jam)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  Alasan Lembur
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Bantu cuci mangkok closing, persiapan bahan..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="w-1/3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-2/3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl shadow-md shadow-amber-500/20 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Mengirim...' : 'Kirim Pengajuan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}