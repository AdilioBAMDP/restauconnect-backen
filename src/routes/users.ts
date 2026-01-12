import { Router } from 'express';
import { authenticateToken, requireAdmin, requireSuperAdmin, AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../types';
import { UserService } from '../services/UserService';

const router = Router();

// Get all users (Admin only)
router.get('/', authenticateToken, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      role,
      verified,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filters: any = {};
    if (role) filters.role = role;
    if (verified !== undefined) filters.verified = verified === 'true';
    if (search) filters.search = search;

    const options = {
      limit: Number(limit),
      page: Number(page),
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc'
    };

    const result = await UserService.getUsers(filters, options);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    } as ApiResponse);
    return;
  }
});

// Get user by ID
router.get('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { id } = req.params;
    const requestingUser = req.user;

    // ...existing code...

    const result = await UserService.getUserById(id);

    if (!result.success) {
      res.status(404).json({
        success: false,
        error: result.error
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: result.data
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    } as ApiResponse);
    return;
  }
});

// Create new user (Super Admin only)
router.post('/', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const userData = req.body;

    const result = await UserService.createUser(userData);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error
      } as ApiResponse);
      return;
    }

    res.status(201).json({
      success: true,
      data: result.data,
      message: 'User created successfully'
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create user'
    } as ApiResponse);
    return;
  }
});

// Update user profile
router.put('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { id } = req.params;
    const requestingUser = req.user;
    const updateData = req.body;

    // ...existing code...

    // Prevent role changes unless super admin
    if (updateData.role && requestingUser.role !== 'super_admin') {
      delete updateData.role;
    }

    // Prevent verification status changes unless admin
    if (updateData.verified !== undefined &&
        !['super_admin', 'community_manager'].includes(requestingUser.role)) {
      delete updateData.verified;
    }

    const result = await UserService.updateUser(id, updateData);

    if (!result.success) {
      res.status(404).json({
        success: false,
        error: result.error
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: result.data,
      message: 'User updated successfully'
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    } as ApiResponse);
    return;
  }
});

// Delete user (Super Admin only)
router.delete('/:id', authenticateToken, requireSuperAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await UserService.deleteUser(id);

    if (!result.success) {
      res.status(404).json({
        success: false,
        error: result.error
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    } as ApiResponse);
    return;
  }
});

// Get user statistics (Admin only)
router.get('/:id/stats', authenticateToken, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await UserService.getUserStats(id);

    if (!result.success) {
      res.status(404).json({
        success: false,
        error: result.error
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: result.data
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user statistics'
    } as ApiResponse);
    return;
  }
});

// Search users
router.get('/search', authenticateToken, async (req: AuthRequest, res): Promise<void> => {
  try {
    const {
      query = '',
      role,
      city,
      specialties,
      ecoFriendly,
      verified,
      page = 1,
      limit = 20
    } = req.query;

    const searchParams: any = {
      query,
      role,
      city,
      specialties,
      ecoFriendly,
      verified
    };

    const options = {
      limit: Number(limit),
      page: Number(page)
    };

    const result = await UserService.searchUsers(searchParams, options);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to search users'
    } as ApiResponse);
    return;
  }
});

export default router;
