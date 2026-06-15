import { useState, useEffect, useRef, useCallback, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { useAuthStore } from '@truck-platform/state';

const TRUCKER_API = 'http://192.168.8.101:3002/api/v1/truckers';
const HIGHWAY_API = 'http://192.168.8.101:3002/api/v1/highway';
const LOADER_API  = 'http://192.168.8.101:3002/api/v1/loader-cos';
const OSRM        = 'https://router.project-osrm.org/route/v1/driving';
const OVERPASS    = 'https://overpass-api.de/api/interpreter';
const MAP_TILES   = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const MAP_ATTR    = '© <a href="https://carto.com/">CartoDB</a> © <a href="https://openstreetmap.org">OSM</a>';

// ── Route utilities ──────────────────────────────────────────────────────────

interface NavStep {
  distanceKm: number;
  cumulativeKm: number;
  name: string;
  maneuverType: string;
  maneuverModifier: string;
  instruction: string;
  maneuverLat: number;
  maneuverLng: number;
}

function buildNavInstruction(type: string, modifier: string, name: string): string {
  const road = name ? ` onto ${name}` : '';
  const m = modifier || '';
  if (type === 'depart') return name ? `Head${road}` : 'Depart';
  if (type === 'arrive') return 'Arrive at destination';
  if (type === 'roundabout' || type === 'rotary') return `Enter roundabout${road}`;
  if (type === 'fork') return m.includes('right') ? `Keep right${road}` : `Keep left${road}`;
  if (type === 'merge') return `Merge${road}`;
  if (type === 'on ramp') return `Take ramp${road}`;
  if (type === 'off ramp') return `Take exit${road}`;
  if (type === 'end of road') return m.includes('right') ? `Turn right${road}` : `Turn left${road}`;
  const dirMap: Record<string, string> = {
    left: 'Turn left', right: 'Turn right',
    'slight left': 'Keep left', 'slight right': 'Keep right',
    'sharp left': 'Sharp left', 'sharp right': 'Sharp right',
    uturn: 'Make U-turn',
  };
  if (m && dirMap[m]) return `${dirMap[m]}${road}`;
  return name ? `Continue on ${name}` : 'Continue straight';
}

function getManeuverDisplay(type: string, modifier: string): { symbol: string; bg: string; label: string } {
  if (type === 'arrive') return { symbol: '🏁', bg: '#22c55e', label: 'Arrived' };
  if (type === 'depart') return { symbol: '↑', bg: '#22c55e', label: 'Start' };
  if (type === 'roundabout' || type === 'rotary') return { symbol: '↺', bg: '#8b5cf6', label: 'Roundabout' };
  const m = modifier || 'straight';
  if (m === 'left') return { symbol: '←', bg: '#2563eb', label: 'Turn Left' };
  if (m === 'right') return { symbol: '→', bg: '#2563eb', label: 'Turn Right' };
  if (m === 'slight left') return { symbol: '↖', bg: '#0284c7', label: 'Slight Left' };
  if (m === 'slight right') return { symbol: '↗', bg: '#0284c7', label: 'Slight Right' };
  if (m === 'sharp left') return { symbol: '↙', bg: '#dc2626', label: 'Sharp Left' };
  if (m === 'sharp right') return { symbol: '↘', bg: '#dc2626', label: 'Sharp Right' };
  if (m === 'uturn') return { symbol: '↩', bg: '#dc2626', label: 'U-Turn' };
  return { symbol: '↑', bg: '#f97316', label: 'Continue' };
}

interface POIItem {
  lat: number;
  lng: number;
  type: 'fuel' | 'food' | 'rest' | 'mechanic' | 'tyre' | 'loader' | 'merchant';
  name: string;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function polylineTotalKm(coords: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += haversineKm(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
  }
  return total;
}

function positionAlongPolyline(
  coords: [number, number][],
  targetKm: number,
  totalKm: number,
): { pos: [number, number]; remainingKm: number; arrived: boolean } {
  if (!coords.length) return { pos: [0, 0], remainingKm: 0, arrived: true };
  if (targetKm >= totalKm) return { pos: coords[coords.length - 1], remainingKm: 0, arrived: true };
  let accumulated = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const seg = haversineKm(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
    if (accumulated + seg >= targetKm) {
      const ratio = seg > 0 ? (targetKm - accumulated) / seg : 0;
      const pos: [number, number] = [
        coords[i][0] + ratio * (coords[i + 1][0] - coords[i][0]),
        coords[i][1] + ratio * (coords[i + 1][1] - coords[i][1]),
      ];
      return { pos, remainingKm: Math.max(0, totalKm - targetKm), arrived: false };
    }
    accumulated += seg;
  }
  return { pos: coords[coords.length - 1], remainingKm: 0, arrived: true };
}

// ── Domain helpers ────────────────────────────────────────────────────────────

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

// ── Interfaces ────────────────────────────────────────────────────────────────

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

const POI_ICONS: Record<POIItem['type'], { bg: string; emoji: string; label: string }> = {
  fuel:     { bg: '#fbbf24', emoji: '⛽', label: 'Fuel' },
  food:     { bg: '#22c55e', emoji: '🍽️', label: 'Dhaba' },
  rest:     { bg: '#3b82f6', emoji: '🛌', label: 'Rest' },
  mechanic: { bg: '#6b7280', emoji: '🔧', label: 'Repair' },
  tyre:     { bg: '#8b5cf6', emoji: '🚗', label: 'Tyre' },
  loader:   { bg: '#f97316', emoji: '📦', label: 'Loader' },
  merchant: { bg: '#14b8a6', emoji: '🏪', label: 'Merchant' },
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function JourneyPage() {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const userId = user?.userId || user?.user_id || localStorage.getItem('user_id') || localStorage.getItem('userId') || '';
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const routeLayer = useRef<any>(null);

  // Route state
  const routePolyline = useRef<[number, number][]>([]);
  const routeKmTraveled = useRef<number>(0);
  const routeTotalKm = useRef<number>(0);
  const navSteps = useRef<NavStep[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  const [load, setLoad] = useState<ActiveLoad | null>(null);
  const [journey, setJourney] = useState<JourneyLog | null>(null);
  const [fuelStops, setFuelStops] = useState<FuelStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapTilesOk, setMapTilesOk] = useState(true);
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
  const [nearbyFuel, setNearbyFuel] = useState<{ lat: number; lng: number; name: string }[]>([]); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [osrmRoute, setOsrmRoute] = useState<{ distKm: number; durationSec: number } | null>(null);
  const [pois, setPois] = useState<POIItem[]>([]);
  const [truckPos, setTruckPos] = useState<[number, number] | null>(null);
  const [showPhoneMode, setShowPhoneMode] = useState(false);

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

  // Simulation state
  const [simDriving, setSimDriving] = useState(false);
  const [simStep, setSimStep] = useState(1);
  const [simIntervalSec, setSimIntervalSec] = useState(60);
  const [simLog, setSimLog] = useState<{ msg: string; ok: boolean }[]>([]);
  const [simRemaining, setSimRemaining] = useState<number | null>(null);
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simTruckMarker = useRef<any>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Simulation ─────────────────────────────────────────────────────────────

  const doSimStep = useCallback(async (step: number) => {
    if (!userId) return;
    try {
      let bodyPayload: Record<string, number | string> = { stepKm: step };
      let newPos: [number, number] | null = null;
      let remaining = 0;
      let arrivedNow = false;

      if (routePolyline.current.length > 1) {
        // Advance along the real road polyline
        routeKmTraveled.current = Math.min(
          routeKmTraveled.current + step,
          routeTotalKm.current
        );
        const result = positionAlongPolyline(
          routePolyline.current,
          routeKmTraveled.current,
          routeTotalKm.current
        );
        newPos = result.pos;
        remaining = result.remainingKm;
        arrivedNow = result.arrived;
        bodyPayload = { ...bodyPayload, newLat: newPos[0], newLng: newPos[1] };

        // Advance to the correct nav step
        const ns = navSteps.current;
        if (ns.length > 0) {
          let nsi = ns.findIndex(s => s.cumulativeKm >= routeKmTraveled.current);
          if (nsi < 0) nsi = ns.length - 1;
          setCurrentStepIdx(nsi);
        }
      }

      // Call backend to persist position
      const res = await fetch(`${TRUCKER_API}/advance-drive/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || 'Failed');

      // If no polyline, use backend-computed position
      if (!newPos) {
        const d = json.data;
        newPos = [d.newLat, d.newLng];
        remaining = parseFloat(d.remainingKm);
        arrivedNow = d.arrived;
      }

      setTruckPos(newPos);
      setSimRemaining(parseFloat(remaining.toFixed(1)));
      setSimLog(prev => [
        { msg: `📍 +${step} km → (${newPos![0].toFixed(3)}, ${newPos![1].toFixed(3)}) · ${remaining.toFixed(1)} km left`, ok: true },
        ...prev.slice(0, 7),
      ]);

      // Update truck marker on main map
      const L = (window as any).L;
      const map = mapInstance.current;
      if (L && map && newPos) {
        const truckIcon = L.divIcon({
          className: '',
          html: `<div style="font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">🚛</div>`,
          iconSize: [32, 32], iconAnchor: [16, 16],
        });
        if (simTruckMarker.current) {
          simTruckMarker.current.setLatLng(newPos);
        } else {
          simTruckMarker.current = L.marker(newPos, { icon: truckIcon })
            .bindTooltip('Your truck', { permanent: false })
            .addTo(map);
        }
      }

      if (arrivedNow) {
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

  useEffect(() => () => { if (simIntervalRef.current) clearInterval(simIntervalRef.current); }, []);

  // ── Data fetch ─────────────────────────────────────────────────────────────

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

  // ── Map init ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!load || typeof window === 'undefined') return;
    const L = (window as any).L;

    const init = () => {
      if (mapInstance.current || !mapRef.current) return;
      const map = (window as any).L.map(mapRef.current).setView(
        [load.origin_lat || 20.59, load.origin_lng || 78.96], 6
      );
      const tileLayer = (window as any).L.tileLayer(MAP_TILES, {
        attribution: MAP_ATTR, maxZoom: 19, subdomains: 'abcd',
      });
      tileLayer.on('tileerror', () => setMapTilesOk(false));
      tileLayer.addTo(map);
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

  // ── Route drawing + POI fetch ──────────────────────────────────────────────

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
      const url = `${OSRM}/${load.origin_lng},${load.origin_lat};${load.dest_lng},${load.dest_lat}?overview=full&geometries=geojson&steps=true`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code === 'Ok' && data.routes?.[0]) {
        const route = data.routes[0];
        const coords: [number, number][] = route.geometry.coordinates.map(
          ([lng, lat]: number[]) => [lat, lng] as [number, number]
        );
        if (routeLayer.current) routeLayer.current.remove();
        routeLayer.current = L.polyline(coords, { color: '#f97316', weight: 5, opacity: 0.85 }).addTo(map);
        map.fitBounds(routeLayer.current.getBounds().pad(0.1));
        setOsrmRoute({ distKm: route.distance / 1000, durationSec: route.duration });

        // Store polyline for on-route simulation
        routePolyline.current = coords;
        routeKmTraveled.current = 0;
        routeTotalKm.current = polylineTotalKm(coords);

        // Parse turn-by-turn navigation steps from OSRM
        let cumKm = 0;
        navSteps.current = (route.legs?.[0]?.steps || []).map((s: any) => {
          const dkm = (s.distance || 0) / 1000;
          cumKm += dkm;
          return {
            distanceKm: dkm,
            cumulativeKm: cumKm,
            name: (s.name || s.ref || '').trim(),
            maneuverType: s.maneuver?.type || 'straight',
            maneuverModifier: s.maneuver?.modifier || 'straight',
            instruction: buildNavInstruction(s.maneuver?.type || '', s.maneuver?.modifier || '', (s.name || s.ref || '').trim()),
            maneuverLat: s.maneuver?.location?.[1] || 0,
            maneuverLng: s.maneuver?.location?.[0] || 0,
          };
        });
        setCurrentStepIdx(0);

        // Fetch all POIs along the full route bounding box
        fetchRoutePOIs(coords);
      }
    } catch { /* ignore */ }
  }, [load, t]);

  // ── POI fetching ───────────────────────────────────────────────────────────

  const fetchRoutePOIs = async (routeCoords: [number, number][]) => {
    if (!routeCoords.length) return;
    const lats = routeCoords.map(c => c[0]);
    const lngs = routeCoords.map(c => c[1]);
    const south = (Math.min(...lats) - 0.3).toFixed(4);
    const west  = (Math.min(...lngs) - 0.3).toFixed(4);
    const north = (Math.max(...lats) + 0.3).toFixed(4);
    const east  = (Math.max(...lngs) + 0.3).toFixed(4);
    const bbox  = `${south},${west},${north},${east}`;

    const overpassQ = `[out:json][timeout:30];(
      node["amenity"="fuel"](${bbox});
      node["amenity"="restaurant"](${bbox});
      node["amenity"="fast_food"](${bbox});
      node["amenity"="dhaba"](${bbox});
      node["amenity"="rest_area"](${bbox});
      node["highway"="rest_area"](${bbox});
      node["amenity"="car_repair"](${bbox});
      node["shop"="tyres"](${bbox});
    );out 80;`;

    try {
      const res  = await fetch(`${OVERPASS}?data=${encodeURIComponent(overpassQ)}`);
      const data = await res.json();

      const osmPOIs: POIItem[] = [];
      const fuelItems: { lat: number; lng: number; name: string }[] = [];

      (data.elements || []).forEach((el: any) => {
        const amenity = el.tags?.amenity || '';
        const shop    = el.tags?.shop || '';
        let type: POIItem['type'] = 'fuel';
        if (['restaurant', 'fast_food', 'dhaba'].includes(amenity)) type = 'food';
        else if (amenity === 'fuel')                                  type = 'fuel';
        else if (amenity === 'rest_area')                             type = 'rest';
        else if (amenity === 'car_repair')                            type = 'mechanic';
        else if (shop === 'tyres')                                    type = 'tyre';

        const name = el.tags?.name || el.tags?.brand || amenity.replace(/_/g, ' ') || 'POI';
        osmPOIs.push({ lat: el.lat, lng: el.lon, type, name });
        if (type === 'fuel') fuelItems.push({ lat: el.lat, lng: el.lon, name });
      });

      // Generate dummy loaders & merchants placed ON the route polyline
      const totalKm = polylineTotalKm(routeCoords);
      const dummyOnRoute: Array<{ pct: number; name: string; type: POIItem['type'] }> = [
        { pct: 0.15, name: 'Reliance Transport Hub', type: 'loader' },
        { pct: 0.32, name: 'Nashik Farm Produce', type: 'merchant' },
        { pct: 0.48, name: 'Maharashtra Cargo Centre', type: 'loader' },
        { pct: 0.63, name: 'Aurangabad Textile Mill', type: 'merchant' },
        { pct: 0.78, name: 'Vidarbha Logistics Park', type: 'loader' },
        { pct: 0.88, name: 'Amravati Cotton Depot', type: 'merchant' },
      ];
      const dummyPOIs: POIItem[] = dummyOnRoute.map(({ pct, name, type }) => {
        const { pos } = positionAlongPolyline(routeCoords, pct * totalKm, totalKm);
        return { lat: pos[0], lng: pos[1], type, name };
      });

      const allPOIs = [...osmPOIs, ...dummyPOIs];
      setNearbyFuel(fuelItems.slice(0, 6));
      setPois(allPOIs);
      renderPOIsOnMap(allPOIs);
    } catch { /* ignore */ }
  };

  const renderPOIsOnMap = (items: POIItem[]) => {
    const L = (window as any).L;
    const map = mapInstance.current;
    if (!L || !map) return;
    items.forEach(poi => {
      const cfg = POI_ICONS[poi.type];
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${cfg.bg};border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 1px 4px rgba(0,0,0,0.3);border:2px solid white">${cfg.emoji}</div>`,
        iconSize: [26, 26], iconAnchor: [13, 13],
      });
      L.marker([poi.lat, poi.lng], { icon }).bindTooltip(poi.name).addTo(map);
    });
  };

  // ── V2 fetchers ────────────────────────────────────────────────────────────

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

  useEffect(() => {
    if (!activeBreak) { setBreakElapsedMins(0); return; }
    setBreakElapsedMins(elapsedMins(activeBreak.startedAt));
    const timer = setInterval(() => setBreakElapsedMins(elapsedMins(activeBreak.startedAt)), 60000);
    return () => clearInterval(timer);
  }, [activeBreak]);

  useEffect(() => {
    if (!detentionInfo?.active || !detentionInfo.startedAt) return;
    const timer = setInterval(() => {
      const mins = Math.floor((Date.now() - new Date(detentionInfo.startedAt!).getTime()) / 60000);
      setDetentionInfo(prev => prev ? { ...prev, minutesElapsed: mins, costSoFar: parseFloat(((mins / 60) * prev.ratePerHour).toFixed(2)) } : prev);
    }, 60000);
    return () => clearInterval(timer);
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

      {/* Phone Mode Popup */}
      {showPhoneMode && (
        <PhoneModeErrorBoundary onClose={() => setShowPhoneMode(false)}>
          <PhoneModeView
            load={load}
            routePolyline={routePolyline.current}
            routeTotalKm={routeTotalKm.current}
            navSteps={navSteps.current}
            currentStepIdx={currentStepIdx}
            pois={pois}
            truckPos={truckPos}
            simDriving={simDriving}
            simRemaining={simRemaining}
            simStep={simStep}
            simIntervalSec={simIntervalSec}
            simLog={simLog}
            onSimStep={setSimStep}
            onSimInterval={setSimIntervalSec}
            onStart={() => startSimDrive(simStep, simIntervalSec)}
            onStop={stopSimDrive}
            onClose={() => setShowPhoneMode(false)}
          />
        </PhoneModeErrorBoundary>
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
        {/* Load Summary */}
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
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              🗺️ {osrmRoute ? t('routeToDestination') : t('loadingMap')}
            </p>
            <button
              onClick={() => setShowPhoneMode(true)}
              className="flex items-center gap-1.5 text-xs bg-orange-500 text-white px-3 py-1.5 rounded-full font-semibold hover:bg-orange-600 transition-colors"
            >
              📱 Driver View
            </button>
          </div>
          <div ref={mapRef} style={{ height: 280 }} />
          {!mapTilesOk && (
            <div className="px-4 py-2 bg-amber-50 border-t border-amber-200">
              <span className="text-amber-600 text-xs">⚠️ Map tiles unavailable offline — route data still correct below</span>
            </div>
          )}
          {/* POI summary strip */}
          {pois.length > 0 && (
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-2">
              {((['fuel', 'food', 'rest', 'mechanic', 'loader', 'merchant'] as POIItem['type'][]).map(type => {
                const count = pois.filter(p => p.type === type).length;
                const cfg = POI_ICONS[type];
                return count > 0 ? (
                  <span key={type} className="text-xs text-gray-600 flex items-center gap-1">
                    {cfg.emoji} <span className="font-semibold">{count}</span> {cfg.label}
                  </span>
                ) : null;
              }))}
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

        {/* Journey Stats */}
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

        {/* Detention Timer */}
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

        {/* ETA Breakdown */}
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

        {/* Simulation Drive Panel */}
        {(isInTransit || isLoading) && (
          <div className={`rounded-2xl border-2 p-4 ${simDriving ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-dashed border-gray-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎮</span>
                <div>
                  <p className="text-sm font-bold text-gray-800">Simulate Drive</p>
                  <p className="text-xs text-gray-500">Move truck along the road route</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {simRemaining != null && (
                  <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                    {simRemaining} km left
                  </span>
                )}
                <button
                  onClick={() => setShowPhoneMode(true)}
                  className="text-xs bg-gray-800 text-white px-2.5 py-1.5 rounded-full font-semibold hover:bg-gray-700"
                >
                  📱
                </button>
              </div>
            </div>

            {!simDriving ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Step per tick</label>
                    <select value={simStep} onChange={e => setSimStep(Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                      <option value={1}>1 km/min — Real</option>
                      <option value={2}>2 km/min</option>
                      <option value={4}>4 km/min</option>
                      <option value={6}>6 km/min</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Interval</label>
                    <select value={simIntervalSec} onChange={e => setSimIntervalSec(Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                      <option value={60}>60s (1/min)</option>
                      <option value={30}>30s (2/min)</option>
                      <option value={10}>10s (fast)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => startSimDrive(simStep, simIntervalSec)}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
                  >
                    ▶ Start Sim
                  </button>
                  <button
                    onClick={() => { startSimDrive(simStep, simIntervalSec); setShowPhoneMode(true); }}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-1"
                  >
                    📱 Phone Mode
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={stopSimDrive}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
                >
                  ⏹ Stop
                </button>
                <button
                  onClick={() => setShowPhoneMode(true)}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-1"
                >
                  📱 Driver View
                </button>
              </div>
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

        {/* Active Break Panel */}
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
            {breakAds.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-purple-700 mb-2">📍 Nearby businesses</p>
                <div className="space-y-2">
                  {breakAds.map((ad) => (
                    <div key={ad.adId} className="bg-white rounded-xl p-3 flex items-center justify-between" onClick={() => handleAdClick(ad.adId)}>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{ad.businessName}</p>
                        <p className="text-xs text-orange-600">{ad.offerText}</p>
                        <p className="text-xs text-gray-400">{ad.adType} · {ad.distanceKm?.toFixed(1)} km away</p>
                      </div>
                      {ad.phone && (
                        <a href={`tel:${ad.phone}`} className="ml-3 bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-xs font-bold" onClick={(e) => e.stopPropagation()}>
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

        {/* Break Suggestions */}
        {isInTransit && !activeBreak && breakSuggestions.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm font-bold text-amber-900 mb-3">💡 Break Suggestions</p>
            <div className="space-y-2">
              {breakSuggestions.map((s, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${s.priority === 'mandatory' ? 'bg-red-50 border-red-200' : 'bg-white border-amber-100'}`}>
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
            <button onClick={() => setShowBreakModal(true)} className="mt-3 w-full bg-amber-500 text-white py-3 rounded-xl text-sm font-bold hover:bg-amber-600">
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
                <button onClick={() => setShowTollModal(true)} className="text-xs bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full font-semibold hover:bg-orange-200 transition-colors">
                  🚧 Log Toll
                </button>
                <button onClick={() => setShowFuelModal(true)} className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-full font-semibold hover:bg-yellow-200 transition-colors">
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
              <button onClick={() => setShowLoadingModal(true)} className="w-full bg-indigo-600 text-white py-5 rounded-2xl text-xl font-bold shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">
                📦 {t('beginLoadingCargo')}
              </button>
            )}
            {isLoading && (
              <button onClick={() => setShowStartModal(true)} className="w-full bg-orange-500 text-white py-5 rounded-2xl text-xl font-bold shadow-lg hover:bg-orange-600 active:scale-95 transition-all">
                🚀 {t('startJourney')}
              </button>
            )}
            {isInTransit && !activeBreak && (
              <>
                <button onClick={() => setShowBreakModal(true)} className="w-full bg-purple-500 text-white py-4 rounded-2xl text-lg font-bold shadow-sm hover:bg-purple-600 active:scale-95 transition-all">
                  ☕ Take a Break
                </button>
                <button onClick={() => setShowDeliverModal(true)} className="w-full bg-green-500 text-white py-5 rounded-2xl text-xl font-bold shadow-lg hover:bg-green-600 active:scale-95 transition-all">
                  ✅ {t('markDelivered')}
                </button>
              </>
            )}
            {isInTransit && activeBreak && (
              <button onClick={handleBreakEnd} disabled={actionLoading} className="w-full bg-gray-700 text-white py-5 rounded-2xl text-xl font-bold shadow-lg hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-50">
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

      {/* Begin Loading Modal */}
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
            <button onClick={handleBeginLoading} disabled={actionLoading} className="w-full bg-indigo-600 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50 hover:bg-indigo-700 transition-colors">
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
          <input type="number" value={startOdo} onChange={e => setStartOdo(e.target.value)} placeholder="e.g. 45230"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base mb-4 focus:outline-none focus:ring-2 focus:ring-orange-500" />
          <button onClick={handleStartJourney} disabled={actionLoading} className="w-full bg-orange-500 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50 hover:bg-orange-600 transition-colors">
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
              <input type="number" value={fuelLiters} onChange={e => setFuelLiters(e.target.value)} placeholder="e.g. 120"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">{t('fuelAmountPaid')} *</label>
              <input type="number" value={fuelCost} onChange={e => setFuelCost(e.target.value)} placeholder="e.g. 11160"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">{t('stationName')}</label>
              <input type="text" value={fuelStation} onChange={e => setFuelStation(e.target.value)} placeholder="e.g. HP Petrol Pump, NH-44"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-yellow-500" />
            </div>
            {fuelLiters && fuelCost && (
              <div className="bg-yellow-50 rounded-xl p-3 text-sm">
                <span className="text-yellow-700 font-medium">₹{(parseFloat(fuelCost) / parseFloat(fuelLiters)).toFixed(1)}{t('perLiter')}</span>
                <span className="text-yellow-600 ml-2 text-xs">(avg diesel ~₹93/L)</span>
              </div>
            )}
            <button onClick={handleLogFuel} disabled={actionLoading || !fuelLiters || !fuelCost}
              className="w-full bg-yellow-500 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50 hover:bg-yellow-600 transition-colors">
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
              <input type="number" value={endOdo} onChange={e => setEndOdo(e.target.value)} placeholder="e.g. 47380"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">{t('tollCost')} actually paid (₹)</label>
              <input type="number" value={actualToll} onChange={e => setActualToll(e.target.value)} placeholder={`e.g. ${toll}`}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-sm text-green-700">
              Earned: ₹{(load.agreed_price || 0).toLocaleString('en-IN')} · Platform fee (5%): ₹{Math.round((load.agreed_price || 0) * 0.05).toLocaleString('en-IN')}
            </div>
            <button onClick={handleDeliver} disabled={actionLoading} className="w-full bg-green-500 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50 hover:bg-green-600 transition-colors">
              {actionLoading ? '⏳' : `✅ ${t('markDelivered')}`}
            </button>
          </div>
        </Modal>
      )}

      {/* Break Modal */}
      {showBreakModal && (
        <Modal title="☕ Start a Break" onClose={() => setShowBreakModal(false)}>
          <p className="text-sm text-gray-500 mb-4">Select break type. Nearby highway businesses will be shown.</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {BREAK_TYPES.map((b) => (
              <button key={b.value} onClick={() => setBreakType(b.value as any)}
                className={`p-3 rounded-xl border-2 text-left transition-colors ${breakType === b.value ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <p className="text-sm font-semibold text-gray-800">{b.label}</p>
                <p className="text-xs text-gray-500">{b.desc}</p>
              </button>
            ))}
          </div>
          <button onClick={handleBreakStart} disabled={actionLoading} className="w-full bg-purple-500 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50 hover:bg-purple-600 transition-colors">
            {actionLoading ? '⏳' : '☕ Start Break'}
          </button>
        </Modal>
      )}

      {/* Toll Modal */}
      {showTollModal && (
        <Modal title="🚧 Log Toll Crossing" onClose={() => setShowTollModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Toll Plaza Name</label>
              <input type="text" value={tollPlaza} onChange={e => setTollPlaza(e.target.value)} placeholder="e.g. Surat Toll Plaza, NH-48"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Amount Paid (₹) *</label>
              <input type="number" value={tollAmount} onChange={e => setTollAmount(e.target.value)} placeholder="e.g. 295"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Payment Method</label>
              <div className="flex gap-3">
                {(['fastag', 'cash'] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setTollPaymentMethod(m)}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${tollPaymentMethod === m ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600'}`}>
                    {m === 'fastag' ? '📡 FASTag' : '💵 Cash'}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleTollLog} disabled={actionLoading || !tollAmount} className="w-full bg-orange-500 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50 hover:bg-orange-600 transition-colors">
              {actionLoading ? '⏳' : '💾 Save Toll'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

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

// ── Phone Mode Driver View ────────────────────────────────────────────────────

interface PhoneModeProps {
  load: ActiveLoad;
  routePolyline: [number, number][];
  routeTotalKm: number;
  navSteps: NavStep[];
  currentStepIdx: number;
  pois: POIItem[];
  truckPos: [number, number] | null;
  simDriving: boolean;
  simRemaining: number | null;
  simStep: number;
  simIntervalSec: number;
  simLog: { msg: string; ok: boolean }[];
  onSimStep: (v: number) => void;
  onSimInterval: (v: number) => void;
  onStart: () => void;
  onStop: () => void;
  onClose: () => void;
}

class PhoneModeErrorBoundary extends Component<{ onClose: () => void; children: ReactNode }, { hasError: boolean; msg: string }> {
  constructor(props: { onClose: () => void; children: ReactNode }) {
    super(props);
    this.state = { hasError: false, msg: '' };
  }
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, msg: err.message || 'Unknown error' };
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('[PhoneMode crash]', err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Driver View failed to load</div>
          <div style={{ color: '#888', fontSize: 12, textAlign: 'center', maxWidth: 280 }}>{this.state.msg}</div>
          <button onClick={this.props.onClose} style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 8 }}>
            ← Back
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PhoneModeView({
  load, routePolyline, routeTotalKm, navSteps, currentStepIdx, pois, truckPos,
  simDriving, simRemaining, simStep, simIntervalSec, simLog,
  onSimStep, onSimInterval, onStart, onStop, onClose,
}: PhoneModeProps) {
  const phoneMapRef = useRef<HTMLDivElement>(null);
  const phoneMapInst = useRef<any>(null);
  const phoneTruckMarker = useRef<any>(null);
  const nextTurnMarker = useRef<any>(null);
  const [now, setNow] = useState(() => new Date());
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Init phone Leaflet map — retry until Leaflet is loaded
  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const initMap = () => {
      if (!phoneMapRef.current) return;
      if (phoneMapInst.current) return; // already initialized
      const L = (window as any).L;
      if (!L) {
        // Leaflet not yet loaded by parent — retry
        retryTimer = setTimeout(initMap, 300);
        return;
      }

      try {
        // Guard against "Map container is already initialized" Leaflet error
        if ((phoneMapRef.current as any)._leaflet_id) {
          return;
        }

        const originLat = parseFloat(String(load.origin_lat)) || 20.59;
        const originLng = parseFloat(String(load.origin_lng)) || 78.96;
        const center: [number, number] = truckPos
          || (routePolyline.length > 0 ? routePolyline[0] : [originLat, originLng]);

        const map = L.map(phoneMapRef.current, { zoomControl: false, attributionControl: false })
          .setView(center, truckPos ? 18 : 10);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          maxZoom: 19, subdomains: 'abcd',
        }).addTo(map);

        if (routePolyline.length > 1) {
          L.polyline(routePolyline, { color: '#f97316', weight: 7, opacity: 0.95 }).addTo(map);
          L.polyline(routePolyline, { color: '#fff', weight: 2, opacity: 0.3, dashArray: '6 12' }).addTo(map);
        }

        L.marker([originLat, originLng], {
          icon: L.divIcon({
            className: '',
            html: '<div style="background:#22c55e;border-radius:50%;width:16px;height:16px;border:3px solid white;box-shadow:0 0 8px rgba(34,197,94,0.9)"></div>',
            iconSize: [16, 16], iconAnchor: [8, 8],
          }),
        }).bindTooltip(`Start: ${load.origin_city}`).addTo(map);

        const destLat = parseFloat(String(load.dest_lat)) || originLat;
        const destLng = parseFloat(String(load.dest_lng)) || originLng;
        L.marker([destLat, destLng], {
          icon: L.divIcon({
            className: '',
            html: `<div style="background:#ef4444;color:white;padding:5px 10px;border-radius:16px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.4)">🏁 ${load.dest_city}</div>`,
            iconAnchor: [0, 20],
          }),
        }).addTo(map);

        const truckStartPos: [number, number] = truckPos
          || (routePolyline.length > 0 ? routePolyline[0] : [originLat, originLng]);
        phoneTruckMarker.current = L.marker(truckStartPos, {
          icon: L.divIcon({
            className: '',
            html: '<div style="font-size:36px;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.6));transform:scale(1.1)">🚛</div>',
            iconSize: [40, 40], iconAnchor: [20, 20],
          }),
          zIndexOffset: 1000,
        }).addTo(map);

        (pois || []).forEach(poi => {
          try {
            const cfg = POI_ICONS[poi.type];
            if (!cfg) return;
            const icon = L.divIcon({
              className: '',
              html: `<div style="background:${cfg.bg};border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.35);border:2px solid white">${cfg.emoji}</div>`,
              iconSize: [28, 28], iconAnchor: [14, 14],
            });
            L.marker([poi.lat, poi.lng], { icon })
              .bindTooltip(`<b>${poi.name || ''}</b>`, { direction: 'top' })
              .addTo(map);
          } catch { /* skip bad POI */ }
        });

        // If truck is already on route show it zoomed in, else show full route overview
        if (truckPos) {
          map.setView(truckPos, 18);
        } else if (routePolyline.length > 1) {
          try { map.fitBounds(L.polyline(routePolyline).getBounds().pad(0.12)); } catch { /* ignore */ }
        }

        phoneMapInst.current = map;
        setTimeout(() => { try { map.invalidateSize(); } catch { /* ignore */ } }, 200);
        setMapReady(true);
      } catch (err: any) {
        setMapError(err?.message || 'Map init failed');
      }
    };

    initMap();
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      try { phoneMapInst.current?.remove(); } catch { /* ignore */ }
      phoneMapInst.current = null;
      phoneTruckMarker.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [mapCentered, setMapCentered] = useState(true);

  const recenterMap = () => {
    if (!truckPos || !phoneMapInst.current) return;
    try { phoneMapInst.current.setView(truckPos, 18, { animate: true, duration: 0.6 }); } catch { /* ignore */ }
    setMapCentered(true);
  };

  // Detect user panning away from truck
  useEffect(() => {
    const map = phoneMapInst.current;
    if (!map) return;
    const onDrag = () => setMapCentered(false);
    try { map.on('dragstart', onDrag); } catch { /* ignore */ }
    return () => { try { map.off('dragstart', onDrag); } catch { /* ignore */ } };
  }, [mapReady]);

  // Zoom to street level the instant simulation starts
  useEffect(() => {
    if (!simDriving || !phoneMapInst.current || !truckPos) return;
    try { phoneMapInst.current.setView(truckPos, 18, { animate: true, duration: 1.0 }); } catch { /* ignore */ }
    setMapCentered(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simDriving]);

  // Follow truck every sim step — only re-center when map isn't being panned by user
  useEffect(() => {
    if (!truckPos || !phoneTruckMarker.current || !phoneMapInst.current) return;
    try {
      phoneTruckMarker.current.setLatLng(truckPos);
      if (simDriving && mapCentered) {
        phoneMapInst.current.setView(truckPos, 18, { animate: true, duration: 0.8 });
      } else if (!simDriving) {
        phoneMapInst.current.panTo(truckPos, { animate: true, duration: 0.6 });
      }
    } catch { /* ignore */ }
  }, [truckPos, simDriving, mapCentered]);

  // ── Derived navigation state ──────────────────────────────────────────────
  const distKm    = Number(load.distance_km) || 0;
  const remKm     = simRemaining != null ? Number(simRemaining) : null;
  const totalKmNum = Number(routeTotalKm) || 0;
  const progressPct = totalKmNum > 0
    ? Math.min(100, ((totalKmNum - (remKm ?? totalKmNum)) / totalKmNum) * 100)
    : 0;

  // Current nav step = the segment the truck is on right now
  const safeIdx    = Math.min(currentStepIdx, Math.max(0, navSteps.length - 1));
  const curNavStep = navSteps.length > 0 ? navSteps[safeIdx] : null;
  // Next step = what we do at the end of the current segment
  const nextNavStep = navSteps.length > safeIdx + 1 ? navSteps[safeIdx + 1] : null;
  const maneuver   = getManeuverDisplay(nextNavStep?.maneuverType || 'arrive', nextNavStep?.maneuverModifier || '');
  const kmTraveled = remKm != null ? Math.max(0, totalKmNum - remKm) : 0;
  const distToTurn = curNavStep ? Math.max(0, curNavStep.cumulativeKm - kmTraveled) : 0;

  const nextFuel = pois.find(p => p.type === 'fuel');
  const nextFood = pois.find(p => p.type === 'food');
  const timeStr  = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const hasNav = navSteps.length > 0;
  const isArrived = nextNavStep?.maneuverType === 'arrive' || (!nextNavStep && safeIdx >= navSteps.length - 1 && (remKm ?? 999) < 2);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(2,6,23,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>

      {/* Back button row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: 360, padding: '0 4px', marginBottom: 10 }}>
        <button onClick={onClose} style={{ background: '#1e293b', color: '#cbd5e1', border: 'none', borderRadius: 24, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          ← Back
        </button>
        <span style={{ color: '#475569', fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>📱 DRIVER VIEW</span>
        <div style={{ width: 80 }} />
      </div>

      {/* Phone frame */}
      <div style={{ width: 360, height: 720, background: '#020617', borderRadius: 48, border: '6px solid #1e293b', boxShadow: '0 0 0 2px #334155, 0 32px 80px rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Status bar */}
        <div style={{ background: '#0f172a', padding: '14px 22px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 800, letterSpacing: 0.3 }}>{timeStr}</span>
          <div style={{ background: '#1e293b', borderRadius: 18, padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13 }}>🚛</span>
            <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700 }}>En Route</span>
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>📶</span>
            <span style={{ color: '#22c55e', fontSize: 12 }}>🔋</span>
          </div>
        </div>

        {/* ── Navigation instruction panel (Google Maps style) ── */}
        <div style={{ background: '#1e3a5f', flexShrink: 0, padding: '14px 16px 12px' }}>
          {hasNav && !isArrived ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Maneuver arrow box */}
              <div style={{
                background: maneuver.bg,
                borderRadius: 16,
                width: 72, height: 72,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: `0 6px 24px ${maneuver.bg}88`,
                border: '3px solid rgba(255,255,255,0.15)',
              }}>
                <span style={{ fontSize: 38, lineHeight: 1, fontWeight: 900, color: '#fff' }}>{maneuver.symbol}</span>
              </div>
              {/* Distance + instruction */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#fff', fontSize: distToTurn < 1 ? 26 : 24, fontWeight: 900, lineHeight: 1, letterSpacing: -0.5 }}>
                  {distToTurn < 0.5
                    ? `${Math.round(distToTurn * 1000)} m`
                    : distToTurn < 1
                    ? `${Math.round(distToTurn * 1000)} m`
                    : `${distToTurn.toFixed(1)} km`}
                </div>
                <div style={{ color: '#93c5fd', fontSize: 13, marginTop: 4, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nextNavStep?.instruction || maneuver.label}
                </div>
                {curNavStep?.name && (
                  <div style={{ color: '#475569', fontSize: 11, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    📍 {curNavStep.name}
                  </div>
                )}
              </div>
            </div>
          ) : isArrived ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ background: '#16a34a', borderRadius: 16, width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, boxShadow: '0 6px 24px rgba(22,163,74,0.5)' }}>🏁</div>
              <div>
                <div style={{ color: '#4ade80', fontSize: 20, fontWeight: 900 }}>Arrived!</div>
                <div style={{ color: '#86efac', fontSize: 13, marginTop: 4 }}>{load.dest_city}</div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ background: '#334155', borderRadius: 16, width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>🗺️</div>
              <div>
                <div style={{ color: '#94a3b8', fontSize: 14, fontWeight: 700 }}>{load.origin_city} → {load.dest_city}</div>
                <div style={{ color: '#475569', fontSize: 12, marginTop: 4 }}>Start the drive to get navigation</div>
              </div>
            </div>
          )}
        </div>

        {/* Map fills remaining space */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <div ref={phoneMapRef} style={{ width: '100%', height: '100%' }} />
          {!mapReady && !mapError && (
            <div style={{ position: 'absolute', inset: 0, background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ fontSize: 36 }}>🗺️</div>
              <div style={{ color: '#475569', fontSize: 12 }}>Loading map…</div>
            </div>
          )}
          {mapError && (
            <div style={{ position: 'absolute', inset: 0, background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20 }}>
              <div style={{ fontSize: 24 }}>⚠️</div>
              <div style={{ color: '#f87171', fontSize: 11, textAlign: 'center' }}>{mapError}</div>
            </div>
          )}
          {/* Speed badge */}
          {simDriving && (
            <div style={{ position: 'absolute', bottom: 12, right: 12, background: '#0f172a', border: '2px solid #1e293b', borderRadius: 12, padding: '6px 12px', textAlign: 'center', zIndex: 800 }}>
              <div style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 900, lineHeight: 1 }}>65</div>
              <div style={{ color: '#64748b', fontSize: 9, fontWeight: 700 }}>km/h</div>
            </div>
          )}
          {/* Recenter button — shown when user has panned away from truck */}
          {!mapCentered && truckPos && (
            <button
              onClick={recenterMap}
              style={{
                position: 'absolute', bottom: simDriving ? 70 : 12, right: 12,
                background: '#1e40af', color: '#fff', border: '2px solid #3b82f6',
                borderRadius: 12, padding: '8px 12px', fontWeight: 800, fontSize: 13,
                cursor: 'pointer', zIndex: 900, display: 'flex', alignItems: 'center', gap: 5,
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              }}
            >
              <span style={{ fontSize: 16 }}>◎</span> Recenter
            </button>
          )}
        </div>

        {/* Route progress bar + ETA strip */}
        <div style={{ background: '#0f172a', borderTop: '1px solid #1e293b', padding: '8px 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ color: '#64748b', fontSize: 11 }}>{load.origin_city}</span>
            <span style={{ color: '#f97316', fontSize: 12, fontWeight: 800 }}>
              {remKm != null ? `${Math.round(remKm)} km left` : `${Math.round(distKm)} km`}
            </span>
            <span style={{ color: '#64748b', fontSize: 11 }}>{load.dest_city}</span>
          </div>
          <div style={{ background: '#1e293b', borderRadius: 4, height: 5, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(90deg,#f97316,#fb923c)', height: '100%', width: `${progressPct.toFixed(1)}%`, borderRadius: 4, transition: 'width 1s ease' }} />
          </div>
        </div>

        {/* Nearby POIs strip */}
        {(nextFuel || nextFood || pois.length > 0) && (
          <div style={{ background: '#0a0f1a', borderTop: '1px solid #1e293b', padding: '6px 14px', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0 }}>
            {nextFuel && (
              <div style={{ background: '#1e293b', borderRadius: 20, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                <span style={{ fontSize: 13 }}>⛽</span>
                <span style={{ color: '#fbbf24', fontSize: 11, fontWeight: 600 }}>{nextFuel.name.slice(0, 14)}</span>
              </div>
            )}
            {nextFood && (
              <div style={{ background: '#1e293b', borderRadius: 20, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                <span style={{ fontSize: 13 }}>🍽️</span>
                <span style={{ color: '#4ade80', fontSize: 11, fontWeight: 600 }}>{nextFood.name.slice(0, 14)}</span>
              </div>
            )}
            {(Object.entries(POI_ICONS) as [POIItem['type'], typeof POI_ICONS[POIItem['type']]][]).map(([type, cfg]) => {
              const count = pois.filter(p => p.type === type).length;
              if (!count) return null;
              return (
                <div key={type} style={{ background: '#1e293b', borderRadius: 20, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 12 }}>{cfg.emoji}</span>
                  <span style={{ color: cfg.bg, fontSize: 10, fontWeight: 700 }}>{count}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Simulation controls */}
        <div style={{ background: '#020617', borderTop: '1px solid #1e293b', padding: '10px 16px 6px', flexShrink: 0 }}>
          {!simDriving ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#475569', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Simulation</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select value={simStep} onChange={e => onSimStep(Number(e.target.value))} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '5px 6px', fontSize: 11, flex: 1 }}>
                    <option value={1}>1 km — Real</option>
                    <option value={2}>2 km/min</option>
                    <option value={4}>4 km/min</option>
                    <option value={6}>6 km/min</option>
                  </select>
                  <select value={simIntervalSec} onChange={e => onSimInterval(Number(e.target.value))} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '5px 6px', fontSize: 11, flex: 1 }}>
                    <option value={60}>60s (real)</option>
                    <option value={30}>30s (2×)</option>
                    <option value={10}>10s (fast)</option>
                  </select>
                </div>
              </div>
              <button onClick={onStart} style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', border: 'none', borderRadius: 20, padding: '12px 22px', fontWeight: 900, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 16px rgba(249,115,22,0.45)', flexShrink: 0 }}>
                ▶ Start
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#4ade80', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, background: '#22c55e', borderRadius: '50%' }} />
                  Navigating — {remKm != null ? `${Math.round(remKm)} km left` : 'en route…'}
                </div>
                {curNavStep?.name && <div style={{ color: '#334155', fontSize: 10, marginTop: 2 }}>on {curNavStep.name}</div>}
              </div>
              <button onClick={onStop} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 20, padding: '12px 22px', fontWeight: 900, fontSize: 15, cursor: 'pointer', flexShrink: 0 }}>
                ⏹ Stop
              </button>
            </div>
          )}
          {/* Home indicator */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
            <div style={{ background: '#1e293b', borderRadius: 3, width: 90, height: 4 }} />
          </div>
        </div>
      </div>

      {/* Sim log below phone frame */}
      {simLog.length > 0 && (
        <div style={{ width: 360, marginTop: 10, background: '#0f172a', borderRadius: 16, padding: '8px 14px', maxHeight: 65, overflowY: 'auto', border: '1px solid #1e293b' }}>
          {simLog.slice(0, 3).map((l, i) => (
            <div key={i} style={{ color: l.ok ? '#4ade80' : '#f87171', fontSize: 10, fontFamily: 'monospace', lineHeight: 1.5 }}>{l.msg}</div>
          ))}
        </div>
      )}
    </div>
  );
}
