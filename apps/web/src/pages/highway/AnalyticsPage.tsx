import { useState, useEffect } from 'react';
import { useAuthStore } from '@truck-platform/state';

type Period = '7d' | '30d' | '90d';

interface Analytics {
  impressions: number;
  clicks: number;
  ctr: number;
  spendTotal: number;
  estimatedVisits: number;
  topAd?: { title: string; ctr: number };
}

export default function HighwayAnalyticsPage() {
  const { user } = useAuthStore();
  const [period, setPeriod] = useState<Period>('7d');
  const [data, setData] = useState<Analytics>({ impressions: 0, clicks: 0, ctr: 0, spendTotal: 0, estimatedVisits: 0 });

  useEffect(() => {
    fetch(`/api/v1/highway/analytics?period=${period}`, {
      headers: { 'x-user-id': user?.id || '' },
    }).then(r => r.json()).then(d => { if (d.success) setData(d.data); });
  }, [period]);

  const periodLabels: Record<Period, string> = { '7d': '7 Days', '30d': '30 Days', '90d': '90 Days' };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['7d', '30d', '90d'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${period === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Impressions', value: data.impressions.toLocaleString(), icon: '👁️', desc: 'Drivers who saw your ad' },
          { label: 'Clicks', value: data.clicks.toLocaleString(), icon: '👆', desc: 'Drivers who tapped' },
          { label: 'CTR', value: `${(data.ctr * 100).toFixed(1)}%`, icon: '📊', desc: 'Click-through rate' },
          { label: 'Credits Spent', value: `₹${(data.spendTotal || 0).toFixed(0)}`, icon: '💸', desc: 'Ad spend' },
          { label: 'Est. Visits', value: data.estimatedVisits.toLocaleString(), icon: '🚛', desc: 'Estimated physical visits (40% conversion)' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{stat.icon}</span>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-400 mt-1">{stat.desc}</p>
          </div>
        ))}
      </div>

      {data.topAd && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
          <h2 className="font-semibold text-orange-800 mb-2">🏆 Top Performing Ad</h2>
          <p className="text-gray-800 font-medium">{data.topAd.title}</p>
          <p className="text-sm text-orange-700">CTR: {(data.topAd.ctr * 100).toFixed(1)}%</p>
        </div>
      )}

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Impression Rate Over Time</h2>
        <div className="h-32 flex items-end gap-1">
          {Array.from({ length: period === '7d' ? 7 : period === '30d' ? 30 : 12 }).map((_, i) => {
            const height = Math.max(10, Math.random() * 100);
            return <div key={i} className="flex-1 bg-orange-400 rounded-t opacity-80 transition-all hover:opacity-100" style={{ height: `${height}%` }} title={`Day ${i + 1}`} />;
          })}
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">Impressions over selected period (live chart coming soon)</p>
      </div>
    </div>
  );
}
