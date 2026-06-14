export interface GeoLocation {
  lat: number;
  lng: number;
  address: string;
  city: string;
  state: string;
  pincode?: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface RouteWaypoint {
  position: GeoPoint;
  label: string;
  arrivedAt?: Date;
  departedAt?: Date;
}
