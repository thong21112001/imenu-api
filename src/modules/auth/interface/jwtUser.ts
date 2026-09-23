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

export function isSuperAdminUser(user?: JwtUser | null): boolean {
  if (!user?.role) return false;
  const roleSlug = typeof user.role === 'string' ? user.role : (user.role as any)?.slug;
  const lower = (roleSlug || '').toLowerCase();
  return lower === 'system_admin' || lower === 'super_admin';
}
