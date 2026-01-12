/**
 * Script de génération de données de test complètes pour TMS Pro
 * Crée: Véhicules, Chauffeurs, Livraisons, Routes, Factures
 */

const mongoose = require('mongoose');
const moment = require('moment');
const path = require('path');

// Charger les variables d'environnement
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Connexion MongoDB
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/restauconnect';
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB connecté');
}).catch(err => {
  console.error('❌ Erreur connexion MongoDB:', err);
  process.exit(1);
});

// Définir les schémas directement (compatibilité JavaScript)
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  password: { type: String, default: 'password123' },
  role: String,
  status: String,
  licenseNumber: String,
  licenseExpiryDate: Date,
  vehicleAssigned: mongoose.Schema.Types.ObjectId,
  currentLocation: {
    lat: Number,
    lng: Number
  },
  stats: {
    totalDeliveries: Number,
    completedDeliveries: Number,
    rating: Number,
    onTimeRate: Number
  }
});

const VehicleSchema = new mongoose.Schema({
  registrationNumber: String,
  type: String,
  capacity: Number,
  status: String,
  fuelType: String,
  consumption: Number,
  lastMaintenance: Date,
  nextMaintenance: Date,
  features: [String],
  insurance: {
    provider: String,
    policyNumber: String,
    expiryDate: Date
  }
});

const OrderSchema = new mongoose.Schema({
  orderId: String,
  deliveryId: String,
  clientName: String,
  clientPhone: String,
  pickupAddress: String,
  deliveryAddress: String,
  location: {
    lat: Number,
    lng: Number,
    address: String
  },
  destination: {
    street: String,
    city: String,
    postalCode: String,
    lat: Number,
    lng: Number
  },
  status: String,
  priority: String,
  assignedDriver: mongoose.Schema.Types.ObjectId,
  assignedVehicle: mongoose.Schema.Types.ObjectId,
  distance: Number,
  estimatedTime: Date,
  scheduledDate: Date,
  items: [{
    name: String,
    quantity: Number,
    weight: Number
  }],
  createdAt: { type: Date, default: Date.now }
});

const RouteSchema = new mongoose.Schema({
  name: String,
  date: Date,
  vehicleId: mongoose.Schema.Types.ObjectId,
  driverId: mongoose.Schema.Types.ObjectId,
  deliveries: [mongoose.Schema.Types.ObjectId],
  status: String,
  startTime: Date,
  endTime: Date,
  estimatedDistance: Number,
  estimatedDuration: Number,
  optimized: Boolean,
  stops: [{
    order: Number,
    deliveryId: mongoose.Schema.Types.ObjectId,
    location: {
      lat: Number,
      lng: Number,
      address: String
    },
    estimatedArrival: Date,
    status: String
  }]
});

const InvoiceSchema = new mongoose.Schema({
  invoiceNumber: String,
  clientName: String,
  clientId: String,
  issueDate: Date,
  dueDate: Date,
  status: String,
  subtotal: Number,
  taxAmount: Number,
  total: Number,
  items: [{
    description: String,
    distance: Number,
    basePrice: Number,
    total: Number
  }],
  deliveryIds: [mongoose.Schema.Types.ObjectId],
  paidDate: Date,
  paymentMethod: String,
  notes: String
});

const User = mongoose.model('User', UserSchema);
const Vehicle = mongoose.model('Vehicle', VehicleSchema);
const Order = mongoose.model('Order', OrderSchema);
const Route = mongoose.model('Route', RouteSchema);
const TransportInvoice = mongoose.model('TransportInvoice', InvoiceSchema);

// Données de test
const PARIS_CENTER = { lat: 48.8566, lng: 2.3522 };
const VEHICLES_DATA = [
  { registrationNumber: 'AB-123-CD', type: 'van', capacity: 1200, fuelType: 'diesel' },
  { registrationNumber: 'EF-456-GH', type: 'truck', capacity: 3500, fuelType: 'diesel' },
  { registrationNumber: 'IJ-789-KL', type: 'van', capacity: 1000, fuelType: 'electric' },
  { registrationNumber: 'MN-012-OP', type: 'motorcycle', capacity: 50, fuelType: 'gasoline' },
  { registrationNumber: 'QR-345-ST', type: 'van', capacity: 1500, fuelType: 'diesel' },
  { registrationNumber: 'UV-678-WX', type: 'truck', capacity: 5000, fuelType: 'diesel' }
];

const DRIVERS_DATA = [
  { name: 'Jean Dupont', email: 'jean.dupont@tms.com', phone: '0612345678', licenseNumber: 'DL123456' },
  { name: 'Marie Martin', email: 'marie.martin@tms.com', phone: '0623456789', licenseNumber: 'DL234567' },
  { name: 'Pierre Bernard', email: 'pierre.bernard@tms.com', phone: '0634567890', licenseNumber: 'DL345678' },
  { name: 'Sophie Dubois', email: 'sophie.dubois@tms.com', phone: '0645678901', licenseNumber: 'DL456789' },
  { name: 'Luc Moreau', email: 'luc.moreau@tms.com', phone: '0656789012', licenseNumber: 'DL567890' },
  { name: 'Claire Lefebvre', email: 'claire.lefebvre@tms.com', phone: '0667890123', licenseNumber: 'DL678901' }
];

const ADDRESSES_PARIS = [
  { street: '1 Avenue des Champs-Élysées', city: 'Paris', postalCode: '75008', lat: 48.8698, lng: 2.3078 },
  { street: '5 Rue de Rivoli', city: 'Paris', postalCode: '75001', lat: 48.8566, lng: 2.3522 },
  { street: '10 Boulevard Saint-Germain', city: 'Paris', postalCode: '75005', lat: 48.8499, lng: 2.3471 },
  { street: '15 Rue de la République', city: 'Paris', postalCode: '75011', lat: 48.8566, lng: 2.3799 },
  { street: '20 Avenue Montaigne', city: 'Paris', postalCode: '75008', lat: 48.8656, lng: 2.3052 },
  { street: '25 Rue du Faubourg Saint-Honoré', city: 'Paris', postalCode: '75008', lat: 48.8708, lng: 2.3161 },
  { street: '30 Boulevard Haussmann', city: 'Paris', postalCode: '75009', lat: 48.8738, lng: 2.3327 },
  { street: '35 Rue de Vaugirard', city: 'Paris', postalCode: '75006', lat: 48.8499, lng: 2.3276 },
  { street: '40 Avenue Victor Hugo', city: 'Paris', postalCode: '75116', lat: 48.8704, lng: 2.2856 },
  { street: '45 Rue Lafayette', city: 'Paris', postalCode: '75009', lat: 48.8756, lng: 2.3422 },
  { street: '50 Boulevard Voltaire', city: 'Paris', postalCode: '75011', lat: 48.8566, lng: 2.3799 },
  { street: '55 Rue de Belleville', city: 'Paris', postalCode: '75020', lat: 48.8720, lng: 2.3955 },
  { street: '60 Avenue de la Grande Armée', city: 'Paris', postalCode: '75017', lat: 48.8772, lng: 2.2892 },
  { street: '65 Rue du Commerce', city: 'Paris', postalCode: '75015', lat: 48.8450, lng: 2.2950 },
  { street: '70 Boulevard de Magenta', city: 'Paris', postalCode: '75010', lat: 48.8738, lng: 2.3609 }
];

const CLIENTS_DATA = [
  { name: 'Restaurant Le Gourmet', phone: '0145678901' },
  { name: 'Brasserie Moderne', phone: '0156789012' },
  { name: 'Café du Commerce', phone: '0167890123' },
  { name: 'Bistrot Parisien', phone: '0178901234' },
  { name: 'Traiteur Délices', phone: '0189012345' },
  { name: 'Restaurant Gastronomique', phone: '0190123456' },
  { name: 'Boulangerie Artisanale', phone: '0101234567' },
  { name: 'Pizzeria Napoli', phone: '0112345678' },
  { name: 'Sushi Bar Tokyo', phone: '0123456789' },
  { name: 'Steakhouse Premium', phone: '0134567890' }
];

// Fonction utilitaire pour random
const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => Math.random() * (max - min) + min;
const randomElement = (arr) => arr[random(0, arr.length - 1)];
const randomBoolean = () => Math.random() > 0.5;

// Générer une position GPS aléatoire autour de Paris
const randomLocation = () => ({
  lat: PARIS_CENTER.lat + randomFloat(-0.05, 0.05),
  lng: PARIS_CENTER.lng + randomFloat(-0.08, 0.08)
});

async function generateTestData() {
  console.log('🚀 Génération des données de test TMS Pro...\n');

  try {
    // Nettoyer les anciennes données
    console.log('🧹 Nettoyage des anciennes données...');
    await Vehicle.deleteMany({});
    await User.deleteMany({ role: 'driver' });
    await Order.deleteMany({});
    await Route.deleteMany({});
    await TransportInvoice.deleteMany({});

    // 1. CRÉER LES VÉHICULES
    console.log('\n🚗 Création des véhicules...');
    const vehicles = [];
    for (const vData of VEHICLES_DATA) {
      const vehicle = await Vehicle.create({
        registrationNumber: vData.registrationNumber,
        type: vData.type,
        capacity: vData.capacity,
        status: randomElement(['available', 'in-use', 'maintenance']),
        fuelType: vData.fuelType,
        consumption: randomFloat(6, 12),
        lastMaintenance: moment().subtract(random(10, 90), 'days').toDate(),
        nextMaintenance: moment().add(random(30, 180), 'days').toDate(),
        features: ['GPS', 'Réfrigération', 'Hayon'],
        insurance: {
          provider: 'Assurance TMS',
          policyNumber: `POL${random(100000, 999999)}`,
          expiryDate: moment().add(1, 'year').toDate()
        }
      });
      vehicles.push(vehicle);
      console.log(`  ✅ ${vehicle.registrationNumber} (${vehicle.type})`);
    }

    // 2. CRÉER LES CHAUFFEURS
    console.log('\n👨‍✈️ Création des chauffeurs...');
    const drivers = [];
    for (let i = 0; i < DRIVERS_DATA.length; i++) {
      const dData = DRIVERS_DATA[i];
      const driver = await User.create({
        name: dData.name,
        email: dData.email,
        phone: dData.phone,
        role: 'driver',
        password: 'password123', // Sera hashé automatiquement
        status: 'active',
        licenseNumber: dData.licenseNumber,
        licenseExpiryDate: moment().add(2, 'years').toDate(),
        vehicleAssigned: i < vehicles.length ? vehicles[i]._id : null,
        currentLocation: randomLocation(),
        stats: {
          totalDeliveries: random(50, 500),
          completedDeliveries: random(45, 480),
          rating: randomFloat(3.5, 5.0),
          onTimeRate: randomFloat(75, 98)
        }
      });
      drivers.push(driver);
      console.log(`  ✅ ${driver.name} - ${driver.email}`);
    }

    // 3. CRÉER LES LIVRAISONS
    console.log('\n📦 Création des livraisons...');
    const deliveries = [];
    const statuses = ['pending', 'assigned', 'in-transit', 'delivered', 'failed'];
    const priorities = ['low', 'normal', 'high', 'urgent'];

    for (let i = 0; i < 50; i++) {
      const pickupAddr = randomElement(ADDRESSES_PARIS);
      const deliveryAddr = randomElement(ADDRESSES_PARIS);
      const client = randomElement(CLIENTS_DATA);
      const status = randomElement(statuses);
      const priority = randomElement(priorities);
      const driver = status !== 'pending' ? randomElement(drivers) : null;
      const vehicle = driver ? vehicles.find(v => v._id.equals(driver.vehicleAssigned)) : null;

      const delivery = await Order.create({
        orderId: `ORD${moment().format('YYYYMMDD')}${String(i + 1).padStart(4, '0')}`,
        orderNumber: `ORD${moment().format('YYYYMMDD')}${String(i + 1).padStart(4, '0')}`,
        deliveryId: `DEL${moment().format('YYYYMMDD')}${String(i + 1).padStart(4, '0')}`,
        clientName: client.name,
        clientPhone: client.phone,
        pickupAddress: `${pickupAddr.street}, ${pickupAddr.postalCode} ${pickupAddr.city}`,
        deliveryAddress: `${deliveryAddr.street}, ${deliveryAddr.postalCode} ${deliveryAddr.city}`,
        location: {
          lat: deliveryAddr.lat,
          lng: deliveryAddr.lng,
          address: `${deliveryAddr.street}, ${deliveryAddr.city}`
        },
        destination: {
          street: deliveryAddr.street,
          city: deliveryAddr.city,
          postalCode: deliveryAddr.postalCode,
          lat: deliveryAddr.lat,
          lng: deliveryAddr.lng
        },
        status: status,
        priority: priority,
        assignedDriver: driver ? driver._id : null,
        assignedVehicle: vehicle ? vehicle._id : null,
        distance: randomFloat(2, 25),
        estimatedTime: moment().add(random(30, 180), 'minutes').toDate(),
        scheduledDate: moment().add(random(-2, 7), 'days').toDate(),
        items: [
          {
            name: randomElement(['Colis standard', 'Palette', 'Carton', 'Frigo']),
            quantity: random(1, 10),
            weight: randomFloat(5, 100)
          }
        ],
        createdAt: moment().subtract(random(0, 30), 'days').toDate()
      });
      deliveries.push(delivery);
      
      if ((i + 1) % 10 === 0) {
        console.log(`  ✅ ${i + 1} livraisons créées`);
      }
    }

    // 4. CRÉER LES ROUTES OPTIMISÉES
    console.log('\n🗺️ Création des routes optimisées...');
    const routes = [];
    for (let i = 0; i < 10; i++) {
      const driver = randomElement(drivers);
      const vehicle = vehicles.find(v => v._id.equals(driver.vehicleAssigned));
      const routeDeliveries = deliveries
        .filter(d => d.status === 'assigned' || d.status === 'in-transit')
        .slice(i * 3, (i * 3) + 3);

      if (routeDeliveries.length > 0) {
        const route = await Route.create({
          name: `Route ${moment().format('YYYY-MM-DD')} - ${driver.name}`,
          date: moment().toDate(),
          vehicleId: vehicle ? vehicle._id : null,
          driverId: driver._id,
          deliveries: routeDeliveries.map(d => d._id),
          status: randomElement(['draft', 'active', 'completed']),
          startTime: moment().set({ hour: 8, minute: 0 }).toDate(),
          endTime: moment().set({ hour: 18, minute: 0 }).toDate(),
          estimatedDistance: routeDeliveries.reduce((sum, d) => sum + (d.distance || 0), 0),
          estimatedDuration: routeDeliveries.length * 45, // 45 min par livraison
          optimized: true,
          stops: routeDeliveries.map((d, idx) => ({
            order: idx + 1,
            deliveryId: d._id,
            location: d.location,
            estimatedArrival: moment().add(idx * 45, 'minutes').toDate(),
            status: idx === 0 ? 'completed' : 'pending'
          }))
        });
        routes.push(route);
        console.log(`  ✅ Route ${i + 1} - ${routeDeliveries.length} livraisons`);
      }
    }

    // 5. CRÉER LES FACTURES
    console.log('\n💰 Création des factures...');
    const invoices = [];
    for (let i = 0; i < 20; i++) {
      const client = randomElement(CLIENTS_DATA);
      const clientDeliveries = deliveries
        .filter(d => d.clientName === client.name && d.status === 'delivered')
        .slice(0, random(1, 5));

      if (clientDeliveries.length > 0) {
        const subtotal = clientDeliveries.reduce((sum, d) => {
          const basePrice = (d.distance || 10) * 2.5; // 2.5€/km
          return sum + basePrice;
        }, 0);
        const taxAmount = subtotal * 0.20; // TVA 20%

        const invoice = await TransportInvoice.create({
          invoiceNumber: `INV${moment().format('YYYY')}${String(i + 1).padStart(5, '0')}`,
          clientName: client.name,
          clientId: `CLI${random(1000, 9999)}`,
          issueDate: moment().subtract(random(0, 60), 'days').toDate(),
          dueDate: moment().add(random(15, 45), 'days').toDate(),
          status: randomElement(['draft', 'sent', 'paid', 'overdue']),
          subtotal: Math.round(subtotal * 100) / 100,
          taxAmount: Math.round(taxAmount * 100) / 100,
          total: Math.round((subtotal + taxAmount) * 100) / 100,
          items: clientDeliveries.map(d => ({
            description: `Livraison ${d.deliveryId} - ${d.deliveryAddress}`,
            distance: d.distance || 10,
            basePrice: (d.distance || 10) * 2.5,
            total: (d.distance || 10) * 2.5
          })),
          deliveryIds: clientDeliveries.map(d => d._id),
          paidDate: randomBoolean() ? moment().subtract(random(0, 30), 'days').toDate() : null,
          paymentMethod: randomElement(['card', 'transfer', 'check']),
          notes: 'Facture générée automatiquement'
        });
        invoices.push(invoice);
        console.log(`  ✅ Facture ${invoice.invoiceNumber} - ${invoice.total.toFixed(2)}€`);
      }
    }

    // STATISTIQUES FINALES
    console.log('\n📊 RÉSUMÉ DE LA GÉNÉRATION:');
    console.log('═'.repeat(50));
    console.log(`✅ ${vehicles.length} véhicules créés`);
    console.log(`✅ ${drivers.length} chauffeurs créés`);
    console.log(`✅ ${deliveries.length} livraisons créées`);
    console.log(`   - Pending: ${deliveries.filter(d => d.status === 'pending').length}`);
    console.log(`   - Assigned: ${deliveries.filter(d => d.status === 'assigned').length}`);
    console.log(`   - In-transit: ${deliveries.filter(d => d.status === 'in-transit').length}`);
    console.log(`   - Delivered: ${deliveries.filter(d => d.status === 'delivered').length}`);
    console.log(`   - Failed: ${deliveries.filter(d => d.status === 'failed').length}`);
    console.log(`✅ ${routes.length} routes optimisées créées`);
    console.log(`✅ ${invoices.length} factures créées`);
    console.log('═'.repeat(50));
    console.log('\n🎉 Génération terminée avec succès!');
    console.log('\n💡 Pour tester:');
    console.log('   1. Connectez-vous avec le rôle "transporteur"');
    console.log('   2. Ouvrez le TMS Pro Dashboard');
    console.log('   3. Vous verrez toutes les données en temps réel');

  } catch (error) {
    console.error('❌ Erreur lors de la génération:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Lancer le script
generateTestData();
