import { apiClient } from '../axios.instance';
import {
  ApiResponse,
  PaginatedResponse,
  Load,
  LoadDiscovery,
  CreateLoadInput,
  PricingBreakdown,
  EarningsBreakdown,
} from '@truck-platform/shared';
import { ENDPOINTS } from '@truck-platform/shared';

export interface LoadSearchParams {
  originCity?: string;
  destinationCity?: string;
  truckType?: string;
  minWeight?: number;
  maxWeight?: number;
  pickupAfter?: string;
  pickupBefore?: string;
  page?: number;
  pageSize?: number;
}

export interface NearbyLoadsParams {
  lat: number;
  lng: number;
  radiusKm?: number;
  limit?: number;
}

export const loadsApi = {
  createLoad(input: CreateLoadInput): Promise<ApiResponse<Load>> {
    return apiClient.post(ENDPOINTS.LOADS.BASE, input).then((r) => r.data);
  },

  getLoad(loadId: string): Promise<ApiResponse<Load>> {
    return apiClient.get(ENDPOINTS.LOADS.BY_ID(loadId)).then((r) => r.data);
  },

  searchLoads(params: LoadSearchParams): Promise<ApiResponse<PaginatedResponse<LoadDiscovery>>> {
    return apiClient.get(ENDPOINTS.LOADS.SEARCH, { params }).then((r) => r.data);
  },

  getNearbyLoads(params: NearbyLoadsParams): Promise<ApiResponse<LoadDiscovery[]>> {
    return apiClient.get(ENDPOINTS.LOADS.NEARBY, { params }).then((r) => r.data);
  },

  acceptLoad(loadId: string): Promise<ApiResponse<Load>> {
    return apiClient.post(ENDPOINTS.LOADS.ACCEPT(loadId)).then((r) => r.data);
  },

  confirmPickup(loadId: string, photoUrl?: string): Promise<ApiResponse<Load>> {
    return apiClient.post(ENDPOINTS.LOADS.PICKUP(loadId), { photoUrl }).then((r) => r.data);
  },

  confirmDelivery(loadId: string, podPhotoUrl: string): Promise<ApiResponse<Load>> {
    return apiClient.post(ENDPOINTS.LOADS.DELIVER(loadId), { podPhotoUrl }).then((r) => r.data);
  },

  cancelLoad(loadId: string, reason: string): Promise<ApiResponse<Load>> {
    return apiClient.post(ENDPOINTS.LOADS.CANCEL(loadId), { reason }).then((r) => r.data);
  },

  getMerchantLoads(params?: { status?: string; page?: number }): Promise<ApiResponse<PaginatedResponse<Load>>> {
    return apiClient.get(ENDPOINTS.LOADS.BASE, { params }).then((r) => r.data);
  },

  getLoadEarnings(loadId: string): Promise<ApiResponse<EarningsBreakdown>> {
    return apiClient.get(`${ENDPOINTS.LOADS.BY_ID(loadId)}/earnings`).then((r) => r.data);
  },

  getPriceQuote(input: CreateLoadInput): Promise<ApiResponse<PricingBreakdown>> {
    return apiClient.post(ENDPOINTS.PRICING.QUOTE, input).then((r) => r.data);
  },
};
