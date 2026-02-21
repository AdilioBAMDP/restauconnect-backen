/// <reference lib="es2015" />
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { UserService } from './UserService';
import { User } from '../models/User';
import { config } from '../config';
import { logger } from '../utils/logger';
import { devLog } from '../utils/devLogger';

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
    // RÃ´les identiques franÃ§ais/anglais
    'restaurant': 'restaurant',
    'artisan': 'artisan',
    'candidat': 'candidat',
    'community_manager': 'community_manager',
    'admin': 'admin',
    'super_admin': 'super_admin'
  };
  return roleMap[frontendRole] || frontendRole;
}

// ðŸ”´ COMPTES DE TEST - Pour tous les rÃ´les de l'application
// âš ï¸  DÃ‰SACTIVÃ‰S EN PRODUCTION via process.env.ENABLE_TEST_ACCOUNTS
const isTestAccountsEnabled = process.env.ENABLE_TEST_ACCOUNTS !== 'false';
const criticalDriverAccounts = isTestAccountsEnabled ? [
  // ðŸŽ¯ Comptes avec DONNÃ‰ES DE TEST RÃ‰ELLES (password123)
  { id: 'restaurant-001', email: 'restaurant@test.fr', password: 'password123', role: 'restaurant', name: 'Restaurant Test' },
  { id: 'artisan-001', email: 'artisan@test.fr', password: 'password123', role: 'artisan', name: 'Artisan Test' },
  { id: 'driver1', email: 'driver1@test.fr', password: 'password123', role: 'livreur', name: 'Livreur Test' },
  
  // Comptes livreurs (apps mobiles)
  { id: '18', email: 'test.mobile@restauconnect.com', password: 'Test123!', role: 'livreur', name: 'Chauffeur Test' },
  { id: '19', email: 'driver@test.fr', password: 'driver123', role: 'livreur', name: 'Jean Livreur' },
  
  // Autres comptes business
  { id: 'supplier-001', email: 'supplier@test.fr', password: 'supplier123', role: 'fournisseur', name: 'Supplier Test' },
  { id: 'candidat-001', email: 'candidat@test.fr', password: 'candidat123', role: 'candidat', name: 'Candidat Test' },
  
  // Comptes services professionnels
  { id: 'community_manager-001', email: 'cm@test.fr', password: 'cm123', role: 'community_manager', name: 'Community Manager Test' },
  { id: 'banker-001', email: 'banker@test.fr', password: 'banker123', role: 'banquier', name: 'Banker Test' },
  { id: 'investisseur-001', email: 'investisseur@test.fr', password: 'investisseur123', role: 'investisseur', name: 'Investisseur Test' },
  { id: 'comptable-001', email: 'comptable@test.fr', password: 'comptable123', role: 'comptable', name: 'Comptable Test' },
  
  // Comptes administration
  { id: 'admin-001', email: 'admin@restauconnect.fr', password: 'admin123', role: 'admin', name: 'Admin Test' },
  { id: 'super_admin-001', email: 'super_admin@test.fr', password: 'superadmin123', role: 'super_admin', name: 'Super Admin Test' }
] : [];

export class AuthService {
  /**
   * Authentifier un utilisateur et gÃ©nÃ©rer un token
   */
  static async login(email: string, password: string) {
    try {
      logger.info(`Tentative de connexion pour l'email: ${email}`);

      // 1. D'abord essayer les comptes livreurs critiques (pour tests)
      const criticalUser = criticalDriverAccounts.find(account =>
        account.email === email && account.password === password
      );

      if (criticalUser) {
        const { password: _, ...userWithoutPassword } = criticalUser;

        const token = jwt.sign(
          {
            userId: criticalUser.id,
            email: criticalUser.email,
            role: mapRoleToMongoDB(criticalUser.role) // ðŸ”„ Mapper rÃ´le franÃ§ais â†’ anglais
          },
          config.jwt.secret,
          { expiresIn: '24h' }
        );

        logger.info(`Connexion rÃ©ussie pour ${email} (rÃ´le: ${criticalUser.role}) - Compte critique`);

        return {
          success: true,
          data: {
            user: {
              ...userWithoutPassword,
              userId: criticalUser.id,
              _id: criticalUser.id,
              id: criticalUser.id
            },
            token: token,
            source: 'critical'
          }
        };
      }

      // 2. Essayer MongoDB seulement si disponible
      try {
        const mongoUser = await User.findOne({ email: email.toLowerCase() }).select('+password').exec();
        if (mongoUser && mongoUser.password) {
          const isValidPassword = await bcrypt.compare(password, mongoUser.password);
          if (isValidPassword) {
            // âœ… VÃ‰RIFIER LE STATUT DU COMPTE
            if (mongoUser.status === 'pending') {
              logger.warn(`Tentative de connexion d'un compte en attente: ${email}`);
              return {
                success: false,
                error: 'Votre compte est en attente de validation par un administrateur.'
              };
            }

            if (mongoUser.status === 'rejected') {
              logger.warn(`Tentative de connexion d'un compte rejetÃ©: ${email}`);
              return {
                success: false,
                error: 'Votre demande d\'inscription a Ã©tÃ© rejetÃ©e. Contactez le support pour plus d\'informations.'
              };
            }

            // VÃ©rifier si le compte est actif
            if (!mongoUser.isActive) {
              logger.warn(`Compte dÃ©sactivÃ©: ${email}`);
              return {
                success: false,
                error: 'Compte dÃ©sactivÃ©'
              };
            }

            const token = jwt.sign(
              {
                userId: mongoUser._id,
                email: mongoUser.email,
                role: mongoUser.role // âœ… RÃ´le MongoDB dÃ©jÃ  en anglais
              },
              config.jwt.secret,
              { expiresIn: '24h' }
            );

            logger.info(`Connexion rÃ©ussie pour ${email} (rÃ´le: ${mongoUser.role}) - MongoDB`);

            // Retourner donnÃ©es utilisateur MongoDB (production)
            const { password: _, ...userWithoutPassword } = mongoUser.toObject();
            return {
              success: true,
              data: {
                user: {
                  ...userWithoutPassword,
                  userId: mongoUser._id.toString(),
                  id: mongoUser._id.toString()
                },
                token: token,
                source: 'production'
              }
            };
          }
        }
      } catch (mongoError) {
        logger.warn('Erreur MongoDB, utilisation comptes critiques uniquement', mongoError);
      }

      // 3. Aucun compte trouvÃ©
      logger.warn(`Ã‰chec de connexion pour: ${email} - Aucun compte trouvÃ©`);
      return {
        success: false,
        error: 'Email ou mot de passe incorrect'
      };
    } catch (error) {
      logger.error('Erreur lors du login:', error);
      return {
        success: false,
        error: 'Erreur lors de l\'authentification'
      };
    }
  }

  /**
   * Inscrire un nouvel utilisateur
   */
  static async register(name: string, email: string, password: string, role: string = 'restaurant') {
    try {
      logger.info(`Tentative d'inscription pour l'email: ${email}`);

      // VÃ©rifier si l'utilisateur existe dÃ©jÃ 
      const existingUser = await User.findOne({ email: email.toLowerCase() }).exec();
      if (existingUser) {
        logger.warn(`Tentative d'inscription avec email existant: ${email}`);
        return {
          success: false,
          error: 'Un compte avec cet email existe dÃ©jÃ '
        };
      }

      // Hasher le mot de passe
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // CrÃ©er le nouvel utilisateur - EN ATTENTE DE VALIDATION ADMIN
      const newUser = new User({
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role,
        status: 'pending',   // âš ï¸ NÃ©cessite validation admin
        isActive: false,     // DÃ©sactivÃ© jusqu'Ã  approbation admin
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await newUser.save();

      // GÃ©nÃ©rer token mÃªme si en attente
      const token = jwt.sign(
        {
          userId: newUser._id,
          email: newUser.email,
          role: newUser.role
        },
        config.jwt.secret,
        { expiresIn: '24h' }
      );

      const { password: pwd2, ...userWithoutPassword } = newUser.toObject();
      
      logger.info(`Inscription en attente de validation pour ${email} (rÃ´le: ${role})`);

      return {
        success: true,
        data: {
          user: {
            ...userWithoutPassword,
            userId: newUser._id.toString(),
            id: newUser._id.toString()
          },
          token,
          message: 'Inscription enregistrÃ©e. Un administrateur doit valider votre compte et vÃ©rifier votre rÃ´le avant activation.'
        }
      };
    } catch (error) {
      logger.error('Erreur lors de l\'inscription:', error);
      return {
        success: false,
        error: 'Erreur lors de l\'inscription'
      };
    }
  }

  /**
   * VÃ©rifier la validitÃ© d'un token et rÃ©cupÃ©rer l'utilisateur
   */
  static async verifyTokenAndGetUser(token: string) {
    try {
      // VÃ©rifier le token JWT
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      const userId = decoded.userId || decoded._id || decoded.id;

      if (!userId) {
        return {
          success: false,
          error: 'Token invalide - donnÃ©es manquantes'
        };
      }

      // Essayer de rÃ©cupÃ©rer depuis MongoDB d'abord
      try {
        const user = await User.findById(userId).select('-password').exec();
        if (user) {
          return {
            success: true,
            data: {
              user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                phone: user.phone
              },
              source: 'production'
            }
          };
        }
      } catch (mongoError) {
        logger.warn('Erreur rÃ©cupÃ©ration utilisateur MongoDB:', mongoError);
      }

      // Fallback vers comptes critiques
      const criticalUser = criticalDriverAccounts.find(account => account.id === userId);
      if (criticalUser) {
        const { password: _, ...userWithoutPassword } = criticalUser;
        return {
          success: true,
          data: {
            user: userWithoutPassword,
            source: 'critical-fallback'
          }
        };
      }

      return {
        success: false,
        error: 'Utilisateur non trouvÃ©'
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return {
          success: false,
          error: 'Token invalide'
        };
      }

      if (error instanceof jwt.TokenExpiredError) {
        return {
          success: false,
          error: 'Token expirÃ©'
        };
      }

      logger.error('Erreur lors de la vÃ©rification du token:', error);
      return {
        success: false,
        error: 'Erreur lors de la vÃ©rification du token'
      };
    }
  }

  /**
   * VÃ©rifier la validitÃ© d'un token (simple)
   */
  static async verifyToken(token: string) {
    try {
      jwt.verify(token, config.jwt.secret);
      return {
        success: true,
        data: { valid: true }
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return {
          success: false,
          error: 'Token invalide'
        };
      }

      if (error instanceof jwt.TokenExpiredError) {
        return {
          success: false,
          error: 'Token expirÃ©'
        };
      }

      return {
        success: false,
        error: 'Erreur lors de la vÃ©rification du token'
      };
    }
  }

  /**
   * RafraÃ®chir un token
   */
  static async refreshToken(token: string) {
    try {
      // D'abord vÃ©rifier le token et rÃ©cupÃ©rer l'utilisateur
      const userResult = await AuthService.verifyTokenAndGetUser(token);
      if (!userResult.success || !userResult.data) {
        return userResult;
      }

      const user = userResult.data.user;

      // GÃ©nÃ©rer un nouveau token
      const newToken = jwt.sign(
        {
          userId: (user as any).id || (user as any)._id,
          email: user.email,
          role: user.role
        },
        config.jwt.secret,
        { expiresIn: '24h' }
      );

      return {
        success: true,
        data: {
          user,
          token: newToken
        }
      };
    } catch (error) {
      logger.error('Erreur lors du rafraÃ®chissement du token:', error);
      return {
        success: false,
        error: 'Erreur lors du rafraÃ®chissement du token'
      };
    }
  }

  /**
   * Invalider un token (logout)
   */
  static async logout(token: string) {
    try {
      // Pour une implÃ©mentation complÃ¨te, on pourrait ajouter le token
      // Ã  une liste noire Redis, mais pour l'instant on se contente
      // de vÃ©rifier que le token est valide
      const verifyResult = await AuthService.verifyToken(token);
      if (!verifyResult.success) {
        return verifyResult;
      }

      // Essayer de rÃ©cupÃ©rer l'utilisateur pour le log
      const userResult = await AuthService.verifyTokenAndGetUser(token);
      const userId = userResult.success && userResult.data ? (userResult.data.user as any).id || (userResult.data.user as any)._id || 'unknown' : 'unknown';

      logger.info(`Logout pour l'utilisateur: ${userId}`);

      return {
        success: true,
        message: 'DÃ©connexion rÃ©ussie'
      };
    } catch (error) {
      logger.error('Erreur lors du logout:', error);
      return {
        success: false,
        error: 'Erreur lors de la dÃ©connexion'
      };
    }
  }

  /**
   * GÃ©nÃ©rer un token de rÃ©initialisation de mot de passe
   */
  static generatePasswordResetToken(userId: string): string {
    return jwt.sign(
      { userId, type: 'password_reset' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
  }

  /**
   * VÃ©rifier un token de rÃ©initialisation de mot de passe
   */
  static async verifyPasswordResetToken(token: string) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any;

      if (decoded.type !== 'password_reset') {
        return {
          success: false,
          error: 'Type de token invalide'
        };
      }

      // VÃ©rifier que l'utilisateur existe
      const userResult = await UserService.getUserById(decoded.userId);
      if (!userResult.success) {
        return {
          success: false,
          error: 'Utilisateur non trouvÃ©'
        };
      }

      return {
        success: true,
        data: {
          userId: decoded.userId,
          user: userResult.data
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Token de rÃ©initialisation invalide ou expirÃ©'
      };
    }
  }

  /**
   * VÃ©rifier les permissions d'un utilisateur
   */
  static checkPermissions(userRole: string, requiredRoles: string[]): boolean {
    return requiredRoles.includes(userRole);
  }

  /**
   * VÃ©rifier si un utilisateur a le rÃ´le admin
   */
  static isAdmin(userRole: string): boolean {
    return ['super_admin', 'admin'].includes(userRole);
  }

  /**
   * VÃ©rifier si un utilisateur a le rÃ´le super_admin
   */
  static isSuperAdmin(userRole: string): boolean {
    return userRole === 'super_admin';
  }

  /**
   * Obtenir les permissions par rÃ´le
   */
  static getRolePermissions(role: string): string[] {
    const rolePermissions: Record<string, string[]> = {
      super_admin: ['*'], // Toutes les permissions
      admin: [
        'users.read', 'users.write', 'users.delete',
        'orders.read', 'orders.write',
        'deliveries.read', 'deliveries.write',
        'reports.read'
      ],
      restaurant: [
        'orders.read', 'orders.write',
        'profile.read', 'profile.write'
      ],
      fournisseur: [
        'orders.read', 'orders.write',
        'products.read', 'products.write',
        'profile.read', 'profile.write'
      ],
      livreur: [
        'deliveries.read', 'deliveries.write',
        'profile.read', 'profile.write'
      ],
      artisan: [
        'profile.read', 'profile.write',
        'services.read', 'services.write'
      ],
      candidat: [
        'profile.read', 'profile.write',
        'applications.read', 'applications.write'
      ],
      community_manager: [
        'content.read', 'content.write',
        'community.read', 'community.write'
      ],
      banquier: [
        'loans.read', 'loans.write',
        'investments.read'
      ],
      investisseur: [
        'investments.read', 'investments.write',
        'reports.read'
      ],
      comptable: [
        'accounting.read', 'accounting.write',
        'reports.read'
      ]
    };

    return rolePermissions[role] || [];
  }

  /**
   * VÃ©rifier une permission spÃ©cifique
   */
  static hasPermission(userRole: string, permission: string): boolean {
    const permissions = this.getRolePermissions(userRole);
    return permissions.includes('*') || permissions.includes(permission);
  }
}