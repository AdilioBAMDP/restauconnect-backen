/**
 * 13 RÔLES UTILISATEURS - Synchronisé avec frontend et models
 * - Business: restaurant, artisan, supplier (fournisseur)
 * - Workforce: candidat, driver (livreur)
 * - Finance: banker, accountant, investor, auditor
 * - Logistics: carrier (transporteur)
 * - Admin: community_manager, admin, super_admin
 */
export type UserRole = 
  | 'restaurant' 
  | 'artisan' 
  | 'supplier'       // fournisseur
  | 'candidat' 
  | 'community_manager' 
  | 'admin' 
  | 'super_admin' 
  | 'banker'         // banquier
  | 'accountant'     // comptable
  | 'investor'       // investisseur
  | 'driver'         // livreur
  | 'carrier'        // transporteur
  | 'auditor';       // auditeur

export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  _id?: string;
  email: string;
  password?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  role: UserRole;
  status: UserStatus;
  isActive: boolean;
  avatar?: string;
  phone?: string;
  location?: {
    address?: string;
    city?: string;
    postalCode?: string;
    coordinates?: [number, number];
  };
  verified?: boolean;
  rating?: number;
  reviewCount?: number;
  profile?: UserProfile;
  preferences?: UserPreferences;
  createdAt?: Date;
  updatedAt?: Date;
  lastActive?: Date;
}

export interface UserProfile {
  description: string;
  specialties: string[];
  certifications: string[];
  portfolio: PortfolioItem[];
  availability: Availability;
  pricing: PricingInfo;
  businessInfo?: BusinessInfo;
  ecoFriendly: boolean;
}

export interface PortfolioItem {
  _id?: string;
  title: string;
  description: string;
  images: string[];
  category: string;
  completedAt: Date;
  clientName?: string;
  rating?: number;
}

export interface Availability {
  schedule: WeeklySchedule;
  exceptions: DateException[];
  urgentAvailable: boolean;
  advanceBooking: number;
}

export interface WeeklySchedule {
  [key: string]: DaySchedule;
}

export interface DaySchedule {
  available: boolean;
  slots: TimeSlot[];
}

export interface TimeSlot {
  start: string;
  end: string;
  type: 'available' | 'busy' | 'preferred';
}

export interface DateException {
  date: Date;
  available: boolean;
  reason?: string;
}

export interface PricingInfo {
  hourlyRate?: number;
  fixedPrices?: { [service: string]: number };
  negotiable: boolean;
  currency: string;
}

export interface BusinessInfo {
  companyName: string;
  siret?: string;
  vatNumber?: string;
  insurance: string;
  licenses: string[];
}

export interface UserPreferences {
  language: 'fr' | 'en' | 'es';
  currency: 'EUR' | 'USD' | 'GBP';
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  privacy: {
    showPhone: boolean;
    showEmail: boolean;
    showLocation: boolean;
  };
  filters: {
    maxDistance: number;
    priceRange: [number, number];
    ecoFriendly: boolean;
  };
}

export interface Listing {
  _id?: string;
  authorId: string;
  title: string;
  description: string;
  category: ListingCategory;
  type: ListingType;
  location: Location;
  pricing: ListingPricing;
  requirements: string[];
  benefits: string[];
  images: string[];
  urgent: boolean;
  featured: boolean;
  status: ListingStatus;
  tags: string[];
  ecoFriendly: boolean;
  expiresAt?: Date;
  applicationsCount: number;
  viewsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ListingCategory = 'personnel' | 'services' | 'fournitures' | 'equipement' | 'digital' | 'formation';
export type ListingType = 'offer' | 'demand' | 'collaboration';
export type ListingStatus = 'active' | 'paused' | 'completed' | 'expired';

export interface ListingPricing {
  type: 'hourly' | 'fixed' | 'negotiable' | 'free';
  amount?: number;
  currency: string;
  range?: [number, number];
}

export interface Location {
  address: string;
  city: string;
  postalCode: string;
  country: string;
  coordinates?: [number, number];
}

export interface Message {
  _id?: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system';
  attachments?: Attachment[];
  read: boolean;
  edited?: boolean;
  editedAt?: Date;
  createdAt: Date;
}

export interface Conversation {
  _id?: string;
  participants: string[];
  lastMessage?: string;
  unreadCount: { [userId: string]: number };
  archived: { [userId: string]: boolean };
  muted: { [userId: string]: boolean };
  listingId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Attachment {
  _id?: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface Notification {
  _id?: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: { [key: string]: any };
  read: boolean;
  actionUrl?: string;
  createdAt: Date;
}

export type NotificationType = 
  | 'message' 
  | 'listing_match' 
  | 'project_invitation' 
  | 'review_received' 
  | 'booking_confirmed' 
  | 'payment_received' 
  | 'system_update';

export interface Review {
  _id?: string;
  reviewerId: string;
  reviewedId: string;
  listingId?: string;
  projectId?: string;
  rating: number;
  comment: string;
  categories: ReviewCategory[];
  verified: boolean;
  helpful: number;
  response?: ReviewResponse;
  createdAt: Date;
}

export interface ReviewCategory {
  name: string;
  rating: number;
}

export interface ReviewResponse {
  content: string;
  createdAt: Date;
}

export interface SearchFilters {
  query?: string;
  category?: ListingCategory;
  type?: ListingType;
  location?: {
    city?: string;
    radius?: number;
    coordinates?: [number, number];
  };
  pricing?: {
    min?: number;
    max?: number;
    type?: 'hourly' | 'fixed';
  };
  availability?: {
    urgent?: boolean;
    dateRange?: [Date, Date];
  };
  rating?: number;
  verified?: boolean;
  ecoFriendly?: boolean;
  tags?: string[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface DashboardStats {
  totalListings: number;
  activeConversations: number;
  completedProjects: number;
  averageRating: number;
  totalEarnings: number;
  monthlyGrowth: number;
  upcomingBookings: number;
  profileViews: number;
}
