'use client';
import { useState, useEffect } from 'react';

interface LoaderCompany {
  id: string;
  companyName: string;
  ownerName: string;
  gstNumber: string;
  labourLicenseNumber: string;
  coverageCities: string[];
  subscriptionTier: string;
  avgRating: number;
  totalJobs: number;
  isVerified: boolean;
  status: string;
  createdAt: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.8.101:3000';

export default function LoaderCompaniesAdminPage() {
  const [companies, setCompanies] = useState<LoaderCompany[]>([]);
  const [filter, setFilter] = useState<'pending' | 'active' | 'suspended'>('pending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/v1/admin/loader-companies?status=${filter}`, { headers: { 'x-user-id': 'admin' } })
      .then(r => r.json()).then(d => { if (d.success) setCompanies(d.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filter]);

  async function updateStatus(id: string, status: 'active' | 'suspended', verifyFlag: boolean) {
    await fetch(`${API}/api/v1/admin/loader-companies/${id}/status`, {
      method: 'PATCH',
      headers: { 'x-user-id': 'admin', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, isVerified: verifyFlag }),
    });
    setCompanies(prev => prev.filter(c => c.id !== id));
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Loader Companies</h1>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        {(['pending', 'active', 'suspended'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${filter === s ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? <div className="text-gray-400">Loading…</div> : companies.length === 0 ? (
        <div className="text-center text-gray-400 py-16">No {filter} companies</div>
      ) : (
        <div className="space-y-4">
          {companies.map(c => (
            <div key={c.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{c.companyName}</h3>
                  <p className="text-sm text-gray-500">{c.ownerName} • {c.coverageCities?.join(', ')}</p>
                  <div className="flex gap-3 mt-2 text-xs text-gray-500">
                    <span>GST: {c.gstNumber || '—'}</span>
                    <span>Labour Licence: {c.labourLicenseNumber || '—'}</span>
                    <span>{c.totalJobs} jobs</span>
                    <span className="capitalize">{c.subscriptionTier}</span>
                  </div>
                </div>
                {filter === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => updateStatus(c.id, 'active', true)} className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-600">Verify & Activate</button>
                    <button onClick={() => updateStatus(c.id, 'suspended', false)} className="bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200">Reject</button>
                  </div>
                )}
                {filter === 'active' && (
                  <button onClick={() => updateStatus(c.id, 'suspended', false)} className="bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200">Suspend</button>
                )}
                {filter === 'suspended' && (
                  <button onClick={() => updateStatus(c.id, 'active', true)} className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-600">Reinstate</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
