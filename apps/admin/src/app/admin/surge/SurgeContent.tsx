'use client';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@truck-platform/api-client';
import { MAX_SURGE_MULTIPLIER, MIN_SURGE_MULTIPLIER } from '@truck-platform/shared';

export default function SurgeContent() {
  const { data: analyticsData } = useQuery({
    queryKey: ['surge-analytics'],
    queryFn: () => adminApi.getAnalytics(),
    refetchInterval: 30000,
  });

  const a = analyticsData?.data;

  const surgeMetrics = [
    { region: 'Mumbai', multiplier: 1.3, openLoads: 45, availableTruckers: 18 },
    { region: 'Delhi NCR', multiplier: 1.2, openLoads: 38, availableTruckers: 22 },
    { region: 'Bengaluru', multiplier: 1.0, openLoads: 22, availableTruckers: 31 },
    { region: 'Chennai', multiplier: 1.4, openLoads: 55, availableTruckers: 12 },
    { region: 'Hyderabad', multiplier: 1.1, openLoads: 29, availableTruckers: 25 },
    { region: 'Kolkata', multiplier: 1.0, openLoads: 18, availableTruckers: 27 },
  ];

  function getMultiplierColor(m: number) {
    if (m >= 1.4) return 'text-red-600 bg-red-50';
    if (m >= 1.2) return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Surge Pricing Monitor</h2>
        <p className="text-gray-500 mt-1">
          Real-time surge multipliers by region. Cap: {MAX_SURGE_MULTIPLIER}x · Min: {MIN_SURGE_MULTIPLIER}x
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm text-gray-500">Active Loads</p>
          <p className="text-3xl font-bold text-orange-500 mt-1">{a?.activeLoads ?? '—'}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm text-gray-500">Regions with Surge</p>
          <p className="text-3xl font-bold text-red-500 mt-1">
            {surgeMetrics.filter((r) => r.multiplier > 1.0).length}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm text-gray-500">Max Surge Active</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {Math.max(...surgeMetrics.map((r) => r.multiplier)).toFixed(1)}x
          </p>
        </div>
      </div>

      {/* Region table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Region</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Multiplier</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Open Loads</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Available Truckers</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Demand Ratio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {surgeMetrics.map((r) => (
              <tr key={r.region} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.region}</td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-bold px-2 py-1 rounded-lg ${getMultiplierColor(r.multiplier)}`}>
                    {r.multiplier.toFixed(1)}x
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{r.openLoads}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{r.availableTruckers}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 rounded-full"
                        style={{ width: `${Math.min(100, (r.openLoads / r.availableTruckers) * 30)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{(r.openLoads / r.availableTruckers).toFixed(1)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Surge multipliers are calculated automatically by the pricing service every 5 minutes.
        Manual override is not available to prevent gaming.
      </p>
    </div>
  );
}
