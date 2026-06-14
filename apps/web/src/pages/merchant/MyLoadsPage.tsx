import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { loadsApi } from '@truck-platform/api-client';
import { LoadStatus } from '@truck-platform/shared';
import { formatCurrency, formatRelativeTime } from '@truck-platform/shared';

const STATUS_FILTERS: Array<{ label: string; value: string }> = [
  { label: 'All', value: '' },
  { label: 'Posted', value: 'posted' },
  { label: 'In Transit', value: 'in_transit' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
];

const STATUS_COLORS: Record<LoadStatus, string> = {
  posted: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-blue-100 text-blue-700',
  loading: 'bg-indigo-100 text-indigo-700',
  in_transit: 'bg-orange-100 text-orange-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-600',
  disputed: 'bg-red-100 text-red-700',
};

export default function MyLoadsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['merchant-loads', statusFilter, page],
    queryFn: () => loadsApi.getMerchantLoads({ status: statusFilter || undefined, page, pageSize: 20 }),
  });

  const loads = data?.data?.items ?? [];
  const pagination = data?.data?.pagination;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">My Loads</h2>
        <Link to="/post-load" className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600">
          + Post Load
        </Link>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setStatusFilter(f.value); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center mt-12">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Load ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Route</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cargo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Price</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loads.map((load) => (
                <tr key={load.loadId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/loads/${load.loadId}`} className="text-sm font-mono text-orange-600 hover:underline">
                      {load.loadId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {load.origin.city} → {load.destination.city}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {load.cargo.weightKg}kg · {load.cargo.cargoType}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                    {formatCurrency(load.pricing.agreedPrice ?? 0)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[load.status]}`}>
                      {load.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {formatRelativeTime(new Date(load.createdAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {loads.length === 0 && (
            <div className="p-8 text-center text-gray-400">No loads found</div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-between items-center p-4 border-t border-gray-100">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!pagination.hasPrevPage}
                className="px-3 py-1.5 text-sm border rounded disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">Page {pagination.page} of {pagination.totalPages}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!pagination.hasNextPage}
                className="px-3 py-1.5 text-sm border rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
