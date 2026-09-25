import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Global JWT Authentication Guard
 * Tu dong kiem tra token Bearer tru nhung route duoc gan @Public()
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err) {
      throw err;
    }
    if (!user) {
      if (info?.name === 'TokenExpiredError' || info?.message === 'jwt expired') {
        throw new UnauthorizedException('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại');
      }
      if (info?.name === 'JsonWebTokenError' || info?.message === 'invalid token') {
        throw new UnauthorizedException('Mã xác thực (Token) không hợp lệ');
      }
      throw new UnauthorizedException('Bạn chưa đăng nhập hoặc thiếu mã xác thực (Token)');
    }
    return user;
  }
}
