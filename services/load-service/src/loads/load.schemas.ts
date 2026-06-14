import { z } from 'zod';

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().min(5).max(200),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  contactName: z.string().max(100).optional(),
  contactPhone: z.string().regex(/^\+?[0-9]{10,13}$/).optional(),
});

export const createLoadSchema = z.object({
  origin: locationSchema,
  destination: locationSchema,
  cargo: z.object({
    weightKg: z.number().positive().max(40000),
    volumeCbm: z.number().positive().max(100).optional(),
    cargoType: z.enum(['general', 'fragile', 'hazmat', 'temperature_controlled', 'liquid', 'oversized']),
    specialRequirements: z.string().max(500).optional(),
  }),
  timeWindow: z.object({
    pickupStart: z.string().datetime(),
    pickupEnd: z.string().datetime(),
    deliveryExpected: z.string().datetime(),
    loadingTimeMinutes: z.number().int().min(0).max(480),
    unloadingTimeMinutes: z.number().int().min(0).max(480),
  }),
  waitingChargeRate: z.number().min(0).max(100).optional(),
});

export const searchLoadsSchema = z.object({
  originCity: z.string().optional(),
  destinationCity: z.string().optional(),
  truckType: z.string().optional(),
  minWeight: z.coerce.number().positive().optional(),
  maxWeight: z.coerce.number().positive().optional(),
  pickupAfter: z.string().datetime().optional(),
  pickupBefore: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const cancelLoadSchema = z.object({
  reason: z.string().min(5).max(500),
});

export const confirmDeliverySchema = z.object({
  podPhotoUrl: z.string().url(),
});

export type CreateLoadInput = z.infer<typeof createLoadSchema>;
export type SearchLoadsQuery = z.infer<typeof searchLoadsSchema>;
