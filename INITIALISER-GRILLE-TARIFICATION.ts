/**
 * SCRIPT D'INITIALISATION DE LA GRILLE DE TARIFICATION PAR DÉFAUT
 * 
 * Ce script crée la grille de tarification globale par défaut
 * conforme aux normes françaises et européennes de transport
 * 
 * UTILISATION: ts-node INITIALISER-GRILLE-TARIFICATION.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { PricingGrid } from './src/models/TransportPricing';

// Charger variables d'environnement
dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/restau-connect';

async function initializeDefaultPricingGrid() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connecté à MongoDB');

    // Vérifier si une grille globale existe déjà
    const existingGlobal = await PricingGrid.findOne({ isGlobal: true, active: true });
    
    if (existingGlobal) {
      console.log('⚠️  Une grille globale existe déjà:');
      console.log(`   ID: ${existingGlobal._id}`);
      console.log(`   Nom: ${existingGlobal.name}`);
      console.log(`   Créée le: ${existingGlobal.createdAt}`);
      console.log('\n🔄 Voulez-vous la remplacer? (Ctrl+C pour annuler)');
      
      // Attendre 5 secondes pour laisser le temps d'annuler
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Désactiver l'ancienne grille
      existingGlobal.active = false;
      await existingGlobal.save();
      console.log('✅ Ancienne grille désactivée');
    }

    // Créer la nouvelle grille par défaut
    const defaultGrid = new PricingGrid({
      name: 'Grille Tarifaire France 2025',
      description: 'Grille de tarification standard conforme aux normes françaises et européennes',
      isGlobal: true,
      active: true,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 an de validité
      
      rates: {
        perKg: 0.15, // 15 centimes/kg
        
        perKm: {
          urban: 1.80,        // 1.80€/km en ville
          suburban: 1.50,     // 1.50€/km périurbain
          regional: 1.20,     // 1.20€/km régional (50-200km)
          national: 0.90,     // 0.90€/km national (200-500km)
          longDistance: 0.70, // 0.70€/km longue distance (>500km)
          international: 0.65 // 0.65€/km international
        },
        
        perPallet: {
          standard: 12,    // 12€/palette 80x120cm
          euro: 12,        // 12€/palette Europe 80x120cm
          half: 7,         // 7€/demi-palette 60x80cm
          oversized: 25    // 25€/palette hors norme
        }
      },
      
      supplements: {
        refrigerated: 0.40,       // +40% pour frigorifique
        tautliner: 0.10,          // +10% pour bâché
        flatbed: 0.15,            // +15% pour plateau
        tanker: 0.50,             // +50% pour citerne
        tailgate: 0.15,           // +15% pour hayon
        express: 1.0,             // +100% pour express (délai < 24h)
        appointment: 0.20,        // +20% pour rendez-vous
        night: 0.50,              // +50% pour livraison nocturne (20h-6h)
        weekend: 1.0,             // +100% pour week-end
        adr: 0.60,                // +60% pour marchandises dangereuses
        fragile: 0.25,            // +25% pour fragile
        highValue: 0.30,          // +30% pour haute valeur (>5000€)
        mountainAccess: 0.30,     // +30% zones montagneuses
        islandAccess: 0.50,       // +50% îles (Corse, etc.)
        ruralRemote: 0.20,        // +20% rural isolé
        restrictedZone: 0.25,     // +25% centres-villes difficiles d'accès
        perFloor: 15,             // 15€ par étage
        twoPersonDelivery: 0.40,  // +40% pour 2 personnes
        assembly: 35              // 35€ pour montage
      },
      
      seasonalMultipliers: {
        lowSeason: 0.90,       // -10% basse saison (janvier-février, août)
        normalSeason: 1.0,     // Tarif normal
        highSeason: 1.35,      // +35% haute saison (septembre-novembre, mars-juin)
        peakSeason: 1.50       // +50% période de pointe (décembre, Noël)
      },
      
      minimumCharge: 50,       // 50€ minimum de facturation
      defaultVatRate: 0.20,    // TVA 20%
      intraCommunityVat: 0.0   // 0% pour international
    });

    await defaultGrid.save();
    
    console.log('\n✅ Grille de tarification créée avec succès!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📋 ID: ${defaultGrid._id}`);
    console.log(`📝 Nom: ${defaultGrid.name}`);
    console.log(`🌍 Globale: Oui`);
    console.log(`✅ Active: Oui`);
    console.log(`📅 Valide du ${defaultGrid.validFrom.toLocaleDateString('fr-FR')} au ${defaultGrid.validUntil?.toLocaleDateString('fr-FR') || 'Illimité'}`);
    console.log('\n💰 TARIFS DE BASE:');
    console.log(`   • Poids: ${defaultGrid.rates.perKg}€/kg`);
    console.log(`   • Urbain: ${defaultGrid.rates.perKm.urban}€/km`);
    console.log(`   • Régional: ${defaultGrid.rates.perKm.regional}€/km`);
    console.log(`   • National: ${defaultGrid.rates.perKm.national}€/km`);
    console.log(`   • International: ${defaultGrid.rates.perKm.international}€/km`);
    console.log(`   • Palette standard: ${defaultGrid.rates.perPallet.standard}€`);
    console.log(`   • Minimum facturation: ${defaultGrid.minimumCharge}€`);
    console.log('\n📈 SUPPLÉMENTS PRINCIPAUX:');
    console.log(`   • Express: +${(defaultGrid.supplements.express * 100).toFixed(0)}%`);
    console.log(`   • Frigorifique: +${(defaultGrid.supplements.refrigerated * 100).toFixed(0)}%`);
    console.log(`   • Nocturne: +${(defaultGrid.supplements.night * 100).toFixed(0)}%`);
    console.log(`   • Week-end: +${(defaultGrid.supplements.weekend * 100).toFixed(0)}%`);
    console.log(`   • ADR (dangereux): +${(defaultGrid.supplements.adr * 100).toFixed(0)}%`);
    console.log(`   • Montagne: +${(defaultGrid.supplements.mountainAccess * 100).toFixed(0)}%`);
    console.log(`   • Île: +${(defaultGrid.supplements.islandAccess * 100).toFixed(0)}%`);
    console.log(`   • Livraison étage: ${defaultGrid.supplements.perFloor}€/étage`);
    console.log('\n📊 SAISONNALITÉ:');
    console.log(`   • Basse saison: ${(defaultGrid.seasonalMultipliers.lowSeason * 100).toFixed(0)}%`);
    console.log(`   • Haute saison: ${(defaultGrid.seasonalMultipliers.highSeason * 100).toFixed(0)}%`);
    console.log(`   • Période pointe: ${(defaultGrid.seasonalMultipliers.peakSeason * 100).toFixed(0)}%`);
    console.log('\n📊 AUTRES PARAMÈTRES:');
    console.log(`   • TVA: ${(defaultGrid.defaultVatRate * 100).toFixed(0)}%`);
    console.log(`   • Minimum facturation: ${defaultGrid.minimumCharge}€`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n🎯 Prochaines étapes:');
    console.log('   1. Testez le calculateur via l\'interface web');
    console.log('   2. Ajustez les tarifs si nécessaire via PUT /api/pricing/grids/:id');
    console.log('   3. Les transporteurs peuvent créer leurs grilles personnalisées');
    console.log('   4. Générez des devis avec POST /api/pricing/quote');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Déconnecté de MongoDB');
  }
}

// Exécution
if (require.main === module) {
  initializeDefaultPricingGrid()
    .then(() => {
      console.log('\n✅ Initialisation terminée avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Échec de l\'initialisation:', error);
      process.exit(1);
    });
}

export default initializeDefaultPricingGrid;
