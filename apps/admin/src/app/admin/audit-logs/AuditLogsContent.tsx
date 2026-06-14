'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@truck-platform/api-client';

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  suspend: 'bg-orange-100 text-orange-700',
  approve: 'bg-green-100 text-green-700',
  reject: 'bg-red-100 text-red-700',
};

export default function AuditLogsContent() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page],
    queryFn: () => adminApi.getAuditLogs({ page, pageSize: 50 }),
  });

  const logs = data?.data?.items ?? [];
  const pagination = data?.data?.pagination;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Audit Logs</h2>
        <p className="text-gray-500 mt-1">All admin actions on the platform</p>
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Timestamp</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Admin</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Resource</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log) => (
                <tr key={log.logId} className="hover:bg-gray-50 text-sm">
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{log.adminId}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{log.resourceType}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono max-w-xs truncate">
                    {JSON.stringify(log.metadata)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <div className="p-8 text-center text-gray-400">No audit logs</div>}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-between items-center p-4 border-t border-gray-100">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!pagination.hasPrevPage}
                className="px-3 py-1.5 text-sm border rounded disabled:opacity-40">Previous</button>
              <span className="text-sm text-gray-500">Page {pagination.page} of {pagination.totalPages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={!pagination.hasNextPage}
                className="px-3 py-1.5 text-sm border rounded disabled:opacity-40">Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
