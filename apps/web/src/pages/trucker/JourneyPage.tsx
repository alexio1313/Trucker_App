import { useState, useEffect, useRef, useCallback } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { useAuthStore } from '@truck-platform/state';

const TRUCKER_API = 'http://192.168.8.101:3002/api/v1/truckers';
const HIGHWAY_API = 'http://192.168.8.101:3002/api/v1/highway';
const LOADER_API  = 'http://192.168.8.101:3002/api/v1/loader-cos';
const OSRM        = 'https://router.project-osrm.org/route/v1/driving';
const OVERPASS    = 'https://overpass-api.de/api/interpreter';

function getAuthHeaders(userId?: string | null): HeadersInit {
  const uid = userId || localStorage.getItem('user_id') || localStorage.getItem('userId') || '';
  return { 'Content-Type': 'application/json', 'x-user-id': uid };
}

function estimateToll(distKm: number, isHeavy = true): number {
  const booths = Math.round(distKm / 65);
  const perBooth = isHeavy ? 295 : 175;
  return Math.max(0, booths) * perBooth;
}

function estimateFuel(distKm: number): { liters: number; cost: number } {
  const liters = Math.ceil(distKm / 4);
  return { liters, cost: Math.round(liters * 93) };
}

function estimateHours(distKm: number): string {
  const hours = distKm / 55;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

function elapsedMins(isoStr: string): number {
  return Math.floor((Date.now() - new Date(isoStr).getTime()) / 60000);
}

interface ActiveLoad {
  load_id: string;
  origin_city: string;
  dest_city: string;
  origin_address: string;
  dest_address: string;
  origin_lat: number;
  origin_lng: number;
  dest_lat: number;
  dest_lng: number;
  origin_state: string;
  dest_state: string;
  cargo_type: string;
  cargo_weight_kg: number;
  agreed_price: number;
  distance_km: number;
  status: string;
  merchant_name?: string;
  origin_contact_name?: string;
  origin_contact_phone?: string;
  dest_contact_name?: string;
  dest_contact_phone?: string;
}

interface JourneyLog {
  log_id: string;
  journey_status: string;
  start_odometer_km: number | null;
  total_fuel_liters: number | null;
  total_fuel_cost: number | null;
  actual_toll_cost: number | null;
  journey_started_at: string | null;
}

interface FuelStop {
  stop_id: string;
  fuel_liters: number;
  fuel_cost: number;
  odometer_km: number | null;
  fuel_station_name: string | null;
  logged_at: string;
}

interface ETABreakdown {
  newETA: string;
  remainingKm: number;
  delayVsOriginal?: number;
  breakdown: {
    drivingMins: number;
    pendingBreaksMins: number;
    trafficDelayMins: number;
    fatigueMins: number;
  };
}

interface BreakSuggestion {
  type: string;
  reason: string;
  priority: string;
  hoursFromStart?: number;
}

interface ActiveBreakState {
  id: string;
  type: string;
  startedAt: string;
}

interface HighwayAd {
  adId: string;
  businessName: string;
  offerText: string;
  distanceKm: number;
  phone: string;
  adType: string;
}

interface DetentionInfo {
  active: boolean;
  minutesElapsed: number;
  costSoFar: number;
  ratePerHour: number;
  startedAt?: string;
}

const STEP_STATES: Record<string, number> = {
  accepted: 0,
  loading: 1,
  in_transit: 2,
  delivered: 3,
};

const BREAK_TYPES = [
  { value: 'meal', label: '🍽️ Meal Break', desc: 'Food & rest stop' },
  { value: 'rest', label: '😴 Rest Break', desc: 'Driver rest / nap' },
  { value: 'fuel', label: '⛽ Fuel Stop', desc: 'Refuelling + break' },
  { value: 'maintenance', label: '🔧 Maintenance', desc: 'Vehicle check / repair' },
];

export default function JourneyPage() {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const userId = user?.userId || user?.user_id || localStorage.getItem('user_id') || localStorage.getItem('userId') || '';
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const routeLayer = useRef<any>(null);

  const [load, setLoad] = useState<ActiveLoad | null>(null);
  const [journey, setJourney] = useState<JourneyLog | null>(null);
  const [fuelStops, setFuelStops] = useState<FuelStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [showLoadingModal, setShowLoadingModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showDeliverModal, setShowDeliverModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [fuelLiters, setFuelLiters] = useState('');
  const [fuelCost, setFuelCost] = useState('');
  const [fuelStation, setFuelStation] = useState('');
  const [startOdo, setStartOdo] = useState('');
  const [endOdo, setEndOdo] = useState('');
  const [actualToll, setActualToll] = useState('');
  const [nearbyFuel, setNearbyFuel] = useState<{ lat: number; lng: number; name: string }[]>([]);
  const [osrmRoute, setOsrmRoute] = useState<{ distKm: number; durationSec: number } | null>(null);

  // V2 state — ETA, breaks, ads, toll, detention
  const [etaBreakdown, setEtaBreakdown] = useState<ETABreakdown | null>(null);
  const [breakSuggestions, setBreakSuggestions] = useState<BreakSuggestion[]>([]);
  const [activeBreak, setActiveBreak] = useState<ActiveBreakState | null>(null);
  const [breakAds, setBreakAds] = useState<HighwayAd[]>([]);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [breakType, setBreakType] = useState<'meal' | 'rest' | 'fuel' | 'maintenance'>('meal');
  const [showTollModal, setShowTollModal] = useState(false);
  const [tollPlaza, setTollPlaza] = useState('');
  const [tollAmount, setTollAmount] = useState('');
  const [tollPaymentMethod, setTollPaymentMethod] = useState<'fastag' | 'cash'>('fastag');
  const [detentionInfo, setDetentionInfo] = useState<DetentionInfo | null>(null);
  const [breakElapsedMins, setBreakElapsedMins] = useState(0);

  // ── Simulation Drive state ────────────────────────────────────────────────
  const [simDriving, setSimDriving] = useState(false);
  const [simStep, setSimStep] = useState(30);
  const [simIntervalSec, setSimIntervalSec] = useState(4);
  const [simLog, setSimLog] = useState<{ msg: string; ok: boolean }[]>([]);
  const [simRemaining, setSimRemaining] = useState<number | null>(null);
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simTruckMarker = useRef<any>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const doSimStep = useCallback(async (step: number) => {
    if (!userId) return;
    try {
      const res = await fetch(`${TRUCKER_API}/advance-drive/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepKm: step }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || 'Failed');
      const d = json.data;
      const remaining = parseFloat(d.remainingKm);
      setSimRemaining(remaining);
      setSimLog(prev => [
        { msg: `📍 +${step} km → (${d.newLat.toFixed(3)}, ${d.newLng.toFixed(3)}) · ${remaining} km left`, ok: true },
        ...prev.slice(0, 7),
      ]);

      // Update truck marker on Leaflet map
      const L = (window as any).L;
      const map = mapInstance.current;
      if (L && map) {
        const truckIcon = L.divIcon({
          className: '',
          html: `<div style="font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">🚛</div>`,
          iconSize: [32, 32], iconAnchor: [16, 16],
        });
        if (simTruckMarker.current) {
          simTruckMarker.current.setLatLng([d.newLat, d.newLng]);
        } else {
          simTruckMarker.current = L.marker([d.newLat, d.newLng], { icon: truckIcon })
            .bindTooltip('Your truck', { permanent: false })
            .addTo(map);
        }
      }

      if (d.arrived) {
        setSimLog(prev => [{ msg: '✅ Arrived at destination!', ok: true }, ...prev]);
        stopSimDrive();
        fetchData();
      }
    } catch (e: any) {
      setSimLog(prev => [{ msg: `❌ ${e.message}`, ok: false }, ...prev.slice(0, 7)]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const startSimDrive = useCallback((step: number, intervalSec: number) => {
    setSimLog([]);
    setSimDriving(true);
    doSimStep(step);
    simIntervalRef.current = setInterval(() => doSimStep(step), intervalSec * 1000);
  }, [doSimStep]);

  const stopSimDrive = useCallback(() => {
    if (simIntervalRef.current) { clearInterval(simIntervalRef.current); simIntervalRef.current = null; }
    setSimDriving(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { if (simIntervalRef.current) clearInterval(simIntervalRef.current); }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${TRUCKER_API}/my/journey/active-load`, { headers: getAuthHeaders(userId) });
      const json = await res.json();
      if (json.success && json.data.load) {
        setLoad(json.data.load);
        setJourney(json.data.journey || null);
        setFuelStops(json.data.fuelStops || []);
      } else {
        setLoad(null);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Load Leaflet
  useEffect(() => {
    if (!load || typeof window === 'undefined') return;
    const L = (window as any).L;

    const init = () => {
      if (mapInstance.current || !mapRef.current) return;
      const map = (window as any).L.map(mapRef.current).setView(
        [load.origin_lat || 20.59, load.origin_lng || 78.96], 6
      );
      (window as any).L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 18,
      }).addTo(map);
      mapInstance.current = map;
      setTimeout(() => { map.invalidateSize(); drawRoute(map); }, 200);
    };

    if (!L) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = init;
      document.head.appendChild(s);
    } else {
      init();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const drawRoute = useCallback(async (map: any) => {
    if (!load?.origin_lat || !load?.dest_lat) return;
    const L = (window as any).L;
    if (!L || !map) return;

    const pickupIcon = L.divIcon({
      className: '',
      html: `<div style="background:#22c55e;color:white;padding:6px 10px;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.3)">📍 ${t('pickupHere')}</div>`,
      iconAnchor: [10, 30],
    });
    L.marker([load.origin_lat, load.origin_lng], { icon: pickupIcon }).addTo(map);

    const destIcon = L.divIcon({
      className: '',
      html: `<div style="background:#ef4444;color:white;padding:6px 10px;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🏁 ${t('dropHere')}</div>`,
      iconAnchor: [10, 30],
    });
    L.marker([load.dest_lat, load.dest_lng], { icon: destIcon }).addTo(map);

    try {
      const url = `${OSRM}/${load.origin_lng},${load.origin_lat};${load.dest_lng},${load.dest_lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code === 'Ok' && data.routes?.[0]) {
        const route = data.routes[0];
        const coords = route.geometry.coordinates.map(([lng, lat]: number[]) => [lat, lng]);
        if (routeLayer.current) routeLayer.current.remove();
        routeLayer.current = L.polyline(coords, { color: '#f97316', weight: 5, opacity: 0.85 }).addTo(map);
        map.fitBounds(routeLayer.current.getBounds().pad(0.1));
        setOsrmRoute({ distKm: route.distance / 1000, durationSec: route.duration });

        const midIdx = Math.floor(coords.length / 2);
        const [midLat, midLng] = coords[midIdx];
        fetchFuelStations(midLat, midLng);
      }
    } catch { /* ignore */ }
  }, [load, t]);

  const fetchFuelStations = async (lat: number, lng: number) => {
    try {
      const query = `[out:json][timeout:25];node["amenity"="fuel"](around:50000,${lat},${lng});out 6;`;
      const res = await fetch(`${OVERPASS}?data=${encodeURIComponent(query)}`);
      const data = await res.json();
      const stations = (data.elements || []).slice(0, 6).map((el: any) => ({
        lat: el.lat, lng: el.lon,
        name: el.tags?.name || el.tags?.brand || 'Fuel Station',
      }));
      setNearbyFuel(stations);

      const L = (window as any).L;
      const map = mapInstance.current;
      if (L && map) {
        stations.forEach((s: any) => {
          const icon = L.divIcon({
            className: '',
            html: `<div style="background:#fbbf24;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 1px 4px rgba(0,0,0,0.3)">⛽</div>`,
            iconSize: [24, 24], iconAnchor: [12, 12],
          });
          L.marker([s.lat, s.lng], { icon }).bindTooltip(s.name).addTo(map);
        });
      }
    } catch { /* ignore */ }
  };

  // ── V2: ETA & Break fetchers ───────────────────────────────────────────────

  const fetchV2ETA = useCallback(async () => {
    if (!load) return;
    try {
      const res = await fetch(
        `${TRUCKER_API}/my/journey/eta?loadId=${load.load_id}`,
        { headers: getAuthHeaders(userId) }
      );
      const json = await res.json();
      if (json.success && json.data) setEtaBreakdown(json.data);
    } catch { /* ignore */ }
  }, [load, userId]);

  const fetchBreakSuggestions = useCallback(async () => {
    if (!load || !journey?.log_id) return;
    try {
      const res = await fetch(
        `${TRUCKER_API}/my/journey/break-suggestions?journeyLogId=${journey.log_id}`,
        { headers: getAuthHeaders(userId) }
      );
      const json = await res.json();
      if (json.success) setBreakSuggestions(json.data?.suggestions || []);
    } catch { /* ignore */ }
  }, [load, journey, userId]);

  const fetchDetentionStatus = useCallback(async () => {
    if (!load) return;
    try {
      const res = await fetch(
        `${LOADER_API}/jobs/${load.load_id}/detention`,
        { headers: getAuthHeaders(userId) }
      );
      const json = await res.json();
      if (json.success) setDetentionInfo(json.data);
    } catch { /* ignore */ }
  }, [load, userId]);

  const fetchBreakAds = useCallback(async (bType: string, lat?: number, lng?: number) => {
    const driverLat = lat || load?.origin_lat;
    const driverLng = lng || load?.origin_lng;
    if (!driverLat || !driverLng) return;
    try {
      const res = await fetch(`${HIGHWAY_API}/ads/serve`, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({ driverLat, driverLng, breakType: bType }),
      });
      const json = await res.json();
      if (json.success) setBreakAds(json.data?.ads || []);
    } catch { /* ignore */ }
  }, [load, userId]);

  // V2 polling
  useEffect(() => {
    const statusNow = load?.status;
    if (statusNow === 'in_transit') {
      fetchV2ETA();
      fetchBreakSuggestions();
      const timer = setInterval(() => { fetchV2ETA(); fetchBreakSuggestions(); }, 120000);
      return () => clearInterval(timer);
    }
    if (statusNow === 'loading') {
      fetchDetentionStatus();
      const timer = setInterval(fetchDetentionStatus, 30000);
      return () => clearInterval(timer);
    }
  }, [load?.status, fetchV2ETA, fetchBreakSuggestions, fetchDetentionStatus]);

  // Break elapsed timer
  useEffect(() => {
    if (!activeBreak) { setBreakElapsedMins(0); return; }
    setBreakElapsedMins(elapsedMins(activeBreak.startedAt));
    const t = setInterval(() => setBreakElapsedMins(elapsedMins(activeBreak.startedAt)), 60000);
    return () => clearInterval(t);
  }, [activeBreak]);

  // Detention timer update
  useEffect(() => {
    if (!detentionInfo?.active || !detentionInfo.startedAt) return;
    const t = setInterval(() => {
      const mins = Math.floor((Date.now() - new Date(detentionInfo.startedAt!).getTime()) / 60000);
      setDetentionInfo(prev => prev ? { ...prev, minutesElapsed: mins, costSoFar: parseFloat(((mins / 60) * prev.ratePerHour).toFixed(2)) } : prev);
    }, 60000);
    return () => clearInterval(t);
  }, [detentionInfo?.active, detentionInfo?.startedAt]);

  // ── Action Handlers ────────────────────────────────────────────────────────

  const handleBeginLoading = async () => {
    if (!load) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${TRUCKER_API}/my/journey/begin-loading`, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({ loadId: load.load_id }),
      });
      const json = await res.json();
      if (json.success) { showToast('Arrived at pickup — loading cargo'); setShowLoadingModal(false); fetchData(); }
      else showToast(json.error?.message || t('error'), false);
    } catch { showToast(t('error'), false); }
    finally { setActionLoading(false); }
  };

  const handleStartJourney = async () => {
    if (!load) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${TRUCKER_API}/my/journey/start`, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({ loadId: load.load_id, startOdometerKm: parseFloat(startOdo) || null }),
      });
      const json = await res.json();
      if (json.success) { showToast(t('journeyStarted')); setShowStartModal(false); fetchData(); }
      else showToast(json.error?.message || t('error'), false);
    } catch { showToast(t('error'), false); }
    finally { setActionLoading(false); }
  };

  const handleLogFuel = async () => {
    if (!load || !fuelLiters || !fuelCost) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${TRUCKER_API}/my/journey/fuel-stop`, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({
          loadId: load.load_id,
          fuelLiters: parseFloat(fuelLiters),
          fuelCost: parseFloat(fuelCost),
          odometerKm: null,
          stationName: fuelStation || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(t('fuelStopSaved'));
        setShowFuelModal(false);
        setFuelLiters(''); setFuelCost(''); setFuelStation('');
        fetchData();
      } else showToast(json.error?.message || t('error'), false);
    } catch { showToast(t('error'), false); }
    finally { setActionLoading(false); }
  };

  const handleDeliver = async () => {
    if (!load) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${TRUCKER_API}/my/journey/deliver`, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({
          loadId: load.load_id,
          endOdometerKm: parseFloat(endOdo) || null,
          actualTollCost: parseFloat(actualToll) || null,
        }),
      });
      const json = await res.json();
      if (json.success) { showToast(t('journeyCompleted')); setShowDeliverModal(false); fetchData(); }
      else showToast(json.error?.message || t('error'), false);
    } catch { showToast(t('error'), false); }
    finally { setActionLoading(false); }
  };

  const handleBreakStart = async () => {
    if (!load || !journey?.log_id) return;
    setActionLoading(true);
    try {
      let lat = load.origin_lat, lng = load.origin_lng;
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => { lat = pos.coords.latitude; lng = pos.coords.longitude; resolve(); },
            () => resolve(), { timeout: 4000 }
          );
        });
      }
      const res = await fetch(`${TRUCKER_API}/my/journey/break-start`, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({ journeyLogId: journey.log_id, breakType, locationName: `${breakType} break` }),
      });
      const json = await res.json();
      if (json.success) {
        const bid = json.data?.break_id || json.data?.breakId || json.data?.id;
        setActiveBreak({ id: bid, type: breakType, startedAt: new Date().toISOString() });
        setShowBreakModal(false);
        showToast(`Break started — ${breakType}`);
        fetchBreakAds(breakType, lat, lng);
      } else showToast(json.error?.message || t('error'), false);
    } catch { showToast(t('error'), false); }
    finally { setActionLoading(false); }
  };

  const handleBreakEnd = async () => {
    if (!activeBreak) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${TRUCKER_API}/my/journey/break-end`, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({ breakId: activeBreak.id }),
      });
      const json = await res.json();
      if (json.success) {
        setActiveBreak(null);
        setBreakAds([]);
        setBreakSuggestions([]);
        showToast('Break ended — drive safely!');
        fetchV2ETA();
        fetchBreakSuggestions();
      } else showToast(json.error?.message || t('error'), false);
    } catch { showToast(t('error'), false); }
    finally { setActionLoading(false); }
  };

  const handleTollLog = async () => {
    if (!load || !tollAmount) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${TRUCKER_API}/my/journey/toll`, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({
          loadId: load.load_id,
          plazaName: tollPlaza || 'Toll Plaza',
          amount: parseFloat(tollAmount),
          paymentMethod: tollPaymentMethod,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Toll ₹${tollAmount} logged`);
        setShowTollModal(false);
        setTollPlaza(''); setTollAmount('');
        fetchData();
      } else showToast(json.error?.message || t('error'), false);
    } catch { showToast(t('error'), false); }
    finally { setActionLoading(false); }
  };

  const handleAdClick = async (adId: string) => {
    try {
      await fetch(`${HIGHWAY_API}/ads/${adId}/click`, { method: 'POST', headers: getAuthHeaders(userId) });
    } catch { /* ignore */ }
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const dist = osrmRoute?.distKm || parseFloat(String(load?.distance_km || 0));
  const toll = estimateToll(dist);
  const fuel = estimateFuel(dist);
  const netEarnings = (load?.agreed_price || 0) - toll - fuel.cost;
  const currentStep = STEP_STATES[load?.status || ''] ?? 0;
  const journeyStatus = journey?.journey_status || 'not_started';
  const isAccepted  = load?.status === 'accepted';
  const isLoading   = load?.status === 'loading';
  const isInTransit = load?.status === 'in_transit';
  const isDelivered = load?.status === 'delivered';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-5xl mb-4">🚛</div>
          <p className="text-gray-500">{t('loadingMap')}</p>
        </div>
      </div>
    );
  }

  if (!load) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">📦</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('noActiveLoad')}</h2>
          <p className="text-gray-500 mb-6">{t('findLoadsNow')}</p>
          <a href="/trucker/loads" className="bg-orange-500 text-white px-8 py-3 rounded-xl font-bold text-lg hover:bg-orange-600 transition-colors inline-block">
            {t('findLoads')} →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg font-semibold text-white text-sm transition-all ${toast.ok ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.ok ? '✓' : '✗'} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t('journeyTitle')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{load.origin_city} → {load.dest_city}</p>
          </div>
          <span className={`text-sm px-3 py-1.5 rounded-full font-bold ${
            isDelivered ? 'bg-green-100 text-green-700' :
            isInTransit ? 'bg-orange-100 text-orange-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {t(isDelivered ? 'statusDelivered' : isInTransit ? 'statusInTransit' : 'statusAccepted')}
          </span>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center mt-4 gap-0">
          {[t('stepPickup'), t('stepLoading'), t('stepDriving'), t('stepDeliver')].map((step, i) => (
            <div key={i} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                  i < currentStep ? 'bg-green-500 border-green-500 text-white' :
                  i === currentStep ? 'bg-orange-500 border-orange-500 text-white' :
                  'bg-gray-100 border-gray-200 text-gray-400'
                }`}>
                  {i < currentStep ? '✓' : i + 1}
                </div>
                <span className={`text-xs mt-1 text-center leading-tight ${i <= currentStep ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                  {step}
                </span>
              </div>
              {i < 3 && <div className={`h-0.5 w-6 mt-[-16px] ${i < currentStep ? 'bg-green-400' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Load Summary Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold mb-1">{t('cargo')}</p>
              <p className="text-lg font-bold text-gray-900 capitalize">{load.cargo_type}</p>
              <p className="text-sm text-gray-500">{load.cargo_weight_kg?.toLocaleString('en-IN')} kg</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase font-semibold mb-1">{t('price')}</p>
              <p className="text-2xl font-bold text-green-600">₹{(load.agreed_price || 0).toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-xl p-3">
              <p className="text-xs text-green-600 font-semibold mb-1">📍 {t('pickupLocation')}</p>
              <p className="text-sm font-bold text-gray-900">{load.origin_city}</p>
              <p className="text-xs text-gray-500">{load.origin_state}</p>
              {load.origin_address && <p className="text-xs text-gray-400 mt-1 truncate">{load.origin_address}</p>}
              {load.origin_contact_name && (
                <p className="text-xs text-blue-600 mt-1">📞 {load.origin_contact_name}: {load.origin_contact_phone}</p>
              )}
            </div>
            <div className="bg-red-50 rounded-xl p-3">
              <p className="text-xs text-red-600 font-semibold mb-1">🏁 {t('destination')}</p>
              <p className="text-sm font-bold text-gray-900">{load.dest_city}</p>
              <p className="text-xs text-gray-500">{load.dest_state}</p>
              {load.dest_address && <p className="text-xs text-gray-400 mt-1 truncate">{load.dest_address}</p>}
              {load.dest_contact_name && (
                <p className="text-xs text-blue-600 mt-1">📞 {load.dest_contact_name}: {load.dest_contact_phone}</p>
              )}
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <p className="px-4 py-3 text-sm font-semibold text-gray-700 border-b border-gray-50">
            🗺️ {osrmRoute ? t('routeToDestination') : t('loadingMap')}
          </p>
          <div ref={mapRef} style={{ height: 280 }} />
          {nearbyFuel.length > 0 && (
            <div className="px-4 py-2 bg-yellow-50 border-t border-yellow-100">
              <p className="text-xs text-yellow-700 font-medium">⛽ {t('nearbyFuel')}: {nearbyFuel.slice(0, 3).map(f => f.name).join(' · ')}</p>
            </div>
          )}
        </div>

        {/* Journey Estimates */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm font-bold text-gray-700 mb-3">{t('routeDetails')}</p>
          <div className="grid grid-cols-2 gap-3">
            <InfoCard icon="🛣️" label={t('distance')} value={`${dist.toFixed(0)} ${t('km')}`} color="blue" />
            <InfoCard icon="⏱️" label={t('duration')} value={osrmRoute ? estimateHours(dist) : `${estimateHours(dist)}*`} color="indigo" />
            <InfoCard icon="⛽" label={t('fuelNeeded')} value={`~${fuel.liters} ${t('liters')}`} color="yellow" />
            <InfoCard icon="💰" label={t('fuelCost')} value={`~₹${fuel.cost.toLocaleString('en-IN')}`} color="yellow" />
            <InfoCard icon="🚧" label={t('estimatedToll')} value={`~₹${toll.toLocaleString('en-IN')}`} color="orange" />
            <InfoCard icon="📈" label={t('netEarnings')} value={`₹${Math.max(0, netEarnings).toLocaleString('en-IN')}`} color="green" />
          </div>
          <p className="text-xs text-gray-400 mt-3">ℹ️ {t('tollInfo')}</p>
        </div>

        {/* Journey Stats (if started) */}
        {journey && journeyStatus !== 'not_started' && (
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
            <p className="text-sm font-bold text-orange-800 mb-3">{t('journeyStats')}</p>
            <div className="grid grid-cols-2 gap-3">
              {journey.total_fuel_liters != null && (
                <InfoCard icon="⛽" label={t('totalFuelUsed')} value={`${journey.total_fuel_liters} L`} color="yellow" />
              )}
              {journey.total_fuel_cost != null && (
                <InfoCard icon="💸" label={t('totalFuelCost')} value={`₹${Number(journey.total_fuel_cost).toLocaleString('en-IN')}`} color="yellow" />
              )}
              {journey.actual_toll_cost != null && (
                <InfoCard icon="🚧" label={t('tollsPaid')} value={`₹${Number(journey.actual_toll_cost).toLocaleString('en-IN')}`} color="orange" />
              )}
              {journey.journey_started_at && (
                <div className="col-span-2 text-xs text-orange-700">
                  {t('journeyStarted')}: {new Date(journey.journey_started_at).toLocaleString('en-IN')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── V2: Detention Timer (when loading) ── */}
        {isLoading && detentionInfo && (
          <div className={`rounded-2xl p-4 border ${detentionInfo.active ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-800">⏱️ Detention Timer</p>
              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${detentionInfo.active ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'}`}>
                {detentionInfo.active ? 'RUNNING' : 'NOT STARTED'}
              </span>
            </div>
            {detentionInfo.active ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{detentionInfo.minutesElapsed}</p>
                  <p className="text-xs text-gray-500">minutes</p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">₹{detentionInfo.costSoFar.toFixed(0)}</p>
                  <p className="text-xs text-gray-500">cost so far</p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-600">₹{detentionInfo.ratePerHour}</p>
                  <p className="text-xs text-gray-500">per hour</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Detention starts after 2-hour free grace period from truck arrival.</p>
            )}
          </div>
        )}

        {/* ── V2: ETA Breakdown (when in_transit) ── */}
        {isInTransit && etaBreakdown && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-blue-900">📡 Live ETA Breakdown</p>
              <span className="text-xs text-blue-500">{etaBreakdown.remainingKm?.toFixed(0)} km left</span>
            </div>
            <div className="bg-white rounded-xl px-4 py-3 mb-3">
              <p className="text-xs text-gray-500 mb-1">Estimated Arrival</p>
              <p className="text-lg font-bold text-blue-800">
                {new Date(etaBreakdown.newETA).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                <span className="text-xs font-normal text-gray-500 ml-2">
                  {new Date(etaBreakdown.newETA).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white rounded-xl p-3">
                <p className="text-xs text-gray-500">🚛 Driving</p>
                <p className="text-base font-bold text-gray-800">{etaBreakdown.breakdown.drivingMins} min</p>
              </div>
              <div className="bg-white rounded-xl p-3">
                <p className="text-xs text-gray-500">☕ Pending breaks</p>
                <p className="text-base font-bold text-purple-700">{etaBreakdown.breakdown.pendingBreaksMins} min</p>
              </div>
              <div className="bg-white rounded-xl p-3">
                <p className="text-xs text-gray-500">🚦 Traffic delay</p>
                <p className="text-base font-bold text-orange-600">{etaBreakdown.breakdown.trafficDelayMins} min</p>
              </div>
              <div className="bg-white rounded-xl p-3">
                <p className="text-xs text-gray-500">😴 Fatigue buffer</p>
                <p className="text-base font-bold text-gray-600">{etaBreakdown.breakdown.fatigueMins} min</p>
              </div>
            </div>
            {etaBreakdown.delayVsOriginal != null && etaBreakdown.delayVsOriginal > 0 && (
              <p className="text-xs text-orange-600 mt-2">⚠️ {Math.round(etaBreakdown.delayVsOriginal / 60)} hr behind schedule</p>
            )}
          </div>
        )}

        {/* ── Simulation Drive Panel (only when in_transit or loading) ── */}
        {(isInTransit || isLoading) && (
          <div className={`rounded-2xl border-2 p-4 ${simDriving ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-dashed border-gray-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎮</span>
                <div>
                  <p className="text-sm font-bold text-gray-800">Simulate Drive</p>
                  <p className="text-xs text-gray-500">Move your GPS toward destination for demo</p>
                </div>
              </div>
              {simRemaining != null && (
                <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                  {simRemaining} km left
                </span>
              )}
            </div>

            {!simDriving ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Step per tick</label>
                    <select value={simStep} onChange={e => setSimStep(Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                      {[10, 20, 30, 50, 100].map(v => <option key={v} value={v}>{v} km</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Interval</label>
                    <select value={simIntervalSec} onChange={e => setSimIntervalSec(Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                      {[2, 3, 4, 5, 10].map(v => <option key={v} value={v}>{v}s</option>)}
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => startSimDrive(simStep, simIntervalSec)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
                >
                  ▶ Start Simulation Drive
                </button>
              </div>
            ) : (
              <button
                onClick={stopSimDrive}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm transition-colors mb-3"
              >
                ⏹ Stop Simulation
              </button>
            )}

            {simLog.length > 0 && (
              <div className="mt-2 bg-gray-900 rounded-xl p-3 font-mono text-xs space-y-0.5 max-h-28 overflow-y-auto">
                {simLog.map((l, i) => (
                  <p key={i} className={l.ok ? 'text-green-400' : 'text-red-400'}>{l.msg}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── V2: Active Break Panel ── */}
        {activeBreak && (
          <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-purple-900">
                  {BREAK_TYPES.find(b => b.value === activeBreak.type)?.label || '☕ Break in Progress'}
                </p>
                <p className="text-xs text-purple-600">{breakElapsedMins} min elapsed</p>
              </div>
              <button
                onClick={handleBreakEnd}
                disabled={actionLoading}
                className="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-purple-700 disabled:opacity-50"
              >
                {actionLoading ? '⏳' : '▶ End Break'}
              </button>
            </div>

            {/* Highway business ads during break */}
            {breakAds.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-purple-700 mb-2">📍 Nearby businesses</p>
                <div className="space-y-2">
                  {breakAds.map((ad) => (
                    <div
                      key={ad.adId}
                      className="bg-white rounded-xl p-3 flex items-center justify-between"
                      onClick={() => handleAdClick(ad.adId)}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{ad.businessName}</p>
                        <p className="text-xs text-orange-600">{ad.offerText}</p>
                        <p className="text-xs text-gray-400">{ad.adType} · {ad.distanceKm?.toFixed(1)} km away</p>
                      </div>
                      {ad.phone && (
                        <a
                          href={`tel:${ad.phone}`}
                          className="ml-3 bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-xs font-bold"
                          onClick={(e) => e.stopPropagation()}
                        >
                          📞 Call
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {breakAds.length === 0 && (
              <p className="text-xs text-purple-400 text-center py-2">No nearby businesses found along your route.</p>
            )}
          </div>
        )}

        {/* ── V2: Break Suggestions (when in_transit & no active break) ── */}
        {isInTransit && !activeBreak && breakSuggestions.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm font-bold text-amber-900 mb-3">💡 Break Suggestions</p>
            <div className="space-y-2">
              {breakSuggestions.map((s, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${
                  s.priority === 'mandatory' ? 'bg-red-50 border-red-200' : 'bg-white border-amber-100'
                }`}>
                  <span className="text-lg">{s.type === 'meal' ? '🍽️' : s.type === 'rest' ? '😴' : '☕'}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800 capitalize">{s.type} break</p>
                    <p className="text-xs text-gray-600">{s.reason}</p>
                  </div>
                  {s.priority === 'mandatory' && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">REQUIRED</span>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowBreakModal(true)}
              className="mt-3 w-full bg-amber-500 text-white py-3 rounded-xl text-sm font-bold hover:bg-amber-600"
            >
              ☕ Take a Break Now
            </button>
          </div>
        )}

        {/* Fuel Stops */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-gray-700">⛽ {t('fuelStops')} ({fuelStops.length})</p>
            {!isDelivered && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowTollModal(true)}
                  className="text-xs bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full font-semibold hover:bg-orange-200 transition-colors"
                >
                  🚧 Log Toll
                </button>
                <button
                  onClick={() => setShowFuelModal(true)}
                  className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-full font-semibold hover:bg-yellow-200 transition-colors"
                >
                  + {t('logFuelStop')}
                </button>
              </div>
            )}
          </div>
          {fuelStops.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">{t('noFuelLogs')}</p>
          ) : (
            <div className="space-y-2">
              {fuelStops.map(fs => (
                <div key={fs.stop_id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{fs.fuel_liters} {t('liters')} · ₹{fs.fuel_cost.toLocaleString('en-IN')}</p>
                    {fs.fuel_station_name && <p className="text-xs text-gray-400">{fs.fuel_station_name}</p>}
                    <p className="text-xs text-gray-400">{new Date(fs.logged_at).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-yellow-600">₹{(fs.fuel_cost / fs.fuel_liters).toFixed(1)}{t('perLiter')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!isDelivered && (
          <div className="space-y-3 pb-6">
            {isAccepted && (
              <button
                onClick={() => setShowLoadingModal(true)}
                className="w-full bg-indigo-600 text-white py-5 rounded-2xl text-xl font-bold shadow-lg hover:bg-indigo-700 active:scale-95 transition-all"
              >
                📦 {t('beginLoadingCargo')}
              </button>
            )}
            {isLoading && (
              <button
                onClick={() => setShowStartModal(true)}
                className="w-full bg-orange-500 text-white py-5 rounded-2xl text-xl font-bold shadow-lg hover:bg-orange-600 active:scale-95 transition-all"
              >
                🚀 {t('startJourney')}
              </button>
            )}
            {isInTransit && !activeBreak && (
              <>
                <button
                  onClick={() => setShowBreakModal(true)}
                  className="w-full bg-purple-500 text-white py-4 rounded-2xl text-lg font-bold shadow-sm hover:bg-purple-600 active:scale-95 transition-all"
                >
                  ☕ Take a Break
                </button>
                <button
                  onClick={() => setShowDeliverModal(true)}
                  className="w-full bg-green-500 text-white py-5 rounded-2xl text-xl font-bold shadow-lg hover:bg-green-600 active:scale-95 transition-all"
                >
                  ✅ {t('markDelivered')}
                </button>
              </>
            )}
            {isInTransit && activeBreak && (
              <button
                onClick={handleBreakEnd}
                disabled={actionLoading}
                className="w-full bg-gray-700 text-white py-5 rounded-2xl text-xl font-bold shadow-lg hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-50"
              >
                {actionLoading ? '⏳' : '▶ End Break — Resume Journey'}
              </button>
            )}
          </div>
        )}

        {isDelivered && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center mb-6">
            <div className="text-5xl mb-3">🎉</div>
            <h3 className="text-xl font-bold text-green-800">{t('journeyCompleted')}</h3>
            <p className="text-green-600 mt-1">₹{(load.agreed_price || 0).toLocaleString('en-IN')} {t('earnings')}</p>
          </div>
        )}
      </div>

      {/* Begin Loading Cargo Modal */}
      {showLoadingModal && (
        <Modal title="📦 Arrived at Pickup Location" onClose={() => setShowLoadingModal(false)}>
          <div className="space-y-4">
            <div className="bg-indigo-50 rounded-xl p-4 text-sm text-indigo-800">
              <p className="font-semibold mb-1">Confirm you are at the pickup site:</p>
              <p>{load?.origin_city} — {load?.origin_address || load?.origin_state}</p>
              {load?.origin_contact_name && (
                <p className="mt-2 text-indigo-600">📞 Contact: {load.origin_contact_name} ({load.origin_contact_phone})</p>
              )}
            </div>
            <p className="text-sm text-gray-600">Tapping below marks this load as <strong>Loading</strong> and notifies the merchant you have arrived.</p>
            <button
              onClick={handleBeginLoading}
              disabled={actionLoading}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50 hover:bg-indigo-700 transition-colors"
            >
              {actionLoading ? '⏳' : '📦 Confirm Arrival & Begin Loading'}
            </button>
          </div>
        </Modal>
      )}

      {/* Start Journey Modal */}
      {showStartModal && (
        <Modal title={`🚀 ${t('startJourney')}`} onClose={() => setShowStartModal(false)}>
          <p className="text-sm text-gray-600 mb-4">{load.origin_city} → {load.dest_city}</p>
          <label className="block text-xs font-semibold text-gray-600 mb-1">{t('odometerReading')} ({t('approx')})</label>
          <input
            type="number"
            value={startOdo}
            onChange={e => setStartOdo(e.target.value)}
            placeholder="e.g. 45230"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base mb-4 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={handleStartJourney}
            disabled={actionLoading}
            className="w-full bg-orange-500 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50 hover:bg-orange-600 transition-colors"
          >
            {actionLoading ? '⏳' : `🚀 ${t('startJourney')}`}
          </button>
        </Modal>
      )}

      {/* Fuel Modal */}
      {showFuelModal && (
        <Modal title={`⛽ ${t('logFuelTitle')}`} onClose={() => setShowFuelModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">{t('fuelLiters')} *</label>
              <input
                type="number"
                value={fuelLiters}
                onChange={e => setFuelLiters(e.target.value)}
                placeholder="e.g. 120"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">{t('fuelAmountPaid')} *</label>
              <input
                type="number"
                value={fuelCost}
                onChange={e => setFuelCost(e.target.value)}
                placeholder="e.g. 11160"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">{t('stationName')}</label>
              <input
                type="text"
                value={fuelStation}
                onChange={e => setFuelStation(e.target.value)}
                placeholder="e.g. HP Petrol Pump, NH-44"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            {fuelLiters && fuelCost && (
              <div className="bg-yellow-50 rounded-xl p-3 text-sm">
                <span className="text-yellow-700 font-medium">
                  ₹{(parseFloat(fuelCost) / parseFloat(fuelLiters)).toFixed(1)}{t('perLiter')}
                </span>
                <span className="text-yellow-600 ml-2 text-xs">(avg diesel ~₹93/L)</span>
              </div>
            )}
            <button
              onClick={handleLogFuel}
              disabled={actionLoading || !fuelLiters || !fuelCost}
              className="w-full bg-yellow-500 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50 hover:bg-yellow-600 transition-colors"
            >
              {actionLoading ? '⏳' : `💾 ${t('save')}`}
            </button>
          </div>
        </Modal>
      )}

      {/* Deliver Modal */}
      {showDeliverModal && (
        <Modal title={`✅ ${t('markDelivered')}`} onClose={() => setShowDeliverModal(false)}>
          <p className="text-sm text-gray-600 mb-4">Confirm delivery to {load.dest_city}?</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">{t('odometerReading')} at delivery</label>
              <input
                type="number"
                value={endOdo}
                onChange={e => setEndOdo(e.target.value)}
                placeholder="e.g. 47380"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">{t('tollCost')} actually paid (₹)</label>
              <input
                type="number"
                value={actualToll}
                onChange={e => setActualToll(e.target.value)}
                placeholder={`e.g. ${toll}`}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-sm text-green-700">
              Earned: ₹{(load.agreed_price || 0).toLocaleString('en-IN')} · Platform fee (5%): ₹{Math.round((load.agreed_price || 0) * 0.05).toLocaleString('en-IN')}
            </div>
            <button
              onClick={handleDeliver}
              disabled={actionLoading}
              className="w-full bg-green-500 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50 hover:bg-green-600 transition-colors"
            >
              {actionLoading ? '⏳' : `✅ ${t('markDelivered')}`}
            </button>
          </div>
        </Modal>
      )}

      {/* ── V2: Break Modal ── */}
      {showBreakModal && (
        <Modal title="☕ Start a Break" onClose={() => setShowBreakModal(false)}>
          <p className="text-sm text-gray-500 mb-4">Select break type. Nearby highway businesses will be shown.</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {BREAK_TYPES.map((b) => (
              <button
                key={b.value}
                onClick={() => setBreakType(b.value as any)}
                className={`p-3 rounded-xl border-2 text-left transition-colors ${
                  breakType === b.value ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="text-sm font-semibold text-gray-800">{b.label}</p>
                <p className="text-xs text-gray-500">{b.desc}</p>
              </button>
            ))}
          </div>
          <button
            onClick={handleBreakStart}
            disabled={actionLoading}
            className="w-full bg-purple-500 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50 hover:bg-purple-600 transition-colors"
          >
            {actionLoading ? '⏳' : '☕ Start Break'}
          </button>
        </Modal>
      )}

      {/* ── V2: Toll Modal ── */}
      {showTollModal && (
        <Modal title="🚧 Log Toll Crossing" onClose={() => setShowTollModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Toll Plaza Name</label>
              <input
                type="text"
                value={tollPlaza}
                onChange={e => setTollPlaza(e.target.value)}
                placeholder="e.g. Surat Toll Plaza, NH-48"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Amount Paid (₹) *</label>
              <input
                type="number"
                value={tollAmount}
                onChange={e => setTollAmount(e.target.value)}
                placeholder="e.g. 295"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Method</label>
              <div className="flex gap-3">
                {(['fastag', 'cash'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTollPaymentMethod(m)}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${
                      tollPaymentMethod === m ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {m === 'fastag' ? '📡 FASTag' : '💵 Cash'}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleTollLog}
              disabled={actionLoading || !tollAmount}
              className="w-full bg-orange-500 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50 hover:bg-orange-600 transition-colors"
            >
              {actionLoading ? '⏳' : '💾 Save Toll'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function InfoCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-900',
    indigo: 'bg-indigo-50 text-indigo-900',
    yellow: 'bg-yellow-50 text-yellow-900',
    orange: 'bg-orange-50 text-orange-900',
    green: 'bg-green-50 text-green-900',
  };
  return (
    <div className={`rounded-xl p-3 ${colorMap[color] || 'bg-gray-50 text-gray-900'}`}>
      <p className="text-xs text-gray-500 mb-0.5">{icon} {label}</p>
      <p className="text-base font-bold">{value}</p>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 sm:items-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
