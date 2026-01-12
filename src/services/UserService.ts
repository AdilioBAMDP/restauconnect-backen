import mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { logger } from '../utils/logger';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  RESTAURANT = 'restaurant',
  FOURNISSEUR = 'fournisseur',
  LIVREUR = 'livreur',
  ARTISAN = 'artisan',
  CANDIDAT = 'candidat',
  COMMUNITY_MANAGER = 'community_manager',
  BANQUIER = 'banquier',
  INVESTISSEUR = 'investisseur',
  COMPTABLE = 'comptable'
}

// Interfaces pour les paramètres des services
export interface CreateUserData {
  email: string;
  password: string;
  role: UserRole;
  name: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    zipCode: string;
    country: string;
  };
  company?: string;
  preferences?: Record<string, any>;
}

export interface UserFilters {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
}

export interface UserOptions {
  limit?: number;
  page?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UpdateUserData {
  name?: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    zipCode: string;
    country: string;
  };
  company?: string;
  preferences?: Record<string, unknown>;
  [key: string]: unknown; // Index signature pour permettre l'accès dynamique
}

export interface SearchUserParams {
  query?: string;
  role?: UserRole;
  city?: string;
  specialties?: string;
  ecoFriendly?: string;
  verified?: string;
}

export interface SearchUserOptions {
  limit?: number;
  page?: number;
}

export class UserService {
  /**
   * Créer un nouvel utilisateur
   */
  static async createUser(userData: CreateUserData) {
    try {
      const validatedData = await this.validateUserData(userData);

      // Vérifier si l'email existe déjà
      const existingUser = await User.findOne({ email: validatedData.email.toLowerCase() });
      if (existingUser) {
        return {
          success: false,
          error: 'Un utilisateur avec cet email existe déjà'
        };
      }

      // Hash du mot de passe
      const hashedPassword = await bcrypt.hash(validatedData.password, 12);

      // Création de l'utilisateur
      const user = new User({
        ...validatedData,
        email: validatedData.email.toLowerCase(),
        password: hashedPassword,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await user.save();

      // Retourner l'utilisateur sans le mot de passe
      const { password, ...userWithoutPassword } = user.toObject();

      logger.info(`Nouvel utilisateur créé: ${user._id} (${user.role})`);

      return {
        success: true,
        data: userWithoutPassword
      };
    } catch (error) {
      logger.error('Erreur lors de la création de l\'utilisateur:', error);
      return {
        success: false,
        error: 'Erreur lors de la création de l\'utilisateur'
      };
    }
  }

  /**
   * Récupérer un utilisateur par ID
   */
  static async getUserById(userId: string) {
    try {
      const user = await User.findById(userId).select('-password');

      if (!user) {
        return {
          success: false,
          error: 'Utilisateur non trouvé'
        };
      }

      return {
        success: true,
        data: user
      };
    } catch (error) {
      logger.error('Erreur lors de la récupération de l\'utilisateur:', error);
      return {
        success: false,
        error: 'Erreur lors de la récupération de l\'utilisateur'
      };
    }
  }

  /**
   * Récupérer les utilisateurs avec filtres
   */
  static async getUsers(filters: UserFilters = {}, options: UserOptions = {}) {
    try {
      const {
        limit = 50,
        page = 1,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;

      const validatedFilters = this.validateUserFilters(filters);

      const query = User.find(validatedFilters)
        .select('-password')
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .limit(limit)
        .skip((page - 1) * limit);

      const users = await query.exec();
      const total = await User.countDocuments(validatedFilters);

      return {
        success: true,
        data: users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Erreur lors de la récupération des utilisateurs:', error);
      return {
        success: false,
        error: 'Erreur lors de la récupération des utilisateurs'
      };
    }
  }

  /**
   * Mettre à jour un utilisateur
   */
  static async updateUser(userId: string, updateData: UpdateUserData) {
    try {
      const validatedData = this.validateUpdateData(updateData);

      const user = await User.findByIdAndUpdate(
        userId,
        {
          ...validatedData,
          updatedAt: new Date()
        },
        { new: true }
      ).select('-password');

      if (!user) {
        return {
          success: false,
          error: 'Utilisateur non trouvé'
        };
      }

      logger.info(`Utilisateur mis à jour: ${userId}`);

      return {
        success: true,
        data: user
      };
    } catch (error) {
      logger.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
      return {
        success: false,
        error: 'Erreur lors de la mise à jour de l\'utilisateur'
      };
    }
  }

  /**
   * Activer/Désactiver un utilisateur
   */
  static async toggleUserStatus(userId: string, isActive: boolean) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          isActive,
          updatedAt: new Date()
        },
        { new: true }
      ).select('-password');

      if (!user) {
        return {
          success: false,
          error: 'Utilisateur non trouvé'
        };
      }

      logger.info(`Utilisateur ${userId} ${isActive ? 'activé' : 'désactivé'}`);

      return {
        success: true,
        data: user
      };
    } catch (error) {
      logger.error('Erreur lors du changement de statut:', error);
      return {
        success: false,
        error: 'Erreur lors du changement de statut'
      };
    }
  }

  /**
   * Changer le mot de passe d'un utilisateur
   */
  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'Utilisateur non trouvé'
        };
      }

      // Vérifier l'ancien mot de passe
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return {
          success: false,
          error: 'Mot de passe actuel incorrect'
        };
      }

      // Valider le nouveau mot de passe
      if (!this.isValidPassword(newPassword)) {
        return {
          success: false,
          error: 'Le nouveau mot de passe ne respecte pas les critères de sécurité'
        };
      }

      // Hash du nouveau mot de passe
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      user.password = hashedPassword;
      user.updatedAt = new Date();
      await user.save();

      logger.info(`Mot de passe changé pour l'utilisateur: ${userId}`);

      return {
        success: true,
        message: 'Mot de passe changé avec succès'
      };
    } catch (error) {
      logger.error('Erreur lors du changement de mot de passe:', error);
      return {
        success: false,
        error: 'Erreur lors du changement de mot de passe'
      };
    }
  }

  /**
   * Réinitialiser le mot de passe (admin seulement)
   */
  static async resetPassword(userId: string, newPassword: string) {
    try {
      // Valider le nouveau mot de passe
      if (!this.isValidPassword(newPassword)) {
        return {
          success: false,
          error: 'Le mot de passe ne respecte pas les critères de sécurité'
        };
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      const user = await User.findByIdAndUpdate(
        userId,
        {
          password: hashedPassword,
          updatedAt: new Date()
        },
        { new: true }
      ).select('-password');

      if (!user) {
        return {
          success: false,
          error: 'Utilisateur non trouvé'
        };
      }

      logger.info(`Mot de passe réinitialisé pour l'utilisateur: ${userId}`);

      return {
        success: true,
        data: user,
        message: 'Mot de passe réinitialisé avec succès'
      };
    } catch (error) {
      logger.error('Erreur lors de la réinitialisation du mot de passe:', error);
      return {
        success: false,
        error: 'Erreur lors de la réinitialisation du mot de passe'
      };
    }
  }

  /**
   * Authentifier un utilisateur
   */
  static async authenticateUser(email: string, password: string) {
    try {
      // Recherche de l'utilisateur
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return {
          success: false,
          error: 'Email ou mot de passe incorrect'
        };
      }

      // Vérification du mot de passe
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return {
          success: false,
          error: 'Email ou mot de passe incorrect'
        };
      }

      // Vérification du statut
      if (!user.isActive) {
        return {
          success: false,
          error: 'Compte désactivé'
        };
      }

      // Retourner l'utilisateur sans le mot de passe
      const { password: _, ...userWithoutPassword } = user.toObject();

      logger.info(`Authentification réussie: ${user._id} (${user.role})`);

      return {
        success: true,
        data: userWithoutPassword
      };
    } catch (error) {
      logger.error('Erreur lors de l\'authentification:', error);
      return {
        success: false,
        error: 'Erreur lors de l\'authentification'
      };
    }
  }

  /**
   * Supprimer un utilisateur
   */
  static async deleteUser(userId: string) {
    try {
      const user = await User.findByIdAndDelete(userId);

      if (!user) {
        return {
          success: false,
          error: 'Utilisateur non trouvé'
        };
      }

      logger.info(`Utilisateur supprimé: ${userId}`);

      return {
        success: true,
        message: 'Utilisateur supprimé avec succès'
      };
    } catch (error) {
      logger.error('Erreur lors de la suppression de l\'utilisateur:', error);
      return {
        success: false,
        error: 'Erreur lors de la suppression de l\'utilisateur'
      };
    }
  }

  /**
   * Rechercher des utilisateurs
   */
  static async searchUsers(searchParams: SearchUserParams = {}, options: SearchUserOptions = {}) {
    try {
      const {
        limit = 20,
        page = 1
      } = options;

      const query: Record<string, unknown> = {};

      if (searchParams.query) {
        query.$or = [
          { name: { $regex: searchParams.query, $options: 'i' } },
          { 'profile.description': { $regex: searchParams.query, $options: 'i' } },
          { 'profile.specialties': { $in: [new RegExp(searchParams.query, 'i')] } }
        ];
      }

      if (searchParams.role) query.role = searchParams.role;
      if (searchParams.city) query['location.city'] = { $regex: searchParams.city, $options: 'i' };
      if (searchParams.specialties) {
        const specialtyArray = searchParams.specialties.split(',');
        query['profile.specialties'] = { $in: specialtyArray };
      }
      if (searchParams.ecoFriendly === 'true') query['profile.ecoFriendly'] = true;
      if (searchParams.verified === 'true') query.verified = true;

      const users = await User.find(query)
        .select('name avatar role location.city profile.specialties profile.ecoFriendly rating reviewCount verified')
        .sort({ rating: -1, reviewCount: -1 })
        .limit(limit)
        .skip((page - 1) * limit);

      const total = await User.countDocuments(query);

      return {
        success: true,
        data: users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Erreur lors de la recherche d\'utilisateurs:', error);
      return {
        success: false,
        error: 'Erreur lors de la recherche d\'utilisateurs'
      };
    }
  }

  /**
   * Récupérer les statistiques d'un utilisateur
   */
  static async getUserStats(userId: string) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'Utilisateur non trouvé'
        };
      }

      // Statistiques de base (à étendre selon les besoins)
      const stats = {
        totalListings: 0, // À implémenter selon le modèle métier
        activeConversations: 0, // À implémenter selon le modèle métier
        completedProjects: 0, // À implémenter selon le modèle métier
        profileViews: 0, // À implémenter selon le modèle métier
        joinDate: user.createdAt,
        lastActive: user.lastActive,
        verificationStatus: user.verified
      };

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      logger.error('Erreur lors de la récupération des statistiques utilisateur:', error);
      return {
        success: false,
        error: 'Erreur lors de la récupération des statistiques utilisateur'
      };
    }
  }

  // === MÉTHODES UTILITAIRES ===

  private static async validateUserData(userData: CreateUserData) {
    const { email, password, role, name } = userData;

    if (!email || !password || !role || !name) {
      throw new Error('Données utilisateur incomplètes');
    }

    // Validation de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Format d\'email invalide');
    }

    // Validation du mot de passe
    if (!this.isValidPassword(password)) {
      throw new Error('Le mot de passe ne respecte pas les critères de sécurité');
    }

    // Validation du rôle
    if (!Object.values(UserRole).includes(role)) {
      throw new Error('Rôle utilisateur invalide');
    }

    return userData;
  }

  private static validateUpdateData(updateData: UpdateUserData) {
    const allowedFields = ['name', 'phone', 'address', 'company', 'preferences'];
    const filteredData: Partial<UpdateUserData> = {};

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    }

    return filteredData;
  }

  private static validateUserFilters(filters: UserFilters) {
    const validatedFilters: Record<string, unknown> = {};

    if (filters.role && Object.values(UserRole).includes(filters.role)) {
      validatedFilters.role = filters.role;
    }

    if (filters.isActive !== undefined) {
      validatedFilters.isActive = filters.isActive;
    }

    if (filters.search) {
      validatedFilters.$or = [
        { name: new RegExp(filters.search, 'i') },
        { email: new RegExp(filters.search, 'i') }
      ];
    }

    return validatedFilters;
  }

  private static isValidPassword(password: string): boolean {
    // Au moins 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }
}