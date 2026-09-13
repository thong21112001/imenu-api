import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtConstants } from '../../shared/common/constants/envConstants';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './interface/jwtPayload';
import { JwtUser } from './interface/jwtUser';

/**
 * Passport JWT Strategy ke thua tu menu-bepthu-api
 * Tu dong trích xuất Bearer token va gan thong tin user vao req.user
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JwtConstants.secret,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    const user = await this.usersService.findById(payload.id);
    if (!user || user.status === 'INACTIVE') {
      throw new UnauthorizedException('Tai khoan khong ton tai hoac da bi khoa');
    }

    return {
      userId: (user as any)._id.toString(),
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      isRoleActive: user.isRoleActive,
      restaurantId: user.restaurantId ? (user.restaurantId as any).toString() : undefined,
      branchId: user.branchId,
      branchName: user.branchName,
    };
  }
}
