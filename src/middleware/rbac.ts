// RBAC middleware and policies for Web Spider backend
import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/User';

// Centralized permissions mapping
export const rolePermissions: Record<UserRole, string[]> = {
  super_admin: [
    'manage_users', 'manage_roles', 'view_audit_log', 'export_data', 'manage_platform', 'moderate', 'view_analytics', 'access_support', 'schedule_exports', 'view_transactions', 'manage_alerts', 'all'
  ],
  admin: [
    'manage_users', 'view_audit_log', 'export_data', 'moderate', 'view_analytics', 'access_support', 'view_transactions', 'manage_alerts'
  ],
  community_manager: [
    'moderate', 'view_analytics', 'access_support', 'view_transactions'
  ],
  accountant: [
    'view_analytics', 'export_data', 'view_transactions'
  ],
  banker: [
    'view_analytics', 'view_transactions'
  ],
  investor: [
    'view_analytics'
  ],
  auditor: [
    'view_audit_log', 'view_analytics'
  ],
  restaurant: [
    'view_analytics', 'access_support', 'view_transactions'
  ],
  artisan: [
    'view_analytics', 'access_support', 'view_transactions'
  ],
  supplier: [
    'view_analytics', 'access_support', 'view_transactions'
  ],
  candidat: [
    'access_support'
  ],
  driver: [
    'view_analytics', 'access_support', 'view_transactions'
  ],
  carrier: [
    'view_analytics', 'access_support', 'view_transactions'
  ]
};

// Middleware to check for a specific permission
export function requirePermission(permission: string) {
  return (req: any, res: Response, next: NextFunction) => {
    // console.log(`ðŸ” RBAC: Checking permission '${permission}' for user:`, req.user?.email, 'role:', req.user?.role);
    
    if (!req.user || !req.user.role) {
      // console.log('âŒ RBAC: No user or role found');
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const perms = rolePermissions[req.user.role as UserRole] || [];
    // console.log(`ðŸ” RBAC: User permissions:`, perms);
    
    if (perms.includes('all') || perms.includes(permission)) {
      // console.log(`âœ… RBAC: Permission '${permission}' granted`);
      return next();
    }
    
    // console.log(`âŒ RBAC: Permission '${permission}' denied`);
    return res.status(403).json({ success: false, error: 'Insufficient permissions' });
  };
}

// Endpoint helpers (to be used in routes):
// - GET /api/rbac/roles: list all roles and permissions
// - GET /api/rbac/permissions: list all permissions
// - POST /api/rbac/roles/:role/permissions: update permissions for a role (super_admin only)
