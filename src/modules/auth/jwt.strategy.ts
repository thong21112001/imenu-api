import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtConstants } from '../../shared/common/constants/envConstants';
import { UsersService } from '../users/users.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { JwtPayload } from './interface/jwtPayload';
import { JwtUser } from './interface/jwtUser';

/**
 * Passport JWT Strategy ke thua tu menu-bepthu-api
 * Tu dong trích xuất Bearer token va gan thong tin user vao req.user
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    private readonly restaurantsService: RestaurantsService,
  ) {
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

    let isMainBranch = false;
    const roleSlug = (user.role as any)?.slug?.toLowerCase() || '';

    if (roleSlug === 'system_admin' || roleSlug === 'super_admin' || roleSlug === 'restaurant_admin') {
      isMainBranch = true;
    } else if (user.restaurantId && user.branchId) {
      try {
        const restaurant = await this.restaurantsService.findById(user.restaurantId.toString());
        const branch = restaurant?.branches?.find(
          (b: any) => b._id.toString() === user.branchId || b.id === user.branchId,
        );
        isMainBranch = !!branch?.isMainBranch;
      } catch {
        isMainBranch = false;
      }
    }

    const isDemo =
      user.email === 'owner@sample.vn' ||
      (user as any).isDemo === true;

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
      isMainBranch,
      isDemo,
    };
  }
}
