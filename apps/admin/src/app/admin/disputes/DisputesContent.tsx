'use client';
import { useState, useEffect, useCallback } from 'react';

const ADMIN_API = 'http://192.168.8.101:3004/api/v1/admin';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  under_review: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
};

interface Dispute {
  dispute_id: string;
  load_id: string;
  raised_by: string;
  raised_against: string;
  dispute_type: string;
  description: string;
  status: string;
  priority: string;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  origin_city?: string;
  dest_city?: string;
}

export default function DisputesContent() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [resolution, setResolution] = useState('');
  const [compensation, setCompensation] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await fetch(`${ADMIN_API}/disputes${params}`);
      const json = await res.json();
      if (json.success) setDisputes(json.data?.items ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchDisputes(); }, [fetchDisputes]);

  const resolve = async () => {
    if (!selected || !resolution.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${ADMIN_API}/disputes/${selected.dispute_id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution: resolution,
          compensationAmount: compensation ? Number(compensation) : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Dispute resolved');
        setSelected(null);
        setResolution('');
        setCompensation('');
        fetchDisputes();
      } else {
        showToast(json.error?.message || 'Error resolving dispute');
      }
    } catch { showToast('Error'); }
    finally { setActionLoading(false); }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Disputes</h2>
          <p className="text-gray-500 mt-1">Resolve conflicts between truckers and merchants</p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="under_review">Under Review</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {toast && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg z-50 shadow">{toast}</div>
      )}

      {loading ? (
        <div className="flex justify-center mt-12">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((d) => (
            <div key={d.dispute_id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[d.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {d.status.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded capitalize">{d.dispute_type?.replace('_', ' ')}</span>
                    <span className="text-xs text-gray-400">Priority: {d.priority}</span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{d.description}</p>
                  <div className="flex gap-4 text-xs text-gray-400">
                    <span>Load: <span className="font-mono">{d.load_id?.slice(0, 16)}…</span></span>
                    {d.origin_city && d.dest_city && (
                      <span>{d.origin_city} → {d.dest_city}</span>
                    )}
                    <span>Filed: {new Date(d.created_at).toLocaleDateString('en-IN')}</span>
                  </div>
                  {d.resolution_notes && (
                    <div className="mt-2 text-xs text-green-700 bg-green-50 px-3 py-1 rounded">
                      Resolution: {d.resolution_notes}
                    </div>
                  )}
                </div>
                {d.status !== 'resolved' && (
                  <button
                    onClick={() => setSelected(d)}
                    className="ml-4 text-sm text-white bg-orange-500 hover:bg-orange-600 px-3 py-1.5 rounded-lg"
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
          {disputes.length === 0 && (
            <div className="bg-white rounded-xl p-12 text-center text-gray-400">
              No disputes found for &quot;{statusFilter || 'all'}&quot; status
            </div>
          )}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg">
            <h3 className="font-bold text-gray-900 mb-1">Resolve Dispute</h3>
            <p className="text-sm text-gray-500 mb-4">{selected.description}</p>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-28 resize-none mb-3"
              placeholder="Resolution decision and reasoning (minimum 10 characters)"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            />
            <input
              type="number"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4"
              placeholder="Compensation amount (₹) — optional"
              value={compensation}
              onChange={(e) => setCompensation(e.target.value)}
            />
            <div className="flex gap-3">
              <button
                onClick={resolve}
                disabled={resolution.trim().length < 10 || actionLoading}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold disabled:opacity-50"
              >
                {actionLoading ? 'Resolving…' : 'Confirm Resolution'}
              </button>
              <button
                onClick={() => { setSelected(null); setResolution(''); setCompensation(''); }}
                className="flex-1 border border-gray-200 py-2 rounded-lg text-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
