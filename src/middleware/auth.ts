import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { config } from '../config';
import { User } from '../models/User';
import { ApiResponse } from '../types';

// ðŸ”„ MAPPING RÃ”LES FRANÃ‡AIS â†’ ANGLAIS (MongoDB)
// Frontend utilise noms franÃ§ais, MongoDB attend noms anglais
function mapRoleToMongoDB(frontendRole: string): string {
  const roleMap: Record<string, string> = {
    'fournisseur': 'supplier',
    'livreur': 'driver',
    'transporteur': 'carrier',
    'banquier': 'banker',
    'comptable': 'accountant',
    'investisseur': 'investor',
    'auditeur': 'auditor',
    // RÃ´les identiques franÃ§ais/anglais (pas de mapping nÃ©cessaire)
    'restaurant': 'restaurant',
    'artisan': 'artisan',
    'candidat': 'candidat',
    'community_manager': 'community_manager',
    'admin': 'admin',
    'super_admin': 'super_admin'
  };
  return roleMap[frontendRole] || frontendRole;
}

// ðŸ”´ COMPTES DE TEST TEMPORAIRES - Pour Ã©viter les appels MongoDB
const testAccounts = [
  // Comptes livreurs (apps mobiles)
  { id: '18', email: 'test.mobile@restauconnect.com', password: 'Test123!', role: 'livreur', name: 'Chauffeur Test' },
  { id: '19', email: 'livreur@test.fr', password: 'livreur123', role: 'livreur', name: 'Jean Livreur' },
  { id: 'restaurant-001', email: 'restaurant@test.fr', password: 'restaurant123', role: 'restaurant', name: 'Restaurant Test' },
  { id: 'artisan-001', email: 'artisan@test.fr', password: 'artisan123', role: 'artisan', name: 'Artisan Test' },
  { id: 'fournisseur-001', email: 'fournisseur@test.fr', password: 'fournisseur123', role: 'fournisseur', name: 'Fournisseur Test' },
  { id: 'candidat-001', email: 'candidat@test.fr', password: 'candidat123', role: 'candidat', name: 'Candidat Test' },
  
  // Comptes services professionnels
  { id: 'community_manager-001', email: 'community_manager@test.fr', password: 'cm123', role: 'community_manager', name: 'Community Manager Test' },
  { id: 'banquier-001', email: 'banquier@test.fr', password: 'banquier123', role: 'banquier', name: 'Banquier Test' },
  { id: 'investisseur-001', email: 'investisseur@test.fr', password: 'investisseur123', role: 'investisseur', name: 'Investisseur Test' },
  { id: 'comptable-001', email: 'comptable@test.fr', password: 'comptable123', role: 'comptable', name: 'Comptable Test' },
  { id: 'transporteur-001', email: 'transporteur@test.fr', password: 'transporteur123', role: 'transporteur', name: 'Transport Pro', transporteurId: 'transporteur-001' },
  
  // Comptes administration
  { id: 'admin-001', email: 'admin@restauconnect.fr', password: 'admin123', role: 'admin', name: 'Admin Test' },
  { id: 'super_admin-001', email: 'super_admin@test.fr', password: 'superadmin123', role: 'super_admin', name: 'Super Admin Test' }
];

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && typeof authHeader === 'string' && (authHeader as string).split(' ')[1]; // Bearer TOKEN

    console.log('ðŸ” Auth middleware - Header:', authHeader);
    console.log('ðŸ” Auth middleware - Token extracted:', token ? token.substring(0, 20) + '...' : 'NONE');
    console.log('ðŸ” Auth middleware - NODE_ENV:', process.env.NODE_ENV);

    if (!token) {
      console.log('âŒ No token provided');
      res.status(401).json({
        success: false,
        error: 'Access token required'
      } as ApiResponse);
      return;
    }

    // ðŸ§ª Support des tokens de test en dÃ©veloppement
    if (process.env.NODE_ENV !== 'production' && token.startsWith('test-token-')) {
      // console.log('ðŸ§ª Test token detected:', token);
      const userId = token.replace('test-token-', '');
      // console.log('ðŸ§ª Extracted userId:', userId);
      
      // ðŸ”´ Utiliser comptes de test au lieu de MongoDB
      const testUser = testAccounts.find(account => account.id === userId);
      if (!testUser) {
        // console.log('âŒ Test token - user not found for ID:', userId);
        res.status(401).json({
          success: false,
          error: 'Invalid test token - user not found'
        } as ApiResponse);
        return;
      }
      
      // console.log('âœ… Test token validated for user:', testUser.email);
      req.user = {
        userId: testUser.id,
        email: testUser.email,
        role: mapRoleToMongoDB(testUser.role), // ðŸ”„ Mapper rÃ´le franÃ§ais â†’ anglais
        name: testUser.name
      };
      next();
      return;
    }

    console.log('ðŸ”‘ Processing JWT token');
    // Token JWT normal
    const decoded = jwt.verify(token, config.jwt.secret as string) as any;
    console.log('âœ… JWT decoded - userId:', decoded.userId, 'email:', decoded.email);
    
    // ðŸ”´ Utiliser comptes de test au lieu de MongoDB pour les tokens JWT aussi
    const testUser = testAccounts.find(account => account.id === decoded.userId);
    if (testUser) {
      console.log('âœ… JWT token validated for test user:', testUser.email);
      req.user = {
        userId: testUser.id,
        email: testUser.email,
        role: mapRoleToMongoDB(testUser.role), // ðŸ”„ Mapper rÃ´le franÃ§ais â†’ anglais
        name: testUser.name
      };
      next();
      return;
    }
    
    // Fallback vers MongoDB - UTILISER EMAIL car _id est ObjectId mais schÃ©ma attend String
    try {
      console.log('ðŸ” Searching user in MongoDB by email:', decoded.email);
      const user = await User.findOne({ email: decoded.email }).select('-password').exec();
      if (!user) {
        console.log('âŒ JWT token - user not found by email');
        res.status(401).json({
          success: false,
          error: 'Invalid token - user not found'
        } as ApiResponse);
        return;
      }
      console.log('âœ… User found:', user.email, 'role:', user.role);
      // âœ… Le rÃ´le MongoDB est dÃ©jÃ  en anglais, on le garde tel quel
      // âœ… Ajouter userId pour compatibilitÃ© avec routes (sans toObject pour Ã©viter problÃ¨mes)
      (user as any).userId = user._id.toString();
      (user as any).id = user._id.toString();
      req.user = user;
    } catch (mongoError) {
      console.log('âŒ JWT token - MongoDB error:', mongoError);
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      } as ApiResponse);
      return;
    }

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    } as ApiResponse);
  }
};

export const requireRole = (roles: string | string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as ApiResponse);
      return;
    }

    const allowedRoles = (Array.isArray ? Array.isArray(roles) : false) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      } as ApiResponse);
      return;
    }

    next();
  };
};

export const requireAdmin = requireRole(['admin', 'super_admin']);
export const requireSuperAdmin = requireRole('super_admin');

export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && typeof authHeader === 'string' && (authHeader as string).split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret as string) as any;
      
      // ðŸ”´ Utiliser comptes de test au lieu de MongoDB
      const testUser = testAccounts.find(account => account.id === decoded.userId);
      if (testUser) {
        req.user = {
          userId: testUser.id,
          email: testUser.email,
          role: mapRoleToMongoDB(testUser.role), // ðŸ”„ Mapper rÃ´le franÃ§ais â†’ anglais
          name: testUser.name
        };
      } else {
        // Fallback vers MongoDB
        try {
          const user = await User.findById(decoded.userId).select('-preferences').exec();
          req.user = user;
        } catch (mongoError) {
          // Continue without user if MongoDB fails
        }
      }
    }

    next();
  } catch (error) {
    // Continue without user if token is invalid
    next();
  }
};

export const generateTokens = (userId: string) => {
  // @ts-ignore - Temporary fix for JWT type issue
  const accessToken = jwt.sign(
    { userId },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  // @ts-ignore - Temporary fix for JWT type issue
  const refreshToken = jwt.sign(
    { userId },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );

  return { accessToken, refreshToken };
};

export const verifyRefreshToken = (token: string) => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret as string) as any;
  } catch (error) {
    const err = new (globalThis.Error || Error)('Invalid refresh token');
    throw err;
  }
};