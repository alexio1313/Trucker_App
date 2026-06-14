import { Load, LoadStatus, PLATFORM_COMMISSION_PERCENT } from '@truck-platform/shared';
import {
  createLoad,
  findLoadById,
  findLoadsByMerchant,
  searchAvailableLoads,
  updateLoadStatus,
  confirmDelivery,
  cancelLoad,
  countLoads,
  DbLoad,
} from './load.repository';
import { publishEvent } from '../db/kafka';
import { env } from '../config/env';
import { logger } from '../logger';

function mapDbLoadToLoad(row: DbLoad): Load {
  return {
    loadId: row.load_id,
    merchantId: row.merchant_id,
    truckerId: row.trucker_id,
    truckId: row.truck_id,
    origin: {
      lat: Number(row.origin_lat),
      lng: Number(row.origin_lng),
      address: row.origin_address,
      city: row.origin_city,
      state: row.origin_state,
      contactName: row.origin_contact_name,
      contactPhone: row.origin_contact_phone,
    },
    destination: {
      lat: Number(row.dest_lat),
      lng: Number(row.dest_lng),
      address: row.dest_address,
      city: row.dest_city,
      state: row.dest_state,
      contactName: row.dest_contact_name,
      contactPhone: row.dest_contact_phone,
    },
    cargo: {
      weightKg: Number(row.cargo_weight_kg),
      volumeCbm: row.cargo_volume_cbm ? Number(row.cargo_volume_cbm) : null,
      cargoType: row.cargo_type as Load['cargo']['cargoType'],
      specialRequirements: row.special_requirements,
      photos: row.cargo_photos ?? [],
    },
    timeWindow: {
      pickupStart: row.pickup_start,
      pickupEnd: row.pickup_end,
      deliveryExpected: row.delivery_expected,
      loadingTimeMinutes: row.loading_time_minutes,
      unloadingTimeMinutes: row.unloading_time_minutes,
    },
    pricing: {
      agreedPrice: row.agreed_price ? Number(row.agreed_price) : null,
      aiSuggestedPrice: row.ai_suggested_price ? Number(row.ai_suggested_price) : null,
      platformCommission: row.platform_commission ? Number(row.platform_commission) : null,
      commissionPercent: Number(row.commission_percent),
      fuelCostEstimate: row.fuel_cost_estimate ? Number(row.fuel_cost_estimate) : null,
      tollCostEstimate: row.toll_cost_estimate ? Number(row.toll_cost_estimate) : null,
      waitingCharges: Number(row.waiting_charges),
      waitingChargeRate: Number(row.waiting_charge_rate),
      netTruckerEarning: row.net_trucker_earning ? Number(row.net_trucker_earning) : null,
      surgeMultiplier: Number(row.surge_multiplier),
    },
    sla: {
      loadingTimeMinutes: row.loading_time_minutes,
      unloadingTimeMinutes: row.unloading_time_minutes,
      waitingChargePerMinute: Number(row.waiting_charge_rate),
      pickupDelayPenaltyPerMinute: 1,
    },
    status: row.status,
    cancellationReason: row.cancellation_reason,
    distanceKm: row.distance_km ? Number(row.distance_km) : null,
    podPhotoUrl: row.pod_photo_url,
    deliveryConfirmedAt: row.delivery_confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createNewLoad(
  merchantId: string,
  input: {
    origin: { lat: number; lng: number; address: string; city: string; state: string; contactName?: string; contactPhone?: string };
    destination: { lat: number; lng: number; address: string; city: string; state: string; contactName?: string; contactPhone?: string };
    cargo: { weightKg: number; volumeCbm?: number; cargoType: string; specialRequirements?: string };
    timeWindow: { pickupStart: string; pickupEnd: string; deliveryExpected: string; loadingTimeMinutes: number; unloadingTimeMinutes: number };
    waitingChargeRate?: number;
  },
): Promise<Load> {
  const row = await createLoad({
    merchantId,
    originLat: input.origin.lat,
    originLng: input.origin.lng,
    originAddress: input.origin.address,
    originCity: input.origin.city,
    originState: input.origin.state,
    originContactName: input.origin.contactName,
    originContactPhone: input.origin.contactPhone,
    destLat: input.destination.lat,
    destLng: input.destination.lng,
    destAddress: input.destination.address,
    destCity: input.destination.city,
    destState: input.destination.state,
    destContactName: input.destination.contactName,
    destContactPhone: input.destination.contactPhone,
    cargoWeightKg: input.cargo.weightKg,
    cargoVolumeCbm: input.cargo.volumeCbm,
    cargoType: input.cargo.cargoType,
    specialRequirements: input.cargo.specialRequirements,
    pickupStart: new Date(input.timeWindow.pickupStart),
    pickupEnd: new Date(input.timeWindow.pickupEnd),
    deliveryExpected: new Date(input.timeWindow.deliveryExpected),
    loadingTimeMinutes: input.timeWindow.loadingTimeMinutes,
    unloadingTimeMinutes: input.timeWindow.unloadingTimeMinutes,
    waitingChargeRate: input.waitingChargeRate ?? 2,
    commissionPercent: env.PLATFORM_COMMISSION_PERCENT,
  });

  const load = mapDbLoadToLoad(row);

  await publishEvent('load.created', {
    loadId: load.loadId,
    merchantId,
    origin: load.origin,
    destination: load.destination,
    cargoType: load.cargo.cargoType,
    cargoWeightKg: load.cargo.weightKg,
    pickupStart: load.timeWindow.pickupStart,
    createdAt: load.createdAt,
  });

  logger.info('Load created', { loadId: load.loadId, merchantId });
  return load;
}

export async function getLoad(loadId: string, requesterId: string, requesterType: string): Promise<Load | null> {
  const row = await findLoadById(loadId);
  if (!row) return null;

  // Admin can see all; merchant sees own; trucker sees loads assigned to them or posted
  if (requesterType === 'admin') return mapDbLoadToLoad(row);
  if (requesterType === 'merchant' && row.merchant_id !== requesterId) return null;
  if (requesterType === 'trucker' && row.trucker_id !== requesterId && row.status !== 'posted') return null;

  return mapDbLoadToLoad(row);
}

export async function getMerchantLoadList(
  merchantId: string,
  status: string | null,
  page: number,
  pageSize: number,
): Promise<{ items: Load[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const [rows, total] = await Promise.all([
    findLoadsByMerchant(merchantId, status, pageSize, offset),
    countLoads(merchantId, status),
  ]);
  return { items: rows.map(mapDbLoadToLoad), total };
}

export async function searchLoads(
  filters: {
    originCity?: string;
    destinationCity?: string;
    truckType?: string;
    minWeight?: number;
    maxWeight?: number;
    pickupAfter?: string;
    pickupBefore?: string;
  },
  page: number,
  pageSize: number,
): Promise<Load[]> {
  const offset = (page - 1) * pageSize;
  const rows = await searchAvailableLoads(
    filters.originCity ?? null,
    filters.destinationCity ?? null,
    filters.truckType ?? null,
    filters.minWeight ?? null,
    filters.maxWeight ?? null,
    filters.pickupAfter ? new Date(filters.pickupAfter) : null,
    filters.pickupBefore ? new Date(filters.pickupBefore) : null,
    pageSize,
    offset,
  );
  return rows.map(mapDbLoadToLoad);
}

export async function acceptLoadByTrucker(
  loadId: string,
  truckerId: string,
): Promise<Load> {
  const existing = await findLoadById(loadId);
  if (!existing) throw new Error('LOAD_NOT_FOUND');
  if (existing.status !== 'posted') throw new Error('LOAD_NOT_AVAILABLE');

  const row = await updateLoadStatus(loadId, 'accepted', truckerId, undefined);
  if (!row) throw new Error('LOAD_UPDATE_FAILED');

  const load = mapDbLoadToLoad(row);
  await publishEvent('load.accepted', { loadId, truckerId, merchantId: existing.merchant_id });
  logger.info('Load accepted', { loadId, truckerId });
  return load;
}

export async function confirmPickup(
  loadId: string,
  truckerId: string,
): Promise<Load> {
  const existing = await findLoadById(loadId);
  if (!existing) throw new Error('LOAD_NOT_FOUND');
  if (existing.trucker_id !== truckerId) throw new Error('FORBIDDEN');
  if (existing.status !== 'accepted') throw new Error('INVALID_STATUS_TRANSITION');

  const row = await updateLoadStatus(loadId, 'loading');
  if (!row) throw new Error('LOAD_UPDATE_FAILED');

  await publishEvent('load.pickup_started', { loadId, truckerId });
  return mapDbLoadToLoad(row);
}

export async function deliverLoad(
  loadId: string,
  truckerId: string,
  podPhotoUrl: string,
): Promise<Load> {
  const existing = await findLoadById(loadId);
  if (!existing) throw new Error('LOAD_NOT_FOUND');
  if (existing.trucker_id !== truckerId) throw new Error('FORBIDDEN');
  if (!['in_transit', 'loading'].includes(existing.status)) throw new Error('INVALID_STATUS_TRANSITION');

  const row = await confirmDelivery(loadId, podPhotoUrl);
  if (!row) throw new Error('LOAD_UPDATE_FAILED');

  const commission = existing.agreed_price
    ? (Number(existing.agreed_price) * PLATFORM_COMMISSION_PERCENT) / 100
    : 0;

  await publishEvent('load.delivered', {
    loadId,
    truckerId,
    merchantId: existing.merchant_id,
    agreedPrice: existing.agreed_price,
    platformCommission: commission,
    podPhotoUrl,
  });

  logger.info('Load delivered', { loadId, truckerId });
  return mapDbLoadToLoad(row);
}

export async function cancelLoadRequest(
  loadId: string,
  requesterId: string,
  requesterType: string,
  reason: string,
): Promise<Load> {
  const existing = await findLoadById(loadId);
  if (!existing) throw new Error('LOAD_NOT_FOUND');

  if (requesterType === 'merchant' && existing.merchant_id !== requesterId) throw new Error('FORBIDDEN');
  if (requesterType === 'trucker' && existing.trucker_id !== requesterId) throw new Error('FORBIDDEN');

  const row = await cancelLoad(loadId, reason);
  if (!row) throw new Error('LOAD_CANNOT_BE_CANCELLED');

  await publishEvent('load.cancelled', {
    loadId,
    cancelledBy: requesterId,
    reason,
    merchantId: existing.merchant_id,
    truckerId: existing.trucker_id,
  });

  return mapDbLoadToLoad(row);
}
