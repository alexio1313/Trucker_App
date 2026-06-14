'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

const API_BASE = 'http://192.168.8.101:3002/api/v1/truckers';
const OSRM = 'https://router.project-osrm.org/route/v1/driving';

interface TruckerPosition {
  user_id: string;
  full_name: string;
  phone_number: string;
  rating: number;
  truck_id: string;
  registration_no: string;
  make: string;
  model: string;
  truck_type: string;
  truck_status: string;
  current_lat: number;
  current_lng: number;
  last_location_at: string;
  load_id: string | null;
  origin_city: string | null;
  dest_city: string | null;
  load_status: string | null;
  distance_km: number;
  agreed_price: number;
  load_origin_lat: number | null;
  load_origin_lng: number | null;
  load_dest_lat: number | null;
  load_dest_lng: number | null;
}

const STATUS_COLOR: Record<string, string> = {
  available:   '#22c55e',
  on_load:     '#f97316',
  in_transit:  '#f97316',
  maintenance: '#94a3b8',
  offline:     '#ef4444',
};

const STATUS_LABEL: Record<string, string> = {
  available:   'Available',
  on_load:     'On Load',
  in_transit:  'In Transit',
  maintenance: 'Maintenance',
  offline:     'Offline',
};

function formatEta(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

export default function LiveMapContent() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const clusterGroupRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const [truckers, setTruckers] = useState<TruckerPosition[]>([]);
  const [selected, setSelected] = useState<TruckerPosition | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ etaSeconds: number; distanceKm: number } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/live-positions`);
      const json = await res.json();
      if (json.success) {
        setTruckers(json.data.truckers);
        setUpdatedAt(json.data.updatedAt);
      }
    } catch { /* silently ignore */ }
    finally { setLoading(false); }
  }, []);

  const drawRoute = useCallback(async (truck: TruckerPosition) => {
    const L = (window as any).L;
    const map = mapInstanceRef.current;
    if (!L || !map || !truck.load_dest_lat) return;

    if (routeLayerRef.current) { routeLayerRef.current.remove(); routeLayerRef.current = null; }
    setRouteInfo(null);
    setRouteLoading(true);

    try {
      const url = `${OSRM}/${truck.current_lng},${truck.current_lat};${truck.load_dest_lng},${truck.load_dest_lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code !== 'Ok' || !data.routes?.[0]) throw new Error('No route');

      const route = data.routes[0];
      const coords = route.geometry.coordinates.map(([lng, lat]: number[]) => [lat, lng]);
      const color = STATUS_COLOR[truck.truck_status] || '#f97316';

      const layer = L.polyline(coords, {
        color,
        weight: 4,
        opacity: 0.85,
        dashArray: '8 4',
      }).addTo(map);
      routeLayerRef.current = layer;

      // Fit map to route
      map.fitBounds(layer.getBounds().pad(0.1));
      setRouteInfo({
        etaSeconds: route.duration,
        distanceKm: route.distance / 1000,
      });

      // Add destination marker
      L.marker([truck.load_dest_lat, truck.load_dest_lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="background:#1e293b;color:white;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${truck.dest_city ?? 'Destination'}</div>`,
          iconAnchor: [0, 0],
        }),
      }).addTo(map);
    } catch {
      setRouteInfo(null);
    } finally {
      setRouteLoading(false);
    }
  }, []);

  // Load Leaflet + MarkerCluster CDN
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initMap = () => {
      if (mapInstanceRef.current || !mapRef.current) return;
      const L = (window as any).L;
      if (!L || !L.markerClusterGroup) return;

      const map = L.map(mapRef.current, { zoomControl: true }).setView([20.5937, 78.9629], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      clusterGroupRef.current = L.markerClusterGroup({
        maxClusterRadius: 50,
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount();
          return L.divIcon({
            className: '',
            html: `<div style="
              width:40px;height:40px;border-radius:50%;
              background:#f97316;color:white;
              display:flex;align-items:center;justify-content:center;
              font-weight:700;font-size:14px;
              border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)
            ">${count}</div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          });
        },
      });
      map.addLayer(clusterGroupRef.current);
      mapInstanceRef.current = map;
      setTimeout(() => map.invalidateSize(), 100);
    };

    const loadScript = (src: string, onload?: () => void) => {
      const s = document.createElement('script');
      s.src = src;
      if (onload) s.onload = onload;
      document.head.appendChild(s);
    };
    const loadCss = (href: string) => {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      document.head.appendChild(l);
    };

    if (!(window as any).L) {
      loadCss('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
      loadCss('https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css');
      loadCss('https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css');
      loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', () =>
        loadScript('https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js', initMap)
      );
    } else {
      initMap();
    }
  }, []);

  // Update markers when truckers data changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const L = (window as any).L;
    const cluster = clusterGroupRef.current;
    if (!L || !cluster) return;

    cluster.clearLayers();

    truckers.forEach((t) => {
      if (!t.current_lat || !t.current_lng) return;
      const color = STATUS_COLOR[t.truck_status] || '#94a3b8';
      const isOnLoad = t.load_id && ['on_load', 'in_transit', 'accepted', 'loading'].includes(t.truck_status);

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:36px;height:36px;border-radius:50%;
          background:${color};border:3px solid white;
          box-shadow:0 2px 8px rgba(0,0,0,0.35);
          display:flex;align-items:center;justify-content:center;
          font-size:16px;cursor:pointer;position:relative;
        ">🚛${isOnLoad ? `<span style="position:absolute;top:-4px;right:-4px;width:12px;height:12px;background:#ef4444;border-radius:50%;border:2px solid white"></span>` : ''}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([t.current_lat, t.current_lng], { icon });

      marker.on('click', () => {
        setSelected(t);
        if (t.load_dest_lat) drawRoute(t);
      });

      const popup = `<div style="min-width:180px;font-family:sans-serif;line-height:1.5">
        <strong style="font-size:14px">${t.full_name}</strong><br/>
        <span style="color:#666;font-size:12px">${t.registration_no}</span><br/>
        <span style="display:inline-block;margin:3px 0;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:${color}22;color:${color}">
          ${STATUS_LABEL[t.truck_status] || t.truck_status}
        </span><br/>
        ${t.load_id ? `<span style="font-size:12px">📦 ${t.origin_city} → ${t.dest_city}</span><br/><span style="font-size:12px;color:#22c55e">₹${t.agreed_price?.toLocaleString('en-IN')}</span><br/>` : ''}
        ${t.load_dest_lat ? `<em style="font-size:11px;color:#888">Click for route & ETA</em>` : ''}
      </div>`;

      marker.bindPopup(popup);
      cluster.addLayer(marker);
    });

    // Fit bounds to all markers
    if (truckers.length > 0 && mapInstanceRef.current) {
      try {
        const bounds = cluster.getBounds();
        if (bounds.isValid()) mapInstanceRef.current.fitBounds(bounds.pad(0.15));
      } catch { /* ignore */ }
    }
    setTimeout(() => mapInstanceRef.current?.invalidateSize(), 100);
  }, [truckers, drawRoute]);

  // Auto-clear route when different trucker selected
  useEffect(() => {
    if (!selected && routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
      setRouteInfo(null);
    }
  }, [selected]);

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, 30_000);
    return () => clearInterval(interval);
  }, [fetchPositions]);

  const statusCounts = truckers.reduce<Record<string, number>>((acc, t) => {
    acc[t.truck_status] = (acc[t.truck_status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Live Fleet Map</h2>
            <p className="text-gray-500 text-sm mt-0.5">
              Real-time trucker GPS · refreshes every 30s
              {updatedAt && <span className="ml-2 text-xs text-gray-400">— {new Date(updatedAt).toLocaleTimeString('en-IN')}</span>}
            </p>
          </div>
          <button onClick={fetchPositions} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
            ↻ Refresh
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUS_LABEL).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-50 border border-gray-200 text-sm">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLOR[key] }} />
              <span className="text-gray-700 font-medium">{label}</span>
              <span className="text-gray-500 font-bold">{statusCounts[key] || 0}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-sm">
            <span className="text-orange-700 font-medium">Total:</span>
            <span className="text-orange-900 font-bold">{truckers.length}</span>
          </div>
        </div>
      </div>

      {/* Map + Side Panel */}
      <div className="flex" style={{ height: 'calc(100vh - 148px)' }}>
        {/* Map */}
        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
              <div className="text-center"><div className="text-4xl mb-3">🗺️</div><p className="text-gray-500">Loading fleet positions…</p></div>
            </div>
          )}
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        </div>

        {/* Side Panel */}
        <div className="w-80 bg-white border-l border-gray-100 overflow-y-auto flex flex-col">
          {selected ? (
            <div className="p-5 flex-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Trucker Details</h3>
                <button
                  onClick={() => {
                    setSelected(null);
                    if (routeLayerRef.current) { routeLayerRef.current.remove(); routeLayerRef.current = null; }
                    setRouteInfo(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-lg"
                >✕</button>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-lg font-bold text-gray-900">{selected.full_name}</p>
                  <p className="text-sm text-gray-500">{selected.phone_number}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: (STATUS_COLOR[selected.truck_status] || '#94a3b8') + '22', color: STATUS_COLOR[selected.truck_status] || '#94a3b8' }}>
                      {STATUS_LABEL[selected.truck_status] || selected.truck_status}
                    </span>
                    <span className="text-xs text-gray-400">⭐ {selected.rating?.toFixed(1)}</span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Vehicle</p>
                  <p className="text-sm font-semibold">{selected.registration_no}</p>
                  <p className="text-sm text-gray-600">{selected.make} {selected.model} · {selected.truck_type}</p>
                </div>

                {selected.load_id && (
                  <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                    <p className="text-xs text-orange-500 font-semibold uppercase mb-1">Active Load</p>
                    <p className="text-sm font-bold text-gray-900">{selected.origin_city} → {selected.dest_city}</p>
                    <p className="text-sm text-gray-600">{selected.distance_km?.toFixed(0)} km route</p>
                    <p className="text-sm font-semibold text-green-700">₹{selected.agreed_price?.toLocaleString('en-IN')}</p>
                  </div>
                )}

                {/* Route & ETA */}
                {selected.load_dest_lat && (
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <p className="text-xs text-blue-600 font-semibold uppercase mb-2">Route to Destination</p>
                    {routeLoading && (
                      <div className="flex items-center gap-2 text-sm text-blue-600">
                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        Fetching route via OSRM…
                      </div>
                    )}
                    {!routeLoading && routeInfo && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Distance remaining</span>
                          <span className="font-semibold">{routeInfo.distanceKm.toFixed(0)} km</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">ETA</span>
                          <span className="font-bold text-blue-700">{formatEta(routeInfo.etaSeconds)}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Route shown on map (dashed line)</p>
                      </div>
                    )}
                    {!routeLoading && !routeInfo && (
                      <button onClick={() => drawRoute(selected)} className="text-sm text-blue-600 hover:underline">
                        Show route on map →
                      </button>
                    )}
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 font-semibold uppercase mb-1">GPS</p>
                  <p className="text-xs font-mono text-gray-600">
                    {selected.current_lat?.toFixed(5)}, {selected.current_lng?.toFixed(5)}
                  </p>
                  {selected.last_location_at && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(selected.last_location_at).toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Active Truckers ({truckers.length})
              </p>
              <div className="space-y-2">
                {truckers.map((t) => (
                  <button
                    key={t.user_id}
                    onClick={() => { setSelected(t); if (t.load_dest_lat) drawRoute(t); }}
                    className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-orange-200 hover:bg-orange-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{t.full_name}</p>
                        <p className="text-xs text-gray-400">{t.registration_no}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {t.load_id && <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">On Load</span>}
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLOR[t.truck_status] || '#94a3b8' }} />
                      </div>
                    </div>
                    {t.load_id && (
                      <p className="text-xs text-orange-600 mt-1 truncate">📦 {t.origin_city} → {t.dest_city}</p>
                    )}
                  </button>
                ))}
                {truckers.length === 0 && !loading && (
                  <p className="text-sm text-gray-400 text-center py-8">No truckers with GPS.<br />Run simulation to populate.</p>
                )}
              </div>
            </div>
          )}
          <div className="p-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
            🗺️ Click any truck to see route & ETA · Clusters show nearby trucks
          </div>
        </div>
      </div>
    </div>
  );
}
