import { GeoPoint } from './geo.types';

export type TrackingEventType =
  | 'gps_update'
  | 'pickup_started'
  | 'pickup_completed'
  | 'en_route'
  | 'delivery_reached'
  | 'delivery_completed'
  | 'unscheduled_stop'
  | 'route_deviation';

export type SLAStatus = 'on_time' | 'at_risk' | 'delayed' | 'completed' | 'failed';

export interface TrackingEvent {
  eventId: string;
  loadId: string;
  truckId: string;
  truckerId: string;
  eventType: TrackingEventType;
  location: GeoPoint;
  speedKmh: number | null;
  heading: number | null;
  accuracy: number | null;
  batteryLevel: number | null;
  odometer: number | null;
  notes: string | null;
  createdAt: Date;
}

export interface LiveTrackingState {
  loadId: string;
  truckId: string;
  currentLocation: GeoPoint;
  lastUpdatedAt: Date;
  speedKmh: number;
  heading: number;
  distanceCoveredKm: number;
  distanceRemainingKm: number;
  estimatedArrival: Date;
  etaConfidence: number;   // 0–1
  slaStatus: SLAStatus;
  delayMinutes: number;
  deviatedFromRoute: boolean;
  currentStatus: TrackingEventType;
  nextWaypoint: string;
}

export interface ETAPrediction {
  loadId: string;
  estimatedArrival: Date;
  confidenceScore: number;
  delayMinutes: number;
  reason: string;
  factors: ETAFactor[];
  calculatedAt: Date;
}

export interface ETAFactor {
  type: 'traffic' | 'weather' | 'route_deviation' | 'rest_stop' | 'breakdown' | 'border_delay';
  impactMinutes: number;
  description: string;
}

export interface SLATracking {
  loadId: string;
  status: SLAStatus;
  pickupDeadline: Date;
  actualPickupAt: Date | null;
  deliveryDeadline: Date;
  actualDeliveryAt: Date | null;
  loadingTimeAllotted: number;
  loadingTimeActual: number | null;
  waitingTimeMinutes: number;
  waitingCharges: number;
  delayPenalty: number;
  earlyBonus: number;
  slaScore: number;   // 0–100
}

export interface RouteDeviation {
  loadId: string;
  plannedRouteKey: string;
  deviationStartAt: Date;
  deviationEndAt: Date | null;
  maxDeviationKm: number;
  reason: string | null;
  resolvedAt: Date | null;
}

export interface BlockadeReport {
  reportId: string;
  reportedBy: string;
  location: GeoPoint;
  blockadeType: 'protest' | 'accident' | 'road_work' | 'police_check' | 'flood' | 'other';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedHighways: string[];
  estimatedClearanceTime: Date | null;
  upvotes: number;
  verifiedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}
