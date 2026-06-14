'use client';
import { useState, useEffect } from 'react';

interface HighwayBiz {
  id: string;
  businessName: string;
  category: string;
  ownerName: string;
  phone: string;
  address: string;
  locationLat: number;
  locationLng: number;
  fssaiNumber: string;
  gstNumber: string;
  subscriptionTier: string;
  isVerified: boolean;
  status: string;
  createdAt: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.8.101:3000';
const CAT_ICONS: Record<string, string> = { dhaba: '🍛', fuel_station: '⛽', truck_stop: '🚛', tyre_shop: '🔧', service_center: '🔩' };

export default function HighwayBusinessesAdminPage() {
  const [businesses, setBusinesses] = useState<HighwayBiz[]>([]);
  const [filter, setFilter] = useState<'pending' | 'active' | 'suspended'>('pending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/v1/admin/highway-businesses?status=${filter}`, { headers: { 'x-user-id': 'admin' } })
      .then(r => r.json()).then(d => { if (d.success) setBusinesses(d.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filter]);

  async function updateStatus(id: string, status: 'active' | 'suspended', isVerified: boolean) {
    await fetch(`${API}/api/v1/admin/highway-businesses/${id}/status`, {
      method: 'PATCH',
      headers: { 'x-user-id': 'admin', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, isVerified }),
    });
    setBusinesses(prev => prev.filter(b => b.id !== id));
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Highway Businesses</h1>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        {(['pending', 'active', 'suspended'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${filter === s ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? <div className="text-gray-400">Loading…</div> : businesses.length === 0 ? (
        <div className="text-center text-gray-400 py-16">No {filter} businesses</div>
      ) : (
        <div className="space-y-4">
          {businesses.map(b => (
            <div key={b.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{CAT_ICONS[b.category] || '🏪'}</span>
                    <h3 className="font-semibold text-gray-900">{b.businessName}</h3>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{b.category?.replace('_', ' ')}</span>
                  </div>
                  <p className="text-sm text-gray-500">{b.address}</p>
                  <div className="flex gap-3 mt-2 text-xs text-gray-500">
                    <span>Owner: {b.ownerName}</span>
                    {b.fssaiNumber && <span>FSSAI: {b.fssaiNumber}</span>}
                    {b.gstNumber && <span>GST: {b.gstNumber}</span>}
                    <a href={`https://maps.google.com/?q=${b.locationLat},${b.locationLng}`} target="_blank" rel="noreferrer" className="text-blue-500 underline">View on Map</a>
                  </div>
                </div>
                {filter === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => updateStatus(b.id, 'active', true)} className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-600">Approve</button>
                    <button onClick={() => updateStatus(b.id, 'suspended', false)} className="bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200">Reject</button>
                  </div>
                )}
                {filter === 'active' && (
                  <button onClick={() => updateStatus(b.id, 'suspended', false)} className="bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-medium">Suspend</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
