import { Types } from 'mongoose';
import { logger } from '../utils/logger';

// Import models (TypeScript compatible)
import { DeliveryModel } from '../models/Delivery';
import DeliveryProposal from '../models/DeliveryProposal';
import { User } from '../models/User';

/**
 * Service d'assignation automatique des livreurs
 * Algorithme de matching basÃƒÂ© sur la proximitÃƒÂ© et la disponibilitÃƒÂ©
 */
class DeliveryMatchingService {
  
  private proposalTimeoutMs: number = 15000; // 15 secondes
  private maxDriversToPropose: number = 10; // Maximum de livreurs ÃƒÂ  contacter
  private searchRadiusKm: number = 10; // Rayon de recherche initial (10 km)
  private testMode: boolean = process.env.TEST_MODE === 'true'; // Mode test: ignore la distance
  
  /**
   * Trouver les livreurs disponibles ÃƒÂ  proximitÃƒÂ©
   * @param pickupCoordinates - CoordonnÃƒÂ©es du point de collecte [longitude, latitude]
   * @param radiusKm - Rayon de recherche en km
   * @returns Liste de livreurs disponibles triÃƒÂ©s par distance
   */
  async findNearbyAvailableDrivers(
    pickupCoordinates: [number, number],
    radiusKm: number = this.searchRadiusKm
  ): Promise<any[]> {
    try {
      // Ã°Å¸Â§Âª MODE TEST: Ignorer complÃƒÂ¨tement la distance gÃƒÂ©ographique
      if (this.testMode) {
        logger.warn('Ã°Å¸Â§Âª MODE TEST ACTIF: Recherche de TOUS les livreurs disponibles (distance ignorÃƒÂ©e)');
        
        const testDrivers = await User.find({
          role: 'driver',
          isOnline: true,
          isAvailable: true,
          isVerified: true,
          currentDelivery: null
        })
        .select('firstName lastName email phone location vehicleType rating completedDeliveries')
        .limit(this.maxDriversToPropose)
        .lean();

        logger.warn(`Ã°Å¸Â§Âª MODE TEST: ${testDrivers.length} livreur(s) trouvÃƒÂ©(s) (distance=0 fictive)`);
        
        return testDrivers.map((driver: any) => ({
          ...driver,
          distance: 0 // Distance fictive en mode test
        }));
      }

      // Ã¢Å“â€¦ MODE PRODUCTION: Recherche gÃƒÂ©ographique normale
      logger.info('Recherche livreurs disponibles', {
        coordinates: pickupCoordinates,
        radiusKm
      });

      // RequÃƒÂªte MongoDB avec $geoNear pour trouver les livreurs les plus proches
      const drivers = await User.aggregate([
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: pickupCoordinates
            },
            distanceField: 'distance', // Distance en mÃƒÂ¨tres
            maxDistance: radiusKm * 1000, // Convertir km en mÃƒÂ¨tres
            spherical: true,
            query: {
              role: 'driver',
              isOnline: true, // Seulement les livreurs en ligne
              isAvailable: true, // Seulement les livreurs disponibles
              isVerified: true // Seulement les livreurs vÃƒÂ©rifiÃƒÂ©s
            }
          }
        },
        {
          $match: {
            currentDelivery: null // Pas de livraison en cours
          }
        },
        {
          $project: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            email: 1,
            phone: 1,
            location: 1,
            distance: 1, // Distance en mÃƒÂ¨tres
            vehicleType: 1,
            rating: 1,
            completedDeliveries: 1
          }
        },
        {
          $sort: { distance: 1 } // Trier par distance croissante
        },
        {
          $limit: this.maxDriversToPropose
        }
      ]);

      logger.info(`${drivers.length} livreur(s) trouvÃƒÂ©(s) dans un rayon de ${radiusKm} km`);

      return drivers;

    } catch (error) {
      logger.error('Erreur recherche livreurs disponibles', error);
      throw error;
    }
  }

  /**
   * Proposer la livraison aux livreurs un par un (algorithme sÃƒÂ©quentiel)
   * @param delivery - Objet Delivery ÃƒÂ  assigner
   * @returns Livraison assignÃƒÂ©e ou null si aucun livreur n'accepte
   */
  async proposeDeliveryToDrivers(delivery: any): Promise<any> {
    try {
      logger.info('DÃƒÂ©but processus assignation automatique', {
        deliveryId: delivery._id,
        pickupAddress: delivery.pickupAddress
      });

      // 1. Trouver les livreurs disponibles
      const drivers = await this.findNearbyAvailableDrivers(
        delivery.pickupAddress.coordinates,
        this.searchRadiusKm
      );

      if (drivers.length === 0) {
        logger.warn('Aucun livreur disponible trouvÃƒÂ©', {
          deliveryId: delivery._id,
          radiusKm: this.searchRadiusKm
        });

        // Marquer la livraison comme non assignÃƒÂ©e
        delivery.status = 'pending';
        await delivery.save();

        // TODO: Notification au restaurateur "Aucun livreur disponible"
        return null;
      }

      // 2. Proposer aux livreurs un par un
      for (let i = 0; i < drivers.length; i++) {
        const driver = drivers[i];
        const distanceKm = (driver.distance / 1000).toFixed(2);

        logger.info(`Proposition ${i + 1}/${drivers.length} au livreur`, {
          driverId: driver._id.toString(),
          driverName: `${driver.firstName} ${driver.lastName}`,
          distance: `${distanceKm} km`
        });

        // CrÃƒÂ©er une proposition
        const proposal = await this.createProposal(delivery._id, driver._id.toString(), driver.distance, i + 1);

        // Envoyer notification au livreur via Socket.io
        const io = (global as any).io; // Socket.io instance globale
        if (io) {
          const driverIdString = driver._id.toString(); // Convertir en string
          io.to(`driver-${driverIdString}`).emit('delivery-proposal', {
            proposalId: proposal._id,
            deliveryId: delivery._id,
            pickupAddress: delivery.pickupAddress,
            deliveryAddress: delivery.deliveryAddress,
            distance: distanceKm,
            estimatedEarnings: this.calculateEarnings(driver.distance, delivery.pricing?.deliveryFee || 5),
            expiresAt: proposal.expiresAt,
            rank: i + 1,
            totalDrivers: drivers.length
          });
        }

        // Attendre la rÃƒÂ©ponse du livreur (15 secondes)
        const accepted = await this.waitForDriverResponse(proposal._id);

        if (accepted) {
          // Le livreur a acceptÃƒÂ© !
          logger.info('Livreur a acceptÃƒÂ© la proposition', {
            driverId: driver._id,
            deliveryId: delivery._id
          });

          // Assigner la livraison
          await this.assignDeliveryToDriver(delivery._id, driver._id);

          return delivery;
        } else {
          // Le livreur a refusÃƒÂ© ou timeout Ã¢â€ â€™ Continuer avec le suivant
          logger.info('Livreur n\'a pas acceptÃƒÂ©, passage au suivant', {
            driverId: driver._id,
            deliveryId: delivery._id,
            rank: i + 1
          });
        }
      }

      // Aucun livreur n'a acceptÃƒÂ©
      logger.warn('Aucun livreur n\'a acceptÃƒÂ© la livraison', {
        deliveryId: delivery._id,
        driversContacted: drivers.length
      });

      delivery.status = 'pending';
      await delivery.save();

      // TODO: Notification au restaurateur "Aucun livreur disponible"
      return null;

    } catch (error) {
      logger.error('Erreur processus assignation automatique', error);
      throw error;
    }
  }

  /**
   * CrÃƒÂ©er une proposition de livraison
   * @param deliveryId - ID de la livraison
   * @param driverId - ID du livreur
   * @param distance - Distance en mÃƒÂ¨tres
   * @param rank - Rang de la proposition (1er, 2ÃƒÂ¨me, etc.)
   */
  private async createProposal(
    deliveryId: Types.ObjectId,
    driverId: Types.ObjectId,
    distance: number,
    rank: number
  ): Promise<any> {
    try {
      // ðŸ“ RÃ‰CUPÃ‰RER LES INFORMATIONS DE LA LIVRAISON
      const delivery = await DeliveryModel.findById(deliveryId)
        .populate('requesterId', 'name firstName lastName email')
        .populate('supplierId', 'name firstName lastName email')
        .populate('orderId', 'orderNumber pricing customerName customerPhone items');

      if (!delivery) {
        throw new Error('Livraison non trouvÃ©e');
      }

      // ðŸ§® CALCULS DES ESTIMATIONS
      const distanceKm = distance / 1000;
      const estimatedDuration = Math.ceil(distanceKm * 3); // 3 min par km
      const estimatedEarnings = this.calculateEarnings(distance, delivery.pricing?.totalCost || 5);
      const matchingScore = Math.max(0, 100 - (distanceKm * 2) - (rank * 5)); // Score basÃ© sur distance et rang

      const expiresAt = new Date(Date.now() + this.proposalTimeoutMs);

      // ðŸ—ï¸ CONSTRUIRE LE PROPOSAL AVEC TOUS LES CHAMPS REQUIS
      const proposal = new DeliveryProposal({
        deliveryId,
        driverId,
        status: 'pending',
        proposedAt: new Date(),
        expiresAt,
        priority: delivery.priority || 'normal',
        estimatedEarnings,
        estimatedDuration,
        estimatedDistance: distanceKm,
        
        // ðŸ“ PICKUP LOCATION
        pickupLocation: {
          latitude: delivery.pickupAddress?.latitude || 48.8566,
          longitude: delivery.pickupAddress?.longitude || 2.3522,
          address: `${delivery.pickupAddress?.street || 'Adresse fournisseur'}, ${delivery.pickupAddress?.city || 'Paris'}`,
          contactName: delivery.pickupAddress?.contactName || 'Fournisseur',
          contactPhone: delivery.pickupAddress?.contactPhone || '0123456789'
        },
        
        // ðŸ“ DELIVERY LOCATION  
        deliveryLocation: {
          latitude: delivery.deliveryAddress?.latitude || 48.8766,
          longitude: delivery.deliveryAddress?.longitude || 2.3722,
          address: `${delivery.deliveryAddress?.street || 'Adresse client'}, ${delivery.deliveryAddress?.city || 'Paris'}`,
          contactName: delivery.deliveryAddress?.contactName || 'Client',
          contactPhone: delivery.deliveryAddress?.contactPhone || '0123456789'
        },
        
        // ðŸ‘¤ CUSTOMER INFO
        customerInfo: {
          name: delivery.customerName || 'Client',
          phone: delivery.customerPhone || '0123456789',
          notes: delivery.specialInstructions
        },
        
        // ðŸ“¦ ORDER INFO
        orderInfo: {
          orderNumber: (delivery as any).orderId?.orderNumber || `ORDER-${Date.now()}`,
          restaurantName: (delivery as any).requesterId?.name || 'Restaurant',
          supplierName: (delivery as any).supplierId?.name || 'Fournisseur',
          totalValue: delivery.totalValue || 50,
          items: delivery.items?.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.value || 10
          })) || [{ name: 'Articles', quantity: 1, price: 50 }],
          specialInstructions: delivery.specialInstructions
        },
        
        matchingScore,
        notificationSent: false,
        viewedByDriver: false,
        
        // ðŸ“Š METADATA
        metadata: {
          algorithmVersion: '1.0',
          matchingFactors: {
            distance: Math.max(0, 100 - (distanceKm * 10)),
            availability: 100,
            rating: 80,
            completionRate: 95
          },
          createdBy: 'AUTO_ASSIGNMENT_ALGORITHM',
          source: 'automatic'
        },
        
        // ðŸ“… TIMELINE
        timeline: [{
          status: 'pending',
          timestamp: new Date(),
          note: `Proposition crÃ©Ã©e pour livreur (rang ${rank})`
        }]
      });

      await proposal.save();

      logger.info('Proposition crÃ©Ã©e avec tous les champs requis', {
        proposalId: proposal._id,
        deliveryId,
        driverId,
        estimatedEarnings,
        estimatedDistance: distanceKm,
        matchingScore,
        expiresAt
      });

      return proposal;

    } catch (error) {
      logger.error('Erreur crÃƒÂ©ation proposition', error);
      throw error;
    }
  }

  /**
   * Attendre la rÃƒÂ©ponse du livreur (Promise avec timeout)
   * @param proposalId - ID de la proposition
   * @returns true si acceptÃƒÂ©, false si refusÃƒÂ©/expirÃƒÂ©
   */
  private async waitForDriverResponse(proposalId: Types.ObjectId): Promise<boolean> {
    return new Promise((resolve) => {
      const checkInterval = 500; // VÃƒÂ©rifier toutes les 500ms
      const maxChecks = this.proposalTimeoutMs / checkInterval; // 15000 / 500 = 30 checks
      let checks = 0;

      const intervalId = setInterval(async () => {
        checks++;

        try {
          const proposal = await DeliveryProposal.findById(proposalId);

          if (!proposal) {
            clearInterval(intervalId);
            resolve(false);
            return;
          }

          // Le livreur a acceptÃƒÂ©
          if (proposal.status === 'accepted') {
            clearInterval(intervalId);
            resolve(true);
            return;
          }

          // Le livreur a refusÃƒÂ©
          if (proposal.status === 'declined') {
            clearInterval(intervalId);
            resolve(false);
            return;
          }

          // Timeout atteint
          if (checks >= maxChecks) {
            clearInterval(intervalId);

            // Marquer comme expirÃƒÂ©
            proposal.status = 'expired';
            await proposal.save();

            logger.info('Proposition expirÃƒÂ©e (timeout)', {
              proposalId,
              driverId: proposal.driverId
            });

            resolve(false);
          }

        } catch (error) {
          logger.error('Erreur vÃƒÂ©rification rÃƒÂ©ponse livreur', error);
          clearInterval(intervalId);
          resolve(false);
        }

      }, checkInterval);
    });
  }

  /**
   * Accepter une proposition (appelÃƒÂ© par le livreur via Socket.io)
   * @param proposalId - ID de la proposition
   * @param driverId - ID du livreur (vÃƒÂ©rification sÃƒÂ©curitÃƒÂ©)
   */
  async acceptProposal(proposalId: string, driverId: string): Promise<any> {
    try {
      const proposal = await DeliveryProposal.findById(proposalId);

      if (!proposal) {
        throw new Error('Proposition non trouvÃƒÂ©e');
      }

      if (proposal.driverId.toString() !== driverId) {
        throw new Error('Livreur non autorisÃƒÂ© ÃƒÂ  accepter cette proposition');
      }

      if (proposal.status !== 'pending') {
        throw new Error(`Proposition dÃƒÂ©jÃƒÂ  ${proposal.status}`);
      }

      // VÃƒÂ©rifier si pas expirÃƒÂ©e
      if (new Date() > proposal.expiresAt) {
        proposal.status = 'expired';
        await proposal.save();
        throw new Error('Proposition expirÃƒÂ©e');
      }

      // Accepter la proposition
      proposal.status = 'accepted';
      proposal.acceptedAt = new Date();
      await proposal.save();

      logger.info('Proposition acceptÃƒÂ©e par livreur', {
        proposalId,
        driverId,
        responseTime: (proposal.acceptedAt ? proposal.acceptedAt.getTime() - proposal.proposedAt.getTime() : null)
      });

      // Annuler toutes les autres propositions pour cette livraison
      await DeliveryProposal.updateMany(
        {
          deliveryId: proposal.deliveryId,
          _id: { $ne: proposalId },
          status: 'pending'
        },
        {
          status: 'expired',
          respondedAt: new Date()
        }
      );

      return proposal;

    } catch (error) {
      logger.error('Erreur acceptation proposition', error);
      throw error;
    }
  }

  /**
   * Refuser une proposition (appelÃƒÂ© par le livreur via Socket.io)
   * @param proposalId - ID de la proposition
   * @param driverId - ID du livreur
   * @param reason - Raison du refus
   */
  async rejectProposal(
    proposalId: string,
    driverId: string,
    reason: 'too_far' | 'too_busy' | 'break_time' | 'other' = 'other'
  ): Promise<any> {
    try {
      const proposal = await DeliveryProposal.findById(proposalId);

      if (!proposal) {
        throw new Error('Proposition non trouvÃƒÂ©e');
      }

      if (proposal.driverId.toString() !== driverId) {
        throw new Error('Livreur non autorisÃƒÂ© ÃƒÂ  refuser cette proposition');
      }

      if (proposal.status !== 'pending') {
        throw new Error(`Proposition dÃƒÂ©jÃƒÂ  ${proposal.status}`);
      }

      // Refuser la proposition
      proposal.status = 'declined';
      proposal.declinedAt = new Date();
      await proposal.save();

      logger.info('Proposition refusÃƒÂ©e par livreur', {
        proposalId,
        driverId,
        reason,
        responseTime: (proposal.declinedAt ? proposal.declinedAt.getTime() - proposal.proposedAt.getTime() : null)
      });

      return proposal;

    } catch (error) {
      logger.error('Erreur refus proposition', error);
      throw error;
    }
  }

  /**
   * Assigner une livraison ÃƒÂ  un livreur
   * @param deliveryId - ID de la livraison
   * @param driverId - ID du livreur
   */
  private async assignDeliveryToDriver(
    deliveryId: Types.ObjectId,
    driverId: Types.ObjectId
  ): Promise<any> {
    try {
      // Mettre Ã  jour la livraison
      const delivery = await DeliveryModel.findById(deliveryId);
      delivery.driverId = driverId;
      delivery.status = 'assigned';
      delivery.assignedAt = new Date();
      await delivery.save();

      // Mettre ÃƒÂ  jour le livreur
      await User.findByIdAndUpdate(driverId, {
        currentDelivery: deliveryId,
        isAvailable: false
      });

      logger.info('Livraison assignÃƒÂ©e au livreur', {
        deliveryId,
        driverId
      });

      // Envoyer notifications Socket.io
      const io = (global as any).io;
      if (io) {
        // Notification au livreur
        io.to(`driver-${driverId}`).emit('delivery-assigned', {
          deliveryId: delivery._id,
          pickupAddress: delivery.pickupAddress,
          deliveryAddress: delivery.deliveryAddress,
          status: 'assigned'
        });

        // Notification au restaurateur/client
        if (delivery.requesterId) {
          io.to(delivery.requesterId.toString()).emit('delivery-driver-found', {
            deliveryId: delivery._id,
            driverId,
            status: 'assigned'
          });
        }
      }

      return delivery;

    } catch (error) {
      logger.error('Erreur assignation livraison', error);
      throw error;
    }
  }

  /**
   * Calculer les gains estimÃƒÂ©s pour le livreur
   * @param distanceMeters - Distance en mÃƒÂ¨tres
   * @param baseFee - Frais de livraison de base
   * @returns Gains estimÃƒÂ©s en euros
   */
  private calculateEarnings(distanceMeters: number, baseFee: number = 5): number {
    const distanceKm = distanceMeters / 1000;
    const distanceBonus = distanceKm * 0.5; // 0.50Ã¢â€šÂ¬ par km
    return parseFloat((baseFee + distanceBonus).toFixed(2));
  }

  /**
   * Job cron pour expirer les propositions en attente
   * Ãƒâ‚¬ exÃƒÂ©cuter toutes les 5 secondes
   */
  async expirePendingProposals(): Promise<void> {
    try {
      const result = await DeliveryProposal.expirePendingProposals();
      
      if (result.modifiedCount > 0) {
        logger.info(`${result.modifiedCount} proposition(s) expirÃƒÂ©e(s)`);
      }

    } catch (error) {
      logger.error('Erreur expiration propositions', error);
    }
  }

  /**
   * Job cron pour rÃƒÂ©essayer les livraisons non assignÃƒÂ©es
   * Ãƒâ‚¬ exÃƒÂ©cuter toutes les minutes
   */
  async retryUnassignedDeliveries(): Promise<void> {
    try {
      const unassignedDeliveries = await DeliveryModel.find({
        status: 'pending',
        createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Moins d'1h
      });

      logger.info(`${unassignedDeliveries.length} livraison(s) non assignÃƒÂ©e(s) ÃƒÂ  rÃƒÂ©essayer`);

      for (const delivery of unassignedDeliveries) {
        await this.proposeDeliveryToDrivers(delivery);
      }

    } catch (error) {
      logger.error('Erreur rÃƒÂ©essai livraisons non assignÃƒÂ©es', error);
    }
  }

  /**
   * Obtenir les statistiques d'un livreur
   * @param driverId - ID du livreur
   * @param days - Nombre de jours ÃƒÂ  analyser
   */
  async getDriverStats(driverId: string, days: number = 30): Promise<any> {
    try {
      const stats = await DeliveryProposal.getDriverStats(driverId, days);
      return stats;
    } catch (error) {
      logger.error('Erreur rÃƒÂ©cupÃƒÂ©ration stats livreur', error);
      throw error;
    }
  }
}

export default new DeliveryMatchingService();

