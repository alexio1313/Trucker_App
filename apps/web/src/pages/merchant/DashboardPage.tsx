import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { loadsApi } from '@truck-platform/api-client';
import { formatCurrency, formatRelativeTime } from '@truck-platform/shared';
import { useAuthStore } from '@truck-platform/state';

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const { data: loadsData } = useQuery({
    queryKey: ['merchant-loads-dashboard'],
    queryFn: () => loadsApi.getMerchantLoads({ pageSize: 5 }),
    refetchInterval: 60000,
  });

  const { data: activeData } = useQuery({
    queryKey: ['merchant-active-loads'],
    queryFn: () => loadsApi.getMerchantLoads({ status: 'in_transit' }),
  });

  const loads = loadsData?.data?.items ?? [];
  const activeLoads = activeData?.data?.items ?? [];
  const totalLoads = loadsData?.data?.pagination?.total ?? 0;

  const totalSpend = loads.reduce((sum, l) => sum + (l.pricing.agreedPrice ?? 0), 0);
  const deliveredCount = loads.filter((l) => l.status === 'delivered').length;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Welcome back, {user?.fullName?.split(' ')[0]}</h2>
        <p className="text-gray-500 mt-1">Here's your freight overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Loads" value={String(totalLoads)} />
        <StatCard label="Active Loads" value={String(activeLoads.length)} sub="In transit" />
        <StatCard label="Delivered" value={String(deliveredCount)} sub="Last 5 loads" />
        <StatCard label="Total Spend" value={formatCurrency(totalSpend)} />
      </div>

      {/* Active Loads Alert */}
      {activeLoads.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-orange-800 mb-3">🚛 Active Loads ({activeLoads.length})</h3>
          {activeLoads.map((load) => (
            <Link key={load.loadId} to={`/loads/${load.loadId}`} className="flex justify-between items-center py-2 hover:bg-orange-100 rounded px-2 -mx-2">
              <div>
                <p className="font-medium text-gray-900 text-sm">{load.origin.city} → {load.destination.city}</p>
                <p className="text-xs text-gray-500">{load.loadId}</p>
              </div>
              <span className="text-xs bg-orange-500 text-white px-2 py-1 rounded-full">In Transit</span>
            </Link>
          ))}
        </div>
      )}

      {/* Recent Loads Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">Recent Loads</h3>
          <Link to="/post-load" className="text-sm bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors">
            + Post Load
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {loads.map((load) => (
            <Link key={load.loadId} to={`/loads/${load.loadId}`} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div>
                <p className="font-medium text-gray-900 text-sm">{load.origin.city} → {load.destination.city}</p>
                <p className="text-xs text-gray-400">{load.loadId} • {formatRelativeTime(new Date(load.createdAt))}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(load.pricing.agreedPrice ?? 0)}</p>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  load.status === 'delivered' ? 'bg-green-100 text-green-700' :
                  load.status === 'in_transit' ? 'bg-blue-100 text-blue-700' :
                  load.status === 'posted' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{load.status.replace('_', ' ')}</span>
              </div>
            </Link>
          ))}
          {loads.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              <p className="text-4xl mb-2">📦</p>
              <p>No loads yet. <Link to="/post-load" className="text-orange-500 hover:underline">Post your first load</Link></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
