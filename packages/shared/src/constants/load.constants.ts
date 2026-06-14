export const PLATFORM_COMMISSION_PERCENT = 5;
export const MAX_SURGE_MULTIPLIER = 1.5;
export const MIN_SURGE_MULTIPLIER = 1.0;

export const DEFAULT_WAITING_CHARGE_PER_MINUTE = 2;   // ₹2/min after free window
export const DEFAULT_FREE_WAITING_MINUTES = 30;
export const DEFAULT_LATE_PICKUP_PENALTY_PER_MINUTE = 1;  // ₹1/min

export const LOAD_ID_PREFIX = 'LD';
export const MAX_CARGO_WEIGHT_KG = 40000;
export const MAX_CARGO_VOLUME_CBM = 100;

export const LOAD_STATUS_TRANSITIONS: Record<string, string[]> = {
  posted: ['accepted', 'cancelled'],
  accepted: ['loading', 'cancelled'],
  loading: ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'disputed'],
  delivered: ['disputed'],
  cancelled: [],
  disputed: ['delivered', 'cancelled'],
};

export const PRICE_LOCK_DURATION_MINUTES = 30;
export const AI_MATCH_SCORE_THRESHOLD = 0.7;

export const TRUCK_TYPE_CAPACITY_KG: Record<string, number> = {
  mini: 1000,
  light: 2500,
  medium: 7500,
  heavy: 16000,
  trailer: 40000,
};

export const BASE_RATE_PER_KM: Record<string, number> = {
  mini: 12,
  light: 18,
  medium: 28,
  heavy: 40,
  trailer: 55,
};
