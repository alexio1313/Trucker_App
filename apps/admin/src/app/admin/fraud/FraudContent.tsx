'use client';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@truck-platform/api-client';
import Link from 'next/link';

const SCORE_COLOR = (score: number) => {
  if (score >= 0.8) return 'text-red-600 bg-red-50';
  if (score >= 0.6) return 'text-orange-600 bg-orange-50';
  return 'text-yellow-600 bg-yellow-50';
};

export default function FraudContent() {
  const { data, isLoading } = useQuery({
    queryKey: ['fraud-alerts'],
    queryFn: () => adminApi.getUsers({ fraudScore: 0.7 }),
    refetchInterval: 60000,
  });

  const alerts = data?.data?.items ?? [];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Fraud Alerts</h2>
        <p className="text-gray-500 mt-1">Users flagged by ML fraud detection (score ≥ 0.7)</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center mt-12">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((user) => (
            <div key={user.userId} className="bg-white rounded-xl shadow-sm border border-red-100 p-5">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex gap-3 items-center mb-2">
                    <span className="font-semibold text-gray-900">{user.fullName}</span>
                    <span className="text-xs text-gray-400 font-mono">{user.phoneNumber}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${SCORE_COLOR(user.fraudScore ?? 0)}`}>
                      Fraud Score: {((user.fraudScore ?? 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{user.fraudExplanation ?? 'ML model flagged this account'}</p>
                </div>
                <Link href={`/admin/users/${user.userId}`} className="text-sm text-orange-600 hover:underline">
                  View User →
                </Link>
              </div>
            </div>
          ))}
          {alerts.length === 0 && (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400">
              No fraud alerts. Platform looks clean.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
