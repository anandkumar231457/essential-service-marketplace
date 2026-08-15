export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN';
}

export interface ProviderProfile {
  id: number;
  userId: string;
  category: string;
  skills: string[];
  hourlyRate: number;
  verifiedStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  avgRating: number;
  idDocumentUrl?: string | null;
  user?: { name: string; phone: string; email: string };
}

export interface NearbyProvider {
  providerId: string;
  name: string;
  phone: string;
  category: string;
  skills: string[];
  hourlyRate: number;
  avgRating: number;
  verifiedStatus: string;
  lat: number;
  lng: number;
  isOnline: boolean;
  distanceKm: string;
}

export interface ServiceCategory {
  id: number;
  name: string;
  icon: string;
}

export interface Booking {
  id: string;
  customerId: string;
  providerId: string;
  categoryId: number;
  status: 'REQUESTED' | 'ACCEPTED' | 'EN_ROUTE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';
  requestedAt: string;
  scheduledAt?: string | null;
  address: string;
  lat: number;
  lng: number;
}

export interface Review {
  id: number;
  bookingId: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
}