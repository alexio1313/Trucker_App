import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@truck-platform/state';
import { truckersApi } from '@truck-platform/api-client';
import { formatCurrency } from '@truck-platform/shared';
import { Link } from 'react-router-dom';

const TRUCKER_API = 'http://192.168.8.101:3002/api/v1/truckers';
const LOAD_API    = 'http://192.168.8.101:3001/api/v1/loads';

const WMO_ICONS: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌊',
  71: '❄️', 73: '❄️', 75: '❄️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

interface DocAlert {
  user_id: string;
  truck_id: string;
  registration_no: string;
  insurance_expiry: string | null;
  permit_expiry: string | null;
  fitness_expiry: string | null;
  insurance_days_left: number | null;
  permit_days_left: number | null;
  fitness_days_left: number | null;
  insurance_alert: string;
  permit_alert: string;
  fitness_alert: string;
}

interface BackhaulLoad {
  load_id: string;
  origin_city: string;
  dest_city: string;
  agreed_price: number;
  distance_km: number;
  pickup_dist_km: number;
  cargo_type: string;
  cargo_weight_kg: number;
}

interface WeatherPoint {
  location: string;
  temperature: string;
  windSpeed: string;
  condition: string;
  weatherCode: number;
  advisory: string | null;
  isAdverse: boolean;
}

function StatCard({ label, value, sub, color = 'text-gray-900' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

const ALERT_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  expired:  { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
  critical: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  warning:  { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
};

function DocAlertBadge({ alert, label, daysLeft }: { alert: string; label: string; daysLeft: number | null }) {
  if (alert === 'ok') return null;
  const s = ALERT_STYLE[alert];
  const text = daysLeft !== null && daysLeft < 0
    ? `${label} expired ${Math.abs(daysLeft)}d ago`
    : daysLeft !== null
    ? `${label} expires in ${daysLeft}d`
    : label;
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${s.bg} ${s.text} ${s.border}`}>
      {text}
    </span>
  );
}

export default function TruckerDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [docAlert, setDocAlert] = useState<DocAlert | null>(null);
  const [weather, setWeather] = useState<WeatherPoint | null>(null);
  const [backhaul, setBackhaul] = useState<BackhaulLoad[]>([]);
  const [journeyLoad, setJourneyLoad] = useState<any>(null);

  const { data: profileData } = useQuery({
    queryKey: ['trucker-profile-web'],
    queryFn: () => truckersApi.getProfile(),
    refetchInterval: 60000,
  });

  const { data: earningsData } = useQuery({
    queryKey: ['trucker-earnings-web', 'weekly'],
    queryFn: () => truckersApi.getEarningsSummary('weekly'),
  });

  const { data: activeData } = useQuery({
    queryKey: ['trucker-active-load-web'],
    queryFn: () => truckersApi.getLoadHistory({ status: 'in_transit', pageSize: 1 }),
    refetchInterval: 30000,
  });

  const { data: historyData } = useQuery({
    queryKey: ['trucker-history-web'],
    queryFn: () => truckersApi.getLoadHistory({ pageSize: 5 }),
  });

  const profile = profileData?.data;
  const earnings = earningsData?.data;
  const activeLoad = (activeData?.data?.items ?? [])[0] as any;
  const recentLoads = (historyData?.data?.items ?? []) as any[];
  const hasActiveLoad = Boolean(activeLoad);

  // Get GPS coordinates from browser or truck profile
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {
          // Fallback to profile truck coords if browser denies
          if (profile?.trucks?.[0]?.currentLat) {
            setCoords({ lat: profile.trucks[0].currentLat, lng: profile.trucks[0].currentLng });
          }
        },
        { timeout: 5000 },
      );
    }
  }, [profile]);

  // Fetch document alerts for this trucker
  useEffect(() => {
    if (!user?.userId) return;
    fetch(`${TRUCKER_API}/document-alerts`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          const mine = json.data.alerts.find((a: DocAlert) => a.user_id === user.userId);
          setDocAlert(mine ?? null);
        }
      })
      .catch(() => {});
  }, [user?.userId]);

  // Fetch weather at current coords
  useEffect(() => {
    if (!coords) return;
    const fields = 'temperature_2m,wind_speed_10m,weather_code';
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current=${fields}&timezone=auto`)
      .then((r) => r.json())
      .then((json) => {
        const c = json.current;
        setWeather({
          location: 'Current Location',
          temperature: `${c.temperature_2m}°C`,
          windSpeed: `${c.wind_speed_10m} km/h`,
          condition: '',
          weatherCode: c.weather_code,
          advisory: c.weather_code >= 95 ? 'Thunderstorm — caution advised' :
            c.weather_code >= 61 ? 'Rain — wet roads, reduce speed' :
            c.weather_code >= 45 ? 'Fog — use headlights' :
            c.wind_speed_10m > 60 ? 'Strong winds — caution for heavy trucks' : null,
          isAdverse: c.weather_code >= 45 || c.wind_speed_10m > 50,
        });
      })
      .catch(() => {});
  }, [coords]);

  // Fetch active journey load from journey service
  useEffect(() => {
    fetch(`${TRUCKER_API}/my/active-load`)
      .then((r) => r.json())
      .then((json) => { if (json.success && json.data?.load) setJourneyLoad(json.data.load); })
      .catch(() => {});
  }, []);

  // Fetch backhaul suggestions only when no active load
  useEffect(() => {
    if (hasActiveLoad || !coords) return;
    const url = `${LOAD_API}/backhaul?destLat=${coords.lat}&destLng=${coords.lng}&radiusKm=150`;
    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setBackhaul((json.data.loads ?? []).slice(0, 3));
      })
      .catch(() => {});
  }, [hasActiveLoad, coords]);

  const kycColor = profile?.kycStatus === 'approved' ? 'text-green-600' : 'text-yellow-600';
  const hasDocAlert = docAlert && (docAlert.insurance_alert !== 'ok' || docAlert.permit_alert !== 'ok' || docAlert.fitness_alert !== 'ok');

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome, {user?.fullName?.split(' ')[0]} 👋</h2>
          <p className="text-gray-500 mt-1">Here's your trucking overview</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Weather widget */}
          {weather && (
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border text-sm ${
              weather.isAdverse ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
            }`}>
              <span className="text-xl">{WMO_ICONS[weather.weatherCode] ?? '🌡️'}</span>
              <div>
                <p className="font-semibold text-gray-900 leading-tight">{weather.temperature}</p>
                <p className="text-xs text-gray-500">{weather.windSpeed} wind</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
            <span className="text-yellow-500 text-lg">⭐</span>
            <span className="font-bold text-gray-900">{profile?.rating?.toFixed(1) ?? user?.rating?.toFixed(1) ?? '–'}</span>
            <span className="text-xs text-gray-500">rating</span>
          </div>
        </div>
      </div>

      {/* Weather advisory banner */}
      {weather?.advisory && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-semibold text-amber-800 text-sm">Driving Advisory</p>
            <p className="text-amber-700 text-sm mt-0.5">{weather.advisory}</p>
          </div>
        </div>
      )}

      {/* Document Expiry Alert */}
      {hasDocAlert && docAlert && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📄</span>
            <div className="flex-1">
              <p className="font-semibold text-red-800 text-sm">Document Expiry Alert — {docAlert.registration_no}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <DocAlertBadge alert={docAlert.insurance_alert} label="Insurance" daysLeft={docAlert.insurance_days_left} />
                <DocAlertBadge alert={docAlert.permit_alert} label="Permit" daysLeft={docAlert.permit_days_left} />
                <DocAlertBadge alert={docAlert.fitness_alert} label="Fitness Cert" daysLeft={docAlert.fitness_days_left} />
              </div>
              <p className="text-xs text-red-600 mt-2">Renew immediately to avoid penalty or vehicle detention by RTO.</p>
            </div>
          </div>
        </div>
      )}

      {/* Active Load Banner — from journey API (preferred) or fallback to query */}
      {(journeyLoad || activeLoad) && (
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-5 mb-6 text-white shadow-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">🚛 Active Load</p>
              <p className="text-xl font-bold leading-tight">
                {journeyLoad
                  ? `${journeyLoad.origin_city} → ${journeyLoad.dest_city}`
                  : `${activeLoad.origin?.city} → ${activeLoad.destination?.city}`}
              </p>
              <p className="text-sm opacity-80 mt-1">
                {journeyLoad
                  ? `${journeyLoad.status?.replace('_', ' ')} · ${journeyLoad.cargo_type} · ${journeyLoad.cargo_weight_kg?.toLocaleString('en-IN')} kg`
                  : `In transit · ID: ${activeLoad.loadId?.slice(0, 8)}`}
              </p>
              <p className="text-lg font-semibold mt-2 opacity-95">
                ₹{(journeyLoad?.agreed_price || activeLoad?.pricing?.netTruckerEarning || 0).toLocaleString('en-IN')}
              </p>
            </div>
            <Link
              to="/trucker/journey"
              className="bg-white text-orange-600 font-bold px-4 py-3 rounded-xl text-sm hover:bg-orange-50 transition-colors ml-4 whitespace-nowrap shadow-md"
            >
              View Journey →
            </Link>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Deliveries"
          value={String(profile?.totalLoadsCompleted ?? profile?.completedLoads ?? 0)}
        />
        <StatCard
          label="Weekly Earnings"
          value={formatCurrency(earnings?.netPayout ?? 0)}
          sub="Net after commission"
          color="text-green-600"
        />
        <StatCard
          label="Commission Paid"
          value={formatCurrency(earnings?.platformCommission ?? 0)}
          sub="This week"
          color="text-red-500"
        />
        <StatCard
          label="KYC Status"
          value={profile?.kycStatus === 'approved' ? 'Verified ✓' : (profile?.kycStatus ?? 'Pending')}
          color={kycColor}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Link to="/trucker/loads" className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow text-center">
          <div className="text-3xl mb-2">🔍</div>
          <p className="font-semibold text-gray-900">Find Loads</p>
          <p className="text-xs text-gray-500 mt-1">Browse available loads</p>
        </Link>
        <Link to="/trucker/earnings" className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow text-center">
          <div className="text-3xl mb-2">💰</div>
          <p className="font-semibold text-gray-900">My Earnings</p>
          <p className="text-xs text-gray-500 mt-1">View payouts & history</p>
        </Link>
        <Link to="/trucker/profile" className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow text-center">
          <div className="text-3xl mb-2">🚛</div>
          <p className="font-semibold text-gray-900">My Profile</p>
          <p className="text-xs text-gray-500 mt-1">Trucks & availability</p>
        </Link>
      </div>

      {/* Backhaul / Return Trip Suggestions */}
      {!hasActiveLoad && backhaul.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">↩️ Return Trip Loads Near You</h3>
              <p className="text-xs text-gray-400 mt-0.5">Don't go back empty — earn on the way home</p>
            </div>
            <Link to="/trucker/loads?tab=return" className="text-orange-500 text-sm hover:underline">
              See all →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {backhaul.map((load) => (
              <div key={load.load_id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-gray-900">
                    {load.origin_city} → {load.dest_city}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {load.distance_km?.toFixed(0)} km · Pickup {load.pickup_dist_km?.toFixed(0)} km from you
                  </p>
                  <p className="text-xs text-gray-500 capitalize">{load.cargo_type} · {load.cargo_weight_kg} kg</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-orange-500">₹{load.agreed_price?.toLocaleString('en-IN')}</p>
                  <Link
                    to="/trucker/loads?tab=return"
                    className="text-xs text-blue-500 hover:underline mt-1 block"
                  >
                    View details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No active load — prompt to find loads */}
      {!hasActiveLoad && backhaul.length === 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-5 mb-8 flex items-center gap-4">
          <span className="text-4xl">🚛</span>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">No active load</p>
            <p className="text-sm text-gray-600 mt-0.5">Search for loads near you or browse return trips to earn on the way back.</p>
          </div>
          <Link
            to="/trucker/loads"
            className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors whitespace-nowrap"
          >
            Find Loads
          </Link>
        </div>
      )}

      {/* Recent Deliveries */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Recent Activity</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {recentLoads.map((load: any) => (
            <div key={load.loadId} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-gray-900 text-sm">
                  {load.origin?.city} → {load.destination?.city}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(load.createdAt).toLocaleDateString('en-IN')} · {load.distanceKm ? `${Math.round(load.distanceKm)} km` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-green-600">
                  {formatCurrency(load.pricing?.netTruckerEarning ?? load.pricing?.agreedPrice ?? 0)}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  load.status === 'delivered'  ? 'bg-green-100 text-green-700' :
                  load.status === 'in_transit' ? 'bg-blue-100 text-blue-700' :
                  load.status === 'accepted'   ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{load.status?.replace('_', ' ')}</span>
              </div>
            </div>
          ))}
          {recentLoads.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              <p className="text-4xl mb-2">📦</p>
              <p>No deliveries yet.</p>
              <Link to="/trucker/loads" className="text-orange-500 hover:underline text-sm">Find your first load</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
