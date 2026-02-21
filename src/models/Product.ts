import mongoose, { Schema, Document } from 'mongoose';

// Interface TypeScript pour le produit
export interface IProduct extends Document {
  // Identification
  supplierId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  
  // Images
  imageUrl: string; // URL de l'image principale
  images: string[]; // Tableau d'URLs pour galerie
  
  // Prix et unitÃƒÂ©s
  price: number;
  unit: string; // kg, L, piÃƒÂ¨ce, boÃƒÂ®te, etc.
  minimumQuantity: number;
  
  // Stock
  stockQuantity: number;
  lowStockThreshold: number;
  
  // Informations produit
  origin?: string; // Origine gÃƒÂ©ographique
  certifications?: string[]; // Bio, Label Rouge, AOP, etc.
  allergens?: string[]; // AllergÃƒÂ¨nes
  nutritionalInfo?: {
    calories?: number;
    proteins?: number;
    carbs?: number;
    fats?: number;
    [key: string]: unknown;
  };
  
  // Conditions de livraison
  deliveryConditions?: {
    minimumOrder?: number;
    freeDeliveryThreshold?: number;
    leadTime?: number; // DÃƒÂ©lai en heures
    deliveryDays?: string[]; // Jours de livraison disponibles
  };
  
  // Statut et disponibilitÃƒÂ©
  isActive: boolean;
  isAvailable: boolean;
  isFeatured: boolean; // Produit mis en avant
  
  // MÃƒÂ©tadonnÃƒÂ©es
  tags: string[];
  sku?: string; // Code produit
  barcode?: string;
  
  // Statistiques
  views: number;
  orders: number;
  averageRating?: number;
  
  // Dates
  createdAt: Date;
  updatedAt: Date;
}

// SchÃƒÂ©ma Mongoose
const ProductSchema = new Schema<IProduct>(
  {
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      required: true,
      maxlength: 2000
    },
    category: {
      type: String,
      required: true,
      enum: [
        'Fruits & LÃƒÂ©gumes',
        'Viandes & Volailles',
        'Poissons & Fruits de Mer',
        'Produits Laitiers',
        'Boulangerie & PÃƒÂ¢tisserie',
        'Ãƒâ€°picerie',
        'Boissons',
        'SurgelÃƒÂ©s',
        'Ãƒâ€°quipements',
        'Autres'
      ],
      index: true
    },
    subcategory: {
      type: String,
      trim: true
    },
    
    // Images
    imageUrl: {
      type: String,
      required: true,
      default: '/images/products/default.jpg'
    },
    images: {
      type: [String],
      default: []
    },
    
    // Prix et unitÃƒÂ©s
    price: {
      type: Number,
      required: true,
      min: 0
    },
    unit: {
      type: String,
      required: true,
      enum: ['kg', 'L', 'piÃƒÂ¨ce', 'boÃƒÂ®te', 'sachet', 'lot', 'g', 'mL', 'unitÃƒÂ©']
    },
    minimumQuantity: {
      type: Number,
      default: 1,
      min: 1
    },
    
    // Stock
    stockQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    lowStockThreshold: {
      type: Number,
      default: 10
    },
    
    // Informations produit
    origin: {
      type: String,
      trim: true
    },
    certifications: {
      type: [String],
      default: []
    },
    allergens: {
      type: [String],
      default: []
    },
    nutritionalInfo: {
      type: Schema.Types.Mixed,
      default: {}
    },
    
    // Conditions de livraison
    deliveryConditions: {
      minimumOrder: { type: Number, default: 0 },
      freeDeliveryThreshold: { type: Number, default: 0 },
      leadTime: { type: Number, default: 24 },
      deliveryDays: { type: [String], default: [] }
    },
    
    // Statut
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    isFeatured: {
      type: Boolean,
      default: false
    },
    
    // MÃƒÂ©tadonnÃƒÂ©es
    tags: {
      type: [String],
      default: []
    },
    sku: {
      type: String,
      trim: true,
      unique: true,
      sparse: true
    },
    barcode: {
      type: String,
      trim: true
    },
    
    // Statistiques
    views: {
      type: Number,
      default: 0
    },
    orders: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      min: 0,
      max: 5
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Index composÃƒÂ© pour recherche optimisÃƒÂ©e
ProductSchema.index({ supplierId: 1, category: 1, isActive: 1 });
ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Virtuals
ProductSchema.virtual('isLowStock').get(function() {
  return this.stockQuantity <= this.lowStockThreshold;
});

ProductSchema.virtual('isOutOfStock').get(function() {
  return this.stockQuantity === 0;
});

// MÃƒÂ©thodes d'instance
ProductSchema.methods.decrementStock = async function(quantity: number) {
  if (this.stockQuantity < quantity) {
    throw new Error('Stock insuffisant');
  }
  this.stockQuantity -= quantity;
  this.orders += 1;
  return this.save();
};

ProductSchema.methods.incrementStock = async function(quantity: number) {
  this.stockQuantity += quantity;
  return this.save();
};

ProductSchema.methods.incrementViews = async function() {
  this.views += 1;
  return this.save();
};

// MÃƒÂ©thodes statiques
ProductSchema.statics.findBySupplier = function(supplierId: string) {
  return this.find({ supplierId, isActive: true }).sort({ name: 1 });
};

ProductSchema.statics.findByCategory = function(category: string) {
  return this.find({ category, isActive: true, isAvailable: true }).sort({ name: 1 });
};

ProductSchema.statics.searchProducts = function(searchTerm: string) {
  return this.find(
    { $text: { $search: searchTerm }, isActive: true, isAvailable: true },
    { score: { $meta: 'textScore' } }
  ).sort({ score: { $meta: 'textScore' } });
};

ProductSchema.statics.getFeaturedProducts = function(limit = 10) {
  return this.find({ isFeatured: true, isActive: true, isAvailable: true })
    .sort({ orders: -1, averageRating: -1 })
    .limit(limit);
};

const Product = mongoose.model<IProduct>('Product', ProductSchema);

export default Product;


