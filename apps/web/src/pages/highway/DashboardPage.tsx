import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@truck-platform/state';

interface HighwayStats {
  impressions: number;
  clicks: number;
  creditsBalance: number;
  activeAds: number;
}

export default function HighwayDashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<HighwayStats>({ impressions: 0, clicks: 0, creditsBalance: 0, activeAds: 0 });
  const [status, setStatus] = useState<'open' | 'closed' | 'busy'>('open');

  useEffect(() => {
    fetch('/api/v1/highway/analytics?period=7d', {
      headers: { 'x-user-id': user?.id || '' },
    })
      .then(r => r.json())
      .then(d => { if (d.success) setStats(d.data); })
      .catch(() => {});
  }, []);

  async function updateStatus(s: 'open' | 'closed' | 'busy') {
    setStatus(s);
    await fetch('/api/v1/highway/me/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
      body: JSON.stringify({ currentStatus: s }),
    });
  }

  const statusColors = { open: 'bg-green-100 text-green-800', closed: 'bg-red-100 text-red-800', busy: 'bg-yellow-100 text-yellow-800' };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">⛽</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Highway Business Dashboard</h1>
            <p className="text-gray-500 text-sm">Manage your presence on the driver map</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Status:</span>
          <select value={status} onChange={e => updateStatus(e.target.value as any)} className={`px-3 py-1 rounded-full text-sm font-medium border-0 ${statusColors[status]}`}>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="busy">Busy</option>
          </select>
        </div>
      </div>

      {stats.creditsBalance < 100 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-medium text-yellow-800">Low ad credits: ₹{stats.creditsBalance.toFixed(2)}</p>
            <p className="text-sm text-yellow-700">Top up to keep your ads running</p>
          </div>
          <Link to="/highway/subscription" className="ml-auto bg-yellow-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-yellow-600">Add Credits</Link>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Impressions (7d)', value: stats.impressions.toLocaleString(), icon: '👁️' },
          { label: 'Clicks (7d)', value: stats.clicks.toLocaleString(), icon: '👆' },
          { label: 'CTR', value: stats.impressions > 0 ? `${((stats.clicks / stats.impressions) * 100).toFixed(1)}%` : '0%', icon: '📊' },
          { label: 'Active Campaigns', value: String(stats.activeAds), icon: '📢' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">{s.label}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl">{s.icon}</span>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Quick Actions</h2>
          <div className="space-y-2">
            <Link to="/highway/ads" className="flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50 transition-colors">
              <span className="text-xl">📢</span>
              <span className="font-medium text-gray-700">Create Ad Campaign</span>
            </Link>
            <Link to="/highway/profile" className="flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50 transition-colors">
              <span className="text-xl">✏️</span>
              <span className="font-medium text-gray-700">Update Business Profile</span>
            </Link>
            <Link to="/highway/analytics" className="flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50 transition-colors">
              <span className="text-xl">📈</span>
              <span className="font-medium text-gray-700">View Analytics</span>
            </Link>
            <Link to="/highway/subscription" className="flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50 transition-colors">
              <span className="text-xl">⭐</span>
              <span className="font-medium text-gray-700">Manage Subscription</span>
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Ad Credits</h2>
          <div className="text-3xl font-bold text-orange-500 mb-1">₹{stats.creditsBalance.toFixed(2)}</div>
          <p className="text-sm text-gray-500 mb-4">Remaining balance</p>
          <div className="space-y-2 text-sm text-gray-600">
            <p>• Cost per impression: ₹0.50</p>
            <p>• Cost per click: ₹3.00</p>
            <p>• Premium tier gets priority placement</p>
          </div>
          <Link to="/highway/subscription" className="mt-4 block text-center bg-orange-500 text-white py-2 rounded-lg font-medium hover:bg-orange-600">
            Add Credits
          </Link>
        </div>
      </div>
    </div>
  );
}
