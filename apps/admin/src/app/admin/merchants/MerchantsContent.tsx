'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@truck-platform/api-client';

const KYC_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-500',
  submitted: 'bg-yellow-100 text-yellow-800',
  under_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function MerchantsContent() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [search, setSearch] = useState('');

  const kycStatus = tab === 'pending' ? 'submitted' : tab === 'approved' ? 'approved' : tab === 'rejected' ? 'rejected' : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-merchants', tab, search],
    queryFn: () =>
      adminApi.getUsers({ userType: 'merchant', kycStatus, search: search || undefined, pageSize: 30 }),
    refetchInterval: 30_000,
  });

  const approveMutation = useMutation({
    mutationFn: (userId: string) => adminApi.approveMerchant(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-merchants'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      adminApi.rejectMerchant(userId, reason),
    onSuccess: () => {
      setRejectingId(null);
      setRejectReason('');
      qc.invalidateQueries({ queryKey: ['admin-merchants'] });
    },
  });

  const merchants = data?.data?.items ?? [];
  const total = data?.data?.pagination?.total ?? 0;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Merchant Approvals</h2>
        <p className="text-gray-500 mt-1">Review KYC submissions and approve or reject merchant registrations</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { value: 'pending', label: 'Pending Review' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'all', label: 'All Merchants' },
        ].map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value as typeof tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.value ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400">Loading merchants...</div>
        ) : merchants.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            {tab === 'pending' ? 'No merchants pending review' : 'No merchants found'}
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Merchant</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">KYC Status</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Registered</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {merchants.map((m: {
                  userId: string; fullName: string; phoneNumber: string;
                  kycStatus: string; createdAt: string; email?: string;
                }) => (
                  <tr key={m.userId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 text-sm">{m.fullName}</div>
                      {m.email && <div className="text-xs text-gray-400">{m.email}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{m.phoneNumber}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${KYC_STATUS_STYLES[m.kycStatus] ?? 'bg-gray-100 text-gray-500'}`}>
                        {m.kycStatus.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">
                      {new Date(m.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      {m.kycStatus === 'submitted' || m.kycStatus === 'under_review' ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setRejectingId(m.userId)}
                            className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => approveMutation.mutate(m.userId)}
                            disabled={approveMutation.isPending}
                            className="px-3 py-1.5 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                          >
                            {approveMutation.isPending ? '…' : 'Approve'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {total > 30 && (
              <div className="px-6 py-3 border-t border-gray-100 text-sm text-gray-400">
                Showing 30 of {total} merchants
              </div>
            )}
          </>
        )}
      </div>

      {/* Reject modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Reject Merchant Application</h3>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reason *</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="E.g. Incomplete documents, invalid Aadhaar number..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setRejectingId(null); setRejectReason(''); }}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => { if (rejectReason.trim()) rejectMutation.mutate({ userId: rejectingId, reason: rejectReason }); }}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'Rejecting…' : 'Reject Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
