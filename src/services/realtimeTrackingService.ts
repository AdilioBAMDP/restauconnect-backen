/**
 * Service de tracking GPS temps réel pour les livreurs
 * Gère les positions GPS, calculs ETA, notifications
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import mongoose from 'mongoose';
import { TransporteurDelivery } from '../models/TransporteurDelivery';
import { DriverEmployee } from '../models/DriverEmployee';
import Route from '../models/Route';

interface LocationUpdate {
  driverId: string;
  deliveryId?: string;
  routeId?: string;
  location: {
    lat: number;
    lng: number;
  };
  speed?: number; // km/h
  heading?: number; // degrés
  accuracy?: number; // mètres
  timestamp: Date;
}

interface ETACalculation {
  deliveryId: string;
  estimatedArrival: Date;
  distanceRemaining: number; // km
  trafficFactor: number; // 1.0 = normal, 1.5 = trafic dense
}

class RealtimeTrackingService {
  private io: SocketIOServer;
  private activeDrivers: Map<string, Socket> = new Map();
  private driverLocations: Map<string, LocationUpdate> = new Map();

  constructor(io: SocketIOServer) {
    this.io = io;
    this.initializeSocketHandlers();
  }

  /**
   * Initialise les event handlers Socket.io
   */
  private initializeSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      // console.log(`[Tracking] Client connected: ${socket.id}`);

      // Event: Chauffeur se connecte
      socket.on('driver:connect', async (data: { driverId: string; transporteurId: string }) => {
        try {
          const { driverId, transporteurId } = data;
          
          // Vérifier que le chauffeur existe
          const driver = await DriverEmployee.findById(driverId);
          if (!driver) {
            socket.emit('error', { message: 'Chauffeur introuvable' });
            return;
          }

          // Enregistrer le socket du chauffeur
          this.activeDrivers.set(driverId, socket);
          socket.join(`transporteur:${transporteurId}`);
          socket.join(`driver:${driverId}`);

          // Mettre à jour le statut du chauffeur
          await DriverEmployee.findByIdAndUpdate(driverId, {
            status: 'on_delivery'
          });

          socket.emit('driver:connected', { driverId, status: 'connected' });
          
          // Notifier le transporteur
          this.io.to(`transporteur:${transporteurId}`).emit('driver:online', {
            driverId,
            timestamp: new Date()
          });

          // console.log(`[Tracking] Driver ${driverId} connected and tracking started`);
        } catch (error: any) {
          // console.error('[Tracking] Error in driver:connect:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // Event: Mise à jour position GPS
      socket.on('location:update', async (data: LocationUpdate) => {
        try {
          const { driverId, deliveryId, routeId, location, speed, heading, accuracy } = data;

          // Valider les données GPS
          if (!location.lat || !location.lng) {
            socket.emit('error', { message: 'Coordonnées GPS invalides' });
            return;
          }

          // Stocker la position en cache
          this.driverLocations.set(driverId, {
            ...data,
            timestamp: new Date()
          });

          // Mettre à jour la position dans la BDD
          await DriverEmployee.findByIdAndUpdate(driverId, {
            currentLocation: {
              lat: location.lat,
              lng: location.lng
            }
          });

          // Si une livraison est en cours, mettre à jour le tracking
          if (deliveryId) {
            await TransporteurDelivery.findByIdAndUpdate(deliveryId, {
              $push: {
                trackingHistory: {
                  location: {
                    lat: location.lat,
                    lng: location.lng
                  },
                  timestamp: new Date(),
                  speed,
                  status: 'in_transit'
                }
              },
              currentLocation: {
                lat: location.lat,
                lng: location.lng
              }
            });

            // Calculer l'ETA mise à jour
            const eta = await this.calculateETA(deliveryId, location);
            
            // Émettre la mise à jour aux observateurs
            const delivery = await TransporteurDelivery.findById(deliveryId)
              .select('transporteurId clientId')
              .lean();

            if (delivery) {
              this.io.to(`transporteur:${delivery.transporteurId}`).emit('delivery:location', {
                deliveryId,
                driverId,
                location,
                speed,
                heading,
                eta,
                timestamp: new Date()
              });

              // Notifier le client si tracking partagé
              if (delivery.clientId) {
                this.io.to(`client:${delivery.clientId}`).emit('delivery:tracking', {
                  deliveryId,
                  location,
                  eta,
                  timestamp: new Date()
                });
              }
            }
          }

          // Mettre à jour la route si applicable
          if (routeId) {
            await this.updateRouteProgress(routeId, driverId, location);
          }

        } catch (error: any) {
          // console.error('[Tracking] Error in location:update:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // Event: Chauffeur démarre une livraison
      socket.on('delivery:start', async (data: { deliveryId: string; driverId: string }) => {
        try {
          const { deliveryId, driverId } = data;

          const delivery = await TransporteurDelivery.findByIdAndUpdate(deliveryId, {
            status: 'in_transit',
            actualPickupTime: new Date()
          }, { new: true });

          if (!delivery) {
            socket.emit('error', { message: 'Livraison introuvable' });
            return;
          }

          // Notifier le transporteur
          this.io.to(`transporteur:${delivery.transporteurId}`).emit('delivery:started', {
            deliveryId,
            driverId,
            timestamp: new Date()
          });

          socket.emit('delivery:start:success', { deliveryId });
        } catch (error: any) {
          // console.error('[Tracking] Error in delivery:start:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // Event: Chauffeur arrive à destination
      socket.on('delivery:arrive', async (data: { deliveryId: string; driverId: string; location: { lat: number; lng: number } }) => {
        try {
          const { deliveryId, driverId, location } = data;

          const delivery = await TransporteurDelivery.findByIdAndUpdate(deliveryId, {
            status: 'arrived',
            actualDeliveryTime: new Date(),
            $push: {
              trackingHistory: {
                location,
                timestamp: new Date(),
                status: 'arrived'
              }
            }
          }, { new: true });

          if (!delivery) {
            socket.emit('error', { message: 'Livraison introuvable' });
            return;
          }

          // Notifier toutes les parties
          this.io.to(`transporteur:${delivery.transporteurId}`).emit('delivery:arrived', {
            deliveryId,
            driverId,
            timestamp: new Date()
          });

          if (delivery.clientId) {
            this.io.to(`client:${delivery.clientId}`).emit('delivery:arrived', {
              deliveryId,
              timestamp: new Date()
            });
          }

          socket.emit('delivery:arrive:success', { deliveryId });
        } catch (error: any) {
          // console.error('[Tracking] Error in delivery:arrive:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // Event: Livraison complétée
      socket.on('delivery:complete', async (data: { deliveryId: string; driverId: string; proofOfDelivery?: string }) => {
        try {
          const { deliveryId, driverId, proofOfDelivery } = data;

          const updateData: any = {
            status: 'delivered',
            actualDeliveryTime: new Date()
          };

          if (proofOfDelivery) {
            updateData.proofOfDelivery = proofOfDelivery;
          }

          const delivery = await TransporteurDelivery.findByIdAndUpdate(deliveryId, updateData, { new: true });

          if (!delivery) {
            socket.emit('error', { message: 'Livraison introuvable' });
            return;
          }

          // Mettre à jour les statistiques du chauffeur
          await DriverEmployee.findByIdAndUpdate(driverId, {
            $inc: { 'performance.totalDeliveries': 1 }
          });

          // Notifier
          this.io.to(`transporteur:${delivery.transporteurId}`).emit('delivery:completed', {
            deliveryId,
            driverId,
            timestamp: new Date()
          });

          socket.emit('delivery:complete:success', { deliveryId });
        } catch (error: any) {
          // console.error('[Tracking] Error in delivery:complete:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // Event: Chauffeur se déconnecte
      socket.on('driver:disconnect', async (data: { driverId: string }) => {
        try {
          const { driverId } = data;

          // Retirer du tracking actif
          this.activeDrivers.delete(driverId);
          this.driverLocations.delete(driverId);

          // Mettre à jour le statut
          const driver = await DriverEmployee.findByIdAndUpdate(driverId, {
            status: 'off_duty'
          });

          if (driver) {
            this.io.to(`transporteur:${driver.transporteurId}`).emit('driver:offline', {
              driverId,
              timestamp: new Date()
            });
          }

          // console.log(`[Tracking] Driver ${driverId} disconnected`);
        } catch (error: any) {
          // console.error('[Tracking] Error in driver:disconnect:', error);
        }
      });

      // Déconnexion socket
      socket.on('disconnect', () => {
        // Trouver et nettoyer le chauffeur déconnecté
        for (const [driverId, driverSocket] of this.activeDrivers.entries()) {
          if (driverSocket.id === socket.id) {
            this.activeDrivers.delete(driverId);
            this.driverLocations.delete(driverId);
            // console.log(`[Tracking] Driver ${driverId} socket disconnected`);
            break;
          }
        }
      });
    });
  }

  /**
   * Calcule l'ETA pour une livraison
   */
  private async calculateETA(deliveryId: string, currentLocation: { lat: number; lng: number }): Promise<ETACalculation | null> {
    try {
      const delivery = await TransporteurDelivery.findById(deliveryId).lean();
      if (!delivery || !delivery.deliveryAddress) {
        return null;
      }

      const destLat = delivery.deliveryAddress.lat || 0;
      const destLng = delivery.deliveryAddress.lng || 0;

      // Calculer la distance restante (formule Haversine)
      const distanceRemaining = this.calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        destLat,
        destLng
      );

      // Facteur de trafic (simplifié - pourrait être amélioré avec API trafic)
      const hour = new Date().getHours();
      let trafficFactor = 1.0;
      if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
        trafficFactor = 1.4; // Heures de pointe
      }

      // Vitesse moyenne urbaine: 30 km/h
      const avgSpeed = 30;
      const adjustedSpeed = avgSpeed / trafficFactor;
      
      // Temps estimé en heures
      const hoursRemaining = distanceRemaining / adjustedSpeed;
      const minutesRemaining = hoursRemaining * 60;

      const estimatedArrival = new Date();
      estimatedArrival.setMinutes(estimatedArrival.getMinutes() + minutesRemaining);

      return {
        deliveryId,
        estimatedArrival,
        distanceRemaining,
        trafficFactor
      };
    } catch (error) {
      // console.error('[ETA] Calculation error:', error);
      return null;
    }
  }

  /**
   * Formule Haversine pour distance GPS
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Rayon de la Terre en km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Met à jour la progression d'une route
   */
  private async updateRouteProgress(routeId: string, driverId: string, currentLocation: { lat: number; lng: number }): Promise<void> {
    try {
      const route = await Route.findById(routeId);
      if (!route) return;

      // Trouver le prochain arrêt non complété
      const nextStop = route.stops.find(stop => stop.status !== 'completed');
      if (!nextStop) return;

      // Calculer distance au prochain arrêt
      const distanceToNext = this.calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        nextStop.address.lat,
        nextStop.address.lng
      );

      // Si proche (< 200m), marquer comme "arrived"
      if (distanceToNext < 0.2) {
        nextStop.status = 'arrived';
        await route.save();

        // Notifier
        this.io.to(`transporteur:${route.transporteurId}`).emit('route:approaching', {
          routeId,
          driverId,
          stopSequence: nextStop.sequence,
          deliveryId: nextStop.deliveryId,
          distance: distanceToNext
        });
      }
    } catch (error) {
      // console.error('[Route Progress] Error:', error);
    }
  }

  /**
   * Obtenir la position actuelle d'un chauffeur
   */
  public getDriverLocation(driverId: string): LocationUpdate | undefined {
    return this.driverLocations.get(driverId);
  }

  /**
   * Obtenir tous les chauffeurs actifs
   */
  public getActiveDrivers(): string[] {
    return Array.from(this.activeDrivers.keys());
  }

  /**
   * Forcer une mise à jour de position (pour tests)
   */
  public async forceLocationUpdate(driverId: string, location: { lat: number; lng: number }): Promise<void> {
    const socket = this.activeDrivers.get(driverId);
    if (socket) {
      socket.emit('location:request', { timestamp: new Date() });
    }
  }
}

export default RealtimeTrackingService;
