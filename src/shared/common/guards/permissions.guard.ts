import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, RequiredPermission } from '../decorators/require-permissions.decorator';

/**
 * RBAC Permissions Guard ke thua tu menu-bepthu-api
 * Kiem tra quyen han Resource + Action, kiem tra isRoleActive va bypass Super Admin
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RequiredPermission>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Neu khong yeu cau quyen dac biet -> Cho phep qua
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException('Truy cap bi tu choi: Khong tim thay vai tro');
    }

    const role = user.role;

    // 1. Super Admin hoac System Admin duoc phep bypass toan bo
    if (role.slug === 'system_admin' || role.slug === 'super_admin') {
      return true;
    }

    // 2. Kiem tra xem vai tro co dang hoat dong khong
    if (role.isActive === false) {
      throw new ForbiddenException('Vai tro nay hien dang bi vo hieu hoa');
    }

    // 3. Kiem tra xem user co bi khoa quyen ca nhan khong
    if (user.isRoleActive === false) {
      throw new ForbiddenException('Quyen han cua ban dang bi tam khoa. Vui long lien he quan tri vien.');
    }

    // 4. Kiem tra quyen cu the trong danh sach permissions cua Role
    const hasPermission = role.permissions?.some((p: any) => {
      if (p.resource !== required.resource) return false;
      return p.actions?.includes(required.action);
    });

    if (!hasPermission) {
      throw new ForbiddenException(
        `Ban khong co quyen thuc hien thao tac: ${required.resource}.${required.action}`,
      );
    }

    return true;
  }
}
