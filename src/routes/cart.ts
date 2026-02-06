import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { Cart, ICartItem } from '../models/Cart';
import { Order, IOrderItem } from '../models/Order';

const router = Router();

// Routes pour le panier (cart)
router.get('/:supplierId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { supplierId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Utilisateur non authentifié' });
      return;
    }
    
    // Si c'est un ID de test, retourner panier vide
    if (supplierId === 'test-supplier-id' || supplierId.startsWith('test-')) {
      res.json({
        success: true,
        data: {
          items: [],
          total: 0,
          supplierId
        }
      });
      return;
    }

    const cart = await Cart.findOne({ userId, supplierId }).populate('items.productId').exec();

    if (!cart) {
      res.json({
        success: true,
        data: {
          items: [],
          total: 0,
          supplierId
        }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        items: cart.items,
        total: cart.total,
        supplierId
      }
    });
  } catch (error) {
    // console.error('Erreur r�cup�ration panier:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Ajouter au panier
router.post('/add', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { productId, quantity, supplierId, name, unitPrice } = req.body as {
      productId: string;
      quantity?: number;
      supplierId: string;
      name: string;
      unitPrice: number | string;
    };
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Utilisateur non authentifi�' });
      return;
    }

    if (!productId || !supplierId || !name || !unitPrice) {
      res.status(400).json({ success: false, message: 'Données incomplètes' });
      return;
    }

    // Validation des types
    const quantityNum = (typeof quantity === 'number' && quantity > 0) ? quantity : 1;
    const unitPriceNum = typeof unitPrice === 'number' ? unitPrice : Number.parseFloat(String(unitPrice));

    if (Number.isNaN(unitPriceNum) || unitPriceNum <= 0) {
      res.status(400).json({ success: false, message: 'Prix unitaire invalide' });
      return;
    }

    let cart = await Cart.findOne({ userId, supplierId }).exec();

    if (!cart) {
      cart = new Cart({ userId, supplierId, items: [], total: 0 });
    }

    const existingItem = cart.items.find((item: ICartItem) => item.productId.toString() === productId);

    if (existingItem) {
      existingItem.quantity += quantityNum;
      existingItem.totalPrice = existingItem.quantity * existingItem.unitPrice;
    } else {
      cart.items.push({
        productId: new mongoose.Types.ObjectId(productId),
        name,
        quantity: quantityNum,
        unitPrice: unitPriceNum,
        totalPrice: quantityNum * unitPriceNum
      });
    }

    cart.total = cart.items.reduce((sum: number, item: ICartItem) => sum + item.totalPrice, 0);
    await cart.save();

    res.json({
      success: true,
      message: 'Produit ajouté au panier',
      data: {
        productId,
        quantity: quantityNum,
        supplierId,
        cartTotal: cart.total
      }
    });
  } catch (error) {
    // console.error('Erreur ajout panier:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Supprimer du panier
router.delete('/remove/:productId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.params;
    const { supplierId } = req.body as { supplierId: string };
    const userId = req.user?.id;

    if (!userId || !supplierId) {
      res.status(401).json({ success: false, message: 'Utilisateur ou fournisseur manquant' });
      return;
    }

    const cart = await Cart.findOne({ userId, supplierId }).exec();

    if (!cart) {
      res.status(404).json({ success: false, message: 'Panier non trouvé' });
      return;
    }

    cart.items = cart.items.filter((item: ICartItem) => item.productId.toString() !== productId);
    cart.total = cart.items.reduce((sum: number, item: ICartItem) => sum + item.totalPrice, 0);
    await cart.save();

    res.json({
      success: true,
      message: 'Produit retiré du panier',
      data: {
        items: cart.items,
        total: cart.total
      }
    });
  } catch (error) {
    // console.error('Erreur suppression panier:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Checkout du panier � cr�e r�ellement une Order en base
router.post('/:supplierId/checkout', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { supplierId } = req.params;
    const { deliveryAddress, paymentMethod = 'card' } = req.body as {
      deliveryAddress?: {
        street: string;
        city: string;
        postalCode: string;
        country: string;
      };
      paymentMethod?: 'card' | 'wallet' | 'cash' | 'bank_transfer';
    };
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Utilisateur non authentifi�' });
      return;
    }

    const cart = await Cart.findOne({ userId, supplierId }).exec();

    if (!cart || cart.items.length === 0) {
      res.status(400).json({ success: false, message: 'Panier vide' });
      return;
    }

    // Construire les items attendus par le sch�ma
    const orderItems: IOrderItem[] = cart.items.map((item: ICartItem) => ({
      listingId: item.productId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice
    }));

    const subtotal = cart.total;
    const deliveryFee = deliveryAddress ? 5.0 : 0;
    const tax = Math.round(subtotal * 0.2 * 100) / 100; // TVA 20%
    const platformFee = 0;
    const discount = 0;
    const total = Math.round((subtotal + deliveryFee + tax + platformFee - discount) * 100) / 100;

    // Pr�parer adresses (champ requis par le sch�ma)
    const defaultAddress = {
      street: (deliveryAddress && deliveryAddress.street) || 'Adresse inconnue',
      city: (deliveryAddress && deliveryAddress.city) || 'Paris',
      postalCode: (deliveryAddress && deliveryAddress.postalCode) || '75000',
      country: (deliveryAddress && deliveryAddress.country) || 'France'
    };

    // G�n�rer orderNumber explicitement
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const orderNumber = `ORD-${year}${month}${day}-${random}`;

    // Cr�er la commande
    const orderDoc = new Order({
      restaurantId: userId,
      supplierId: supplierId,
      orderNumber: orderNumber, // Explicitement d�fini
      status: 'pending',
      priority: 'medium',
      items: orderItems,
      pickupAddress: defaultAddress,
      deliveryAddress: deliveryAddress || defaultAddress,
      pricing: {
        subtotal,
        deliveryFee,
        tax,
        platformFee,
        discount,
        total,
        currency: 'EUR'
      },
      payment: {
        method: paymentMethod,
        status: 'pending'
      }
    });

    await orderDoc.save();

    // Vider le panier apr�s commande
    cart.items = [];
    cart.total = 0;
    await cart.save();

    // console.log(`? Cart checkout: Order created ${orderDoc._id} total=${total}�`);

    res.status(201).json({ success: true, order: orderDoc, message: 'Commande cr��e et persist�e' });
  } catch (error) {
    // console.error('? Erreur checkout cart:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', details: (error as any).message });
  }
});

export default router;
