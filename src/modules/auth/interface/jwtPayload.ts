export interface JwtPayload {
  id: string;
  username: string;
  email: string;
  roleId: string;
  roleSlug: string;
  restaurantId?: string;
  branchId?: string;
}
