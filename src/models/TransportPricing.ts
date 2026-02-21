/**
 * MODÃƒË†LE DE TARIFICATION TRANSPORT PROFESSIONNELLE
 * Conforme aux normes de facturation transport France/UE
 * 
 * Ce modÃƒÂ¨le N'AFFECTE PAS les modÃƒÂ¨les existants Order.ts ou TMS.ts
 * Il s'ajoute comme extension pour calculs avancÃƒÂ©s
 */

import { Schema, model, Document } from 'mongoose';

// ========== TYPES DE VÃƒâ€°HICULES ==========
export enum VehicleType {
  VUL_SMALL = 'vul_small',        // VUL 3-6mÃ‚Â³ (ex: Kangoo, Partner)
  VUL_MEDIUM = 'vul_medium',      // VUL 6-12mÃ‚Â³ (ex: Trafic, Expert)
  VUL_LARGE = 'vul_large',        // VUL 12-20mÃ‚Â³ (ex: Master, Boxer)
  TRUCK_35T = 'truck_35t',        // Porteur 3.5T - 20mÃ‚Â³
  TRUCK_75T = 'truck_75t',        // Porteur 7.5T - 30mÃ‚Â³
  TRUCK_19T = 'truck_19t',        // Porteur 19T - 40mÃ‚Â³
  SEMI_TRAILER = 'semi_trailer',  // Semi-remorque 40T - 90mÃ‚Â³
  REFRIGERATED = 'refrigerated',  // Frigorifique (tempÃƒÂ©rature dirigÃƒÂ©e)
  TAUTLINER = 'tautliner',       // BÃƒÂ¢chÃƒÂ© coulissant
  FLATBED = 'flatbed',           // Plateau
  TANKER = 'tanker'              // Citerne
}

// ========== ZONES TARIFAIRES ==========
export enum PricingZone {
  URBAN = 'urban',              // Zone urbaine dense (Paris intra-muros, etc.)
  SUBURBAN = 'suburban',        // Zone pÃƒÂ©riurbaine (banlieue proche)
  REGIONAL = 'regional',        // RÃƒÂ©gional 50-200km
  NATIONAL = 'national',        // National 200-500km
  LONG_DISTANCE = 'long_distance', // Longue distance >500km
  INTERNATIONAL = 'international', // International/Transfrontalier
  MOUNTAIN = 'mountain',        // Zone montagne (alpes, pyrÃƒÂ©nÃƒÂ©es)
  ISLAND = 'island',            // ÃƒÅ½le (Corse, DOM-TOM)
  RURAL_REMOTE = 'rural_remote' // Rural isolÃƒÂ©/difficile d'accÃƒÂ¨s
}

// ========== SERVICES & SUPPLÃƒâ€°MENTS ==========
export enum ServiceType {
  STANDARD = 'standard',
  EXPRESS = 'express',          // Livraison express/urgente
  APPOINTMENT = 'appointment',  // Rendez-vous fixe
  FLOOR_DELIVERY = 'floor',     // Livraison ÃƒÂ©tage
  TAILGATE = 'tailgate',        // Hayon ÃƒÂ©lÃƒÂ©vateur
  TWO_PEOPLE = 'two_people',    // Livraison 2 personnes
  NIGHT = 'night',              // Livraison nocturne
  WEEKEND = 'weekend',          // Week-end/fÃƒÂ©riÃƒÂ©
  ADR = 'adr',                  // Marchandise dangereuse (ADR)
  FRAGILE = 'fragile',          // Marchandise fragile
  HIGH_VALUE = 'high_value',    // Marchandise de valeur
  ASSEMBLY = 'assembly'         // Montage/installation
}

// ========== INTERFACE CALCUL DE PRIX ==========
export interface IPricingCalculation {
  // DonnÃƒÂ©es de base
  weight: number;               // Poids en kg
  volume: number;               // Volume en mÃ‚Â³
  palletCount?: number;         // Nombre de palettes
  distance: number;             // Distance en km
  
  // Classification
  vehicleType: VehicleType;
  zone: PricingZone;
  services: ServiceType[];
  
  // DÃƒÂ©tails marchandise
  isFragile?: boolean;
  isPerishable?: boolean;
  isDangerous?: boolean;
  temperature?: 'ambient' | 'cold' | 'frozen';
  
  // Timing
  isUrgent?: boolean;
  deliveryDate?: Date;
  timeSlot?: 'morning' | 'afternoon' | 'evening' | 'night';
  
  // Contraintes
  floors?: number;              // Nombre d'ÃƒÂ©tages
  needsTailgate?: boolean;
  needsHelp?: boolean;          // Besoin aide manutention
  
  // SaisonnalitÃƒÂ©
  seasonMultiplier?: number;    // Coefficient saison (1.0 = normal, 1.4 = haute)
}

// ========== RÃƒâ€°SULTAT DU CALCUL ==========
export interface IPricingResult {
  // Prix de base
  basePrice: number;            // Prix de base selon grille
  
  // Composantes du prix
  weightCharge: number;         // Charge au poids/volume
  distanceCharge: number;       // Charge kilomÃƒÂ©trique
  paletteCharge: number;        // Charge palettisation
  
  // SupplÃƒÂ©ments
  zoneSuplement: number;        // SupplÃƒÂ©ment zone
  vehicleSupplement: number;    // SupplÃƒÂ©ment type vÃƒÂ©hicule
  serviceSupplement: number;    // SupplÃƒÂ©ments services
  seasonSupplement: number;     // SupplÃƒÂ©ment saisonnier
  
  // Frais additionnels
  tolls: number;                // PÃƒÂ©ages estimÃƒÂ©s
  fuelSurcharge: number;        // Surcharge carburant
  
  // Total HT
  subtotalHT: number;
  
  // TVA
  vatRate: number;              // Taux TVA (0.20 = 20%)
  vatAmount: number;
  
  // Total TTC
  totalTTC: number;
  
  // DÃƒÂ©tails
  breakdown: {
    label: string;
    amount: number;
    type: 'base' | 'supplement' | 'tax' | 'fee';
  }[];
  
  // MÃƒÂ©ta
  calculatedAt: Date;
  validUntil: Date;             // ValiditÃƒÂ© du devis
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
    perKg: number;              // Ex: 0.15Ã¢â€šÂ¬/kg
    
    // Tarif au km selon zone
    perKm: {
      urban: number;            // Ex: 1.80Ã¢â€šÂ¬/km
      suburban: number;         // Ex: 1.50Ã¢â€šÂ¬/km
      regional: number;         // Ex: 1.20Ã¢â€šÂ¬/km
      national: number;         // Ex: 0.95Ã¢â€šÂ¬/km
      long_distance: number;    // Ex: 0.85Ã¢â€šÂ¬/km
      international: number;    // Ex: 1.10Ã¢â€šÂ¬/km
      mountain: number;         // Ex: 1.60Ã¢â€šÂ¬/km
      island: number;           // Ex: 2.00Ã¢â€šÂ¬/km
      rural_remote: number;     // Ex: 1.40Ã¢â€šÂ¬/km
    };
    
    // Tarif par palette
    perPallet: {
      standard: number;         // Ex: 12Ã¢â€šÂ¬/palette
      euro: number;             // Ex: 12Ã¢â€šÂ¬/palette Europe
      half: number;             // Ex: 7Ã¢â€šÂ¬/demi-palette
      oversized: number;        // Ex: 25Ã¢â€šÂ¬/palette hors gabarit
    };
    
    // Forfaits vÃƒÂ©hicules (si forfait au lieu de calcul)
    vehicleFlatRates?: {
      [key in VehicleType]?: number;
    };
  };
  
  // SupplÃƒÂ©ments en pourcentage
  supplements: {
    // SupplÃƒÂ©ments vÃƒÂ©hicules spÃƒÂ©ciaux
    refrigerated: number;       // +40% (0.40)
    tautliner: number;          // +10%
    flatbed: number;            // +15%
    tanker: number;             // +50%
    tailgate: number;           // +15%
    
    // SupplÃƒÂ©ments services
    express: number;            // +100% (1.0)
    appointment: number;        // +20%
    night: number;              // +50%
    weekend: number;            // +100%
    adr: number;                // +60% (marchandise dangereuse)
    fragile: number;            // +25%
    highValue: number;          // +30%
    
    // SupplÃƒÂ©ments zones difficiles
    mountainAccess: number;     // +30%
    islandAccess: number;       // +50%
    ruralRemote: number;        // +20%
    restrictedZone: number;     // +25%
    
    // Manutention
    perFloor: number;           // Ex: 15Ã¢â€šÂ¬/ÃƒÂ©tage
    twoPersonDelivery: number;  // +40%
    assembly: number;           // Tarif horaire
  };
  
  // Coefficients saisonniers
  seasonalMultipliers: {
    lowSeason: number;          // 0.90 (-10%)
    normalSeason: number;       // 1.0
    highSeason: number;         // 1.35 (+35%)
    peakSeason: number;         // 1.50 (+50% - ex: NoÃƒÂ«l)
  };
  
  // TVA
  defaultVatRate: number;       // 0.20 (20%)
  intraCommunityVat: number;    // 0.0 (autoliquidation)
  
  // Minimum de facturation
  minimumCharge: number;        // Ex: 50Ã¢â€šÂ¬ minimum
  
  // MÃƒÂ©tadonnÃƒÂ©es
  transporterId?: Schema.Types.ObjectId;  // Si grille spÃƒÂ©cifique ÃƒÂ  un transporteur
  isGlobal: boolean;            // Si grille globale plateforme
  createdBy: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ========== SCHÃƒâ€°MA MONGOOSE ==========
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
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: false }, // Optionnel pour grilles globales systÃƒÂ¨me
  
}, { timestamps: true });

// Index pour recherche rapide
PricingGridSchema.index({ active: 1, validFrom: 1, validUntil: 1 });
PricingGridSchema.index({ transporterId: 1, active: 1 });

export const PricingGrid = model<IPricingGrid>('PricingGrid', PricingGridSchema);
