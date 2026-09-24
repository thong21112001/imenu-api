import { Role } from '../../roles/entities/role.entity';

export interface JwtUser {
  userId: string;
  username: string;
  email: string;
  fullName: string;
  phone?: string;
  role: Role;
  isRoleActive: boolean;
  restaurantId?: string;
  branchId?: string;
  branchName?: string;
  isMainBranch?: boolean;
  isDemo?: boolean;
}

export function isSuperAdminUser(user?: any | null): boolean {
  if (!user) return false;
  if (user.isSuperAdmin === true) return true;
  const role = user.role;
  if (!role) return false;
  const roleSlug = typeof role === 'string' ? role : (role.slug || role.code || role.name || '');
  const lower = String(roleSlug).toLowerCase();
  return lower === 'system_admin' || lower === 'super_admin';
}
