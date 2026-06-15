import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@truck-platform/state';

const LOADER_API = 'http://192.168.8.101:3002/api/v1/loader-cos';

type TabType = 'browse' | 'bookings';
type JobStatus = 'pending' | 'active' | 'completed';

interface BrowseJob {
  id: string;
  loadId: string;
  originCity: string;
  originAddress: string;
  scheduledStart: string;
  cargoType: string;
  weightTonnes: number;
  loadingArrangement: string;
  merchantName: string;
}

interface Booking {
  jobId: string;
  loadId: string;
  originCity: string;
  originAddress: string;
  destCity: string;
  cargoType: string;
  weightTonnes: string;
  merchantName: string;
  arrangementType: string;
  truckerArrivalTime?: string;
  detentionStartedAt?: string;
  detentionRatePerHour: number;
  loadingCompletedAt?: string;
  detentionMinutes: number;
  detentionCost: number;
  paymentStatus?: string;
  scheduledStart?: string;
}

interface Worker {
  id: string;
  name: string;
  phone?: string;
  status: string;
  skillTags?: string[];
}

export default function LoaderJobsPage() {
  const { user } = useAuthStore();
  const userId = user?.userId || user?.user_id || '';
  const headers = { 'Content-Type': 'application/json', 'x-user-id': userId };

  const [mainTab, setMainTab] = useState<TabType>('browse');
  const [browseStatus, setBrowseStatus] = useState<JobStatus>('pending');
  const [jobs, setJobs] = useState<BrowseJob[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [checkinModal, setCheckinModal] = useState<{ loadId: string } | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${LOADER_API}/jobs?status=${browseStatus}`, { headers });
      const d = await res.json();
      if (d.success) setJobs(d.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [browseStatus, userId]);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${LOADER_API}/my-bookings`, { headers });
      const d = await res.json();
      if (d.success) setBookings(d.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [userId]);

  const fetchWorkers = useCallback(async () => {
    try {
      const res = await fetch(`${LOADER_API}/workers`, { headers });
      const d = await res.json();
      if (d.success) setWorkers(d.data || []);
    } catch { /* ignore */ }
  }, [userId]);

  useEffect(() => {
    if (mainTab === 'browse') fetchJobs();
    else { fetchBookings(); fetchWorkers(); }
  }, [mainTab, browseStatus]);

  async function expressInterest(loadId: string) {
    try {
      const res = await fetch(`${LOADER_API}/jobs/${loadId}/express-interest`, {
        method: 'POST',
        headers,
      });
      const d = await res.json();
      showToast(d.success ? 'Interest expressed — merchant will be notified' : (d.error?.message || 'Error'), d.success);
    } catch { showToast('Error', false); }
  }

  async function acceptBooking(loadId: string) {
    try {
      const res = await fetch(`${LOADER_API}/jobs/${loadId}/accept`, {
        method: 'POST',
        headers,
      });
      const d = await res.json();
      if (d.success) { showToast('Booking accepted!'); fetchBookings(); }
      else showToast(d.error?.message || 'Error', false);
    } catch { showToast('Error', false); }
  }

  async function workerCheckin(loadId: string) {
    if (!selectedWorkerId) { showToast('Select a worker first', false); return; }
    try {
      const res = await fetch(`${LOADER_API}/jobs/${loadId}/worker-checkin`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ workerId: selectedWorkerId }),
      });
      const d = await res.json();
      if (d.success) { showToast(d.data?.message || 'Worker checked in!'); setCheckinModal(null); setSelectedWorkerId(''); fetchBookings(); }
      else showToast(d.error?.message || 'Error', false);
    } catch { showToast('Error', false); }
  }

  function detentionBadge(b: Booking) {
    if (b.loadingCompletedAt) return null;
    if (b.detentionStartedAt) {
      const mins = Math.floor((Date.now() - new Date(b.detentionStartedAt).getTime()) / 60000);
      const cost = ((mins / 60) * b.detentionRatePerHour).toFixed(0);
      return (
        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
          🔴 {mins}min · ₹{cost} detention
        </span>
      );
    }
    if (b.truckerArrivalTime) {
      return <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Trucker arrived — loading</span>;
    }
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg font-semibold text-white text-sm ${toast.ok ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.ok ? '✓' : '✗'} {toast.msg}
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>

      {/* Main tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setMainTab('browse')}
          className={`px-5 py-1.5 rounded-md text-sm font-medium transition-colors ${mainTab === 'browse' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
        >
          Browse Available
        </button>
        <button
          onClick={() => setMainTab('bookings')}
          className={`px-5 py-1.5 rounded-md text-sm font-medium transition-colors ${mainTab === 'bookings' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
        >
          My Bookings {bookings.length > 0 && <span className="ml-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">{bookings.length}</span>}
        </button>
      </div>

      {/* Browse tab */}
      {mainTab === 'browse' && (
        <>
          <div className="flex gap-1 bg-gray-50 p-1 rounded-lg w-fit border border-gray-200">
            {(['pending', 'active', 'completed'] as JobStatus[]).map(t => (
              <button key={t} onClick={() => setBrowseStatus(t)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${browseStatus === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                {t}
              </button>
            ))}
          </div>

          {loading && <p className="text-sm text-gray-400">Loading…</p>}

          <div className="space-y-4">
            {jobs.map(j => (
              <div key={j.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 capitalize">{j.cargoType} — {j.originCity}</p>
                    <p className="text-sm text-gray-500">{j.originAddress}</p>
                    <p className="text-xs text-gray-400 mt-1">Merchant: {j.merchantName}</p>
                  </div>
                  <span className="text-sm font-bold text-blue-600">{j.weightTonnes}T</span>
                </div>
                {j.scheduledStart && (
                  <p className="text-sm text-gray-600 mb-3">📅 {new Date(j.scheduledStart).toLocaleString('en-IN')}</p>
                )}
                {browseStatus === 'pending' && (
                  <button
                    onClick={() => expressInterest(j.loadId)}
                    className="w-full bg-orange-500 text-white py-2.5 rounded-xl font-medium hover:bg-orange-600 transition-colors"
                  >
                    Express Interest
                  </button>
                )}
              </div>
            ))}
            {!loading && jobs.length === 0 && (
              <div className="text-center text-gray-400 py-12">
                <p className="text-3xl mb-2">📋</p>
                <p>No {browseStatus} jobs in your coverage area</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Bookings tab */}
      {mainTab === 'bookings' && (
        <>
          {loading && <p className="text-sm text-gray-400">Loading…</p>}

          <div className="space-y-4">
            {bookings.map(b => (
              <div key={b.jobId} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900 capitalize">{b.cargoType}</p>
                    <p className="text-sm text-gray-600">{b.originCity} → {b.destCity}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{b.originAddress}</p>
                    <p className="text-xs text-gray-400">Merchant: {b.merchantName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-600">{b.weightTonnes}T</p>
                    <p className="text-xs text-gray-400 mt-1">₹{b.detentionRatePerHour}/hr detention</p>
                  </div>
                </div>

                {/* Detention badge */}
                <div className="mb-3">{detentionBadge(b)}</div>

                {b.scheduledStart && (
                  <p className="text-sm text-gray-600 mb-3">📅 {new Date(b.scheduledStart).toLocaleString('en-IN')}</p>
                )}

                {b.loadingCompletedAt && (
                  <div className="bg-green-50 rounded-lg p-3 mb-3">
                    <p className="text-sm font-semibold text-green-700">✓ Loading Complete</p>
                    {b.detentionMinutes > 0 && (
                      <p className="text-xs text-gray-600">Detention: {b.detentionMinutes} min · ₹{b.detentionCost} charged</p>
                    )}
                    {b.paymentStatus && (
                      <p className="text-xs text-gray-500 capitalize">Payment: {b.paymentStatus}</p>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                {!b.loadingCompletedAt && (
                  <div className="flex gap-2">
                    {b.arrangementType !== 'company_arranged' && (
                      <button
                        onClick={() => acceptBooking(b.loadId)}
                        className="flex-1 bg-green-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors"
                      >
                        ✓ Accept Booking
                      </button>
                    )}
                    {b.arrangementType === 'company_arranged' && (
                      <button
                        onClick={() => { setCheckinModal({ loadId: b.loadId }); }}
                        className="flex-1 bg-indigo-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-indigo-600 transition-colors"
                      >
                        👷 Worker Check-in
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {!loading && bookings.length === 0 && (
              <div className="text-center text-gray-400 py-12">
                <p className="text-3xl mb-2">📭</p>
                <p>No bookings yet. Express interest in available jobs to get booked.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Worker Check-in Modal */}
      {checkinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 sm:items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-900">👷 Worker Check-in</h3>
              <button onClick={() => setCheckinModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Select which worker is checking in at the pickup location.</p>
            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
              {workers.filter(w => w.status === 'active' || w.status === 'idle').map(w => (
                <button
                  key={w.id}
                  onClick={() => setSelectedWorkerId(w.id)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${
                    selectedWorkerId === w.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-800">{w.name}</p>
                  <p className="text-xs text-gray-500">{w.skillTags?.join(', ') || 'General'} · {w.status}</p>
                </button>
              ))}
              {workers.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No workers registered. Add workers in the Workers tab.</p>
              )}
            </div>
            <button
              onClick={() => workerCheckin(checkinModal.loadId)}
              disabled={!selectedWorkerId}
              className="w-full bg-indigo-500 text-white py-3 rounded-xl font-bold disabled:opacity-50 hover:bg-indigo-600 transition-colors"
            >
              Confirm Check-in
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
