/// <reference lib="es2015" />
import express, { Request, Response } from 'express';
import mongoose from 'mongoose';

const router = express.Router();

/**
 * POST /api/seed/announcements
 * Endpoint temporaire pour créer des annonces de test
 * À SUPPRIMER en production après utilisation
 */
router.post('/announcements', async (req: Request, res: Response) => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Database connection not available'
      });
    }

    // Supprimer les anciennes annonces
    await db.collection('globalannouncements').deleteMany({});

    // Créer 10 annonces de test
    const announcements = [
      {
        title: '🎉 Nouvelle fonctionnalité : Suivi en temps réel',
        content: 'Suivez vos livraisons en temps réel avec notre nouveau système de tracking GPS !',
        type: 'success',
        priority: 'high',
        status: 'active',
        targetAudience: ['restaurant', 'fournisseur', 'transporteur'],
        createdBy: { id: '507f1f77bcf86cd799439011', name: 'Admin RestauConnect', role: 'admin' },
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        viewCount: 0,
        clickCount: 0,
        contactCount: 0
      },
      {
        title: '⚠️ Maintenance programmée le 20 janvier',
        content: 'Une maintenance système est prévue le 20 janvier de 2h à 4h du matin.',
        type: 'warning',
        priority: 'urgent',
        status: 'active',
        targetAudience: [],
        createdBy: { id: '507f1f77bcf86cd799439011', name: 'Service Technique', role: 'admin' },
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
        expiresAt: new Date('2026-01-20'),
        viewCount: 127,
        clickCount: 15,
        contactCount: 3
      },
      {
        title: '💰 Promotion : -15% sur les premières commandes',
        content: 'Profitez de 15% de réduction sur vos 3 premières commandes !',
        type: 'promo',
        priority: 'high',
        status: 'active',
        targetAudience: ['restaurant'],
        createdBy: { id: '507f1f77bcf86cd799439011', name: 'Marketing RestauConnect', role: 'community_manager' },
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
        expiresAt: new Date('2026-01-31'),
        viewCount: 245,
        clickCount: 67,
        contactCount: 12
      },
      {
        title: '📦 Nouveaux produits disponibles',
        content: 'Découvrez notre nouvelle gamme de produits bio et locaux !',
        type: 'info',
        priority: 'normal',
        status: 'active',
        targetAudience: ['restaurant', 'fournisseur'],
        createdBy: { id: '507f1f77bcf86cd799439011', name: 'Équipe Produits', role: 'admin' },
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000),
        viewCount: 189,
        clickCount: 34,
        contactCount: 8
      },
      {
        title: '🚚 Nouveaux transporteurs certifiés',
        content: '5 nouveaux transporteurs certifiés ont rejoint le réseau RestauConnect.',
        type: 'success',
        priority: 'normal',
        status: 'active',
        targetAudience: ['restaurant', 'transporteur'],
        createdBy: { id: '507f1f77bcf86cd799439011', name: 'Service Logistique', role: 'admin' },
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000),
        viewCount: 156,
        clickCount: 28,
        contactCount: 5
      },
      {
        title: '📱 Application mobile disponible',
        content: 'Téléchargez l\'application mobile RestauConnect sur iOS et Android !',
        type: 'info',
        priority: 'high',
        status: 'active',
        targetAudience: ['restaurant', 'livreur'],
        createdBy: { id: '507f1f77bcf86cd799439011', name: 'Équipe Mobile', role: 'admin' },
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
        viewCount: 312,
        clickCount: 89,
        contactCount: 23
      },
      {
        title: '🎓 Formation gratuite : Optimiser vos commandes',
        content: 'Participez à notre webinaire gratuit le 25 janvier.',
        type: 'info',
        priority: 'normal',
        status: 'active',
        targetAudience: ['restaurant'],
        createdBy: { id: '507f1f77bcf86cd799439011', name: 'Formation RestauConnect', role: 'community_manager' },
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
        expiresAt: new Date('2026-01-25'),
        viewCount: 98,
        clickCount: 42,
        contactCount: 18
      },
      {
        title: '⭐ Nouveaux avis et notations',
        content: 'Le système d\'avis et de notations est maintenant disponible !',
        type: 'success',
        priority: 'normal',
        status: 'active',
        targetAudience: [],
        createdBy: { id: '507f1f77bcf86cd799439011', name: 'Admin RestauConnect', role: 'admin' },
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000),
        viewCount: 67,
        clickCount: 12,
        contactCount: 2
      },
      {
        title: '💳 Nouveaux modes de paiement',
        content: 'Payez désormais avec Apple Pay, Google Pay et PayPal !',
        type: 'info',
        priority: 'normal',
        status: 'active',
        targetAudience: ['restaurant', 'fournisseur'],
        createdBy: { id: '507f1f77bcf86cd799439011', name: 'Service Paiements', role: 'admin' },
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
        viewCount: 203,
        clickCount: 45,
        contactCount: 9
      },
      {
        title: '🌟 RestauConnect fête ses 1000 utilisateurs !',
        content: 'Merci à toute la communauté ! Profitez de cadeaux exclusifs tout le mois.',
        type: 'success',
        priority: 'high',
        status: 'active',
        targetAudience: [],
        createdBy: { id: '507f1f77bcf86cd799439011', name: 'Admin RestauConnect', role: 'admin' },
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        viewCount: 12,
        clickCount: 3,
        contactCount: 0
      }
    ];

    const result = await db.collection('globalannouncements').insertMany(announcements);

    res.json({
      success: true,
      message: `${result.insertedCount} annonces créées avec succès`,
      count: result.insertedCount
    });

  } catch (error: any) {
    console.error('❌ Erreur seed announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création des annonces',
      error: error.message
    });
  }
});

export default router;
