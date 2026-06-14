import { apiClient } from '../axios.instance';
import {
  ApiResponse,
  LiveTrackingState,
  ETAPrediction,
  TrackingEvent,
  BlockadeReport,
} from '@truck-platform/shared';
import { ENDPOINTS } from '@truck-platform/shared';

export interface LocationUpdate {
  loadId: string;
  lat: number;
  lng: number;
  speedKmh?: number;
  heading?: number;
  accuracy?: number;
  batteryLevel?: number;
}

export const trackingApi = {
  pushLocationUpdate(update: LocationUpdate): Promise<ApiResponse<TrackingEvent>> {
    return apiClient.post(ENDPOINTS.TRACKING.UPDATE, update).then((r) => r.data);
  },

  getLiveTracking(loadId: string): Promise<ApiResponse<LiveTrackingState>> {
    return apiClient.get(ENDPOINTS.LOADS.TRACK(loadId)).then((r) => r.data);
  },

  getETAPrediction(loadId: string): Promise<ApiResponse<ETAPrediction>> {
    return apiClient.get(ENDPOINTS.TRACKING.ETA(loadId)).then((r) => r.data);
  },

  getBlockades(lat: number, lng: number, radiusKm?: number): Promise<ApiResponse<BlockadeReport[]>> {
    return apiClient
      .get(ENDPOINTS.TRACKING.BLOCKADES, { params: { lat, lng, radiusKm } })
      .then((r) => r.data);
  },

  reportBlockade(
    report: Omit<BlockadeReport, 'reportId' | 'upvotes' | 'verifiedAt' | 'expiresAt' | 'createdAt'>,
  ): Promise<ApiResponse<BlockadeReport>> {
    return apiClient.post(ENDPOINTS.TRACKING.BLOCKADES, report).then((r) => r.data);
  },

  upvoteBlockade(reportId: string): Promise<ApiResponse<{ upvotes: number }>> {
    return apiClient.post(`${ENDPOINTS.TRACKING.BLOCKADES}/${reportId}/upvote`).then((r) => r.data);
  },
};
