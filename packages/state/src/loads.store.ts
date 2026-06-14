import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { Load, LoadDiscovery, PaginationMeta, CreateLoadInput } from '@truck-platform/shared';
import { loadsApi, LoadSearchParams } from '@truck-platform/api-client';

interface LoadsState {
  activeLoad: Load | null;
  merchantLoads: Load[];
  discoveryLoads: LoadDiscovery[];
  selectedLoad: Load | null;
  pagination: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
}

interface LoadsActions {
  fetchActiveLoad(): Promise<void>;
  fetchMerchantLoads(params?: { status?: string; page?: number }): Promise<void>;
  searchLoads(params: LoadSearchParams): Promise<void>;
  fetchLoadById(loadId: string): Promise<Load>;
  createLoad(input: CreateLoadInput): Promise<Load>;
  acceptLoad(loadId: string): Promise<void>;
  confirmPickup(loadId: string, photoUrl?: string): Promise<void>;
  confirmDelivery(loadId: string, podPhotoUrl: string): Promise<void>;
  cancelLoad(loadId: string, reason: string): Promise<void>;
  clearError(): void;
}

export const useLoadsStore = create<LoadsState & LoadsActions>()(
  immer((set, get) => ({
    activeLoad: null,
    merchantLoads: [],
    discoveryLoads: [],
    selectedLoad: null,
    pagination: null,
    isLoading: false,
    error: null,

    async fetchActiveLoad() {
      set((state) => { state.isLoading = true; });
      try {
        const res = await loadsApi.getMerchantLoads({ status: 'in_transit', page: 1 });
        const items = res.data.items;
        set((state) => { state.activeLoad = items[0] ?? null; });
      } finally {
        set((state) => { state.isLoading = false; });
      }
    },

    async fetchMerchantLoads(params) {
      set((state) => { state.isLoading = true; state.error = null; });
      try {
        const res = await loadsApi.getMerchantLoads(params);
        set((state) => {
          state.merchantLoads = res.data.items;
          state.pagination = res.data.pagination;
        });
      } catch (err: unknown) {
        const message = (err as { error?: { message?: string } })?.error?.message ?? 'Failed to fetch loads';
        set((state) => { state.error = message; });
      } finally {
        set((state) => { state.isLoading = false; });
      }
    },

    async searchLoads(params) {
      set((state) => { state.isLoading = true; state.error = null; });
      try {
        const res = await loadsApi.searchLoads(params);
        set((state) => {
          state.discoveryLoads = res.data.items;
          state.pagination = res.data.pagination;
        });
      } catch (err: unknown) {
        const message = (err as { error?: { message?: string } })?.error?.message ?? 'Search failed';
        set((state) => { state.error = message; });
      } finally {
        set((state) => { state.isLoading = false; });
      }
    },

    async fetchLoadById(loadId) {
      const res = await loadsApi.getLoad(loadId);
      set((state) => { state.selectedLoad = res.data; });
      return res.data;
    },

    async createLoad(input) {
      set((state) => { state.isLoading = true; state.error = null; });
      try {
        const res = await loadsApi.createLoad(input);
        set((state) => {
          state.merchantLoads.unshift(res.data);
        });
        return res.data;
      } catch (err: unknown) {
        const message = (err as { error?: { message?: string } })?.error?.message ?? 'Failed to create load';
        set((state) => { state.error = message; });
        throw err;
      } finally {
        set((state) => { state.isLoading = false; });
      }
    },

    async acceptLoad(loadId) {
      const res = await loadsApi.acceptLoad(loadId);
      set((state) => {
        state.activeLoad = res.data;
        state.discoveryLoads = state.discoveryLoads.filter((l) => l.loadId !== loadId);
      });
    },

    async confirmPickup(loadId, photoUrl) {
      const res = await loadsApi.confirmPickup(loadId, photoUrl);
      set((state) => { state.activeLoad = res.data; });
    },

    async confirmDelivery(loadId, podPhotoUrl) {
      const res = await loadsApi.confirmDelivery(loadId, podPhotoUrl);
      set((state) => {
        state.activeLoad = null;
        const idx = state.merchantLoads.findIndex((l) => l.loadId === loadId);
        if (idx !== -1) state.merchantLoads[idx] = res.data;
      });
    },

    async cancelLoad(loadId, reason) {
      const res = await loadsApi.cancelLoad(loadId, reason);
      set((state) => {
        if (state.activeLoad?.loadId === loadId) state.activeLoad = null;
        const idx = state.merchantLoads.findIndex((l) => l.loadId === loadId);
        if (idx !== -1) state.merchantLoads[idx] = res.data;
      });
    },

    clearError() {
      set((state) => { state.error = null; });
    },
  })),
);
