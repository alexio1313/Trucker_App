import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '@truck-platform/state';

interface TimelineEvent {
  type: 'toll' | 'state_crossing' | 'weighbridge' | 'break' | 'eta_update' | 'loading';
  time: string;
  title: string;
  detail: string;
  amount?: number;
  status?: string;
}

interface ETAData {
  newETA: string;
  originalETA?: string;
  remainingKm: number;
  delayVsOriginal: number;
  breakdown: { drivingMins: number; pendingBreaksMins: number; trafficDelayMins: number; fatigueMins: number };
}

export default function ShipmentTrackingPage() {
  const { loadId } = useParams<{ loadId: string }>();
  const { user } = useAuthStore();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [etaData, setEtaData] = useState<ETAData | null>(null);
  const [load, setLoad] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const headers = { 'x-user-id': user?.userId || '' };

  useEffect(() => {
    if (!loadId) return;
    Promise.all([
      fetch(`/api/v1/loads/${loadId}`, { headers }).then(r => r.json()),
      fetch(`/api/v1/loads/${loadId}/toll-log`, { headers }).then(r => r.json()),
      fetch(`/api/v1/loads/${loadId}/weight-log`, { headers }).then(r => r.json()),
      fetch(`/api/v1/loads/${loadId}/detention-status`, { headers }).then(r => r.json()),
    ]).then(([loadData, tollData, weightData, detentionData]) => {
      if (loadData.success) setLoad(loadData.data);

      const allEvents: TimelineEvent[] = [];

      if (tollData.success) {
        tollData.data?.forEach((t: any) => {
          allEvents.push({
            type: 'toll',
            time: t.crossingTime,
            title: `Toll: ${t.plazaName}`,
            detail: `${t.stateName} • ${t.paymentMethod === 'fastag' ? 'FASTag' : 'Cash'}`,
            amount: t.amountPaid,
          });
        });
      }

      if (weightData.success) {
        weightData.data?.forEach((w: any) => {
          allEvents.push({
            type: 'weighbridge',
            time: w.stopTime,
            title: `Weighbridge: ${w.locationName}`,
            detail: `${w.weightRecordedTonnes}T recorded`,
            amount: w.fineAmount > 0 ? w.fineAmount : undefined,
            status: w.status,
          });
        });
      }

      if (detentionData.success && detentionData.data?.detentionRunning) {
        allEvents.push({
          type: 'loading',
          time: new Date().toISOString(),
          title: 'Loading in progress',
          detail: `Detention running: ₹${detentionData.data.costSoFar?.toFixed(0)} (${detentionData.data.minutesElapsed} mins)`,
          amount: detentionData.data.costSoFar,
        });
      }

      allEvents.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setEvents(allEvents);
      setLoading(false);
    });
  }, [loadId]);

  useEffect(() => {
    if (!loadId) return;
    fetch(`/api/v1/truckers/my/journey/eta?loadId=${loadId}`, { headers })
      .then(r => r.json()).then(d => { if (d.success) setEtaData(d.data); });
  }, [loadId]);

  const typeIcons: Record<string, string> = {
    toll: '🛣️',
    state_crossing: '🗺️',
    weighbridge: '⚖️',
    break: '☕',
    eta_update: '⏰',
    loading: '📦',
  };

  if (loading) return <div className="p-6 text-gray-500">Loading tracking data…</div>;

  const isDelayed = (etaData?.delayVsOriginal || 0) > 30;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-3xl">📍</span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Tracking</h1>
          <p className="text-gray-500 text-sm">Load #{loadId}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ETA Panel */}
        <div className="lg:col-span-1 space-y-4">
          {etaData && (
            <div className={`rounded-xl p-5 border-2 ${isDelayed ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <h2 className="font-semibold text-gray-800 mb-3">ETA Breakdown</h2>
              <div className={`text-2xl font-bold mb-1 ${isDelayed ? 'text-red-600' : 'text-green-600'}`}>
                {new Date(etaData.newETA).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </div>
              {isDelayed && (
                <p className="text-red-600 text-sm font-medium mb-3">⚠️ {etaData.delayVsOriginal} mins delayed</p>
              )}
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between"><span>Remaining distance</span><span className="font-medium">{etaData.remainingKm} km</span></div>
                <div className="flex justify-between"><span>Driving time</span><span className="font-medium">{etaData.breakdown.drivingMins} mins</span></div>
                <div className="flex justify-between"><span>Pending breaks</span><span className="font-medium">{etaData.breakdown.pendingBreaksMins} mins</span></div>
                <div className="flex justify-between"><span>Traffic</span><span className="font-medium">+{etaData.breakdown.trafficDelayMins} mins</span></div>
                <div className="flex justify-between"><span>Fatigue buffer</span><span className="font-medium">+{etaData.breakdown.fatigueMins} mins</span></div>
              </div>
            </div>
          )}

          {load && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-3">Load Info</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">From</span><span className="font-medium">{load.originCity}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">To</span><span className="font-medium">{load.destCity}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Cargo</span><span className="font-medium">{load.cargoType}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Weight</span><span className="font-medium">{load.cargoWeightKg ? (load.cargoWeightKg / 1000).toFixed(1) + 'T' : '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={`font-medium capitalize ${load.status === 'delivered' ? 'text-green-600' : 'text-blue-600'}`}>{load.status}</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-800 mb-4">Journey Timeline</h2>
            {events.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No journey events recorded yet</p>
            ) : (
              <div className="space-y-4">
                {events.map((ev, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-sm">{typeIcons[ev.type]}</div>
                      {i < events.length - 1 && <div className="w-0.5 flex-1 bg-gray-100 mt-2" />}
                    </div>
                    <div className="pb-4 flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{ev.title}</p>
                          <p className="text-sm text-gray-500">{ev.detail}</p>
                          {ev.status === 'overloaded' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Overloaded</span>}
                          {ev.status === 'fined' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Fined</span>}
                        </div>
                        <div className="text-right text-xs text-gray-400 whitespace-nowrap ml-3">
                          <p>{new Date(ev.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                          {ev.amount != null && ev.amount > 0 && (
                            <p className="font-medium text-gray-700 text-sm mt-0.5">₹{ev.amount.toFixed(0)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
