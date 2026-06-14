'use client';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@truck-platform/api-client';

function formatCrore(value: number) {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  return `₹${(value / 1000).toFixed(0)}K`;
}

export default function AnalyticsContent() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics-detail'],
    queryFn: () => adminApi.getAnalytics(),
    refetchInterval: 60000,
  });

  const a = data?.data;

  const metrics = [
    { label: 'Active Loads', value: a?.activeLoads, fmt: String },
    { label: 'GMV (24h)', value: a?.gmv24h, fmt: formatCrore },
    { label: 'Revenue (Today)', value: a?.revenueToday, fmt: formatCrore },
    { label: 'Delivery Success Rate', value: a?.deliverySuccessRate, fmt: (v: number) => `${v.toFixed(1)}%` },
    { label: 'Active Users (24h)', value: a?.activeUsers, fmt: String },
    { label: 'Pending KYC', value: a?.pendingKyc, fmt: String },
    { label: 'Open Disputes', value: a?.openDisputes, fmt: String },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Platform Analytics</h2>
        <p className="text-gray-500 mt-1">Real-time platform health metrics</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center mt-12">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {metrics.map((m) => (
            <div key={m.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <p className="text-sm text-gray-500">{m.label}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {m.value !== undefined ? m.fmt(m.value as any) : '—'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Revenue chart placeholder */}
      <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Revenue Trend (30 days)</h3>
        <div className="h-48 flex items-end justify-center gap-2">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              style={{ height: `${20 + Math.random() * 80}%` }}
              className="flex-1 bg-orange-200 rounded-t hover:bg-orange-400 transition-colors"
              title={`Day ${i + 1}`}
            />
          ))}
        </div>
        <p className="text-xs text-gray-400 text-center mt-3">Connect to analytics service for real data</p>
      </div>
    </div>
  );
}
