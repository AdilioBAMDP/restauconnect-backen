/**
 * 🔧 Script pour corriger les livraisons et ajouter des coordonnées GPS
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const deliverySchema = new mongoose.Schema({}, { strict: false });
const DeliveryModel = mongoose.model('Delivery', deliverySchema);

const userSchema = new mongoose.Schema({ email: String, name: String, role: String, companyName: String });
const User = mongoose.model('User', userSchema);

async function fixDeliveriesWithGPS() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/restauconnect';
    
    console.log('📡 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB\n');

    // 1. Trouver le restaurant et le fournisseur
    const restaurant = await User.findOne({ email: 'restaurant@test.fr' });
    const supplier = await User.findOne({ role: 'fournisseur' });
    const driver = await User.findOne({ role: 'livreur' });

    console.log('🏪 Restaurant:', restaurant?._id);
    console.log('🏭 Fournisseur:', supplier?._id);
    console.log('🚗 Livreur:', driver?._id);

    // 2. Trouver les livraisons du restaurant sans GPS ou avec mauvais fournisseur
    const deliveries = await DeliveryModel.find({
      requesterId: restaurant!._id,
      status: { $in: ['pending', 'assigned', 'pickup_pending', 'in_transit'] }
    });

    console.log(`\n📦 Trouvé ${deliveries.length} livraisons à corriger\n`);

    // 3. Coordonnées GPS réelles à Paris
    const parisLocations = [
      { name: 'Les Halles', lat: 48.8626, lng: 2.3466, street: '1 Rue Pierre Lescot', city: 'Paris' },
      { name: 'Châtelet', lat: 48.8583, lng: 2.3472, street: '7 Place du Châtelet', city: 'Paris' },
      { name: 'Saint-Michel', lat: 48.8534, lng: 2.3444, street: '23 Boulevard Saint-Michel', city: 'Paris' },
      { name: 'Bastille', lat: 48.8532, lng: 2.3694, street: '14 Place de la Bastille', city: 'Paris' },
      { name: 'République', lat: 48.8680, lng: 2.3638, street: 'Place de la République', city: 'Paris' },
      { name: 'Opéra', lat: 48.8718, lng: 2.3318, street: '8 Rue Scribe', city: 'Paris' },
      { name: 'Tour Eiffel', lat: 48.8584, lng: 2.2945, street: 'Champ de Mars', city: 'Paris' },
      { name: 'Notre-Dame', lat: 48.8530, lng: 2.3499, street: '6 Parvis Notre-Dame', city: 'Paris' }
    ];

    const restaurantLocation = { lat: 48.8566, lng: 2.3522, street: '123 Avenue des Champs-Élysées', city: 'Paris' };

    // 4. Mettre à jour chaque livraison
    for (let i = 0; i < Math.min(deliveries.length, 5); i++) {
      const delivery = deliveries[i];
      const pickupLoc = parisLocations[i % parisLocations.length];

      const updateData: any = {
        supplierId: supplier!._id, // Corriger le fournisseur
        pickupAddress: {
          street: pickupLoc.street,
          city: pickupLoc.city,
          postalCode: '75001',
          coordinates: [pickupLoc.lng, pickupLoc.lat],
          latitude: pickupLoc.lat,
          longitude: pickupLoc.lng
        },
        deliveryAddress: {
          street: restaurantLocation.street,
          city: restaurantLocation.city,
          postalCode: '75008',
          coordinates: [restaurantLocation.lng, restaurantLocation.lat],
          latitude: restaurantLocation.lat,
          longitude: restaurantLocation.lng
        },
        estimatedTime: '25 minutes',
        updatedAt: new Date()
      };

      // Assigner un livreur si statut = assigned ou in_transit
      if (['assigned', 'in_transit'].includes((delivery as any).status) && driver) {
        updateData.driverId = driver._id;
        updateData.status = 'in_transit'; // Forcer en transit pour le test
      } else if ((delivery as any).status === 'pending') {
        updateData.status = 'assigned'; // Passer en assigned
        updateData.driverId = driver!._id;
      }

      await DeliveryModel.updateOne(
        { _id: delivery._id },
        { $set: updateData }
      );

      console.log(`✅ Livraison ${i + 1} corrigée:`);
      console.log(`   ID: ${delivery._id}`);
      console.log(`   📍 De: ${pickupLoc.name} (${pickupLoc.lat}, ${pickupLoc.lng})`);
      console.log(`   🎯 Vers: Restaurant (${restaurantLocation.lat}, ${restaurantLocation.lng})`);
      console.log(`   📊 Statut: ${updateData.status || (delivery as any).status}`);
      console.log(`   🚗 Livreur: ${driver?.name || 'Non assigné'}\n`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ LIVRAISONS CORRIGÉES AVEC GPS !');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📱 Actualisez la page et cliquez sur une livraison');
    console.log('🗺️  La carte affichera maintenant les marqueurs GPS !\n');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Déconnecté de MongoDB');
  }
}

fixDeliveriesWithGPS();
