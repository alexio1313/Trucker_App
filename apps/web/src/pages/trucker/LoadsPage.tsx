import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loadsApi, truckersApi } from '@truck-platform/api-client';
import { formatCurrency, formatDistance } from '@truck-platform/shared';

const LOAD_API = 'http://192.168.8.101:3001/api/v1/loads';
const ADMIN_API = 'http://192.168.8.101:3004/api/v1/admin';

type Tab = 'available' | 'return' | 'nearby' | 'myloads';

interface EnhancedLoad {
  load_id: string;
  origin_city: string;
  dest_city: string;
  origin_state?: string;
  dest_state?: string;
  price: number;
  distance_km: number;
  pickup_dist_km?: number;
  dropoff_to_home_km?: number;
  detour_km?: number;
  cargo_type: string;
  weight_kg: number;
  score?: number;
}

function LoadCard({
  load,
  onAccept,
  accepting,
  extra,
}: {
  load: EnhancedLoad;
  onAccept: (load: EnhancedLoad) => void;
  accepting: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-lg font-bold text-gray-900">
            {load.origin_city} → {load.dest_city}
          </p>
          {(load.origin_state || load.dest_state) && (
            <p className="text-sm text-gray-500">
              {load.origin_state} → {load.dest_state}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-orange-500">
            ₹{load.price?.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-gray-400">Agreed price</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {load.distance_km > 0 && (
          <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
            📍 {load.distance_km?.toFixed(0)} km route
          </span>
        )}
        {load.pickup_dist_km !== undefined && (
          <span className="text-xs bg-orange-50 text-orange-700 px-3 py-1 rounded-full">
            🚀 {load.pickup_dist_km?.toFixed(0)} km to pickup
          </span>
        )}
        {load.dropoff_to_home_km !== undefined && (
          <span className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full">
            🏠 {load.dropoff_to_home_km?.toFixed(0)} km to home
          </span>
        )}
        {load.detour_km !== undefined && (
          <span className="text-xs bg-purple-50 text-purple-700 px-3 py-1 rounded-full">
            ↗️ +{load.detour_km?.toFixed(0)} km detour
          </span>
        )}
        {load.weight_kg > 0 && (
          <span className="text-xs bg-gray-50 text-gray-700 px-3 py-1 rounded-full">
            ⚖️ {load.weight_kg} kg
          </span>
        )}
        {load.cargo_type && (
          <span className="text-xs bg-gray-50 text-gray-700 px-3 py-1 rounded-full capitalize">
            📦 {load.cargo_type}
          </span>
        )}
      </div>

      {extra}

      <div className="flex justify-between items-center pt-3 border-t border-gray-50">
        <div>
          <p className="text-xs text-gray-400">Net earning after 5% commission</p>
          <p className="text-sm font-semibold text-green-600">
            {formatCurrency(load.price * 0.95)}
          </p>
        </div>
        <button
          onClick={() => onAccept(load)}
          disabled={accepting}
          className="bg-orange-500 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50"
        >
          {accepting ? 'Accepting…' : 'Accept Load'}
        </button>
      </div>
    </div>
  );
}

export default function TruckerLoadsPage() {
  const [tab, setTab] = useState<Tab>('available');
  const [originCity, setOriginCity] = useState('');
  const [destCity, setDestCity] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [backhaulLoads, setBackhaulLoads] = useState<EnhancedLoad[]>([]);
  const [nearbyLoads, setNearbyLoads] = useState<EnhancedLoad[]>([]);
  const [myLoads, setMyLoads] = useState<any[]>([]);
  const [myLoadsLoading, setMyLoadsLoading] = useState(false);
  const [enhancedLoading, setEnhancedLoading] = useState(false);
  const [enhancedError, setEnhancedError] = useState<string | null>(null);
  const [disputeModal, setDisputeModal] = useState<{ load: any; description: string; disputeType: string } | null>(null);
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [truckModal, setTruckModal] = useState<{ load: EnhancedLoad; trucks: any[] } | null>(null);
  const [selectedTruckId, setSelectedTruckId] = useState<string>('');
  const [trucksFetching, setTrucksFetching] = useState(false);
  const [truckError, setTruckError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['trucker-loads-search-web', originCity, destCity],
    queryFn: () => loadsApi.searchLoads({
      originCity: originCity || undefined,
      destinationCity: destCity || undefined,
      pageSize: 20,
    }),
    staleTime: 60000,
    enabled: tab === 'available',
  });

  const acceptMutation = useMutation({
    mutationFn: ({ loadId, truckId }: { loadId: string; truckId: string }) =>
      loadsApi.acceptLoad(loadId, truckId),
    onSuccess: () => {
      setTruckModal(null);
      queryClient.invalidateQueries({ queryKey: ['trucker-loads-search-web'] });
      queryClient.invalidateQueries({ queryKey: ['trucker-active-load-web'] });
    },
  });

  async function handleAcceptClick(load: EnhancedLoad) {
    setTruckError(null);
    setTrucksFetching(true);
    try {
      const res = await truckersApi.getTrucks();
      const trucks: any[] = res.data ?? [];
      if (trucks.length === 0) {
        setTruckError('no_trucks');
        setTruckModal({ load, trucks: [] });
      } else if (trucks.length === 1) {
        setSelectedTruckId(trucks[0].truckId ?? trucks[0].truck_id);
        setTruckModal({ load, trucks });
      } else {
        setSelectedTruckId(trucks[0].truckId ?? trucks[0].truck_id);
        setTruckModal({ load, trucks });
      }
    } catch {
      setTruckError('fetch_failed');
      setTruckModal({ load, trucks: [] });
    } finally {
      setTrucksFetching(false);
    }
  }

  const loads = (data?.data?.items ?? []) as any[];

  // Acquire GPS on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setCoords(null),
        { timeout: 8000 },
      );
    }
  }, []);

  // Fetch backhaul loads when tab = return
  useEffect(() => {
    if (tab !== 'return') return;
    if (!coords) { setEnhancedError('Enable location access to find return trip loads.'); return; }
    setEnhancedLoading(true);
    setEnhancedError(null);
    fetch(`${LOAD_API}/backhaul?destLat=${coords.lat}&destLng=${coords.lng}&radiusKm=300`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setBackhaulLoads(json.data.loads ?? []);
        else setEnhancedError('Could not load return trip suggestions.');
      })
      .catch(() => setEnhancedError('Failed to reach load service.'))
      .finally(() => setEnhancedLoading(false));
  }, [tab, coords]);

  // Fetch trucker's own loads when tab = myloads
  useEffect(() => {
    if (tab !== 'myloads') return;
    setMyLoadsLoading(true);
    // Get user_id from localStorage (set during login)
    const userId = localStorage.getItem('user_id') || localStorage.getItem('userId');
    const endpoint = userId
      ? `${LOAD_API}/search?truckerUserId=${userId}&pageSize=50`
      : `${LOAD_API}/search?pageSize=50&status=in_transit`;
    fetch(endpoint)
      .then((r) => r.json())
      .then((json) => { if (json.success) setMyLoads(json.data.items ?? []); })
      .catch(() => {/* ignore */})
      .finally(() => setMyLoadsLoading(false));
  }, [tab]);

  const handleRaiseDispute = async () => {
    if (!disputeModal || !disputeModal.description?.trim()) return;
    setDisputeSubmitting(true);
    try {
      await fetch(`${ADMIN_API}/disputes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loadId: disputeModal.load.load_id ?? disputeModal.load.loadId,
          raisedByRole: 'trucker',
          description: disputeModal.description,
          disputeType: disputeModal.disputeType,
        }),
      });
      setDisputeModal(null);
      // Refresh my loads
      setTab('myloads');
    } catch { /* ignore */ }
    finally { setDisputeSubmitting(false); }
  };

  // Fetch nearby loads when tab = nearby
  useEffect(() => {
    if (tab !== 'nearby') return;
    if (!coords) { setEnhancedError('Enable location access to find loads near you.'); return; }
    setEnhancedLoading(true);
    setEnhancedError(null);
    fetch(`${LOAD_API}/nearby?lat=${coords.lat}&lng=${coords.lng}&radiusKm=100`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setNearbyLoads(json.data.loads ?? []);
        else setEnhancedError('Could not load nearby suggestions.');
      })
      .catch(() => setEnhancedError('Failed to reach load service.'))
      .finally(() => setEnhancedLoading(false));
  }, [tab, coords]);

  const tabStyle = (t: Tab) =>
    tab === t
      ? 'bg-orange-500 text-white shadow-sm'
      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50';

  const mapToCard = (l: any): EnhancedLoad => ({
    load_id:            l.load_id ?? l.loadId,
    origin_city:        l.origin_city ?? l.origin?.city ?? l.origin,
    dest_city:          l.dest_city ?? l.destination?.city ?? l.destination,
    origin_state:       l.origin?.state,
    dest_state:         l.destination?.state,
    // enhanced endpoints use snake_case DB columns; standard API uses nested objects
    price:              l.agreed_price ?? l.price ?? l.pricing?.agreedPrice ?? l.pricing?.aiSuggestedPrice ?? 0,
    distance_km:        parseFloat(l.distance_km ?? l.distanceKm ?? 0),
    pickup_dist_km:     l.pickup_dist_km != null ? parseFloat(l.pickup_dist_km) : undefined,
    dropoff_to_home_km: l.dropoff_to_home_km != null ? parseFloat(l.dropoff_to_home_km) : undefined,
    detour_km:          l.detour_km != null ? parseFloat(l.detour_km) : undefined,
    cargo_type:         l.cargo_type ?? l.cargo?.cargoType ?? '',
    weight_kg:          l.cargo_weight_kg ?? l.weight_kg ?? l.cargo?.weightKg ?? 0,
    score:              l.returnTripScore ?? l.score,
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Find Loads</h2>
        <p className="text-gray-500 mt-1">Search available loads, find return trips, or browse loads near you</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setTab('available')} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tabStyle('available')}`}>
          🔍 Available Loads
        </button>
        <button onClick={() => setTab('return')} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tabStyle('return')}`}>
          ↩️ Return Trip
        </button>
        <button onClick={() => setTab('nearby')} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tabStyle('nearby')}`}>
          📍 Near Me
        </button>
        <button onClick={() => setTab('myloads')} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tabStyle('myloads')}`}>
          📋 My Loads
        </button>
        {!coords && (
          <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
            📡 Location not available — enable in browser for Return/Nearby tabs
          </span>
        )}
      </div>

      {/* Available Loads Tab */}
      {tab === 'available' && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Origin city (e.g. Bangalore)"
                value={originCity}
                onChange={(e) => setOriginCity(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <input
                type="text"
                placeholder="Destination city (e.g. Delhi)"
                value={destCity}
                onChange={(e) => setDestCity(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                onClick={() => refetch()}
                className="bg-orange-500 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors"
              >
                Search
              </button>
              <button
                onClick={() => { setOriginCity(''); setDestCity(''); refetch(); }}
                className="text-gray-500 px-4 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">⏳</div>
              <p>Searching loads…</p>
            </div>
          ) : loads.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">🔍</div>
              <p>No loads found. Try a different search or check back later.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">{loads.length} load{loads.length !== 1 ? 's' : ''} available</p>
              {loads.map((load: any) => (
                <LoadCard
                  key={load.loadId}
                  load={mapToCard(load)}
                  onAccept={handleAcceptClick}
                  accepting={acceptMutation.isPending}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Return Trip Tab */}
      {tab === 'return' && (
        <div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 flex items-start gap-3">
            <span className="text-2xl">↩️</span>
            <div>
              <p className="font-semibold text-blue-900 text-sm">Return Trip Matching</p>
              <p className="text-blue-700 text-sm mt-0.5">
                Loads near your current position headed towards your home region. Don't drive back empty — earn on the way!
              </p>
            </div>
          </div>

          {enhancedLoading && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">🔄</div>
              <p>Finding return trip loads…</p>
            </div>
          )}
          {!enhancedLoading && enhancedError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{enhancedError}</div>
          )}
          {!enhancedLoading && !enhancedError && backhaulLoads.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">↩️</div>
              <p>No return trip loads found within 300 km of your position.</p>
              <p className="text-sm mt-2">Try the "Available Loads" tab or wait for new postings.</p>
            </div>
          )}
          {!enhancedLoading && backhaulLoads.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                {backhaulLoads.length} return trip load{backhaulLoads.length !== 1 ? 's' : ''} found
                {coords && <span className="text-gray-400"> · sorted by best match score</span>}
              </p>
              {backhaulLoads.map((load) => (
                <LoadCard
                  key={load.load_id}
                  load={load}
                  onAccept={handleAcceptClick}
                  accepting={acceptMutation.isPending}
                  extra={
                    load.score !== undefined ? (
                      <div className="mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Match score:</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            <div
                              className="bg-orange-500 h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, (1 / (1 + load.score / 500)) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400">
                            {load.score < 200 ? 'Excellent' : load.score < 400 ? 'Good' : 'Moderate'}
                          </span>
                        </div>
                      </div>
                    ) : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Near Me Tab */}
      {tab === 'nearby' && (
        <div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5 flex items-start gap-3">
            <span className="text-2xl">📍</span>
            <div>
              <p className="font-semibold text-green-900 text-sm">Loads Near Your Current Location</p>
              <p className="text-green-700 text-sm mt-0.5">
                Pickup points within 100 km of you — minimal deadhead, maximum earning efficiency.
              </p>
            </div>
          </div>

          {enhancedLoading && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">📡</div>
              <p>Finding nearby loads…</p>
            </div>
          )}
          {!enhancedLoading && enhancedError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{enhancedError}</div>
          )}
          {!enhancedLoading && !enhancedError && nearbyLoads.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">📍</div>
              <p>No loads within 100 km of your current location.</p>
              <p className="text-sm mt-2">Check "Available Loads" or try Return Trip.</p>
            </div>
          )}
          {!enhancedLoading && nearbyLoads.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                {nearbyLoads.length} load{nearbyLoads.length !== 1 ? 's' : ''} within 100 km
              </p>
              {nearbyLoads.map((load) => (
                <LoadCard
                  key={load.load_id}
                  load={load}
                  onAccept={handleAcceptClick}
                  accepting={acceptMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* My Loads Tab — with Raise Dispute option */}
      {tab === 'myloads' && (
        <div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-5 flex items-start gap-3">
            <span className="text-2xl">📋</span>
            <div>
              <p className="font-semibold text-orange-900 text-sm">Your Load History</p>
              <p className="text-orange-700 text-sm mt-0.5">
                View your active and completed loads. If you have an issue, use "Raise Dispute" — our team will review within 24 hours.
              </p>
            </div>
          </div>

          {myLoadsLoading && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">📋</div>
              <p>Loading your loads…</p>
            </div>
          )}

          {!myLoadsLoading && myLoads.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">📦</div>
              <p>No loads found.</p>
              <p className="text-sm mt-2">Accept a load from the "Available Loads" tab to get started.</p>
            </div>
          )}

          {!myLoadsLoading && myLoads.length > 0 && (
            <div className="space-y-3">
              {myLoads.map((load: any) => {
                const mapped = mapToCard(load);
                const status = load.status ?? '';
                const canDispute = ['in_transit', 'delivered', 'accepted', 'loading'].includes(status);
                const isDisputed = status === 'disputed';
                const statusColors: Record<string, string> = {
                  posted: 'bg-yellow-100 text-yellow-700',
                  accepted: 'bg-blue-100 text-blue-700',
                  loading: 'bg-indigo-100 text-indigo-700',
                  in_transit: 'bg-orange-100 text-orange-700',
                  delivered: 'bg-green-100 text-green-700',
                  cancelled: 'bg-gray-100 text-gray-600',
                  disputed: 'bg-red-100 text-red-700',
                };
                return (
                  <div key={load.load_id ?? load.loadId} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-gray-900">{mapped.origin_city} → {mapped.dest_city}</p>
                        {mapped.distance_km > 0 && <p className="text-xs text-gray-400">{mapped.distance_km.toFixed(0)} km</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-orange-500">₹{mapped.price?.toLocaleString('en-IN')}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                      <div className="flex gap-2 text-xs text-gray-400">
                        {mapped.weight_kg > 0 && <span>⚖️ {mapped.weight_kg} kg</span>}
                        {mapped.cargo_type && <span className="capitalize">📦 {mapped.cargo_type}</span>}
                      </div>
                      {isDisputed ? (
                        <span className="text-xs text-red-500 font-medium">Dispute filed — under review</span>
                      ) : canDispute ? (
                        <button
                          onClick={() => setDisputeModal({ load, description: '', disputeType: 'other' })}
                          className="text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors font-medium"
                        >
                          Raise Dispute
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Truck Selection Modal */}
      {truckModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-900">Accept Load</h3>
              <button onClick={() => setTruckModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <p className="text-sm text-gray-500 mb-5 pb-4 border-b border-gray-100">
              {truckModal.load.origin_city} → {truckModal.load.dest_city}
              <span className="ml-2 font-semibold text-orange-500">₹{truckModal.load.price?.toLocaleString('en-IN')}</span>
            </p>

            {trucksFetching && (
              <div className="text-center py-6 text-gray-400">
                <div className="text-2xl mb-2">🔄</div>
                <p className="text-sm">Loading your trucks…</p>
              </div>
            )}

            {!trucksFetching && (truckError === 'no_trucks' || truckModal.trucks.length === 0) && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                <div className="text-3xl mb-2">🚛</div>
                <p className="font-semibold text-orange-900 text-sm">No truck registered</p>
                <p className="text-orange-700 text-xs mt-1">Go to Profile → My Trucks to add your truck before accepting loads.</p>
              </div>
            )}

            {!trucksFetching && truckError === 'fetch_failed' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                Could not load your trucks. Please try again.
              </div>
            )}

            {!trucksFetching && !truckError && truckModal.trucks.length > 0 && (
              <>
                <p className="text-sm text-gray-600 mb-3 font-medium">
                  {truckModal.trucks.length === 1 ? 'Your truck will be used for this delivery:' : 'Select which truck to use for this delivery:'}
                </p>
                <div className="space-y-2 mb-5">
                  {truckModal.trucks.map((t: any) => {
                    const tid = t.truckId ?? t.truck_id;
                    const reg = t.registrationNo ?? t.registration_no ?? tid;
                    const label = [t.make, t.model].filter(Boolean).join(' ') || (t.truckType ?? 'Truck');
                    const cap = t.capacityKg ?? t.capacity_kg;
                    return (
                      <button
                        key={tid}
                        onClick={() => setSelectedTruckId(tid)}
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                          selectedTruckId === tid
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{reg}</p>
                            <p className="text-xs text-gray-500">{label}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {cap && <span className="text-xs text-gray-400">{(cap / 1000).toFixed(0)}t</span>}
                            {selectedTruckId === tid && <span className="text-orange-500 text-lg">✓</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {acceptMutation.isError && (
                  <p className="text-xs text-red-500 mb-3">Failed to accept load. Please try again.</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setTruckModal(null)}
                    className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => acceptMutation.mutate({ loadId: truckModal.load.load_id, truckId: selectedTruckId })}
                    disabled={!selectedTruckId || acceptMutation.isPending}
                    className="flex-1 py-2.5 text-sm bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
                  >
                    {acceptMutation.isPending ? 'Accepting…' : 'Confirm Accept'}
                  </button>
                </div>
              </>
            )}

            {!trucksFetching && (truckError === 'no_trucks' || truckModal.trucks.length === 0) && (
              <button
                onClick={() => setTruckModal(null)}
                className="w-full mt-4 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 font-medium"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {disputeModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h3 className="font-bold text-lg text-gray-900 mb-1">Raise a Dispute</h3>
            <p className="text-sm text-gray-500 mb-4">
              Load: {(disputeModal.load.origin_city ?? disputeModal.load.origin?.city)} → {(disputeModal.load.dest_city ?? disputeModal.load.destination?.city)}
            </p>
            <select
              value={disputeModal.disputeType}
              onChange={(e) => setDisputeModal((d) => d ? { ...d, disputeType: e.target.value } : null)}
              className="w-full border border-gray-200 rounded-lg p-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="waiting_charge">Waiting Charge</option>
              <option value="payment_issue">Payment Issue</option>
              <option value="damage">Cargo Damage</option>
              <option value="late_delivery">Late Delivery</option>
              <option value="no_show">No Show</option>
              <option value="cargo_mismatch">Cargo Mismatch</option>
              <option value="communication">Communication</option>
              <option value="other">Other</option>
            </select>
            <textarea
              className="w-full border border-gray-200 rounded-lg p-3 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Describe the issue clearly (e.g., merchant delayed loading by 3 hours, damaged goods, incorrect weight). Our team will respond within 24 hours."
              value={disputeModal.description}
              onChange={(e) => setDisputeModal((d) => d ? { ...d, description: e.target.value } : null)}
            />
            <p className="text-xs text-gray-400 mt-2 mb-4">Min. 20 characters. Be specific about dates, amounts, and what happened.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDisputeModal(null)}
                className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRaiseDispute}
                disabled={disputeSubmitting || disputeModal.description.trim().length < 20}
                className="flex-1 py-2 text-sm bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {disputeSubmitting ? 'Submitting…' : 'Submit Dispute'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
