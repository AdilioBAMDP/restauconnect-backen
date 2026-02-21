import mongoose, { Schema, Document } from 'mongoose';

/**
 * Interface TypeScript pour un Partenaire
 */
export interface IPartner extends Document {
  userId?: mongoose.Types.ObjectId; // RÃƒÂ©fÃƒÂ©rence vers User si le partenaire est inscrit
  name: string;
  role: 'restaurant' | 'fournisseur' | 'artisan' | 'transporteur' | 'community_manager' | 'banquier' | 'comptable' | 'investisseur' | 'auditeur' | 'candidat';
  specialty: string;
  location: string;
  rating: number;
  reviewCount: number;
  price?: string;
  availability: string;
  verified: boolean;
  avatar?: string;
  badges: string[];
  description: string;
  ecoFriendly: boolean;
  skills: string[];
  experience?: string;
  
  // Informations de contact
  email?: string;
  phone?: string;
  website?: string;
  
  // Informations supplÃƒÂ©mentaires
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  featured: boolean; // Partenaire mis en avant
  
  // Statistiques
  profileViews: number;
  contactRequests: number;
}

/**
 * SchÃƒÂ©ma MongoDB pour les Partenaires
 */
const PartnerSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Le nom est requis'],
      trim: true,
      minlength: [2, 'Le nom doit contenir au moins 2 caractÃƒÂ¨res'],
      maxlength: [100, 'Le nom ne peut pas dÃƒÂ©passer 100 caractÃƒÂ¨res']
    },
    role: {
      type: String,
      required: [true, 'Le rÃƒÂ´le est requis'],
      enum: {
        values: ['restaurant', 'fournisseur', 'artisan', 'transporteur', 'community_manager', 'banquier', 'comptable', 'investisseur', 'auditeur', 'candidat'],
        message: '{VALUE} n\'est pas un rÃƒÂ´le valide'
      },
      index: true
    },
    specialty: {
      type: String,
      required: [true, 'La spÃƒÂ©cialitÃƒÂ© est requise'],
      trim: true,
      maxlength: [200, 'La spÃƒÂ©cialitÃƒÂ© ne peut pas dÃƒÂ©passer 200 caractÃƒÂ¨res']
    },
    location: {
      type: String,
      required: [true, 'La localisation est requise'],
      trim: true,
      index: true
    },
    rating: {
      type: Number,
      default: 0,
      min: [0, 'La note minimum est 0'],
      max: [5, 'La note maximum est 5'],
      index: true
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: [0, 'Le nombre d\'avis ne peut pas ÃƒÂªtre nÃƒÂ©gatif']
    },
    price: {
      type: String,
      trim: true
    },
    availability: {
      type: String,
      required: [true, 'La disponibilitÃƒÂ© est requise'],
      default: 'Disponible'
    },
    verified: {
      type: Boolean,
      default: false,
      index: true
    },
    avatar: {
      type: String,
      trim: true
    },
    badges: {
      type: [String],
      default: []
    },
    description: {
      type: String,
      required: [true, 'La description est requise'],
      minlength: [10, 'La description doit contenir au moins 10 caractÃƒÂ¨res'],
      maxlength: [1000, 'La description ne peut pas dÃƒÂ©passer 1000 caractÃƒÂ¨res']
    },
    ecoFriendly: {
      type: Boolean,
      default: false,
      index: true
    },
    skills: {
      type: [String],
      default: [],
      validate: {
        validator: function(skills: string[]) {
          return skills.length <= 20;
        },
        message: 'Un partenaire ne peut pas avoir plus de 20 compÃƒÂ©tences'
      }
    },
    experience: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Email invalide']
    },
    phone: {
      type: String,
      trim: true
    },
    website: {
      type: String,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    featured: {
      type: Boolean,
      default: false,
      index: true
    },
    profileViews: {
      type: Number,
      default: 0,
      min: 0
    },
    contactRequests: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true, // Ajoute automatiquement createdAt et updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Index composÃƒÂ© pour amÃƒÂ©liorer les performances des requÃƒÂªtes
PartnerSchema.index({ role: 1, location: 1 });
PartnerSchema.index({ rating: -1, reviewCount: -1 });
PartnerSchema.index({ verified: 1, isActive: 1 });
PartnerSchema.index({ name: 'text', specialty: 'text', description: 'text' }); // Recherche textuelle

// MÃƒÂ©thode pour incrÃƒÂ©menter les vues de profil
PartnerSchema.methods.incrementProfileViews = async function() {
  this.profileViews += 1;
  return await this.save();
};

// MÃƒÂ©thode pour incrÃƒÂ©menter les demandes de contact
PartnerSchema.methods.incrementContactRequests = async function() {
  this.contactRequests += 1;
  return await this.save();
};

// MÃƒÂ©thode statique pour obtenir les partenaires par rÃƒÂ´le (avec exclusion)
PartnerSchema.statics.getByRoleExcluding = async function(excludeRole: string, filters: any = {}) {
  const query: any = {
    role: { $ne: excludeRole },
    isActive: true,
    ...filters
  };
  
  return await this.find(query)
    .sort({ featured: -1, rating: -1, reviewCount: -1 })
    .limit(100);
};

// MÃƒÂ©thode statique pour rechercher des partenaires
PartnerSchema.statics.searchPartners = async function(
  searchTerm: string,
  role?: string,
  location?: string,
  sortBy: string = 'rating'
) {
  const query: any = {
    isActive: true,
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { specialty: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } }
    ]
  };
  
  if (role) {
    query.role = role;
  }
  
  if (location) {
    query.location = { $regex: location, $options: 'i' };
  }
  
  const sortOptions: any = {};
  switch (sortBy) {
    case 'rating':
      sortOptions.rating = -1;
      sortOptions.reviewCount = -1;
      break;
    case 'reviews':
      sortOptions.reviewCount = -1;
      break;
    case 'name':
      sortOptions.name = 1;
      break;
    default:
      sortOptions.rating = -1;
  }
  
  return await this.find(query).sort(sortOptions);
};

// MÃƒÂ©thode statique pour obtenir les stats par rÃƒÂ´le
PartnerSchema.statics.getStatsByRole = async function() {
  return await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
        avgRating: { $avg: '$rating' },
        totalReviews: { $sum: '$reviewCount' },
        verified: {
          $sum: { $cond: ['$verified', 1, 0] }
        }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

const PartnerModel = mongoose.model<IPartner>('Partner', PartnerSchema) as mongoose.Model<IPartner>;
export default PartnerModel;


