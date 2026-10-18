import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { isSuperAdminUser } from '../../../modules/auth/interface/jwtUser';

/**
 * SuperAdminGuard (AUD-13.1)
 * Bảo vệ các endpoint thuộc phạm vi Quản trị Nền tảng iMenu (/api/platform/*)
 * Chỉ cho phép tài khoản có vai trò system_admin / super_admin hoặc isSuperAdmin === true.
 * Mọi vai trò khác (restaurant_admin, restaurant_manager, sales_rep, v.v.) đều bị chặn 403 Forbidden.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !isSuperAdminUser(user)) {
      throw new ForbiddenException(
        'Truy cập bị từ chối: Chỉ Quản trị viên cấp cao (Superadmin) mới có quyền truy cập khu vực này',
      );
    }

    return true;
  }
}
