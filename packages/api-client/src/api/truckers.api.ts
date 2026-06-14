import { apiClient } from '../axios.instance';
import {
  ApiResponse,
  TruckerProfile,
  Truck,
  PaginatedResponse,
  PayoutSummary,
  Load,
} from '@truck-platform/shared';
import { ENDPOINTS } from '@truck-platform/shared';

export interface AddTruckInput {
  registrationNo: string;
  make: string;
  model: string;
  year: number;
  capacityKg: number;
  volumeCbm?: number;
  truckType: string;
  fuelType: string;
  mileageKmpl?: number;
}

export interface TruckerHistoryParams {
  page?: number;
  pageSize?: number;
  status?: string;
  from?: string;
  to?: string;
}

export const truckersApi = {
  getProfile(): Promise<ApiResponse<TruckerProfile>> {
    return apiClient.get(ENDPOINTS.TRUCKERS.PROFILE).then((r) => r.data);
  },

  updateAvailability(status: 'available' | 'offline'): Promise<ApiResponse<{ status: string }>> {
    return apiClient.patch(ENDPOINTS.TRUCKERS.AVAILABILITY, { status }).then((r) => r.data);
  },

  getTrucks(): Promise<ApiResponse<Truck[]>> {
    return apiClient.get(ENDPOINTS.TRUCKERS.TRUCKS).then((r) => r.data);
  },

  addTruck(input: AddTruckInput): Promise<ApiResponse<Truck>> {
    return apiClient.post(ENDPOINTS.TRUCKERS.TRUCKS, input).then((r) => r.data);
  },

  updateTruck(truckId: string, updates: Partial<AddTruckInput>): Promise<ApiResponse<Truck>> {
    return apiClient.patch(`${ENDPOINTS.TRUCKERS.TRUCKS}/${truckId}`, updates).then((r) => r.data);
  },

  getLoadHistory(params?: TruckerHistoryParams): Promise<ApiResponse<PaginatedResponse<Load>>> {
    return apiClient.get(ENDPOINTS.TRUCKERS.HISTORY, { params }).then((r) => r.data);
  },

  getEarningsSummary(period: 'daily' | 'weekly' | 'monthly'): Promise<ApiResponse<PayoutSummary>> {
    return apiClient.get(ENDPOINTS.TRUCKERS.EARNINGS, { params: { period } }).then((r) => r.data);
  },
};
