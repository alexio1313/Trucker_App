// =============================================================
// USER TYPES
// =============================================================

import { GeoLocation } from './geo.types';

export type UserType = 'merchant' | 'trucker' | 'admin';
export type KYCStatus = 'pending' | 'verified' | 'rejected';

export interface User {
  userId: string;
  userType: UserType;
  fullName: string;
  email: string | null;
  phoneNumber: string;
  kycStatus: KYCStatus;
  kycDocFrontUrl: string | null;
  kycDocBackUrl: string | null;
  bankAccount: BankAccount | null;
  gstNumber: string | null;
  panNumber: string | null;
  rating: number;
  totalRatings: number;
  commissionRate: number;
  isSuspended: boolean;
  suspendedUntil: Date | null;
  suspensionReason: string | null;
  fcmToken: string | null;
  lastLoginAt: Date | null;
  profilePhotoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BankAccount {
  accountNumber: string;  // stored encrypted
  ifsc: string;
  beneficiaryName: string;
}

export interface MerchantProfile extends User {
  userType: 'merchant';
  companyName: string;
  businessType: string;
  totalLoadsPosted: number;
  totalSpend: number;
}

export interface TruckerProfile extends User {
  userType: 'trucker';
  trucks: TruckSummary[];
  totalLoadsCompleted: number;
  totalEarnings: number;
  availabilityStatus: TruckerAvailability;
  currentLocation: GeoLocation | null;
}

export type TruckerAvailability = 'available' | 'on_load' | 'offline';

export interface TruckSummary {
  truckId: string;
  registrationNo: string;
  truckType: TruckType;
  capacityKg: number;
  status: TruckStatus;
}

export interface RegisterInput {
  userType: UserType;
  fullName: string;
  phoneNumber: string;
  email?: string;
  password: string;
  gstNumber?: string;
}

export interface LoginInput {
  phoneNumber: string;
  password?: string;
  otp?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

// =============================================================
// TRUCK TYPES
// =============================================================

export type TruckType = 'mini' | 'light' | 'medium' | 'heavy' | 'trailer';
export type TruckStatus = 'available' | 'on_load' | 'maintenance' | 'inactive';
export type FuelType = 'diesel' | 'petrol' | 'cng' | 'electric';

export interface Truck {
  truckId: string;
  truckerId: string;
  registrationNo: string;
  make: string;
  model: string;
  year: number;
  capacityKg: number;
  volumeCbm: number | null;
  truckType: TruckType;
  fuelType: FuelType;
  mileageKmpl: number | null;
  insuranceNo: string | null;
  insuranceExpiry: Date | null;
  permitNo: string | null;
  permitExpiry: Date | null;
  fitnessExpiry: Date | null;
  status: TruckStatus;
  currentLat: number | null;
  currentLng: number | null;
  lastLocationAt: Date | null;
  photos: string[];
  createdAt: Date;
  updatedAt: Date;
}
