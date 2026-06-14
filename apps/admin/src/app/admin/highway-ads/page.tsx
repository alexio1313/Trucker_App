'use client';
import { useState, useEffect } from 'react';

interface AdItem {
  id: string;
  title: string;
  description: string;
  businessName: string;
  targetBreakTypes: string[];
  radiusKm: number;
  budgetTotal: number;
  status: string;
  createdAt: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.8.101:3000';

export default function HighwayAdsAdminPage() {
  const [ads, setAds] = useState<AdItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/v1/admin/highway-ads?status=pending_review`, { headers: { 'x-user-id': 'admin' } })
      .then(r => r.json()).then(d => { if (d.success) setAds(d.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function reviewAd(id: string, status: 'active' | 'rejected', reason?: string) {
    await fetch(`${API}/api/v1/admin/highway-ads/${id}/review`, {
      method: 'PATCH',
      headers: { 'x-user-id': 'admin', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, rejectionReason: reason }),
    });
    setAds(prev => prev.filter(a => a.id !== id));
  }

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Highway Ad Review ({ads.length} pending)</h1>
      {ads.length === 0 ? (
        <div className="text-center text-gray-400 py-16">No ads pending review</div>
      ) : (
        <div className="space-y-4">
          {ads.map(ad => (
            <div key={ad.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{ad.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{ad.description}</p>
                  <div className="flex gap-3 mt-2 text-xs text-gray-400">
                    <span>Business: {ad.businessName}</span>
                    <span>Radius: {ad.radiusKm}km</span>
                    <span>Budget: ₹{ad.budgetTotal}</span>
                    <span>Triggers: {ad.targetBreakTypes?.join(', ')}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => reviewAd(ad.id, 'active')} className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-600">Approve</button>
                  <button onClick={() => { const r = prompt('Rejection reason:'); if (r) reviewAd(ad.id, 'rejected', r); }} className="bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200">Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
