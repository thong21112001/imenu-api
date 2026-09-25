import { ActionType, IMENU_PERMISSIONS, ResourceType } from '../constants/permission.const';
import { PermissionSubdocument } from '../../../modules/roles/entities/permission.schema';

/**
 * Bang tra cuu anh xa giua perm ID va cap { resource, action }
 */
export interface PermissionPair {
  resource: ResourceType;
  action: ActionType | string;
}

// Map tu permId sang PermissionPair
const PERM_ID_TO_PAIR_MAP: Record<string, PermissionPair> = {};

// Map tu "RESOURCE:ACTION" sang permId
const PAIR_TO_PERM_ID_MAP: Record<string, string> = {};

// Khoi tao tu IMENU_PERMISSIONS
Object.values(IMENU_PERMISSIONS).forEach((p) => {
  PERM_ID_TO_PAIR_MAP[p.id] = { resource: p.resource, action: p.action };
  PAIR_TO_PERM_ID_MAP[`${p.resource}:${p.action}`] = p.id;
});

// Cac alias pho bien tu UI Frontend (de tuong thich 100%)
const ALIASES: Record<string, PermissionPair> = {
  'perm-menu-create': { resource: ResourceType.MENU, action: ActionType.CREATE },
  'perm-menu-status': { resource: ResourceType.MENU, action: ActionType.UPDATE },
  'perm-menu-category': { resource: ResourceType.MENU, action: ActionType.UPDATE },
  'perm-pos-order': { resource: ResourceType.POS, action: ActionType.CREATE },
  'perm-pos-table': { resource: ResourceType.TABLE, action: ActionType.UPDATE },
  'perm-kds-out': { resource: ResourceType.KITCHEN, action: ActionType.UPDATE },
  'perm-staff-manage': { resource: ResourceType.STAFF, action: ActionType.UPDATE },
  'perm-role-manage': { resource: ResourceType.ROLE, action: ActionType.UPDATE },
  'perm-qr-print': { resource: ResourceType.QR_CODE, action: ActionType.PRINT },
  'perm-settings': { resource: ResourceType.SETTING, action: ActionType.UPDATE },
};

Object.entries(ALIASES).forEach(([id, pair]) => {
  if (!PERM_ID_TO_PAIR_MAP[id]) {
    PERM_ID_TO_PAIR_MAP[id] = pair;
  }
});

/**
 * Chuyen doi mot PermissionSubdocument array thanh danh sach flat permission string IDs
 * Vi du: [{ resource: 'POS', actions: ['VIEW', 'CREATE'] }] -> ['perm-pos-view', 'perm-pos-create']
 */
export function convertSubdocsToPermissionIds(permissions: PermissionSubdocument[] = []): string[] {
  const result = new Set<string>();

  for (const item of permissions) {
    if (!item?.resource || !Array.isArray(item.actions)) continue;

    for (const action of item.actions) {
      const key = `${item.resource}:${action}`;
      if (PAIR_TO_PERM_ID_MAP[key]) {
        result.add(PAIR_TO_PERM_ID_MAP[key]);
      } else {
        // Fallback tao ID theo quy tac perm-{resource}-{action}
        const fallbackId = `perm-${item.resource.toLowerCase()}-${String(action).toLowerCase()}`;
        result.add(fallbackId);
      }
    }
  }

  return Array.from(result);
}

/**
 * Chuyen doi mang flat permission IDs sang PermissionSubdocument array de luu vao DB
 * Vi du: ['perm-pos-view', 'perm-pos-create'] -> [{ resource: 'POS', actions: ['VIEW', 'CREATE'] }]
 */
export function convertPermissionIdsToSubdocs(permissionIds: string[] = []): PermissionSubdocument[] {
  const resourceActionMap: Record<string, Set<string>> = {};

  for (const id of permissionIds) {
    if (!id || typeof id !== 'string') continue;

    const pair = PERM_ID_TO_PAIR_MAP[id];
    if (pair) {
      if (!resourceActionMap[pair.resource]) {
        resourceActionMap[pair.resource] = new Set<string>();
      }
      resourceActionMap[pair.resource].add(pair.action);
      continue;
    }

    // Neu ID co dang perm-{resource}-{action}
    const parts = id.replace(/^perm-/, '').split('-');
    if (parts.length >= 2) {
      const resourceCandidate = parts[0].toUpperCase() as ResourceType;
      const actionCandidate = parts.slice(1).join('_').toUpperCase();
      if (Object.values(ResourceType).includes(resourceCandidate)) {
        if (!resourceActionMap[resourceCandidate]) {
          resourceActionMap[resourceCandidate] = new Set<string>();
        }
        resourceActionMap[resourceCandidate].add(actionCandidate);
      }
    }
  }

  return Object.entries(resourceActionMap).map(([resource, actions]) => ({
    resource: resource as ResourceType,
    actions: Array.from(actions),
  }));
}
