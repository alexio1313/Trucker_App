export type PricingModel = 'ai_suggested' | 'market_rate' | 'fixed' | 'negotiated';
export type SurgeReason =
  | 'high_demand'
  | 'low_supply'
  | 'weather'
  | 'festival'
  | 'fuel_spike'
  | 'none';

export interface PriceQuote {
  quoteId: string;
  loadId: string;
  aiSuggestedPrice: number;
  marketMin: number;
  marketMax: number;
  confidence: number;  // 0–1
  surgeMultiplier: number;
  surgeReason: SurgeReason;
  breakdown: QuoteBreakdown;
  validUntil: Date;
  createdAt: Date;
}

export interface QuoteBreakdown {
  baseFare: number;           // per-km rate × distance
  fuelSurcharge: number;
  tollCharges: number;
  handlingCharges: number;
  platformFee: number;        // 5% commission
  gst: number;                // 18% on platform fee
  total: number;
}

export interface FuelPrice {
  city: string;
  state: string;
  dieselPricePerLitre: number;
  petrolPricePerLitre: number;
  cngPricePerKg: number;
  updatedAt: Date;
}

export interface MarketRate {
  routeKey: string;           // "origin_state:destination_state"
  truckType: string;
  pricePerKm: number;
  sampleSize: number;
  lastUpdatedAt: Date;
}

export interface CommissionConfig {
  defaultRatePercent: number;   // 5
  minCommissionRs: number;
  maxCommissionRs: number;
  trialPeriodDays: number;
  trialRatePercent: number;
}

export interface PayoutSummary {
  period: 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  grossEarnings: number;
  platformCommission: number;
  taxes: number;
  netPayout: number;
  loadsCount: number;
  pendingSettlement: number;
  nextSettlementDate: Date;
}

export interface WaitingChargeCalc {
  loadId: string;
  freeMinutes: number;
  elapsedMinutes: number;
  billableMinutes: number;
  chargePerMinute: number;
  totalCharge: number;
}
