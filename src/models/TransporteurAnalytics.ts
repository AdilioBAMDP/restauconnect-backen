import mongoose, { Schema, Document } from 'mongoose';

export interface ITransporteurAnalytics extends Document {
  transporteurId: mongoose.Types.ObjectId;
  period: {
    start: Date;
    end: Date;
  };
  revenue: {
    total: number;
    byVehicle: {
      vehicleId: mongoose.Types.ObjectId;
      amount: number;
    }[];
    byDriver: {
      driverId: mongoose.Types.ObjectId;
      amount: number;
    }[];
  };
  costs: {
    fuel: number;
    maintenance: number;
    salaries: number;
    insurance: number;
    other: number;
  };
  performance: {
    totalDeliveries: number;
    onTimeDeliveries: number;
    delayedDeliveries: number;
    cancelledDeliveries: number;
    averageDeliveryTime: number; // En minutes
    customerSatisfaction: number; // Note sur 5
  };
  fleet: {
    totalVehicles: number;
    activeVehicles: number;
    inMaintenanceVehicles: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const TransporteurAnalyticsSchema: Schema = new Schema(
  {
    transporteurId: {
      type: Schema.Types.ObjectId,
      ref: 'Transporteur',
      required: true
    },
    period: {
      start: { type: Date, required: true },
      end: { type: Date, required: true }
    },
    revenue: {
      total: { type: Number, default: 0 },
      byVehicle: [
        {
          vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicule' },
          amount: { type: Number, default: 0 }
        }
      ],
      byDriver: [
        {
          driverId: { type: Schema.Types.ObjectId, ref: 'DriverEmployee' },
          amount: { type: Number, default: 0 }
        }
      ]
    },
    costs: {
      fuel: { type: Number, default: 0 },
      maintenance: { type: Number, default: 0 },
      salaries: { type: Number, default: 0 },
      insurance: { type: Number, default: 0 },
      other: { type: Number, default: 0 }
    },
    performance: {
      totalDeliveries: { type: Number, default: 0 },
      onTimeDeliveries: { type: Number, default: 0 },
      delayedDeliveries: { type: Number, default: 0 },
      cancelledDeliveries: { type: Number, default: 0 },
      averageDeliveryTime: { type: Number, default: 0 },
      customerSatisfaction: { type: Number, default: 0 }
    },
    fleet: {
      totalVehicles: { type: Number, default: 0 },
      activeVehicles: { type: Number, default: 0 },
      inMaintenanceVehicles: { type: Number, default: 0 }
    }
  },
  {
    timestamps: true
  }
);

// Index pour recherche rapide
TransporteurAnalyticsSchema.index({ transporteurId: 1, 'period.start': 1, 'period.end': 1 });

export const TransporteurAnalytics = mongoose.model<ITransporteurAnalytics>('TransporteurAnalytics', TransporteurAnalyticsSchema);
