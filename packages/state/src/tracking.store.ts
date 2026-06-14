import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { LiveTrackingState, ETAPrediction, BlockadeReport, GeoPoint } from '@truck-platform/shared';
import { trackingApi } from '@truck-platform/api-client';

interface TrackingState {
  liveTracking: LiveTrackingState | null;
  etaPrediction: ETAPrediction | null;
  nearbyBlockades: BlockadeReport[];
  isTracking: boolean;
  lastLocationUpdate: Date | null;
  locationPermissionGranted: boolean;
}

interface TrackingActions {
  startTracking(loadId: string): void;
  stopTracking(): void;
  pushLocationUpdate(loadId: string, location: GeoPoint, extras?: { speedKmh?: number; heading?: number; accuracy?: number; batteryLevel?: number }): Promise<void>;
  fetchLiveTracking(loadId: string): Promise<void>;
  fetchETA(loadId: string): Promise<void>;
  fetchNearbyBlockades(lat: number, lng: number, radiusKm?: number): Promise<void>;
  setLocationPermission(granted: boolean): void;
}

export const useTrackingStore = create<TrackingState & TrackingActions>()(
  immer((set) => ({
    liveTracking: null,
    etaPrediction: null,
    nearbyBlockades: [],
    isTracking: false,
    lastLocationUpdate: null,
    locationPermissionGranted: false,

    startTracking(loadId) {
      set((state) => { state.isTracking = true; });
      void loadId;
    },

    stopTracking() {
      set((state) => {
        state.isTracking = false;
        state.liveTracking = null;
      });
    },

    async pushLocationUpdate(loadId, location, extras) {
      await trackingApi.pushLocationUpdate({
        loadId,
        lat: location.lat,
        lng: location.lng,
        ...extras,
      });
      set((state) => { state.lastLocationUpdate = new Date(); });
    },

    async fetchLiveTracking(loadId) {
      const res = await trackingApi.getLiveTracking(loadId);
      set((state) => { state.liveTracking = res.data; });
    },

    async fetchETA(loadId) {
      const res = await trackingApi.getETAPrediction(loadId);
      set((state) => { state.etaPrediction = res.data; });
    },

    async fetchNearbyBlockades(lat, lng, radiusKm) {
      const res = await trackingApi.getBlockades(lat, lng, radiusKm);
      set((state) => { state.nearbyBlockades = res.data; });
    },

    setLocationPermission(granted) {
      set((state) => { state.locationPermissionGranted = granted; });
    },
  })),
);
