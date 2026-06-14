import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { truckersApi } from '@truck-platform/api-client';
import { formatCurrency } from '@truck-platform/shared';

type Period = 'daily' | 'weekly' | 'monthly';

export default function TruckerEarningsPage() {
  const [period, setPeriod] = useState<Period>('weekly');

  const { data: earningsData, isLoading: earningsLoading } = useQuery({
    queryKey: ['trucker-earnings-web', period],
    queryFn: () => truckersApi.getEarningsSummary(period),
  });

  const { data: historyData } = useQuery({
    queryKey: ['trucker-history-web-full'],
    queryFn: () => truckersApi.getLoadHistory({ pageSize: 20, status: 'delivered' }),
  });

  const earnings = earningsData?.data;
  const loads = (historyData?.data?.items ?? []) as any[];

  const periodLabel = { daily: 'Today', weekly: 'This Week', monthly: 'This Month' }[period];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">My Earnings</h2>
        <p className="text-gray-500 mt-1">Track your income and delivery history</p>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2 mb-6">
        {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
              period === p ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Earnings Summary Card */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 mb-6 text-white">
        <p className="text-sm opacity-70 mb-1">{periodLabel} Net Earnings</p>
        {earningsLoading ? (
          <p className="text-4xl font-bold">Loading…</p>
        ) : (
          <p className="text-4xl font-bold">{formatCurrency(earnings?.netPayout ?? 0)}</p>
        )}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-white/20">
          <div>
            <p className="text-xs opacity-60">Gross Revenue</p>
            <p className="text-lg font-semibold mt-0.5">{formatCurrency(earnings?.grossEarnings ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs opacity-60">Commission (5%)</p>
            <p className="text-lg font-semibold mt-0.5 text-red-300">-{formatCurrency(earnings?.platformCommission ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs opacity-60">Loads Delivered</p>
            <p className="text-lg font-semibold mt-0.5">{earnings?.loadsCount ?? 0}</p>
          </div>
        </div>
        {earnings?.nextSettlementDate && (
          <p className="text-xs opacity-60 mt-4">
            Next payout: {new Date(earnings.nextSettlementDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        )}
      </div>

      {/* History Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Delivery History</h3>
          <p className="text-xs text-gray-400 mt-0.5">All completed deliveries</p>
        </div>
        {loads.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="text-3xl mb-2">📋</p>
            <p>No delivered loads yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {loads.map((load: any) => (
              <div key={load.loadId} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {load.origin?.city} → {load.destination?.city}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {load.deliveryConfirmedAt
                      ? new Date(load.deliveryConfirmedAt).toLocaleDateString('en-IN')
                      : new Date(load.createdAt).toLocaleDateString('en-IN')}
                    {load.distanceKm ? ` · ${Math.round(load.distanceKm)} km` : ''}
                    {load.cargo?.cargoType ? ` · ${load.cargo.cargoType}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-600">
                    {formatCurrency(load.pricing?.netTruckerEarning ?? 0)}
                  </p>
                  <p className="text-xs text-gray-400">
                    Gross: {formatCurrency(load.pricing?.agreedPrice ?? 0)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
