import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loadsApi, trackingApi } from '@truck-platform/api-client';
import { LoadStatus } from '@truck-platform/shared';
import { formatCurrency, formatRelativeTime } from '@truck-platform/shared';

const STATUS_STEPS: LoadStatus[] = ['posted', 'accepted', 'loading', 'in_transit', 'delivered'];

const STATUS_COLORS: Record<string, string> = {
  posted: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-blue-100 text-blue-700',
  loading: 'bg-indigo-100 text-indigo-700',
  in_transit: 'bg-orange-100 text-orange-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-600',
  disputed: 'bg-red-100 text-red-700',
};

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

export default function LoadDetailPage() {
  const { loadId } = useParams<{ loadId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: loadData, isLoading } = useQuery({
    queryKey: ['load', loadId],
    queryFn: () => loadsApi.getLoad(loadId!),
    refetchInterval: (data) => {
      const status = data?.data?.status;
      return status === 'in_transit' || status === 'accepted' ? 15000 : false;
    },
  });

  const { data: trackingData } = useQuery({
    queryKey: ['tracking', loadId],
    queryFn: () => trackingApi.getLiveTracking(loadId!),
    enabled: loadData?.data?.status === 'in_transit',
    refetchInterval: 15000,
  });

  const { data: etaData } = useQuery({
    queryKey: ['eta', loadId],
    queryFn: () => trackingApi.getETAPrediction(loadId!),
    enabled: loadData?.data?.status === 'in_transit',
    refetchInterval: 60000,
  });

  const cancelMutation = useMutation({
    mutationFn: () => loadsApi.cancelLoad(loadId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['load', loadId] });
      queryClient.invalidateQueries({ queryKey: ['merchant-loads'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const load = loadData?.data;
  if (!load) return <div className="p-6 text-gray-500">Load not found</div>;

  const tracking = trackingData?.data;
  const eta = etaData?.data;
  const currentStep = STATUS_STEPS.indexOf(load.status as LoadStatus);

  function handleCancel() {
    if (window.confirm('Cancel this load? This cannot be undone.')) {
      cancelMutation.mutate();
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4">
        ← Back
      </button>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Load Detail</h2>
          <p className="text-xs font-mono text-gray-400 mt-1">{load.loadId}</p>
        </div>
        <span className={`text-sm px-3 py-1.5 rounded-full font-medium ${STATUS_COLORS[load.status]}`}>
          {load.status.replace('_', ' ')}
        </span>
      </div>

      {/* Status stepper */}
      {load.status !== 'cancelled' && load.status !== 'disputed' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex justify-between">
            {STATUS_STEPS.map((step, i) => (
              <div key={step} className="flex-1 flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-2 ${
                  i <= currentStep ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {i < currentStep ? '✓' : i + 1}
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`absolute mt-4 h-0.5 w-full ${i < currentStep ? 'bg-orange-500' : 'bg-gray-200'}`} />
                )}
                <span className="text-xs text-center text-gray-500 capitalize">{step.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live tracking card */}
      {load.status === 'in_transit' && tracking && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-orange-800 mb-3">Live Tracking</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Current Location</p>
              <p className="font-medium text-gray-900">{tracking.currentLocation.address ?? 'Updating...'}</p>
            </div>
            {eta && (
              <div>
                <p className="text-xs text-gray-500">ETA</p>
                <p className="font-medium text-gray-900">{new Date(eta.estimatedArrival).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                <p className="text-xs text-gray-400">{Math.round(eta.remainingDistanceKm)}km remaining</p>
              </div>
            )}
          </div>
          {eta?.slaStatus && (
            <div className={`mt-3 text-xs px-3 py-1.5 rounded-full inline-block ${
              eta.slaStatus === 'on_time' ? 'bg-green-100 text-green-700' :
              eta.slaStatus === 'at_risk' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              SLA: {eta.slaStatus.replace('_', ' ')}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Route & Cargo */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Route</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-400">Pickup</p>
              <p className="font-medium text-gray-900">{load.origin.city}, {load.origin.state}</p>
              <p className="text-xs text-gray-500">{load.origin.address}</p>
            </div>
            <div className="border-l-2 border-dashed border-orange-300 ml-2 pl-3 py-1">
              <p className="text-xs text-gray-400">{load.distanceKm ? `${Math.round(load.distanceKm)}km` : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Delivery</p>
              <p className="font-medium text-gray-900">{load.destination.city}, {load.destination.state}</p>
              <p className="text-xs text-gray-500">{load.destination.address}</p>
            </div>
          </div>
        </div>

        {/* Cargo details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Cargo Details</h3>
          <InfoRow label="Weight" value={`${load.cargo.weightKg}kg`} />
          <InfoRow label="Type" value={load.cargo.cargoType} />
          {load.cargo.volumeCbm && <InfoRow label="Volume" value={`${load.cargo.volumeCbm}m³`} />}
          {load.cargo.hazmat && <InfoRow label="Hazmat" value="Yes" />}
          {load.cargo.temperatureControlled && <InfoRow label="Temp Controlled" value="Yes" />}
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Pricing</h3>
          <InfoRow label="Agreed Price" value={formatCurrency(load.pricing.agreedPrice ?? 0)} />
          <InfoRow label="Platform Fee (5%)" value={formatCurrency((load.pricing.agreedPrice ?? 0) * 0.05)} />
          {load.pricing.surgeMultiplier && load.pricing.surgeMultiplier > 1 && (
            <InfoRow label="Surge Multiplier" value={`${load.pricing.surgeMultiplier}x`} />
          )}
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Timeline</h3>
          <InfoRow label="Posted" value={formatRelativeTime(new Date(load.createdAt))} />
          {load.pickupTime && <InfoRow label="SLA Pickup" value={new Date(load.pickupTime.earliest).toLocaleDateString('en-IN')} />}
          {load.deliveryTime && <InfoRow label="SLA Delivery" value={new Date(load.deliveryTime.latest).toLocaleDateString('en-IN')} />}
        </div>
      </div>

      {/* Cancel button */}
      {(load.status === 'posted' || load.status === 'accepted') && (
        <div className="mt-6">
          <button
            onClick={handleCancel}
            disabled={cancelMutation.isPending}
            className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50"
          >
            {cancelMutation.isPending ? 'Cancelling…' : 'Cancel Load'}
          </button>
        </div>
      )}
    </div>
  );
}
