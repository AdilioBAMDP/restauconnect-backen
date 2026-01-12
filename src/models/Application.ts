import mongoose, { Schema, Document } from 'mongoose';

// Types pour les rôles de candidature
export type ApplicationRole = 'restaurant' | 'artisan' | 'fournisseur' | 'candidat' | 'banker' | 'investor' | 'driver';

// Statuts de candidature
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

// Interface pour une candidature
export interface IApplication extends Document {
  // Informations personnelles
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  
  // Informations professionnelles
  role: ApplicationRole;
  company?: string;
  experience?: string;
  
  // Message de motivation
  message: string;
  
  // CV (optionnel)
  cvUrl?: string;
  cvFilename?: string;
  
  // Statut de la candidature
  status: ApplicationStatus;
  
  // Métadonnées
  reviewedBy?: string; // ID de l'admin qui a traité
  reviewedAt?: Date;
  reviewNotes?: string; // Notes de l'admin
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Schéma Application
const ApplicationSchema: Schema = new Schema(
  {
    // Informations personnelles
    firstName: {
      type: String,
      required: [true, 'Le prénom est requis'],
      trim: true,
      minlength: [2, 'Le prénom doit contenir au moins 2 caractères'],
      maxlength: [50, 'Le prénom ne peut pas dépasser 50 caractères']
    },
    lastName: {
      type: String,
      required: [true, 'Le nom est requis'],
      trim: true,
      minlength: [2, 'Le nom doit contenir au moins 2 caractères'],
      maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
    },
    email: {
      type: String,
      required: [true, 'L\'email est requis'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Email invalide']
    },
    phone: {
      type: String,
      required: [true, 'Le téléphone est requis'],
      trim: true,
      match: [/^[\d\s+()-]+$/, 'Numéro de téléphone invalide']
    },
    
    // Informations professionnelles
    role: {
      type: String,
      required: [true, 'Le rôle est requis'],
      enum: {
        values: ['restaurant', 'artisan', 'fournisseur', 'candidat', 'banker', 'investor', 'driver'],
        message: '{VALUE} n\'est pas un rôle valide'
      }
    },
    company: {
      type: String,
      trim: true,
      maxlength: [100, 'Le nom de l\'entreprise ne peut pas dépasser 100 caractères']
    },
    experience: {
      type: String,
      trim: true,
      maxlength: [500, 'L\'expérience ne peut pas dépasser 500 caractères']
    },
    
    // Message de motivation
    message: {
      type: String,
      required: [true, 'Le message de motivation est requis'],
      trim: true,
      minlength: [50, 'Le message doit contenir au moins 50 caractères'],
      maxlength: [2000, 'Le message ne peut pas dépasser 2000 caractères']
    },
    
    // CV (optionnel)
    cvUrl: {
      type: String,
      trim: true
    },
    cvFilename: {
      type: String,
      trim: true
    },
    
    // Statut de la candidature
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    
    // Métadonnées
    reviewedBy: {
      type: String,
      ref: 'User'
    },
    reviewedAt: {
      type: Date
    },
    reviewNotes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Les notes ne peuvent pas dépasser 1000 caractères']
    }
  },
  {
    timestamps: true
  }
);

// Index pour améliorer les performances
ApplicationSchema.index({ email: 1 });
ApplicationSchema.index({ status: 1, createdAt: -1 });
ApplicationSchema.index({ role: 1, status: 1 });

// Méthode pour approuver une candidature
ApplicationSchema.methods.approve = function(adminId: string, notes?: string) {
  this.status = 'approved';
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  if (notes) this.reviewNotes = notes;
  return this.save();
};

// Méthode pour rejeter une candidature
ApplicationSchema.methods.reject = function(adminId: string, notes?: string) {
  this.status = 'rejected';
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  if (notes) this.reviewNotes = notes;
  return this.save();
};

// Méthode statique pour obtenir les statistiques
ApplicationSchema.statics.getStats = async function() {
  const total = await this.countDocuments();
  const pending = await this.countDocuments({ status: 'pending' });
  const approved = await this.countDocuments({ status: 'approved' });
  const rejected = await this.countDocuments({ status: 'rejected' });
  
  const byRole = await this.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 }
      }
    }
  ]);
  
  return {
    total,
    pending,
    approved,
    rejected,
    byRole: byRole.reduce((acc: any, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {})
  };
};

// Guard pattern pour éviter "OverwriteModelError"
const ApplicationModel = (mongoose.models.Application || mongoose.model<IApplication>('Application', ApplicationSchema)) as mongoose.Model<IApplication>;

export default ApplicationModel;
