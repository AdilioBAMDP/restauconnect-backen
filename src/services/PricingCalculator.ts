/**
 * SERVICE DE CALCUL TARIFAIRE TRANSPORT
 * Algorithme professionnel conforme aux pratiques du secteur
 * 
 * Règle des 3 pour 1 : 1 tonne = 3m³
 * Poids taxable = Max(poids réel, volume/3)
 */

import { 
  IPricingCalculation, 
  IPricingResult, 
  PricingGrid, 
  IPricingGrid,
  VehicleType,
  PricingZone,
  ServiceType 
} from '../models/TransportPricing';
import { logger } from '../utils/logger';

export class PricingCalculator {
  
  /**
   * Calcule le poids taxable selon la règle des 3 pour 1
   * Poids taxable = Max(poids réel en kg, volume en m³ / 3 * 1000)
   */
  static calculateTaxableWeight(weight: number, volume: number): number {
    const volumeWeight = (volume / 3) * 1000; // Convertir m³ en kg
    return Math.max(weight, volumeWeight);
  }

  /**
   * Estime les péages autoroutiers selon la distance et le type de véhicule
   */
  static estimateTolls(distance: number, vehicleType: VehicleType): number {
    // Tarifs péages moyens 2025 (classe véhicule)
    const tollRates: Record<VehicleType, number> = {
      [VehicleType.VUL_SMALL]: 0.10,      // 0.10€/km
      [VehicleType.VUL_MEDIUM]: 0.12,
      [VehicleType.VUL_LARGE]: 0.14,
      [VehicleType.TRUCK_35T]: 0.18,
      [VehicleType.TRUCK_75T]: 0.22,
      [VehicleType.TRUCK_19T]: 0.25,
      [VehicleType.SEMI_TRAILER]: 0.28,
      [VehicleType.REFRIGERATED]: 0.25,
      [VehicleType.TAUTLINER]: 0.24,
      [VehicleType.FLATBED]: 0.23,
      [VehicleType.TANKER]: 0.26
    };
    
    // On estime que 60% de la distance est sur autoroute pour >100km
    const highwayDistance = distance > 100 ? distance * 0.6 : 0;
    return Math.round(highwayDistance * tollRates[vehicleType] * 100) / 100;
  }

  /**
   * Calcule la surcharge carburant (indexée sur prix gazole)
   * Environ 15-20% du prix HT en 2025
   */
  static calculateFuelSurcharge(subtotalHT: number): number {
    const fuelSurchargeRate = 0.18; // 18% (varie selon cours)
    return Math.round(subtotalHT * fuelSurchargeRate * 100) / 100;
  }

  /**
   * Détermine le coefficient saisonnier
   */
  static getSeasonalMultiplier(date: Date, grid: IPricingGrid): number {
    const month = date.getMonth() + 1; // 1-12
    
    // Haute saison : Septembre-Octobre (rentrée), Novembre-Décembre (Noël)
    if (month >= 11 || month === 9 || month === 10) {
      return grid.seasonalMultipliers.highSeason;
    }
    
    // Pic : 15 nov - 24 déc (Noël)
    if (month === 12 && date.getDate() < 25) {
      return grid.seasonalMultipliers.peakSeason;
    }
    
    // Basse saison : Janvier-Février, Juillet-Août
    if (month <= 2 || month >= 7 && month <= 8) {
      return grid.seasonalMultipliers.lowSeason;
    }
    
    // Normal le reste du temps
    return grid.seasonalMultipliers.normalSeason;
  }

  /**
   * CALCUL PRINCIPAL DU PRIX DE TRANSPORT
   */
  static async calculatePrice(
    params: IPricingCalculation,
    gridId?: string
  ): Promise<IPricingResult> {
    try {
      // 1. Charger la grille tarifaire active
      let grid: IPricingGrid | null;
      
      if (gridId) {
        grid = await PricingGrid.findById(gridId);
      } else {
        // Prendre la grille globale active par défaut
        grid = await PricingGrid.findOne({ 
          isGlobal: true, 
          active: true,
          validFrom: { $lte: new Date() },
          $or: [
            { validUntil: { $exists: false } },
            { validUntil: { $gte: new Date() } }
          ]
        }).sort({ createdAt: -1 });
      }

      if (!grid) {
        throw new Error('Aucune grille tarifaire active trouvée');
      }

      // 2. Calcul du poids taxable (règle des 3 pour 1)
      const taxableWeight = this.calculateTaxableWeight(params.weight, params.volume);
      logger.info(`Poids taxable: ${taxableWeight}kg (poids: ${params.weight}kg, volume: ${params.volume}m³)`);

      // 3. Prix de base au poids
      const weightCharge = taxableWeight * grid.rates.perKg;

      // 4. Prix de base à la distance (selon zone)
      const kmRate = grid.rates.perKm[params.zone] || grid.rates.perKm.national;
      const distanceCharge = params.distance * kmRate;

      // 5. Charge palettisation (si applicable)
      let paletteCharge = 0;
      if (params.palletCount && params.palletCount > 0) {
        paletteCharge = params.palletCount * grid.rates.perPallet.standard;
      }

      // 6. Prix de base = poids + distance + palettes
      let basePrice = weightCharge + distanceCharge + paletteCharge;

      // 7. Supplément type de véhicule
      let vehicleSupplement = 0;
      if (params.vehicleType === VehicleType.REFRIGERATED) {
        vehicleSupplement = basePrice * grid.supplements.refrigerated;
      } else if (params.vehicleType === VehicleType.FLATBED) {
        vehicleSupplement = basePrice * grid.supplements.flatbed;
      } else if (params.vehicleType === VehicleType.TANKER) {
        vehicleSupplement = basePrice * grid.supplements.tanker;
      } else if (params.vehicleType === VehicleType.TAUTLINER) {
        vehicleSupplement = basePrice * grid.supplements.tautliner;
      }

      // 8. Supplément zone géographique
      let zoneSuplement = 0;
      if (params.zone === PricingZone.MOUNTAIN) {
        zoneSuplement = basePrice * grid.supplements.mountainAccess;
      } else if (params.zone === PricingZone.ISLAND) {
        zoneSuplement = basePrice * grid.supplements.islandAccess;
      } else if (params.zone === PricingZone.RURAL_REMOTE) {
        zoneSuplement = basePrice * grid.supplements.ruralRemote;
      } else if (params.zone === PricingZone.URBAN) {
        zoneSuplement = basePrice * grid.supplements.restrictedZone;
      }

      // 9. Suppléments services
      let serviceSupplement = 0;
      
      if (params.services && params.services.length > 0) {
        for (const service of params.services) {
          switch (service) {
            case ServiceType.EXPRESS:
              serviceSupplement += basePrice * grid.supplements.express;
              break;
            case ServiceType.APPOINTMENT:
              serviceSupplement += basePrice * grid.supplements.appointment;
              break;
            case ServiceType.NIGHT:
              serviceSupplement += basePrice * grid.supplements.night;
              break;
            case ServiceType.WEEKEND:
              serviceSupplement += basePrice * grid.supplements.weekend;
              break;
            case ServiceType.ADR:
              serviceSupplement += basePrice * grid.supplements.adr;
              break;
            case ServiceType.FRAGILE:
              serviceSupplement += basePrice * grid.supplements.fragile;
              break;
            case ServiceType.HIGH_VALUE:
              serviceSupplement += basePrice * grid.supplements.highValue;
              break;
            case ServiceType.TWO_PEOPLE:
              serviceSupplement += basePrice * grid.supplements.twoPersonDelivery;
              break;
            case ServiceType.TAILGATE:
              serviceSupplement += basePrice * grid.supplements.tailgate;
              break;
          }
        }
      }

      // Livraison étage
      if (params.floors && params.floors > 0) {
        serviceSupplement += params.floors * grid.supplements.perFloor;
      }

      // 10. Coefficient saisonnier
      const deliveryDate = params.deliveryDate || new Date();
      const seasonMultiplier = params.seasonMultiplier || this.getSeasonalMultiplier(deliveryDate, grid);
      const seasonSupplement = (basePrice + vehicleSupplement + zoneSuplement + serviceSupplement) * (seasonMultiplier - 1);

      // 11. Sous-total HT avant frais
      let subtotalBeforeFees = basePrice + vehicleSupplement + zoneSuplement + serviceSupplement + seasonSupplement;

      // 12. Frais additionnels
      const tolls = this.estimateTolls(params.distance, params.vehicleType);
      const fuelSurcharge = this.calculateFuelSurcharge(subtotalBeforeFees);

      // 13. Sous-total HT final
      let subtotalHT = subtotalBeforeFees + tolls + fuelSurcharge;

      // 14. Minimum de facturation
      if (subtotalHT < grid.minimumCharge) {
        subtotalHT = grid.minimumCharge;
      }

      // 15. TVA
      const vatRate = params.zone === PricingZone.INTERNATIONAL 
        ? grid.intraCommunityVat 
        : grid.defaultVatRate;
      const vatAmount = Math.round(subtotalHT * vatRate * 100) / 100;

      // 16. Total TTC
      const totalTTC = Math.round((subtotalHT + vatAmount) * 100) / 100;

      // 17. Détails de la facture
      const breakdown: IPricingResult['breakdown'] = [
        { label: 'Base poids', amount: Math.round(weightCharge * 100) / 100, type: 'base' },
        { label: 'Base distance', amount: Math.round(distanceCharge * 100) / 100, type: 'base' },
      ];

      if (paletteCharge > 0) {
        breakdown.push({ label: `Palettisation (${params.palletCount} pal.)`, amount: Math.round(paletteCharge * 100) / 100, type: 'base' });
      }

      if (vehicleSupplement > 0) {
        breakdown.push({ label: 'Supp. véhicule spécialisé', amount: Math.round(vehicleSupplement * 100) / 100, type: 'supplement' });
      }

      if (zoneSuplement > 0) {
        breakdown.push({ label: 'Supp. zone géographique', amount: Math.round(zoneSuplement * 100) / 100, type: 'supplement' });
      }

      if (serviceSupplement > 0) {
        breakdown.push({ label: 'Supp. services', amount: Math.round(serviceSupplement * 100) / 100, type: 'supplement' });
      }

      if (seasonSupplement > 0) {
        breakdown.push({ label: `Supp. saisonnier (×${seasonMultiplier})`, amount: Math.round(seasonSupplement * 100) / 100, type: 'supplement' });
      }

      if (tolls > 0) {
        breakdown.push({ label: 'Péages estimés', amount: tolls, type: 'fee' });
      }

      if (fuelSurcharge > 0) {
        breakdown.push({ label: 'Surcharge carburant', amount: fuelSurcharge, type: 'fee' });
      }

      breakdown.push({ label: `TVA (${vatRate * 100}%)`, amount: vatAmount, type: 'tax' });

      // 18. Résultat final
      const result: IPricingResult = {
        basePrice: Math.round(basePrice * 100) / 100,
        weightCharge: Math.round(weightCharge * 100) / 100,
        distanceCharge: Math.round(distanceCharge * 100) / 100,
        paletteCharge: Math.round(paletteCharge * 100) / 100,
        zoneSuplement: Math.round(zoneSuplement * 100) / 100,
        vehicleSupplement: Math.round(vehicleSupplement * 100) / 100,
        serviceSupplement: Math.round(serviceSupplement * 100) / 100,
        seasonSupplement: Math.round(seasonSupplement * 100) / 100,
        tolls,
        fuelSurcharge,
        subtotalHT: Math.round(subtotalHT * 100) / 100,
        vatRate,
        vatAmount,
        totalTTC,
        breakdown,
        calculatedAt: new Date(),
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Valide 7 jours
        currency: 'EUR'
      };

      logger.info(`Prix calculé: ${totalTTC}€ TTC (HT: ${subtotalHT}€)`);
      return result;

    } catch (error: any) {
      logger.error('Erreur calcul tarif transport:', error);
      throw new Error(`Erreur calcul: ${error.message}`);
    }
  }

  /**
   * Génère un devis PDF conforme aux normes
   */
  static async generateQuote(
    params: IPricingCalculation,
    pricingResult: IPricingResult,
    clientInfo: {
      name: string;
      company?: string;
      address: string;
      email: string;
      phone?: string;
    },
    transporterInfo: {
      name: string;
      company: string;
      siret?: string;
      vatNumber?: string;
      address: string;
      email: string;
      phone: string;
    }
  ): Promise<string> {
    // TODO: Implémenter génération PDF avec PDFKit
    // Retourner le chemin du fichier PDF généré
    return '/exports/quotes/DEVIS-XXXXX.pdf';
  }
}
