'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@truck-platform/api-client';

export default function FeatureFlagsContent() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => adminApi.getFeatureFlags(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      adminApi.updateFeatureFlag(key, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feature-flags'] }),
  });

  const flags = data?.data ?? [];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Feature Flags</h2>
        <p className="text-gray-500 mt-1">Toggle platform features without deployment</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center mt-12">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {flags.map((flag) => (
            <div key={flag.key} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex justify-between items-center">
              <div>
                <p className="font-semibold text-gray-900">{flag.key}</p>
                <p className="text-sm text-gray-500 mt-0.5">{flag.description}</p>
                {flag.rolloutPercent !== undefined && (
                  <p className="text-xs text-gray-400 mt-1">Rollout: {flag.rolloutPercent}%</p>
                )}
              </div>
              <button
                onClick={() => updateMutation.mutate({ key: flag.key, enabled: !flag.enabled })}
                disabled={updateMutation.isPending}
                className={`relative w-12 h-6 rounded-full transition-colors ${flag.enabled ? 'bg-orange-500' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  flag.enabled ? 'translate-x-7' : 'translate-x-1'
                }`} />
              </button>
            </div>
          ))}
          {flags.length === 0 && (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400">No feature flags configured</div>
          )}
        </div>
      )}
    </div>
  );
}
