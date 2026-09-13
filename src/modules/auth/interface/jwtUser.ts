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
}
