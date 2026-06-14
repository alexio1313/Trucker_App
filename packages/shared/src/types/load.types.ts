// =============================================================
// LOAD / FREIGHT TYPES
// =============================================================

import { GeoLocation } from './geo.types';

export type LoadStatus =
  | 'posted'
  | 'accepted'
  | 'loading'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  | 'disputed';

export type CargoType =
  | 'general'
  | 'fragile'
  | 'hazmat'
  | 'temperature_controlled'
  | 'liquid'
  | 'oversized';

export interface Load {
  loadId: string;
  merchantId: string;
  truckerId: string | null;
  truckId: string | null;

  origin: GeoLocation & {
    contactName: string | null;
    contactPhone: string | null;
  };
  destination: GeoLocation & {
    contactName: string | null;
    contactPhone: string | null;
  };

  cargo: CargoDetails;
  timeWindow: TimeWindow;
  pricing: PricingDetails;
  sla: SLAConfig;

  status: LoadStatus;
  cancellationReason: string | null;
  distanceKm: number | null;
  podPhotoUrl: string | null;
  deliveryConfirmedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface CargoDetails {
  weightKg: number;
  volumeCbm: number | null;
  cargoType: CargoType;
  specialRequirements: string | null;
  photos: string[];
}

export interface TimeWindow {
  pickupStart: Date;
  pickupEnd: Date;
  deliveryExpected: Date;
  loadingTimeMinutes: number;
  unloadingTimeMinutes: number;
}

export interface PricingDetails {
  agreedPrice: number | null;
  aiSuggestedPrice: number | null;
  platformCommission: number | null;
  commissionPercent: number;
  fuelCostEstimate: number | null;
  tollCostEstimate: number | null;
  waitingCharges: number;
  waitingChargeRate: number;
  netTruckerEarning: number | null;
  surgeMultiplier: number;
}

export interface SLAConfig {
  loadingTimeMinutes: number;
  unloadingTimeMinutes: number;
  waitingChargePerMinute: number;
  pickupDelayPenaltyPerMinute: number;
}

// For creating a load (merchant input)
export interface CreateLoadInput {
  origin: {
    lat: number;
    lng: number;
    address: string;
    city: string;
    state: string;
    contactName?: string;
    contactPhone?: string;
  };
  destination: {
    lat: number;
    lng: number;
    address: string;
    city: string;
    state: string;
    contactName?: string;
    contactPhone?: string;
  };
  cargo: {
    weightKg: number;
    volumeCbm?: number;
    cargoType: CargoType;
    specialRequirements?: string;
  };
  timeWindow: {
    pickupStart: string;   // ISO string
    pickupEnd: string;
    deliveryExpected: string;
    loadingTimeMinutes: number;
    unloadingTimeMinutes: number;
  };
  waitingChargeRate?: number;
}

// Load as seen by a trucker searching for work
export interface LoadDiscovery {
  loadId: string;
  origin: string;
  destination: string;
  distanceKm: number;
  estimatedTime: string;
  priceOffered: number;
  merchantName: string;
  merchantRating: number;
  cargoType: CargoType;
  cargoWeightKg: number;
  pickupStart: Date;
  pickupDeadline: Date;
  aiMatchScore: number;
  aiMatchReason: string;
  estimatedProfit: number;
  aiFuelPrediction: string;
  blockadeRisk: string;
  tollSummary: string;
}

// AI pricing breakdown
export interface PricingBreakdown {
  baseDistancePrice: number;
  fuelCostEstimate: number;
  tollCharges: TollBreakdown[];
  totalTollCost: number;
  platformFee: {
    fixed: number;
    percentageComponent: string;
    total: number;
  };
  surgePricing: {
    multiplier: number;
    reason: string;
  } | null;
  dynamicFactors: {
    timeSensitivityPremium: number;
    specialCargoHandling: number;
    estimatedWaitingTime: number;
    waitingChargePerMinute: number;
  };
  finalPrice: number;
  priceLockUntil: Date;
  alternativeRoutes: AlternativeRoute[];
}

export interface TollBreakdown {
  tollGate: string;
  charge: number;
  type: string;
}

export interface AlternativeRoute {
  routeId: string;
  distanceKm: number;
  estimatedTime: string;
  totalCost: number;
  fuelSaved: number;
  tollCost: number;
  riskScore: number;
  recommendation: string;
}

// Trucker earnings for an active load
export interface EarningsBreakdown {
  loadId: string;
  agreedPrice: number;
  fuelActualCost: number;
  tollActualCost: number;
  waitingTimeCharges: number;
  lateDeliveryPenalty: number;
  bonusEarlyDelivery: number;
  platformCommission: number;
  netEarning: number;
  netEarningPercent: number;
  potentialBonuses: number;
  potentialFinalEarning: number;
}
