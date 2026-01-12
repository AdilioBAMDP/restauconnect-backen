import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

/**
 * Middleware pour vérifier que l'utilisateur est un transporteur (owner)
 */
export const requireTransporteurRole = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentification requise' });
  }

  if (req.user.role !== 'transporteur' && req.user.role !== 'super_admin') {
    return res.status(403).json({ 
      error: 'Accès réservé aux transporteurs',
      requiredRole: 'transporteur',
      currentRole: req.user.role 
    });
  }

  return next();
};

/**
 * Middleware pour vérifier les permissions d'un utilisateur transporteur
 * @param permission - La permission requise (ex: 'manage_fleet', 'create_documents', etc.)
 */
export const requireTransporteurPermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    // Super admin a toutes les permissions
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Owner transporteur a toutes les permissions
    if (req.user.role === 'transporteur') {
      return next();
    }

    // Vérifier les permissions pour les utilisateurs transporteur
    if (req.user.transporteurRole) {
      const userPermissions = req.user.permissions || [];
      
      if (!userPermissions.includes(permission)) {
        return res.status(403).json({ 
          error: 'Permission insuffisante',
          requiredPermission: permission,
          userPermissions: userPermissions 
        });
      }
      
      return next();
    }

    return res.status(403).json({ 
      error: 'Accès non autorisé',
      message: 'Vous devez être un utilisateur transporteur pour accéder à cette ressource'
    });
  };
};

/**
 * Liste des permissions disponibles pour les utilisateurs transporteur
 */
export const TRANSPORTEUR_PERMISSIONS = {
  // Gestion de la flotte
  MANAGE_FLEET: 'manage_fleet',
  VIEW_FLEET: 'view_fleet',
  
  // Gestion des chauffeurs
  MANAGE_DRIVERS: 'manage_drivers',
  VIEW_DRIVERS: 'view_drivers',
  ASSIGN_DRIVERS: 'assign_drivers',
  
  // Gestion des utilisateurs
  MANAGE_USERS: 'manage_users',
  VIEW_USERS: 'view_users',
  
  // Documents de transport
  CREATE_DOCUMENTS: 'create_documents',
  VIEW_DOCUMENTS: 'view_documents',
  SIGN_DOCUMENTS: 'sign_documents',
  
  // Livraisons
  MANAGE_DELIVERIES: 'manage_deliveries',
  VIEW_DELIVERIES: 'view_deliveries',
  ASSIGN_DELIVERIES: 'assign_deliveries',
  
  // Maintenance
  MANAGE_MAINTENANCE: 'manage_maintenance',
  VIEW_MAINTENANCE: 'view_maintenance',
  SCHEDULE_MAINTENANCE: 'schedule_maintenance',
  
  // Analytics & Finance
  VIEW_ANALYTICS: 'view_analytics',
  VIEW_FINANCIAL_DATA: 'view_financial_data',
  MANAGE_PAYROLL: 'manage_payroll',
  
  // Marketplace
  VIEW_MARKETPLACE: 'view_marketplace',
  BID_ON_OFFERS: 'bid_on_offers'
};

/**
 * Rôles prédéfinis avec leurs permissions
 */
export const TRANSPORTEUR_ROLES = {
  owner: [
    // Toutes les permissions
    ...Object.values(TRANSPORTEUR_PERMISSIONS)
  ],
  dispatcher: [
    TRANSPORTEUR_PERMISSIONS.VIEW_FLEET,
    TRANSPORTEUR_PERMISSIONS.VIEW_DRIVERS,
    TRANSPORTEUR_PERMISSIONS.ASSIGN_DRIVERS,
    TRANSPORTEUR_PERMISSIONS.MANAGE_DELIVERIES,
    TRANSPORTEUR_PERMISSIONS.VIEW_DELIVERIES,
    TRANSPORTEUR_PERMISSIONS.ASSIGN_DELIVERIES,
    TRANSPORTEUR_PERMISSIONS.VIEW_DOCUMENTS,
    TRANSPORTEUR_PERMISSIONS.CREATE_DOCUMENTS,
    TRANSPORTEUR_PERMISSIONS.VIEW_MARKETPLACE,
    TRANSPORTEUR_PERMISSIONS.BID_ON_OFFERS
  ],
  accountant: [
    TRANSPORTEUR_PERMISSIONS.VIEW_ANALYTICS,
    TRANSPORTEUR_PERMISSIONS.VIEW_FINANCIAL_DATA,
    TRANSPORTEUR_PERMISSIONS.MANAGE_PAYROLL,
    TRANSPORTEUR_PERMISSIONS.VIEW_DELIVERIES
  ],
  driver: [
    TRANSPORTEUR_PERMISSIONS.VIEW_DELIVERIES,
    TRANSPORTEUR_PERMISSIONS.VIEW_DOCUMENTS,
    TRANSPORTEUR_PERMISSIONS.SIGN_DOCUMENTS
  ],
  maintenance_manager: [
    TRANSPORTEUR_PERMISSIONS.VIEW_FLEET,
    TRANSPORTEUR_PERMISSIONS.MANAGE_FLEET,
    TRANSPORTEUR_PERMISSIONS.MANAGE_MAINTENANCE,
    TRANSPORTEUR_PERMISSIONS.VIEW_MAINTENANCE,
    TRANSPORTEUR_PERMISSIONS.SCHEDULE_MAINTENANCE
  ]
};
