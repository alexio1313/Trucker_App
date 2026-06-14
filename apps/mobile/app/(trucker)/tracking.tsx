import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Platform, Linking } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loadsApi, truckersApi, trackingApi } from '@truck-platform/api-client';
import { useAuthStore, useTrackingStore } from '@truck-platform/state';
import { colors, fontSize, spacing, borderRadius, shadow } from '@truck-platform/ui-kit';
import { formatCurrency } from '@truck-platform/shared';
import { apiClient } from '../../src/lib/api';

interface LatLng { latitude: number; longitude: number; }

// Fetch a truck-friendly route from OSRM public demo
async function fetchRoute(from: LatLng, to: LatLng): Promise<LatLng[]> {
  try {
    const url =
      `http://router.project-osrm.org/route/v1/driving/` +
      `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
      `?overview=full&geometries=geojson`;
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error('OSRM error');
    const data = await r.json();
    const coords: [number, number][] = data.routes[0].geometry.coordinates;
    return coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
  } catch {
    return [from, to]; // straight-line fallback
  }
}

function midpoint(a: LatLng, b: LatLng): LatLng {
  return { latitude: (a.latitude + b.latitude) / 2, longitude: (a.longitude + b.longitude) / 2 };
}

function latLngDelta(a: LatLng, b: LatLng) {
  return {
    latitudeDelta: Math.abs(a.latitude - b.latitude) * 1.5 + 0.5,
    longitudeDelta: Math.abs(a.longitude - b.longitude) * 1.5 + 0.5,
  };
}

// Rough estimates for heavy trucks on Indian highways
function tollEstimate(distKm: number) { return Math.round(distKm * 0.65 * 2.5); }
function fuelEstimate(distKm: number) { return Math.round((distKm / 4) * 95); }
function etaHours(distKm: number) { return distKm / 55; } // avg 55 km/h with stops

export default function TrackingScreen() {
  const { isTracking, startTracking, stopTracking } = useTrackingStore();
  const locationWatcher = useRef<Location.LocationSubscription | null>(null);
  const mapRef = useRef<MapView>(null);
  const queryClient = useQueryClient();

  const [currentPos, setCurrentPos] = useState<LatLng | null>(null);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [speed, setSpeed] = useState(0);
  const [routeLoading, setRouteLoading] = useState(false);
  const [nearbyHighwayBiz, setNearbyHighwayBiz] = useState<any[]>([]);
  const [breakSuggestion, setBreakSuggestion] = useState<{ type: string; reason: string } | null>(null);
  const [dynamicEta, setDynamicEta] = useState<{ etaHours: number; trafficMultiplier: number } | null>(null);
  const [journeyLogId, setJourneyLogId] = useState<string | null>(null);

  const { data: activeLoadsData } = useQuery({
    queryKey: ['active-load-tracking'],
    queryFn: () => truckersApi.getLoadHistory({ status: 'in_transit', pageSize: 1 }),
    refetchInterval: 30000,
  });

  const activeLoad = activeLoadsData?.data?.items?.[0] as any;

  const destCoord: LatLng | null = activeLoad
    ? { latitude: activeLoad.destination?.lat ?? 0, longitude: activeLoad.destination?.lng ?? 0 }
    : null;

  const deliverMutation = useMutation({
    mutationFn: ({ loadId, podUrl }: { loadId: string; podUrl: string }) =>
      loadsApi.confirmDelivery(loadId, podUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-load-tracking'] });
      Alert.alert('Delivery Confirmed!', 'Payment will be released within 24 hours.');
    },
  });

  // Load route once we have current position and destination
  const loadRoute = useCallback(async (from: LatLng, to: LatLng) => {
    setRouteLoading(true);
    const coords = await fetchRoute(from, to);
    setRouteCoords(coords);
    setRouteLoading(false);

    // Fit map to show full route
    if (mapRef.current && coords.length > 1) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 40, bottom: 220, left: 40 },
        animated: true,
      });
    }
  }, []);

  async function fetchNearbyHighway(pos: LatLng) {
    try {
      const d = await apiClient.post('/highway/near', { lat: pos.latitude, lng: pos.longitude, radiusKm: 5 });
      setNearbyHighwayBiz((d.data || []).slice(0, 5));
    } catch {}
  }

  async function fetchBreakSuggestions(loadId: string) {
    try {
      const d = await apiClient.get(`/truckers/my/journey/break-suggestions?journeyLogId=${loadId}`);
      const top = (d.data || [])[0];
      if (top && top.priority <= 2) setBreakSuggestion({ type: top.type, reason: top.reason });
    } catch {}
  }

  async function fetchDynamicEta(loadId: string) {
    try {
      const d = await apiClient.get(`/truckers/my/journey/eta?journeyLogId=${loadId}`);
      if (d.success) setDynamicEta({ etaHours: d.data.etaHours, trafficMultiplier: d.data.trafficMultiplier });
    } catch {}
  }

  async function startLocationTracking() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Location access is required for navigation.');
      return;
    }
    if (!activeLoad) return;

    startTracking(activeLoad.loadId);

    locationWatcher.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 10000, distanceInterval: 50 },
      async (location) => {
        const pos: LatLng = { latitude: location.coords.latitude, longitude: location.coords.longitude };
        setCurrentPos(pos);
        setSpeed(Math.round((location.coords.speed ?? 0) * 3.6));

        try {
          await trackingApi.pushLocationUpdate({
            loadId: activeLoad.loadId,
            lat: pos.latitude,
            lng: pos.longitude,
            speedKmh: (location.coords.speed ?? 0) * 3.6,
            heading: location.coords.heading ?? 0,
            accuracy: location.coords.accuracy ?? 0,
          });
        } catch {
          // Continue silently
        }

        // Reload route and V2 data when position changes
        if (destCoord) {
          loadRoute(pos, destCoord);
        }
        fetchNearbyHighway(pos);
        if (activeLoad.loadId) {
          fetchBreakSuggestions(activeLoad.loadId);
          fetchDynamicEta(activeLoad.loadId);
        }
      },
    );

    // Initial position
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const pos: LatLng = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setCurrentPos(pos);
      if (destCoord) loadRoute(pos, destCoord);
    } catch {
      // Fallback: use load origin coords
      if (activeLoad?.origin?.lat && destCoord) {
        const pos: LatLng = { latitude: activeLoad.origin.lat, longitude: activeLoad.origin.lng };
        setCurrentPos(pos);
        loadRoute(pos, destCoord);
      }
    }
  }

  function stopLocationTracking() {
    locationWatcher.current?.remove();
    locationWatcher.current = null;
    stopTracking();
  }

  useEffect(() => {
    return () => { locationWatcher.current?.remove(); };
  }, []);

  // Auto-center map to route when load data arrives even before tracking starts
  useEffect(() => {
    if (activeLoad && !currentPos && destCoord && destCoord.latitude !== 0) {
      const originCoord: LatLng = {
        latitude: activeLoad.origin?.lat ?? 12.9716,
        longitude: activeLoad.origin?.lng ?? 77.5946,
      };
      loadRoute(originCoord, destCoord);
      setCurrentPos(originCoord);
    }
  }, [activeLoad, loadRoute]);

  if (!activeLoad) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🗺️</Text>
        <Text style={styles.emptyTitle}>No Active Load</Text>
        <Text style={styles.emptySubtitle}>Accept a load to start navigation</Text>
      </View>
    );
  }

  const distKm = activeLoad.distanceKm ?? 0;
  const tollEst = tollEstimate(distKm);
  const fuelEst = fuelEstimate(distKm);
  const etaH    = etaHours(distKm);
  const etaHrs  = Math.floor(etaH);
  const etaMins = Math.round((etaH - etaHrs) * 60);

  const mapCenter = currentPos
    ? (destCoord ? midpoint(currentPos, destCoord) : currentPos)
    : (destCoord ?? { latitude: 20.5937, longitude: 78.9629 });

  const mapDelta = currentPos && destCoord
    ? latLngDelta(currentPos, destCoord)
    : { latitudeDelta: 8, longitudeDelta: 8 };

  return (
    <View style={styles.container}>
      {/* ─── MAP ─────────────────────────────────────── */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={{ ...mapCenter, ...mapDelta }}
          showsUserLocation={isTracking}
          showsTraffic
          showsCompass
        >
          {/* Origin marker */}
          {currentPos && (
            <Marker coordinate={currentPos} title="Your Location" pinColor={colors.success}>
              <View style={styles.markerBox}>
                <Text style={styles.markerText}>🚛</Text>
              </View>
            </Marker>
          )}

          {/* Destination marker */}
          {destCoord && destCoord.latitude !== 0 && (
            <Marker coordinate={destCoord} title={`Deliver to ${activeLoad.destination?.city}`} pinColor={colors.danger}>
              <View style={styles.markerBox}>
                <Text style={styles.markerText}>📍</Text>
              </View>
            </Marker>
          )}

          {/* Route polyline */}
          {routeCoords.length > 1 && (
            <Polyline
              coordinates={routeCoords}
              strokeColor={colors.primary}
              strokeWidth={4}
              lineDashPattern={undefined}
            />
          )}

          {/* Highway business pins */}
          {nearbyHighwayBiz.map((biz: any) => biz.lat && biz.lng ? (
            <Marker
              key={biz.id}
              coordinate={{ latitude: biz.lat, longitude: biz.lng }}
              title={biz.businessName}
              description={biz.category?.replace(/_/g, ' ')}
            >
              <View style={styles.hwBizMarker}>
                <Text style={styles.hwBizMarkerText}>
                  {biz.category === 'fuel' ? '⛽' : biz.category === 'dhaba' ? '🍛' : biz.category === 'tyre_shop' ? '🔧' : '🏪'}
                </Text>
              </View>
            </Marker>
          ) : null)}
        </MapView>

        {/* Break suggestion banner */}
        {breakSuggestion && (
          <View style={styles.breakBanner}>
            <Text style={styles.breakBannerText}>
              {breakSuggestion.type === 'rest' ? '😴' : breakSuggestion.type === 'meal' ? '🍛' : '⏸️'} {breakSuggestion.reason}
            </Text>
          </View>
        )}

        {/* Speed badge overlay */}
        {isTracking && (
          <View style={styles.speedBadge}>
            <Text style={styles.speedNum}>{speed}</Text>
            <Text style={styles.speedUnit}>km/h</Text>
          </View>
        )}

        {/* Route loading indicator */}
        {routeLoading && (
          <View style={styles.routeLoadingBadge}>
            <Text style={styles.routeLoadingText}>Calculating route…</Text>
          </View>
        )}
      </View>

      {/* ─── BOTTOM PANEL ────────────────────────────── */}
      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent} showsVerticalScrollIndicator={false}>

        {/* Route summary */}
        <View style={styles.routeCard}>
          <Text style={styles.routeLoadId}>{activeLoad.loadId}</Text>
          <View style={styles.routeRow}>
            <View style={styles.routePoint}>
              <View style={[styles.dot, { backgroundColor: colors.success }]} />
              <Text style={styles.routeCity}>{activeLoad.origin?.city}</Text>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routePoint}>
              <View style={[styles.dot, { backgroundColor: colors.danger }]} />
              <Text style={styles.routeCity}>{activeLoad.destination?.city}</Text>
            </View>
          </View>
          <Text style={styles.priceText}>Earnings: {formatCurrency(activeLoad.pricing?.netTruckerEarning ?? 0)}</Text>
        </View>

        {/* Trip metrics */}
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricVal}>{distKm ? `${Math.round(distKm)} km` : '—'}</Text>
            <Text style={styles.metricLabel}>Distance</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricVal}>{distKm ? `${etaHrs}h ${etaMins}m` : '—'}</Text>
            <Text style={styles.metricLabel}>Est. Time</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricVal}>₹{distKm ? tollEst.toLocaleString('en-IN') : '—'}</Text>
            <Text style={styles.metricLabel}>Toll Est.</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricVal}>₹{distKm ? fuelEst.toLocaleString('en-IN') : '—'}</Text>
            <Text style={styles.metricLabel}>Fuel Est.</Text>
          </View>
        </View>

        {/* V2 Dynamic ETA card */}
        {dynamicEta && (
          <View style={[styles.tipCard, { borderLeftColor: dynamicEta.trafficMultiplier > 1.2 ? '#EF4444' : '#059669' }]}>
            <Text style={styles.tipTitle}>🕐 Live ETA</Text>
            <Text style={styles.tipText}>
              {Math.floor(dynamicEta.etaHours)}h {Math.round((dynamicEta.etaHours % 1) * 60)}m remaining
              {dynamicEta.trafficMultiplier > 1.2 ? ' ⚠️ Traffic delay' : ' ✅ On track'}
            </Text>
          </View>
        )}

        {/* V2 Quick action FABs */}
        <View style={styles.v2Actions}>
          <TouchableOpacity style={styles.v2Fab} onPress={() => Linking.openURL(`/trucker/toll-log?loadId=${activeLoad.loadId}`)}>
            <Text style={styles.v2FabText}>🛣️ Toll</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.v2Fab} onPress={() => Linking.openURL(`/trucker/weighbridge?loadId=${activeLoad.loadId}`)}>
            <Text style={styles.v2FabText}>⚖️ Weight</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.v2Fab} onPress={() => Linking.openURL(`/trucker/breaks?journeyLogId=${activeLoad.loadId}`)}>
            <Text style={styles.v2FabText}>☕ Break</Text>
          </TouchableOpacity>
        </View>

        {/* Route tips */}
        {distKm > 500 && (
          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>🛣️ Route Advisory</Text>
            <Text style={styles.tipText}>• Use NH (National Highway) for fastest route</Text>
            <Text style={styles.tipText}>• FASTag mandatory at toll plazas — keep active</Text>
            {distKm > 1000 && <Text style={styles.tipText}>• Plan rest stops every 4-5 hours (RTO rule)</Text>}
            {distKm > 1500 && <Text style={styles.tipText}>• Night driving — stay on NH, avoid state roads after 10pm</Text>}
          </View>
        )}

        {/* Tracking control */}
        <View style={styles.trackingCard}>
          <View style={styles.trackingStatus}>
            <View style={[styles.statusDot, { backgroundColor: isTracking ? colors.success : colors.gray400 }]} />
            <Text style={styles.statusText}>{isTracking ? '🟢 Live Navigation Active' : '⚪ Navigation Off'}</Text>
          </View>
          <TouchableOpacity
            style={[styles.trackBtn, isTracking && styles.trackBtnStop]}
            onPress={isTracking ? stopLocationTracking : startLocationTracking}
          >
            <Text style={styles.trackBtnText}>
              {isTracking ? '⏹ Stop Navigation' : '▶ Start Navigation'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.warning }]}
            onPress={() => {
              Alert.alert('Confirm Pickup', 'Confirm you have picked up the goods?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Confirm', onPress: () => loadsApi.confirmPickup(activeLoad.loadId) },
              ]);
            }}
          >
            <Text style={styles.actionBtnText}>📦 Confirm Pickup</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.success }]}
            onPress={() => {
              Alert.alert('Confirm Delivery', 'Confirm goods delivered at destination?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Confirm Delivery',
                  onPress: () =>
                    deliverMutation.mutate({ loadId: activeLoad.loadId, podUrl: 'https://placeholder-pod.jpg' }),
                },
              ]);
            }}
          >
            <Text style={styles.actionBtnText}>✅ Confirm Delivery</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgSecondary },

  // Map
  mapContainer: { height: '45%', position: 'relative' },
  markerBox: { alignItems: 'center', justifyContent: 'center' },
  markerText: { fontSize: 28 },
  speedBadge: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center',
  },
  speedNum: { color: '#fff', fontSize: 24, fontWeight: '700' },
  speedUnit: { color: '#aaa', fontSize: 11 },
  routeLoadingBadge: {
    position: 'absolute', bottom: 10, left: 10,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  routeLoadingText: { color: '#fff', fontSize: 12 },

  // Panel
  panel: { flex: 1 },
  panelContent: { padding: spacing[3], gap: spacing[3], paddingBottom: spacing[6] },

  // Route card
  routeCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    ...shadow.sm,
  },
  routeLoadId: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '700', marginBottom: spacing[2] },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[2] },
  routePoint: { alignItems: 'center', gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  routeCity: { fontSize: fontSize.base, fontWeight: '600', color: colors.textPrimary },
  routeLine: { flex: 1, height: 2, backgroundColor: colors.gray200, marginHorizontal: spacing[3] },
  priceText: { fontSize: fontSize.md, fontWeight: '700', color: colors.primary },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.xl,
    ...shadow.sm,
    overflow: 'hidden',
  },
  metric: { flex: 1, alignItems: 'center', paddingVertical: spacing[3], borderRightWidth: 1, borderRightColor: colors.gray100 },
  metricVal: { fontSize: fontSize.base, fontWeight: '700', color: colors.textPrimary },
  metricLabel: { fontSize: 10, color: colors.textSecondary, marginTop: 2 },

  // Tip card
  tipCard: {
    backgroundColor: '#FFF9F0',
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  tipTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  tipText: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },

  // Tracking card
  trackingCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    ...shadow.sm,
  },
  trackingStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: fontSize.sm, fontWeight: '500', color: colors.textPrimary },
  trackBtn: { backgroundColor: colors.primary, paddingVertical: spacing[3], borderRadius: borderRadius.lg, alignItems: 'center' },
  trackBtnStop: { backgroundColor: colors.danger },
  trackBtnText: { color: colors.textInverse, fontWeight: '600', fontSize: fontSize.base },

  // Actions
  actions: { gap: spacing[3] },
  actionBtn: { paddingVertical: spacing[4], borderRadius: borderRadius.lg, alignItems: 'center' },
  actionBtnText: { color: colors.textInverse, fontWeight: '700', fontSize: fontSize.base },

  // Empty
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgSecondary },
  emptyIcon: { fontSize: 56, marginBottom: spacing[4] },
  emptyTitle: { fontSize: fontSize.xl, fontWeight: '600', color: colors.textPrimary },
  emptySubtitle: { fontSize: fontSize.base, color: colors.textSecondary, marginTop: spacing[2] },

  // V2 additions
  hwBizMarker: { backgroundColor: '#FFF7ED', borderRadius: 8, padding: 4, borderWidth: 1, borderColor: '#FED7AA' },
  hwBizMarkerText: { fontSize: 18 },
  breakBanner: {
    position: 'absolute', bottom: 10, left: 10, right: 10,
    backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12,
    borderLeftWidth: 4, borderLeftColor: '#F59E0B',
  },
  breakBannerText: { fontWeight: '600', color: '#92400E', fontSize: 13 },
  v2Actions: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  v2Fab: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  v2FabText: { fontWeight: '600', color: '#374151', fontSize: 13 },
});
