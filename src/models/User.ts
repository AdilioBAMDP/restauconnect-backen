// Types utilitaires locaux si non reconnus globalement
type Exclude<T, U> = T extends U ? never : T;
type Pick<T, K extends keyof T> = {
  [P in K]: T[P];
};
// Type utilitaire Omit local si non reconnu globalement
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

import mongoose, { Schema, Document } from 'mongoose';

import { User as IUser } from '../types';

/**
 * 13 RÃ¯Â¿Â½LES SYNCHRONISÃ¯Â¿Â½S AVEC LE FRONTEND
 * - Business: restaurant, artisan, supplier (fournisseur)
 * - Workforce: candidat, driver (livreur)
 * - Finance: banker, accountant (comptable), investor, auditor
 * - Logistics: carrier (transporteur)
 * - Admin: community_manager, admin, super_admin
 */
export type UserRole = 
  | 'restaurant' 
  | 'artisan' 
  | 'supplier'       // fournisseur (mapping frontend)
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

export interface UserDocument extends Omit<IUser, '_id'>, Document {
  password: string;
  isActive: boolean;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  role: UserRole;
  name?: string;
  verified?: boolean;
  // Ã°Å¸â€™Â³ Stripe Connect
  stripeAccountId?: string | null;
  stripeOnboardingComplete?: boolean;
  stripeBankAccountVerified?: boolean;
  stripeDetailsSubmitted?: boolean;
  stripeChargesEnabled?: boolean;
  stripePayoutsEnabled?: boolean;
  // MÃ¯Â¿Â½thodes d'instance
  getDisplayName(): string;
  isVerifiedWith(targetUser: UserDocument): boolean;
}

const TimeSlotSchema = new Schema({
  start: { type: String, required: true },
  end: { type: String, required: true },
  type: { type: String, enum: ['available', 'busy', 'preferred'], default: 'available' }
});

const DayScheduleSchema = new Schema({
  available: { type: mongoose.Schema.Types.Boolean, default: false },
  slots: [TimeSlotSchema]
});

const WeeklyScheduleSchema = new Schema({
  monday: DayScheduleSchema,
  tuesday: DayScheduleSchema,
  wednesday: DayScheduleSchema,
  thursday: DayScheduleSchema,
  friday: DayScheduleSchema,
  saturday: DayScheduleSchema,
  sunday: DayScheduleSchema
});

const DateExceptionSchema = new Schema({
  date: { type: Date, required: true },
  available: { type: mongoose.Schema.Types.Boolean, required: true },
  reason: String
});

const AvailabilitySchema = new Schema({
  schedule: WeeklyScheduleSchema,
  exceptions: [DateExceptionSchema],
  urgentAvailable: { type: mongoose.Schema.Types.Boolean, default: false },
  advanceBooking: { type: Number, default: 24 } // hours
});

const PricingInfoSchema = new Schema({
  hourlyRate: Number,
  fixedPrices: { type: Map, of: Number },
  negotiable: { type: mongoose.Schema.Types.Boolean, default: true },
  currency: { type: String, default: 'EUR' }
});

const BusinessInfoSchema = new Schema({
  companyName: String,
  siret: String,
  vatNumber: String,
  insurance: String,
  licenses: [String]
});

const PortfolioItemSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  images: [String],
  category: String,
  completedAt: { type: Date, default: Date.now },
  clientName: String,
  rating: { type: Number, min: 1, max: 5 }
});

const UserProfileSchema = new Schema({
  description: { type: String, default: '' },
  specialties: [String],
  certifications: [String],
  portfolio: [PortfolioItemSchema],
  availability: AvailabilitySchema,
  pricing: PricingInfoSchema,
  businessInfo: BusinessInfoSchema,
  ecoFriendly: { type: mongoose.Schema.Types.Boolean, default: false }
});

const UserPreferencesSchema = new Schema({
  language: { type: String, enum: ['fr', 'en', 'es'], default: 'fr' },
  currency: { type: String, enum: ['EUR', 'USD', 'GBP'], default: 'EUR' },
  notifications: {
  email: { type: mongoose.Schema.Types.Boolean, default: true },
  push: { type: mongoose.Schema.Types.Boolean, default: true },
  sms: { type: mongoose.Schema.Types.Boolean, default: false }
  },
  privacy: {
  showPhone: { type: mongoose.Schema.Types.Boolean, default: false },
  showEmail: { type: mongoose.Schema.Types.Boolean, default: false },
  showLocation: { type: mongoose.Schema.Types.Boolean, default: true }
  },
  filters: {
    maxDistance: { type: Number, default: 50 },
    priceRange: { type: [Number], default: [0, 1000] },
  ecoFriendly: { type: mongoose.Schema.Types.Boolean, default: false }
  }
});

const LocationSchema = new Schema({
  address: { type: String, required: true },
  city: { type: String, required: true },
  postalCode: { type: String, required: true },
  coordinates: { type: [Number] }
});

const UserSchema = new Schema<UserDocument>({
  // Ã¢Å“â€¦ LaissÃƒÂ© par dÃƒÂ©faut - Mongoose gÃƒÂ¨re automatiquement _id comme ObjectId
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    select: false // Ne pas inclure par dÃ¯Â¿Â½faut dans les requÃ¯Â¿Â½tes
  },
  // ? COMPATIBILITY: Support both 'name' (new) and 'firstName'/'lastName' (server-final.js)
  name: { 
    type: String, 
    trim: true
  },
  role: { 
    type: String, 
    enum: [
      'restaurant', 
      'artisan', 
      'supplier',        // fournisseur
      'candidat', 
      'community_manager', 
      'admin', 
      'super_admin', 
      'banker',          // banquier
      'accountant',      // comptable
      'investor',        // investisseur
      'driver',          // livreur
      'carrier',         // transporteur
      'auditor'          // auditeur
    ],
    required: true 
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  avatar: String,
  phone: String,
  // ? COMPATIBILITY: Support 'firstName'/'lastName' from server-final.js
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  // ? COMPATIBILITY: Support 'companyName' from server-final.js
  companyName: {
    type: String,
    trim: true
  },
  location: LocationSchema,
  verified: { type: mongoose.Schema.Types.Boolean, default: false },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0 },
  profile: UserProfileSchema,
  preferences: UserPreferencesSchema,
  lastActive: { type: Date, default: Date.now },
  
  // Ã°Å¸â€™Â³ Stripe Connect - Pour les fournisseurs qui reÃƒÂ§oivent des paiements
  stripeAccountId: { 
    type: String, 
    default: null 
  },
  stripeOnboardingComplete: { 
    type: Boolean, 
    default: false 
  },
  stripeBankAccountVerified: { 
    type: Boolean, 
    default: false 
  },
  stripeDetailsSubmitted: { 
    type: Boolean, 
    default: false 
  },
  stripeChargesEnabled: { 
    type: Boolean, 
    default: false 
  },
  stripePayoutsEnabled: { 
    type: Boolean, 
    default: false 
  },
  // Réinitialisation mot de passe
  resetPasswordToken: {
    type: String,
    select: false
  },
  resetPasswordExpires: {
    type: Date,
    select: false
  }
}, {
  timestamps: true,
    toJSON: { 
      virtuals: true,
  transform: function(doc: UserDocument, ret: { [key: string]: any }) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
});

// Indexes
// Index unique dÃ¯Â¿Â½jÃ¯Â¿Â½ crÃ¯Â¿Â½Ã¯Â¿Â½ par 'unique: true' sur le champ email
UserSchema.index({ role: 1 });
// UserSchema.index({ 'location.coordinates': '2dsphere' }); // Ã¢Å¡Â Ã¯Â¸Â DÃƒÂ©sactivÃƒÂ© temporairement - cause erreur GeoJSON
UserSchema.index({ verified: 1 });
UserSchema.index({ rating: -1 });
UserSchema.index({ createdAt: -1 });

// Virtual for full name
UserSchema.virtual('fullName').get(function(this: UserDocument) {
  return (this.name ? String(this.name) : (String(`${this.firstName || ''} ${this.lastName || ''}`)).trim());
});

// Methods
UserSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.preferences;
  return obj;
};

UserSchema.methods.canContactUser = function(targetUser: UserDocument) {
  // Only canonical roles allowed
  return !!this.verified && !!targetUser.verified;
};

UserSchema.methods.updateLastActive = function() {
  this.lastActive = new Date();
  return this.save();
};

// Static methods
UserSchema.statics.findByRole = function(...args: any[]) {
  const _args: any[] = args as any[];
  const role: UserRole = (_args as any)[0];
  return this.find({ role });
};

UserSchema.statics.findNearby = function(...args: any[]) {
  // Ã¢Å¡Â Ã¯Â¸Â DÃƒâ€°SACTIVÃƒâ€° TEMPORAIREMENT - Requiert index 2dsphere qui cause erreur GeoJSON
  console.warn('Ã¢Å¡Â Ã¯Â¸Â findNearby est dÃƒÂ©sactivÃƒÂ© - le schÃƒÂ©ma location doit ÃƒÂªtre converti en GeoJSON');
  return this.find({});
  /*
  const _args: any[] = args as any[];
  const coordinates: [number, number] = (_args as any)[0];
  const maxDistance: number = (_args as any)[1] || 50000;
  return this.find({
    'location.coordinates': {
      $near: {
        $geometry: { type: 'Point', coordinates },
        $maxDistance: maxDistance
      }
    }
  });
  */
};

export const User = mongoose.model<UserDocument>('User', UserSchema);
