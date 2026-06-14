import { useState, useEffect } from 'react';
import { useAuthStore } from '@truck-platform/state';

interface Ad {
  id: string;
  title: string;
  description: string;
  targetBreakTypes: string[];
  radiusKm: number;
  timeFrom: string;
  timeTo: string;
  budgetTotal: number;
  spentTotal: number;
  impressions: number;
  clicks: number;
  status: string;
  startsAt: string;
  endsAt: string;
}

const BREAK_TYPES = ['fuel', 'meal', 'rest', 'washroom'];

export default function HighwayAdsPage() {
  const { user } = useAuthStore();
  const [ads, setAds] = useState<Ad[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', offerCode: '', offerText: '',
    targetBreakTypes: ['fuel', 'meal', 'rest'],
    radiusKm: 10, timeFrom: '06:00', timeTo: '22:00',
    budgetTotal: 1000, costPerImpression: 0.5, costPerClick: 3.0,
    startsAt: '', endsAt: '',
  });

  const headers = { 'Content-Type': 'application/json', 'x-user-id': user?.userId || '' };

  useEffect(() => {
    fetch('/api/v1/highway/ads', { headers }).then(r => r.json()).then(d => { if (d.success) setAds(d.data); });
  }, []);

  async function createAd(e: React.FormEvent) {
    e.preventDefault();
    const resp = await fetch('/api/v1/highway/ads', { method: 'POST', headers, body: JSON.stringify(form) });
    const d = await resp.json();
    if (d.success) { setAds(prev => [...prev, d.data]); setShowForm(false); }
  }

  async function toggleAd(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    await fetch(`/api/v1/highway/ads/${id}`, { method: 'PUT', headers, body: JSON.stringify({ status: newStatus }) });
    setAds(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
  }

  async function deleteAd(id: string) {
    await fetch(`/api/v1/highway/ads/${id}`, { method: 'DELETE', headers });
    setAds(prev => prev.filter(a => a.id !== id));
  }

  function toggleBreakType(bt: string) {
    setForm(f => ({
      ...f,
      targetBreakTypes: f.targetBreakTypes.includes(bt)
        ? f.targetBreakTypes.filter(t => t !== bt)
        : [...f.targetBreakTypes, bt],
    }));
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Ad Campaigns</h1>
        <button onClick={() => setShowForm(true)} className="bg-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-600">
          + Create Campaign
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">New Ad Campaign</h2>
            <form onSubmit={createAd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" placeholder="e.g. Special Dal Makhani - 20% off" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Brief description of your offer" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Offer Code</label>
                  <input type="text" value={form.offerCode} onChange={e => setForm(f => ({ ...f, offerCode: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" placeholder="TRUCK20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Offer Text</label>
                  <input type="text" value={form.offerText} onChange={e => setForm(f => ({ ...f, offerText: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" placeholder="20% off on meals" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Trigger Break Types</label>
                <div className="flex gap-2 flex-wrap">
                  {BREAK_TYPES.map(bt => (
                    <button key={bt} type="button" onClick={() => toggleBreakType(bt)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${form.targetBreakTypes.includes(bt) ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {bt}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Radius (km)</label>
                  <input type="number" value={form.radiusKm} onChange={e => setForm(f => ({ ...f, radiusKm: +e.target.value }))} min={1} max={20} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                  <input type="time" value={form.timeFrom} onChange={e => setForm(f => ({ ...f, timeFrom: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                  <input type="time" value={form.timeTo} onChange={e => setForm(f => ({ ...f, timeTo: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Budget (₹)</label>
                  <input type="number" value={form.budgetTotal} onChange={e => setForm(f => ({ ...f, budgetTotal: +e.target.value }))} min={100} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium">Cancel</button>
                <button type="submit" className="flex-1 bg-orange-500 text-white py-2 rounded-lg font-semibold hover:bg-orange-600">Create Campaign</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {ads.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100 text-center">
          <span className="text-5xl">📢</span>
          <p className="text-gray-500 mt-4">No campaigns yet. Create your first ad to reach drivers on the highway!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ads.map(ad => (
            <div key={ad.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{ad.title}</h3>
                  <p className="text-sm text-gray-500">{ad.description}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ad.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {ad.status}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-3 text-center mb-3">
                <div><p className="text-xs text-gray-400">Impressions</p><p className="font-bold text-gray-900">{ad.impressions}</p></div>
                <div><p className="text-xs text-gray-400">Clicks</p><p className="font-bold text-gray-900">{ad.clicks}</p></div>
                <div><p className="text-xs text-gray-400">CTR</p><p className="font-bold text-gray-900">{ad.impressions > 0 ? `${((ad.clicks / ad.impressions) * 100).toFixed(1)}%` : '0%'}</p></div>
                <div><p className="text-xs text-gray-400">Spent</p><p className="font-bold text-gray-900">₹{(ad.spentTotal || 0).toFixed(0)}</p></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => toggleAd(ad.id, ad.status)} className="flex-1 text-sm py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                  {ad.status === 'active' ? 'Pause' : 'Resume'}
                </button>
                <button onClick={() => deleteAd(ad.id)} className="text-sm py-1.5 px-4 border border-red-200 text-red-500 rounded-lg hover:bg-red-50">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
