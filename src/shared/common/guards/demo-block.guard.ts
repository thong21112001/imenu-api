import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Guard chan cac thao tac thay doi du lieu (POST, PUT, PATCH, DELETE) doi voi tai khoan Demo
 */
@Injectable()
export class DemoBlockGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (
      user?.isDemo ||
      user?.email === 'owner@sample.vn'
    ) {
      throw new ForbiddenException(
        'Tài khoản trải nghiệm (Demo) chỉ được phép xem dữ liệu, không thể sửa cài đặt hoặc quản lý chi nhánh/nhân sự.',
      );
    }

    return true;
  }
}
