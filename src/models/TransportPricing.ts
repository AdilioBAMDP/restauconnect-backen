/**
 * MODÈLE DE TARIFICATION TRANSPORT PROFESSIONNELLE
 * Conforme aux normes de facturation transport France/UE
 * 
 * Ce modèle N'AFFECTE PAS les modèles existants Order.ts ou TMS.ts
 * Il s'ajoute comme extension pour calculs avancés
 */

import { Schema, model, Document } from 'mongoose';

// ========== TYPES DE VÉHICULES ==========
export enum VehicleType {
  VUL_SMALL = 'vul_small',        // VUL 3-6m³ (ex: Kangoo, Partner)
  VUL_MEDIUM = 'vul_medium',      // VUL 6-12m³ (ex: Trafic, Expert)
  VUL_LARGE = 'vul_large',        // VUL 12-20m³ (ex: Master, Boxer)
  TRUCK_35T = 'truck_35t',        // Porteur 3.5T - 20m³
  TRUCK_75T = 'truck_75t',        // Porteur 7.5T - 30m³
  TRUCK_19T = 'truck_19t',        // Porteur 19T - 40m³
  SEMI_TRAILER = 'semi_trailer',  // Semi-remorque 40T - 90m³
  REFRIGERATED = 'refrigerated',  // Frigorifique (température dirigée)
  TAUTLINER = 'tautliner',       // Bâché coulissant
  FLATBED = 'flatbed',           // Plateau
  TANKER = 'tanker'              // Citerne
}

// ========== ZONES TARIFAIRES ==========
export enum PricingZone {
  URBAN = 'urban',              // Zone urbaine dense (Paris intra-muros, etc.)
  SUBURBAN = 'suburban',        // Zone périurbaine (banlieue proche)
  REGIONAL = 'regional',        // Régional 50-200km
  NATIONAL = 'national',        // National 200-500km
  LONG_DISTANCE = 'long_distance', // Longue distance >500km
  INTERNATIONAL = 'international', // International/Transfrontalier
  MOUNTAIN = 'mountain',        // Zone montagne (alpes, pyrénées)
  ISLAND = 'island',            // Île (Corse, DOM-TOM)
  RURAL_REMOTE = 'rural_remote' // Rural isolé/difficile d'accès
}

// ========== SERVICES & SUPPLÉMENTS ==========
export enum ServiceType {
  STANDARD = 'standard',
  EXPRESS = 'express',          // Livraison express/urgente
  APPOINTMENT = 'appointment',  // Rendez-vous fixe
  FLOOR_DELIVERY = 'floor',     // Livraison étage
  TAILGATE = 'tailgate',        // Hayon élévateur
  TWO_PEOPLE = 'two_people',    // Livraison 2 personnes
  NIGHT = 'night',              // Livraison nocturne
  WEEKEND = 'weekend',          // Week-end/férié
  ADR = 'adr',                  // Marchandise dangereuse (ADR)
  FRAGILE = 'fragile',          // Marchandise fragile
  HIGH_VALUE = 'high_value',    // Marchandise de valeur
  ASSEMBLY = 'assembly'         // Montage/installation
}

// ========== INTERFACE CALCUL DE PRIX ==========
export interface IPricingCalculation {
  // Données de base
  weight: number;               // Poids en kg
  volume: number;               // Volume en m³
  palletCount?: number;         // Nombre de palettes
  distance: number;             // Distance en km
  
  // Classification
  vehicleType: VehicleType;
  zone: PricingZone;
  services: ServiceType[];
  
  // Détails marchandise
  isFragile?: boolean;
  isPerishable?: boolean;
  isDangerous?: boolean;
  temperature?: 'ambient' | 'cold' | 'frozen';
  
  // Timing
  isUrgent?: boolean;
  deliveryDate?: Date;
  timeSlot?: 'morning' | 'afternoon' | 'evening' | 'night';
  
  // Contraintes
  floors?: number;              // Nombre d'étages
  needsTailgate?: boolean;
  needsHelp?: boolean;          // Besoin aide manutention
  
  // Saisonnalité
  seasonMultiplier?: number;    // Coefficient saison (1.0 = normal, 1.4 = haute)
}

// ========== RÉSULTAT DU CALCUL ==========
export interface IPricingResult {
  // Prix de base
  basePrice: number;            // Prix de base selon grille
  
  // Composantes du prix
  weightCharge: number;         // Charge au poids/volume
  distanceCharge: number;       // Charge kilométrique
  paletteCharge: number;        // Charge palettisation
  
  // Suppléments
  zoneSuplement: number;        // Supplément zone
  vehicleSupplement: number;    // Supplément type véhicule
  serviceSupplement: number;    // Suppléments services
  seasonSupplement: number;     // Supplément saisonnier
  
  // Frais additionnels
  tolls: number;                // Péages estimés
  fuelSurcharge: number;        // Surcharge carburant
  
  // Total HT
  subtotalHT: number;
  
  // TVA
  vatRate: number;              // Taux TVA (0.20 = 20%)
  vatAmount: number;
  
  // Total TTC
  totalTTC: number;
  
  // Détails
  breakdown: {
    label: string;
    amount: number;
    type: 'base' | 'supplement' | 'tax' | 'fee';
  }[];
  
  // Méta
  calculatedAt: Date;
  validUntil: Date;             // Validité du devis
  currency: string;
}

// ========== GRILLE TARIFAIRE ==========
export interface IPricingGrid extends Document {
  name: string;                 // Nom de la grille ("Standard", "Premium", etc.)
  active: boolean;
  validFrom: Date;
  validUntil?: Date;
  
  // Tarifs de base
  rates: {
    // Tarif au kg (pour poids taxable)
    perKg: number;              // Ex: 0.15€/kg
    
    // Tarif au km selon zone
    perKm: {
      urban: number;            // Ex: 1.80€/km
      suburban: number;         // Ex: 1.50€/km
      regional: number;         // Ex: 1.20€/km
      national: number;         // Ex: 0.95€/km
      long_distance: number;    // Ex: 0.85€/km
      international: number;    // Ex: 1.10€/km
      mountain: number;         // Ex: 1.60€/km
      island: number;           // Ex: 2.00€/km
      rural_remote: number;     // Ex: 1.40€/km
    };
    
    // Tarif par palette
    perPallet: {
      standard: number;         // Ex: 12€/palette
      euro: number;             // Ex: 12€/palette Europe
      half: number;             // Ex: 7€/demi-palette
      oversized: number;        // Ex: 25€/palette hors gabarit
    };
    
    // Forfaits véhicules (si forfait au lieu de calcul)
    vehicleFlatRates?: {
      [key in VehicleType]?: number;
    };
  };
  
  // Suppléments en pourcentage
  supplements: {
    // Suppléments véhicules spéciaux
    refrigerated: number;       // +40% (0.40)
    tautliner: number;          // +10%
    flatbed: number;            // +15%
    tanker: number;             // +50%
    tailgate: number;           // +15%
    
    // Suppléments services
    express: number;            // +100% (1.0)
    appointment: number;        // +20%
    night: number;              // +50%
    weekend: number;            // +100%
    adr: number;                // +60% (marchandise dangereuse)
    fragile: number;            // +25%
    highValue: number;          // +30%
    
    // Suppléments zones difficiles
    mountainAccess: number;     // +30%
    islandAccess: number;       // +50%
    ruralRemote: number;        // +20%
    restrictedZone: number;     // +25%
    
    // Manutention
    perFloor: number;           // Ex: 15€/étage
    twoPersonDelivery: number;  // +40%
    assembly: number;           // Tarif horaire
  };
  
  // Coefficients saisonniers
  seasonalMultipliers: {
    lowSeason: number;          // 0.90 (-10%)
    normalSeason: number;       // 1.0
    highSeason: number;         // 1.35 (+35%)
    peakSeason: number;         // 1.50 (+50% - ex: Noël)
  };
  
  // TVA
  defaultVatRate: number;       // 0.20 (20%)
  intraCommunityVat: number;    // 0.0 (autoliquidation)
  
  // Minimum de facturation
  minimumCharge: number;        // Ex: 50€ minimum
  
  // Métadonnées
  transporterId?: Schema.Types.ObjectId;  // Si grille spécifique à un transporteur
  isGlobal: boolean;            // Si grille globale plateforme
  createdBy: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ========== SCHÉMA MONGOOSE ==========
const PricingGridSchema = new Schema<IPricingGrid>({
  name: { type: String, required: true },
  active: { type: Boolean, default: true },
  validFrom: { type: Date, required: true, default: Date.now },
  validUntil: Date,
  
  rates: {
    perKg: { type: Number, required: true, default: 0.15 },
    perKm: {
      urban: { type: Number, default: 1.80 },
      suburban: { type: Number, default: 1.50 },
      regional: { type: Number, default: 1.20 },
      national: { type: Number, default: 0.95 },
      long_distance: { type: Number, default: 0.85 },
      international: { type: Number, default: 1.10 },
      mountain: { type: Number, default: 1.60 },
      island: { type: Number, default: 2.00 },
      rural_remote: { type: Number, default: 1.40 }
    },
    perPallet: {
      standard: { type: Number, default: 12 },
      euro: { type: Number, default: 12 },
      half: { type: Number, default: 7 },
      oversized: { type: Number, default: 25 }
    },
    vehicleFlatRates: { type: Map, of: Number }
  },
  
  supplements: {
    refrigerated: { type: Number, default: 0.40 },
    tautliner: { type: Number, default: 0.10 },
    flatbed: { type: Number, default: 0.15 },
    tanker: { type: Number, default: 0.50 },
    tailgate: { type: Number, default: 0.15 },
    express: { type: Number, default: 1.0 },
    appointment: { type: Number, default: 0.20 },
    night: { type: Number, default: 0.50 },
    weekend: { type: Number, default: 1.0 },
    adr: { type: Number, default: 0.60 },
    fragile: { type: Number, default: 0.25 },
    highValue: { type: Number, default: 0.30 },
    mountainAccess: { type: Number, default: 0.30 },
    islandAccess: { type: Number, default: 0.50 },
    ruralRemote: { type: Number, default: 0.20 },
    restrictedZone: { type: Number, default: 0.25 },
    perFloor: { type: Number, default: 15 },
    twoPersonDelivery: { type: Number, default: 0.40 },
    assembly: { type: Number, default: 35 }
  },
  
  seasonalMultipliers: {
    lowSeason: { type: Number, default: 0.90 },
    normalSeason: { type: Number, default: 1.0 },
    highSeason: { type: Number, default: 1.35 },
    peakSeason: { type: Number, default: 1.50 }
  },
  
  defaultVatRate: { type: Number, default: 0.20 },
  intraCommunityVat: { type: Number, default: 0.0 },
  minimumCharge: { type: Number, default: 50 },
  
  transporterId: { type: Schema.Types.ObjectId, ref: 'User' },
  isGlobal: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: false }, // Optionnel pour grilles globales système
  
}, { timestamps: true });

// Index pour recherche rapide
PricingGridSchema.index({ active: 1, validFrom: 1, validUntil: 1 });
PricingGridSchema.index({ transporterId: 1, active: 1 });

export const PricingGrid = model<IPricingGrid>('PricingGrid', PricingGridSchema);
