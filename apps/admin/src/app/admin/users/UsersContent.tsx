'use client';
import { useState, useEffect, useCallback } from 'react';

const ADMIN_SERVICE = 'http://192.168.8.101:3004/api/v1/admin';

const TYPE_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Merchants', value: 'merchant' },
  { label: 'Truckers', value: 'trucker' },
  { label: 'Staff', value: 'admin' },
];

const ROLE_OPTIONS = ['admin', 'developer', 'tester', 'qa'];

interface User {
  user_id?: string;
  userId?: string;
  full_name?: string;
  fullName?: string;
  phone_number?: string;
  phoneNumber?: string;
  user_type?: string;
  userType?: string;
  kyc_status?: string;
  kycStatus?: string;
  created_at?: string;
  createdAt?: string;
  is_suspended?: boolean;
  isSuspended?: boolean;
}

const getField = (u: User, snake: string, camel: string): any =>
  (u as any)[snake] ?? (u as any)[camel];

interface StaffForm {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  role: string;
}

export default function UsersContent() {
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffForm, setStaffForm] = useState<StaffForm>({ fullName: '', phone: '', email: '', password: '', role: 'admin' });
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [staffSuccess, setStaffSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (typeFilter) params.set('userType', typeFilter);
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`${ADMIN_SERVICE}/users?${params}`);
      const json = await res.json();
      if (json.success) {
        setUsers(json.data.items ?? []);
        setPagination(json.data.pagination ?? null);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [typeFilter, searchQuery, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSuspend = async (userId: string, suspend: boolean) => {
    setActionLoading(userId);
    try {
      await fetch(`${ADMIN_SERVICE}/users/${userId}/${suspend ? 'suspend' : 'unsuspend'}`, { method: 'POST' });
      fetchUsers();
    } catch { /* ignore */ }
    finally { setActionLoading(null); }
  };

  const handleCreateStaff = async () => {
    if (!staffForm.fullName || !staffForm.phone || !staffForm.password) {
      setStaffError('Full name, phone, and password are required.');
      return;
    }
    setStaffLoading(true);
    setStaffError('');
    setStaffSuccess('');
    try {
      const res = await fetch(`${ADMIN_SERVICE}/staff-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffForm),
      });
      const json = await res.json();
      if (json.success) {
        setStaffSuccess(`Staff user "${staffForm.fullName}" created successfully. They can log in with phone ${staffForm.phone}.`);
        setStaffForm({ fullName: '', phone: '', email: '', password: '', role: 'admin' });
        fetchUsers();
      } else {
        setStaffError(json.error?.message ?? 'Failed to create staff user.');
      }
    } catch {
      setStaffError('Network error. Please try again.');
    } finally {
      setStaffLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {pagination ? `${pagination.total?.toLocaleString('en-IN') ?? users.length} total users` : 'Loading…'}
          </p>
        </div>
        <button
          onClick={() => { setShowStaffModal(true); setStaffError(''); setStaffSuccess(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors shadow-sm"
        >
          + Create Staff User
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setTypeFilter(f.value); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              typeFilter === f.value ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
        <input
          className="ml-auto px-3 py-1.5 border border-gray-200 rounded-full text-sm w-64 focus:outline-none focus:ring-2 focus:ring-orange-500"
          placeholder="Search by name or phone…"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
        />
      </div>

      {loading ? (
        <div className="flex justify-center mt-12">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">KYC</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => {
                const uid = getField(u, 'user_id', 'userId');
                const name = getField(u, 'full_name', 'fullName');
                const phone = getField(u, 'phone_number', 'phoneNumber');
                const utype = getField(u, 'user_type', 'userType');
                const kyc = getField(u, 'kyc_status', 'kycStatus');
                const createdAt = getField(u, 'created_at', 'createdAt');
                const suspended = getField(u, 'is_suspended', 'isSuspended');

                return (
                  <tr key={uid} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{name}</div>
                      <div className="text-xs font-mono text-gray-400">{String(uid ?? '').slice(0, 8)}…</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{phone}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        utype === 'admin'    ? 'bg-purple-100 text-purple-700' :
                        utype === 'merchant' ? 'bg-blue-100 text-blue-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>{utype}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        kyc === 'verified' || kyc === 'approved' ? 'bg-green-100 text-green-700' :
                        kyc === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{kyc ?? 'pending'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {createdAt ? new Date(createdAt).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {utype !== 'admin' && (
                        suspended ? (
                          <button
                            onClick={() => handleSuspend(uid, false)}
                            disabled={actionLoading === uid}
                            className="text-xs text-green-600 border border-green-200 px-2 py-1 rounded hover:bg-green-50 disabled:opacity-50"
                          >
                            {actionLoading === uid ? '…' : 'Unsuspend'}
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (window.confirm(`Suspend ${name}?`)) handleSuspend(uid, true);
                            }}
                            disabled={actionLoading === uid}
                            className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
                          >
                            {actionLoading === uid ? '…' : 'Suspend'}
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              <div className="text-3xl mb-2">👥</div>
              <p>No users found{typeFilter ? ` of type "${typeFilter}"` : ''}.</p>
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-between items-center p-4 border-t border-gray-100 bg-gray-50">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1.5 text-sm border rounded bg-white disabled:opacity-40">Previous</button>
              <span className="text-sm text-gray-500">Page {page} of {pagination.totalPages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}
                className="px-3 py-1.5 text-sm border rounded bg-white disabled:opacity-40">Next</button>
            </div>
          )}
        </div>
      )}

      {/* Create Staff User Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Create Staff User</h3>
                <p className="text-sm text-gray-500 mt-0.5">Bypass KYC — for admin, developer, tester, or QA accounts</p>
              </div>
              <button onClick={() => setShowStaffModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            {staffSuccess ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-green-800 text-sm font-medium">✓ {staffSuccess}</p>
                <button
                  onClick={() => { setStaffSuccess(''); setShowStaffModal(false); }}
                  className="mt-3 w-full py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {staffError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{staffError}</div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={staffForm.fullName}
                    onChange={(e) => setStaffForm((f) => ({ ...f, fullName: e.target.value }))}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+91XXXXXXXXXX"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Email (optional)</label>
                  <input
                    type="email"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="staff@yourcompany.com"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Password *</label>
                  <input
                    type="password"
                    value={staffForm.password}
                    onChange={(e) => setStaffForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Set a secure password"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Role *</label>
                  <select
                    value={staffForm.role}
                    onChange={(e) => setStaffForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                  <strong>Note:</strong> Staff accounts are created with KYC pre-approved. They log in using phone number + password via the main app login screen.
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowStaffModal(false)}
                    className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateStaff}
                    disabled={staffLoading}
                    className="flex-1 py-2 text-sm bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
                  >
                    {staffLoading ? 'Creating…' : 'Create Staff User'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
