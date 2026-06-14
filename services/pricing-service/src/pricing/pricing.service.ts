import axios from 'axios';
import { createClient } from 'redis';
import { env } from '../config/env';
import { logger } from '../logger';
import { calculateSurgeMultiplier } from './surge.service';
import { BASE_RATE_PER_KM } from '@truck-platform/shared';

let redisClient: ReturnType<typeof createClient> | null = null;
async function getRedis(): Promise<ReturnType<typeof createClient>> {
  if (!redisClient) {
    redisClient = createClient({ url: env.REDIS_URL });
    await redisClient.connect();
  }
  return redisClient;
}

interface RouteInfo {
  distanceKm: number;
  durationMinutes: number;
}

async function getRouteInfo(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<RouteInfo> {
  const redis = await getRedis();
  const cacheKey = `route:${originLat.toFixed(4)},${originLng.toFixed(4)}:${destLat.toFixed(4)},${destLng.toFixed(4)}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as RouteInfo;

  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin: `${originLat},${originLng}`,
        destination: `${destLat},${destLng}`,
        mode: 'driving',
        key: env.GOOGLE_MAPS_API_KEY,
      },
      timeout: 5000,
    });

    const route = response.data.routes?.[0]?.legs?.[0];
    if (!route) throw new Error('No route found');

    const info: RouteInfo = {
      distanceKm: route.distance.value / 1000,
      durationMinutes: Math.ceil(route.duration.value / 60),
    };

    await redis.set(cacheKey, JSON.stringify(info), { EX: 3600 });
    return info;
  } catch (err) {
    // Fallback: haversine approximation
    logger.warn('Google Maps API failed, using fallback distance', { error: (err as Error).message });
    const R = 6371;
    const dLat = ((destLat - originLat) * Math.PI) / 180;
    const dLng = ((destLng - originLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((originLat * Math.PI) / 180) *
      Math.cos((destLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
    const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return { distanceKm: distanceKm * 1.15, durationMinutes: Math.ceil((distanceKm * 1.15) / 50 * 60) };
  }
}

export interface PriceQuoteResult {
  distanceKm: number;
  durationMinutes: number;
  baseFare: number;
  fuelSurcharge: number;
  tollCharges: number;
  platformFee: number;
  gst: number;
  surgePricing: { multiplier: number; reasons: string[] } | null;
  finalPrice: number;
  netTruckerEarning: number;
  priceLockUntil: Date;
}

export async function generatePriceQuote(input: {
  originLat: number;
  originLng: number;
  originCity: string;
  destLat: number;
  destLng: number;
  destCity: string;
  cargoWeightKg: number;
  cargoType: string;
  truckType: string;
  pickupStart: string;
}): Promise<PriceQuoteResult> {
  const route = await getRouteInfo(input.originLat, input.originLng, input.destLat, input.destLng);

  const ratePerKm = BASE_RATE_PER_KM[input.truckType as keyof typeof BASE_RATE_PER_KM] ?? 30;
  const baseFare = Math.round(route.distanceKm * ratePerKm);

  // Fuel surcharge: assume 0.2 L/km diesel at ₹95/L
  const fuelSurcharge = Math.round(route.distanceKm * 0.2 * 95);

  // Simplified toll estimate: ₹2/km for national highway routes
  const tollCharges = Math.round(route.distanceKm * 2);

  const surge = await calculateSurgeMultiplier(input.originCity, input.destCity, input.cargoType);
  const surgeAdjustment = surge.multiplier > 1 ? surge : null;

  const subtotal = Math.round((baseFare + fuelSurcharge + tollCharges) * surge.multiplier);

  const platformFee = Math.round((subtotal * env.PLATFORM_COMMISSION_PERCENT) / 100);
  const gst = Math.round(platformFee * 0.18);
  const finalPrice = subtotal + platformFee + gst;
  const netTruckerEarning = subtotal - platformFee;

  const priceLockUntil = new Date(Date.now() + 30 * 60 * 1000);

  logger.debug('Price quote generated', {
    route: `${input.originCity}→${input.destCity}`,
    distanceKm: route.distanceKm,
    finalPrice,
  });

  return {
    distanceKm: Math.round(route.distanceKm * 10) / 10,
    durationMinutes: route.durationMinutes,
    baseFare,
    fuelSurcharge,
    tollCharges,
    platformFee,
    gst,
    surgePricing: surgeAdjustment,
    finalPrice,
    netTruckerEarning,
    priceLockUntil,
  };
}
