import { useState, useEffect } from 'react';
import { useAuthStore } from '@truck-platform/state';

type JobStatus = 'pending' | 'active' | 'completed';

interface Job {
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

export default function LoaderJobsPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<JobStatus>('pending');
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    fetch(`/api/v1/loader-cos/jobs?status=${tab}`, { headers: { 'x-user-id': user?.userId || '' } })
      .then(r => r.json()).then(d => { if (d.success) setJobs(d.data || []); });
  }, [tab]);

  async function expressInterest(loadId: string) {
    await fetch(`/api/v1/loader-cos/jobs/${loadId}/express-interest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': user?.userId || '' },
    });
    alert('Interest expressed! The merchant/trucker can now see your company.');
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['pending', 'active', 'completed'] as JobStatus[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {jobs.map(j => (
          <div key={j.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-gray-900">{j.cargoType} — {j.originCity}</p>
                <p className="text-sm text-gray-500">{j.originAddress}</p>
                <p className="text-xs text-gray-400 mt-1">Merchant: {j.merchantName}</p>
              </div>
              <span className="text-sm font-medium text-blue-600">{j.weightTonnes}T</span>
            </div>
            {j.scheduledStart && <p className="text-sm text-gray-600 mb-3">📅 {new Date(j.scheduledStart).toLocaleString('en-IN')}</p>}
            {tab === 'pending' && (
              <button onClick={() => expressInterest(j.loadId)} className="w-full bg-orange-500 text-white py-2 rounded-lg font-medium hover:bg-orange-600">
                Express Interest
              </button>
            )}
          </div>
        ))}
        {jobs.length === 0 && <div className="text-center text-gray-400 py-12">No {tab} jobs in your coverage area</div>}
      </div>
    </div>
  );
}
