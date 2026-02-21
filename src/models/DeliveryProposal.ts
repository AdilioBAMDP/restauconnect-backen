import mongoose, { Schema, Document, Types, Model } from 'mongoose';

export interface IDeliveryProposal extends Document {
  _id: Types.ObjectId;
  deliveryId: Types.ObjectId;
  driverId: Types.ObjectId;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  proposedAt: Date;
  expiresAt: Date;
  respondedAt?: Date;
  acceptedAt?: Date;
  declinedAt?: Date;
  declineReason?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  estimatedEarnings: number;
  estimatedDuration: number;
  estimatedDistance: number;
  pickupLocation: {
    latitude: number;
    longitude: number;
    address: string;
    contactName: string;
    contactPhone: string;
  };
  deliveryLocation: {
    latitude: number;
    longitude: number;
    address: string;
    contactName: string;
    contactPhone: string;
  };
  customerInfo: {
    name: string;
    phone: string;
    notes?: string;
  };
  orderInfo: {
    orderNumber: string;
    restaurantName: string;
    supplierName: string;
    totalValue: number;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
    specialInstructions?: string;
  };
  driverLocation?: {
    latitude: number;
    longitude: number;
    lastUpdated: Date;
  };
  matchingScore: number;
  notificationSent: boolean;
  viewedByDriver: boolean;
  viewedAt?: Date;
  metadata: {
    algorithmVersion: string;
    matchingFactors: {
      distance: number;
      availability: number;
      rating: number;
      completionRate: number;
    };
    createdBy: string;
    source: 'automatic' | 'manual' | 'rebalancing';
  };
  timeline: Array<{
    status: string;
    timestamp: Date;
    note?: string;
    userId?: Types.ObjectId;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryProposalSchema = new Schema<IDeliveryProposal>({
  deliveryId: {
    type: Schema.Types.ObjectId,
    ref: 'Delivery',
    required: true,
    index: true
  },
  driverId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'expired', 'cancelled'],
    default: 'pending',
    required: true,
    index: true
  },
  proposedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  respondedAt: {
    type: Date
  },
  acceptedAt: {
    type: Date
  },
  declinedAt: {
    type: Date
  },
  declineReason: {
    type: String,
    maxlength: 500
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
    required: true
  },
  estimatedEarnings: {
    type: Number,
    required: true,
    min: 0
  },
  estimatedDuration: {
    type: Number,
    required: true,
    min: 0
  },
  estimatedDistance: {
    type: Number,
    required: true,
    min: 0
  },
  pickupLocation: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: { type: String, required: true, maxlength: 500 },
    contactName: { type: String, required: true, maxlength: 100 },
    contactPhone: { type: String, required: true, maxlength: 20 }
  },
  deliveryLocation: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: { type: String, required: true, maxlength: 500 },
    contactName: { type: String, required: true, maxlength: 100 },
    contactPhone: { type: String, required: true, maxlength: 20 }
  },
  customerInfo: {
    name: { type: String, required: true, maxlength: 100 },
    phone: { type: String, required: true, maxlength: 20 },
    notes: { type: String, maxlength: 1000 }
  },
  orderInfo: {
    orderNumber: { type: String, required: true, maxlength: 50 },
    restaurantName: { type: String, required: true, maxlength: 200 },
    supplierName: { type: String, required: true, maxlength: 200 },
    totalValue: { type: Number, required: true, min: 0 },
    items: [{
      name: { type: String, required: true, maxlength: 200 },
      quantity: { type: Number, required: true, min: 1 },
      price: { type: Number, required: true, min: 0 }
    }],
    specialInstructions: { type: String, maxlength: 1000 }
  },
  driverLocation: {
    latitude: { type: Number },
    longitude: { type: Number },
    lastUpdated: { type: Date }
  },
  matchingScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  notificationSent: {
    type: Boolean,
    default: false,
    index: true
  },
  viewedByDriver: {
    type: Boolean,
    default: false,
    index: true
  },
  viewedAt: {
    type: Date
  },
  metadata: {
    algorithmVersion: { type: String, required: true, default: '1.0' },
    matchingFactors: {
      distance: { type: Number, required: true, min: 0, max: 100 },
      availability: { type: Number, required: true, min: 0, max: 100 },
      rating: { type: Number, required: true, min: 0, max: 100 },
      completionRate: { type: Number, required: true, min: 0, max: 100 }
    },
    createdBy: { type: String, required: true, maxlength: 100 },
    source: { 
      type: String, 
      enum: ['automatic', 'manual', 'rebalancing'], 
      default: 'automatic' 
    }
  },
  timeline: [{
    status: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    note: { type: String, maxlength: 500 },
    userId: { type: Schema.Types.ObjectId, ref: 'User' }
  }]
}, {
  timestamps: true,
  collection: 'deliveryProposals'
});

// Index composÃƒÂ©s pour optimiser les requÃƒÂªtes
DeliveryProposalSchema.index({ deliveryId: 1, driverId: 1 }, { unique: true });
DeliveryProposalSchema.index({ driverId: 1, status: 1, createdAt: -1 });
DeliveryProposalSchema.index({ deliveryId: 1, status: 1 });
DeliveryProposalSchema.index({ expiresAt: 1, status: 1 });
DeliveryProposalSchema.index({ 'metadata.source': 1, createdAt: -1 });

// MÃƒÂ©thodes statiques
DeliveryProposalSchema.statics.findPendingForDriver = function(driverId: Types.ObjectId) {
  return this.find({
    driverId,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });
};

DeliveryProposalSchema.statics.findActiveForDelivery = function(deliveryId: Types.ObjectId) {
  return this.find({
    deliveryId,
    status: { $in: ['pending', 'accepted'] }
  }).sort({ matchingScore: -1 });
};

DeliveryProposalSchema.statics.expirePendingProposals = async function() {
  const now = new Date();
  const result = await this.updateMany(
    {
      status: 'pending',
      expiresAt: { $lt: now }
    },
    {
      $set: { 
        status: 'expired',
        updatedAt: now
      },
      $push: {
        timeline: {
          status: 'expired',
          timestamp: now,
          note: 'Proposition expirÃƒÂ©e automatiquement'
        }
      }
    }
  );
  
  return result;
};

DeliveryProposalSchema.statics.getDriverStats = async function(driverId: Types.ObjectId, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const stats = await this.aggregate([
    {
      $match: {
        driverId: new Types.ObjectId(driverId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalProposals: { $sum: 1 },
        acceptedProposals: {
          $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] }
        },
        declinedProposals: {
          $sum: { $cond: [{ $eq: ['$status', 'declined'] }, 1, 0] }
        },
        expiredProposals: {
          $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] }
        },
        avgMatchingScore: { $avg: '$matchingScore' },
        avgEarnings: { $avg: '$estimatedEarnings' },
        avgDuration: { $avg: '$estimatedDuration' },
        avgDistance: { $avg: '$estimatedDistance' }
      }
    }
  ]);
  
  const result = stats[0] || {
    totalProposals: 0,
    acceptedProposals: 0,
    declinedProposals: 0,
    expiredProposals: 0,
    avgMatchingScore: 0,
    avgEarnings: 0,
    avgDuration: 0,
    avgDistance: 0
  };
  
  result.acceptanceRate = result.totalProposals > 0 
    ? (result.acceptedProposals / result.totalProposals) * 100 
    : 0;
    
  return result;
};

// MÃƒÂ©thodes d'instance
DeliveryProposalSchema.methods.accept = async function(driverId?: Types.ObjectId) {
  if (this.status !== 'pending') {
    throw new Error('Seules les propositions en attente peuvent ÃƒÂªtre acceptÃƒÂ©es');
  }
  
  if (this.expiresAt < new Date()) {
    throw new Error('Cette proposition a expirÃƒÂ©');
  }
  
  this.status = 'accepted';
  this.respondedAt = new Date();
  
  this.timeline.push({
    status: 'accepted',
    timestamp: new Date(),
    userId: driverId,
    note: 'Proposition acceptÃƒÂ©e par le driver'
  });
  
  await this.save();
  
  // Annuler les autres propositions pour cette livraison
  await this.constructor.updateMany(
    {
      deliveryId: this.deliveryId,
      _id: { $ne: this._id },
      status: 'pending'
    },
    {
      $set: {
        status: 'cancelled',
        updatedAt: new Date()
      },
      $push: {
        timeline: {
          status: 'cancelled',
          timestamp: new Date(),
          note: 'Proposition annulÃƒÂ©e car livraison acceptÃƒÂ©e par un autre driver'
        }
      }
    }
  );
  
  return this;
};

DeliveryProposalSchema.methods.decline = async function(reason?: string, driverId?: Types.ObjectId) {
  if (this.status !== 'pending') {
    throw new Error('Seules les propositions en attente peuvent ÃƒÂªtre refusÃƒÂ©es');
  }
  
  this.status = 'declined';
  this.respondedAt = new Date();
  this.declineReason = reason;
  
  this.timeline.push({
    status: 'declined',
    timestamp: new Date(),
    userId: driverId,
    note: reason ? `Proposition refusÃƒÂ©e: ${reason}` : 'Proposition refusÃƒÂ©e par le driver'
  });
  
  await this.save();
  return this;
};

DeliveryProposalSchema.methods.markAsViewed = async function() {
  if (!this.viewedByDriver) {
    this.viewedByDriver = true;
    this.viewedAt = new Date();
    
    this.timeline.push({
      status: 'viewed',
      timestamp: new Date(),
      note: 'Proposition consultÃƒÂ©e par le driver'
    });
    
    await this.save();
  }
  return this;
};

// Static methods
DeliveryProposalSchema.statics.expirePendingProposals = async function() {
  const now = new Date();
  
  const expiredProposals = await this.updateMany(
    {
      status: 'pending',
      expiresAt: { $lte: now }
    },
    {
      $set: {
        status: 'expired',
        updatedAt: now
      },
      $push: {
        timeline: {
          status: 'expired',
          timestamp: now,
          note: 'Proposition expirÃƒÂ©e automatiquement'
        }
      }
    }
  );
  
  return expiredProposals;
};

DeliveryProposalSchema.statics.getDriverStats = async function(driverId: Types.ObjectId, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const stats = await this.aggregate([
    {
      $match: {
        driverId: driverId,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalProposals: { $sum: 1 },
        acceptedProposals: {
          $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] }
        },
        declinedProposals: {
          $sum: { $cond: [{ $eq: ['$status', 'declined'] }, 1, 0] }
        },
        expiredProposals: {
          $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] }
        },
        totalEarnings: {
          $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, '$estimatedEarnings', 0] }
        },
        averageResponseTime: {
          $avg: {
            $cond: [
              { $in: ['$status', ['accepted', 'declined']] },
              { $subtract: ['$respondedAt', '$proposedAt'] },
              null
            ]
          }
        }
      }
    }
  ]);
  
  const result = stats[0] || {
    totalProposals: 0,
    acceptedProposals: 0,
    declinedProposals: 0,
    expiredProposals: 0,
    totalEarnings: 0,
    averageResponseTime: null
  };
  
  const acceptanceRate = result.totalProposals > 0 
    ? (result.acceptedProposals / result.totalProposals) * 100 
    : 0;
  
  return {
    ...result,
    acceptanceRate: Math.round(acceptanceRate * 100) / 100,
    averageResponseTime: result.averageResponseTime ? Math.round(result.averageResponseTime / 1000 / 60) : null // en minutes
  };
};

// Interface pour les mÃƒÂ©thodes statiques
interface IDeliveryProposalModel extends Model<IDeliveryProposal> {
  expirePendingProposals(): Promise<any>;
  getDriverStats(driverId: string, days: number): Promise<any>;
}

export const DeliveryProposal = mongoose.model<IDeliveryProposal, IDeliveryProposalModel>('DeliveryProposal', DeliveryProposalSchema);
export default DeliveryProposal;