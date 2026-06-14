'use client';
import { useState, useEffect, useCallback } from 'react';

const ADMIN_API = 'http://192.168.8.101:3004/api/v1/admin';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  verified: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

interface KYCUser {
  user_id: string;
  full_name: string;
  user_type: string;
  phone_number: string;
  kyc_status: string;
  kyc_doc_front_url: string | null;
  kyc_doc_back_url: string | null;
  created_at: string;
}

export default function KYCContent() {
  const [users, setUsers] = useState<KYCUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchKYC = useCallback(async () => {
    try {
      const res = await fetch(`${ADMIN_API}/kyc?status=pending&pageSize=50`);
      const json = await res.json();
      if (json.success) setUsers(json.data?.items ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchKYC(); }, [fetchKYC]);

  const approve = async (userId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${ADMIN_API}/kyc/${userId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const json = await res.json();
      if (json.success) { showToast('KYC Approved'); fetchKYC(); }
      else showToast(json.error?.message || 'Error');
    } catch { showToast('Error'); }
    finally { setActionLoading(false); }
  };

  const reject = async () => {
    if (!selectedId || !rejectReason.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${ADMIN_API}/kyc/${selectedId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const json = await res.json();
      if (json.success) { showToast('KYC Rejected'); setSelectedId(null); setRejectReason(''); fetchKYC(); }
      else showToast(json.error?.message || 'Error');
    } catch { showToast('Error'); }
    finally { setActionLoading(false); }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">KYC Queue</h2>
      <p className="text-gray-500 mb-6">Review and approve identity verification submissions</p>

      {toast && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg z-50 shadow">{toast}</div>
      )}

      {loading ? (
        <div className="flex justify-center mt-12">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Submitted</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.user_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{u.full_name}</div>
                    <div className="text-xs text-gray-400 font-mono">{u.user_id.slice(0, 12)}…</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 capitalize">{u.user_type}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{u.phone_number}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(u.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[u.kyc_status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {u.kyc_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {u.kyc_doc_front_url && (
                        <a href={u.kyc_doc_front_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline">View Doc</a>
                      )}
                      <button
                        onClick={() => approve(u.user_id)}
                        disabled={actionLoading}
                        className="text-xs text-green-600 border border-green-200 px-2 py-1 rounded hover:bg-green-50 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setSelectedId(u.user_id)}
                        className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded hover:bg-red-50"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="p-8 text-center text-gray-400">No pending KYC submissions</div>
          )}
        </div>
      )}

      {selectedId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-gray-900 mb-4">Reject KYC Submission</h3>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-28 resize-none"
              placeholder="Reason for rejection (required)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={reject}
                disabled={!rejectReason.trim() || actionLoading}
                className="flex-1 bg-red-500 text-white py-2 rounded-lg font-semibold disabled:opacity-50"
              >
                {actionLoading ? 'Rejecting…' : 'Confirm Reject'}
              </button>
              <button
                onClick={() => { setSelectedId(null); setRejectReason(''); }}
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
