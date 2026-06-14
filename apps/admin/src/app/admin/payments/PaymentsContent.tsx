'use client';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@truck-platform/api-client';

export default function PaymentsContent() {
  const { data: analyticsData } = useQuery({
    queryKey: ['payment-analytics'],
    queryFn: () => adminApi.getAnalytics(),
    refetchInterval: 60000,
  });

  const a = analyticsData?.data;

  const mockPayments = [
    { id: 'pay_001', loadId: 'ld-abc123', amount: 12500, status: 'captured', settlementDue: '2026-06-13' },
    { id: 'pay_002', loadId: 'ld-def456', amount: 8750, status: 'captured', settlementDue: '2026-06-13' },
    { id: 'pay_003', loadId: 'ld-ghi789', amount: 21000, status: 'settled', settlementDue: '2026-06-12' },
    { id: 'pay_004', loadId: 'ld-jkl012', amount: 6500, status: 'failed', settlementDue: '—' },
  ];

  const statusColor: Record<string, string> = {
    captured: 'bg-blue-100 text-blue-700',
    settled: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    refunded: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Payment Management</h2>
        <p className="text-gray-500 mt-1">Razorpay transactions with 24h settlement delay</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm text-gray-500">Revenue Today</p>
          <p className="text-3xl font-bold text-green-600 mt-1">
            {a?.revenueToday ? `₹${(a.revenueToday / 1000).toFixed(0)}K` : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Platform commissions (5%)</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm text-gray-500">GMV (24h)</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {a?.gmv24h ? `₹${(a.gmv24h / 100000).toFixed(1)}L` : '—'}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm text-gray-500">Settlement Cycle</p>
          <p className="text-3xl font-bold text-orange-500 mt-1">24h</p>
          <p className="text-xs text-gray-400 mt-1">After delivery confirmation</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Recent Transactions</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Payment ID</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Load</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Settlement Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {mockPayments.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.id}</td>
                <td className="px-4 py-3 font-mono text-xs text-orange-600">{p.loadId}</td>
                <td className="px-4 py-3 font-semibold">₹{p.amount.toLocaleString('en-IN')}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[p.status]}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{p.settlementDue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Settlements are processed automatically when settlement_due_at ≤ NOW() and status = 'captured'.
        Webhook signature verification uses crypto.timingSafeEqual.
      </p>
    </div>
  );
}
