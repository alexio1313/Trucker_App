import { query, queryOne } from '../db/postgres';
import { Load, LoadStatus } from '@truck-platform/shared';

export interface DbLoad {
  load_id: string;
  merchant_id: string;
  trucker_id: string | null;
  truck_id: string | null;
  origin_lat: number;
  origin_lng: number;
  origin_address: string;
  origin_city: string;
  origin_state: string;
  origin_contact_name: string | null;
  origin_contact_phone: string | null;
  dest_lat: number;
  dest_lng: number;
  dest_address: string;
  dest_city: string;
  dest_state: string;
  dest_contact_name: string | null;
  dest_contact_phone: string | null;
  cargo_weight_kg: number;
  cargo_volume_cbm: number | null;
  cargo_type: string;
  special_requirements: string | null;
  cargo_photos: string[];
  pickup_start: Date;
  pickup_end: Date;
  delivery_expected: Date;
  loading_time_minutes: number;
  unloading_time_minutes: number;
  agreed_price: number | null;
  ai_suggested_price: number | null;
  platform_commission: number | null;
  commission_percent: number;
  fuel_cost_estimate: number | null;
  toll_cost_estimate: number | null;
  waiting_charges: number;
  waiting_charge_rate: number;
  net_trucker_earning: number | null;
  surge_multiplier: number;
  status: LoadStatus;
  cancellation_reason: string | null;
  distance_km: number | null;
  pod_photo_url: string | null;
  delivery_confirmed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateLoadData {
  merchantId: string;
  originLat: number;
  originLng: number;
  originAddress: string;
  originCity: string;
  originState: string;
  originContactName?: string;
  originContactPhone?: string;
  destLat: number;
  destLng: number;
  destAddress: string;
  destCity: string;
  destState: string;
  destContactName?: string;
  destContactPhone?: string;
  cargoWeightKg: number;
  cargoVolumeCbm?: number;
  cargoType: string;
  specialRequirements?: string;
  pickupStart: Date;
  pickupEnd: Date;
  deliveryExpected: Date;
  loadingTimeMinutes: number;
  unloadingTimeMinutes: number;
  waitingChargeRate: number;
  aiSuggestedPrice?: number;
  commissionPercent: number;
}

export async function createLoad(data: CreateLoadData): Promise<DbLoad> {
  const rows = await query<DbLoad>(
    `INSERT INTO loads (
      merchant_id,
      origin_lat, origin_lng, origin_address, origin_city, origin_state,
      origin_contact_name, origin_contact_phone,
      dest_lat, dest_lng, dest_address, dest_city, dest_state,
      dest_contact_name, dest_contact_phone,
      cargo_weight_kg, cargo_volume_cbm, cargo_type, special_requirements,
      pickup_start, pickup_end, delivery_expected,
      loading_time_minutes, unloading_time_minutes,
      waiting_charge_rate, ai_suggested_price, commission_percent,
      status
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
      $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, 'posted'
    ) RETURNING *`,
    [
      data.merchantId,
      data.originLat, data.originLng, data.originAddress, data.originCity, data.originState,
      data.originContactName ?? null, data.originContactPhone ?? null,
      data.destLat, data.destLng, data.destAddress, data.destCity, data.destState,
      data.destContactName ?? null, data.destContactPhone ?? null,
      data.cargoWeightKg, data.cargoVolumeCbm ?? null, data.cargoType, data.specialRequirements ?? null,
      data.pickupStart, data.pickupEnd, data.deliveryExpected,
      data.loadingTimeMinutes, data.unloadingTimeMinutes,
      data.waitingChargeRate, data.aiSuggestedPrice ?? null, data.commissionPercent,
    ],
  );
  return rows[0];
}

export async function findLoadById(loadId: string): Promise<DbLoad | null> {
  return queryOne<DbLoad>(
    'SELECT * FROM loads WHERE load_id = $1',
    [loadId],
  );
}

export async function findLoadsByMerchant(
  merchantId: string,
  status: string | null,
  limit: number,
  offset: number,
): Promise<DbLoad[]> {
  const conditions = ['merchant_id = $1'];
  const params: unknown[] = [merchantId];
  let paramIdx = 2;

  if (status) {
    conditions.push(`status = $${paramIdx++}`);
    params.push(status);
  }

  params.push(limit, offset);

  return query<DbLoad>(
    `SELECT * FROM loads WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    params,
  );
}

export async function searchAvailableLoads(
  originCity: string | null,
  destinationCity: string | null,
  truckType: string | null,
  minWeight: number | null,
  maxWeight: number | null,
  pickupAfter: Date | null,
  pickupBefore: Date | null,
  limit: number,
  offset: number,
): Promise<DbLoad[]> {
  const conditions = ["status = 'posted'"];
  const params: unknown[] = [];
  let idx = 1;

  if (originCity) { conditions.push(`origin_city ILIKE $${idx++}`); params.push(`%${originCity}%`); }
  if (destinationCity) { conditions.push(`dest_city ILIKE $${idx++}`); params.push(`%${destinationCity}%`); }
  if (minWeight) { conditions.push(`cargo_weight_kg >= $${idx++}`); params.push(minWeight); }
  if (maxWeight) { conditions.push(`cargo_weight_kg <= $${idx++}`); params.push(maxWeight); }
  if (pickupAfter) { conditions.push(`pickup_start >= $${idx++}`); params.push(pickupAfter); }
  if (pickupBefore) { conditions.push(`pickup_end <= $${idx++}`); params.push(pickupBefore); }

  params.push(limit, offset);

  return query<DbLoad>(
    `SELECT * FROM loads WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    params,
  );
}

export async function updateLoadStatus(
  loadId: string,
  status: LoadStatus,
  truckerId?: string,
  truckId?: string,
): Promise<DbLoad | null> {
  return queryOne<DbLoad>(
    `UPDATE loads SET status = $2, trucker_id = COALESCE($3, trucker_id),
     truck_id = COALESCE($4, truck_id), updated_at = NOW()
     WHERE load_id = $1 RETURNING *`,
    [loadId, status, truckerId ?? null, truckId ?? null],
  );
}

export async function confirmDelivery(loadId: string, podPhotoUrl: string): Promise<DbLoad | null> {
  return queryOne<DbLoad>(
    `UPDATE loads SET status = 'delivered', pod_photo_url = $2,
     delivery_confirmed_at = NOW(), updated_at = NOW()
     WHERE load_id = $1 RETURNING *`,
    [loadId, podPhotoUrl],
  );
}

export async function cancelLoad(loadId: string, reason: string): Promise<DbLoad | null> {
  return queryOne<DbLoad>(
    `UPDATE loads SET status = 'cancelled', cancellation_reason = $2, updated_at = NOW()
     WHERE load_id = $1 AND status IN ('posted', 'accepted', 'loading') RETURNING *`,
    [loadId, reason],
  );
}

export async function countLoads(merchantId: string, status: string | null): Promise<number> {
  const conditions = ['merchant_id = $1'];
  const params: unknown[] = [merchantId];
  if (status) { conditions.push('status = $2'); params.push(status); }
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*) FROM loads WHERE ${conditions.join(' AND ')}`,
    params,
  );
  return parseInt(rows[0].count, 10);
}
