export type UserRole = 'client' | 'driver' | 'merchant';

export type VehicleType = 'moto' | 'velo' | 'voiture' | 'tricycle';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface User {
  id: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  dateOfBirth?: string;
  email?: string;
  userType: UserRole;
  avatarUrl?: string;
  isVerified: boolean;
  isActive: boolean;
  ratingAvg: number;
  ratingCount: number;
  createdAt: string;
}

export interface DriverProfile {
  id: string;
  userId: string;
  cnibNumber?: string;
  cnibPhotoUrl?: string;
  vehicleType: VehicleType;
  licenseNumber?: string;
  licensePhotoUrl?: string;
  isOnline: boolean;
  currentLocation?: LatLng;
  lastLocationUpdate?: string;
  walletBalance: number;
  totalDeliveries: number;
  verificationStatus: VerificationStatus;
}

export interface MerchantProfile {
  id: string;
  userId: string;
  businessName: string;
  businessAddress?: string;
  businessLocation?: LatLng;
  subscriptionType: 'free' | 'pro';
  subscriptionExpiresAt?: string;
  monthlyDeliveryCount: number;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface DriverWithProfile extends User {
  driverProfile: DriverProfile;
  distance?: number; // km from pickup
}
