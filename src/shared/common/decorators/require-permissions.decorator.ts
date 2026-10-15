import { SetMetadata } from '@nestjs/common';
import { ActionType, ResourceType } from '../constants/permission.const';

export const PERMISSIONS_KEY = 'permissions';

export interface RequiredPermission {
  resource: ResourceType;
  action: ActionType;
  permissionId?: string;
  alternatePermissionIds?: string[];
}

/**
 * Decorator @RequirePermissions(resource, action, permissionId?, alternatePermissionIds?) yeu cau quyen cu the
 */
export const RequirePermissions = (
  resource: ResourceType,
  action: ActionType,
  permissionId?: string,
  alternatePermissionIds?: string[],
) => SetMetadata(PERMISSIONS_KEY, { resource, action, permissionId, alternatePermissionIds });

