import { SetMetadata } from '@nestjs/common';
import { ActionType, ResourceType } from '../constants/permission.const';

export const PERMISSIONS_KEY = 'permissions';

export interface RequiredPermission {
  resource: ResourceType;
  action: ActionType;
}

/**
 * Decorator @RequirePermissions(resource, action) yeu cau quyen cu the
 */
export const RequirePermissions = (resource: ResourceType, action: ActionType) =>
  SetMetadata(PERMISSIONS_KEY, { resource, action });
