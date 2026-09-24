import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { LoginDto } from './dto/login.dto';
import { RegisterRestaurantDto } from './dto/register-restaurant.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { comparePassword, hashPassword } from '../../shared/common/utils/password.util';
import { convertSubdocsToPermissionIds } from '../../shared/common/utils/permission-mapping.util';
import { JwtPayload } from './interface/jwtPayload';
import { JwtUser } from './interface/jwtUser';
import { JwtConstants } from '../../shared/common/constants/envConstants';

const SYSTEM_PERMISSIONS = [
  'perm-menu-view',
  'perm-menu-create',
  'perm-menu-status',
  'perm-menu-category',
  'perm-pos-view',
  'perm-pos-order',
  'perm-pos-pay',
  'perm-pos-table',
  'perm-kds-view',
  'perm-kds-cook',
  'perm-kds-out',
  'perm-rep-view',
  'perm-rep-export',
  'perm-staff-manage',
  'perm-role-manage',
  'perm-qr-print',
  'perm-settings',
];

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly restaurantsService: RestaurantsService,
    private readonly jwtService: JwtService,
  ) {}

  private getRoleCode(role: any): string {
    const slug = role?.slug || (typeof role === 'string' ? role : '');
    switch (slug.toLowerCase()) {
      case 'system_admin':
      case 'super_admin':
        return 'SYSTEM_ADMIN';
      case 'restaurant_admin':
        return 'RESTAURANT_ADMIN';
      case 'restaurant_manager':
        return 'RESTAURANT_MANAGER';
      case 'cashier':
        return 'CASHIER';
      case 'kitchen':
        return 'KITCHEN';
      case 'waiter':
        return 'WAITER';
      default:
        return (slug || 'STAFF').toUpperCase();
    }
  }

  private resolvePermissions(role: any): string[] {
    const roleSlug = (role?.slug || (typeof role === 'string' ? role : '')).toLowerCase();
    // Super Admin luon co toan bo cac permission IDs hien co va moi cua he thong
    if (roleSlug === 'system_admin' || roleSlug === 'super_admin') {
      return this.rolesService.getAllPermissionIds();
    }
    // Uu tien lay permissionIds truc tiep duoc SuperAdmin/chu nha hang cau hinh trong DB
    if (role?.permissionIds && Array.isArray(role.permissionIds) && role.permissionIds.length > 0) {
      return role.permissionIds;
    }
    if (role?.permissions && Array.isArray(role.permissions) && role.permissions.length > 0) {
      return convertSubdocsToPermissionIds(role.permissions);
    }
    // Fallback cho cac role mac dinh chua co document permissionIds cu the
    if (roleSlug === 'restaurant_admin') {
      return SYSTEM_PERMISSIONS;
    }
    if (roleSlug === 'restaurant_manager') {
      return SYSTEM_PERMISSIONS.filter(
        (p) => !['perm-rep-export', 'perm-staff-manage', 'perm-role-manage', 'perm-settings'].includes(p),
      );
    }
    if (roleSlug === 'cashier') {
      return [
        'perm-menu-view',
        'perm-menu-status',
        'perm-pos-view',
        'perm-pos-order',
        'perm-pos-pay',
        'perm-rep-view',
      ];
    }
    if (roleSlug === 'kitchen') {
      return ['perm-kds-view', 'perm-kds-cook', 'perm-kds-out'];
    }
    if (roleSlug === 'waiter') {
      return ['perm-menu-view', 'perm-pos-view', 'perm-pos-order'];
    }

    return ['perm-menu-view', 'perm-pos-view'];
  }

  async validateUser(identifier: string, pass: string): Promise<any> {
    if (!identifier || !pass) return null;
    const user = await this.usersService.findByEmailOrUsername(identifier, true);
    if (user && user.password && (await comparePassword(pass, user.password))) {
      const userObj = user.toObject();
      delete userObj.password;
      return userObj;
    }
    return null;
  }

  private async checkIsMainBranch(
    restaurantId?: string,
    branchId?: string,
    roleSlug?: string,
  ): Promise<boolean> {
    const slug = (roleSlug || '').toLowerCase();
    if (slug === 'system_admin' || slug === 'super_admin') {
      return true;
    }
    if (!restaurantId) return false;
    try {
      const restaurant = await this.restaurantsService.findById(restaurantId);
      if (!restaurant?.branches || restaurant.branches.length === 0) return false;

      // Nếu không có branchId cụ thể nhưng là chủ nhà hàng gốc -> coi như thuộc main branch
      if (!branchId) {
        return slug === 'restaurant_admin';
      }

      const branch = restaurant.branches.find(
        (b: any) => b._id.toString() === branchId || b.id === branchId,
      );
      return !!branch?.isMainBranch;
    } catch {
      return false;
    }
  }

  async login(loginDto: LoginDto) {
    const identifier = loginDto.email || loginDto.username;
    if (!identifier) {
      throw new BadRequestException('Vui lòng cung cấp email hoặc tên đăng nhập');
    }

    const user = await this.validateUser(identifier, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Email / tên đăng nhập hoặc mật khẩu không chính xác');
    }

    if (user.status === 'INACTIVE') {
      throw new UnauthorizedException('Tài khoản đã bị tạm ngưng hoạt động');
    }

    const roleObj = user.role;
    const roleCode = this.getRoleCode(roleObj);
    const permissions = this.resolvePermissions(roleObj);

    const payload: JwtPayload = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      roleId: roleObj?._id ? roleObj._id.toString() : roleObj?.toString(),
      roleSlug: roleObj?.slug || '',
      restaurantId: user.restaurantId ? user.restaurantId.toString() : undefined,
      branchId: user.branchId,
    };

    const refreshExpiry = loginDto.rememberMe ? '30d' : (JwtConstants.refreshExpiresIn as any) || '7d';

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: (JwtConstants.expiresIn as any) || '1d',
    });
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: refreshExpiry,
    });

    await this.usersService.updateLastLogin(user._id.toString());

    const isMainBranch = await this.checkIsMainBranch(
      user.restaurantId?.toString(),
      user.branchId,
      roleObj?.slug,
    );

    return {
      user: {
        id: user._id.toString(),
        fullName: user.fullName,
        email: user.email,
        role: roleCode,
        restaurantId: user.restaurantId ? user.restaurantId.toString() : undefined,
        branchId: user.branchId,
        branchName: user.branchName,
        isMainBranch,
        isDemo: user.email === 'owner@sample.vn' || (user as any).isDemo === true,
      },
      permissions,
      accessToken,
      refreshToken,
    };
  }

  async register(dto: RegisterRestaurantDto) {
    const existingEmail = await this.usersService.findByEmail(dto.owner.email);
    if (existingEmail) {
      throw new ConflictException('Email chủ quán đã được đăng ký trên hệ thống');
    }

    // 1. Tao nha hang kem branch mac dinh
    const mainBranchId = new Types.ObjectId();
    const branchName = 'Chi nhánh chính';

    const createdRestaurant = await this.restaurantsService.create({
      name: dto.restaurant.name,
      phone: dto.restaurant.phone,
      address: dto.restaurant.address,
      plan: 'Basic',
      isOpen: true,
      branches: [
        {
          _id: mainBranchId,
          name: branchName,
          address: dto.restaurant.address,
          phone: dto.restaurant.phone,
          isMainBranch: true,
        } as any,
      ],
    });

    // 2. Lay vai tro chu nha hang
    const ownerRole = await this.rolesService.findBySlug('restaurant_admin');

    // 3. Tao tai khoan nguoi dung chu quan
    const generatedUsername = `${dto.owner.email.split('@')[0]}_${Math.random().toString(36).substring(2, 6)}`.toLowerCase();

    const createdUser: any = await this.usersService.create(
      {
        username: generatedUsername,
        email: dto.owner.email,
        password: dto.owner.password,
        fullName: dto.owner.fullName,
        phone: dto.owner.phone,
        roleId: (ownerRole as any)._id.toString(),
        branchId: mainBranchId.toString(),
        branchName: branchName,
      },
      (createdRestaurant as any)._id.toString(),
    );

    // 4. Sinh JWT tokens
    const payload: JwtPayload = {
      id: createdUser._id.toString(),
      username: createdUser.username,
      email: createdUser.email,
      roleId: (ownerRole as any)._id.toString(),
      roleSlug: 'restaurant_admin',
      restaurantId: (createdRestaurant as any)._id.toString(),
      branchId: mainBranchId.toString(),
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: (JwtConstants.expiresIn as any) || '1d',
    });
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: (JwtConstants.refreshExpiresIn as any) || '7d',
    });

    this.logger.log(
      `[Register] Nhà hàng mới: "${createdRestaurant.name}" (${createdRestaurant.slug}), Chủ quán: ${createdUser.email}`,
    );

    return {
      restaurant: {
        id: (createdRestaurant as any)._id.toString(),
        name: createdRestaurant.name,
        slug: createdRestaurant.slug,
      },
      user: {
        id: createdUser._id.toString(),
        email: createdUser.email,
        role: 'RESTAURANT_ADMIN',
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    try {
      const decoded = this.jwtService.verify<JwtPayload>(dto.refreshToken);
      const user = await this.usersService.findById(decoded.id);

      if (user.status === 'INACTIVE') {
        throw new UnauthorizedException('Tài khoản đã bị tạm ngưng hoạt động');
      }

      const payload: JwtPayload = {
        id: (user as any)._id.toString(),
        username: user.username,
        email: user.email,
        roleId: (user.role as any)?._id
          ? (user.role as any)._id.toString()
          : (user.role as any)?.toString(),
        roleSlug: (user.role as any)?.slug || '',
        restaurantId: user.restaurantId
          ? (user.restaurantId as any).toString()
          : undefined,
        branchId: user.branchId,
      };

      const accessToken = this.jwtService.sign(payload, {
        expiresIn: (JwtConstants.expiresIn as any) || '1d',
      });
      return { accessToken };
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }
  }

  async getProfile(currentUser: JwtUser) {
    const user = await this.usersService.findById(currentUser.userId);
    const roleObj = user.role;
    const roleCode = this.getRoleCode(roleObj);
    const permissions = this.resolvePermissions(roleObj);
    const isMainBranch = await this.checkIsMainBranch(
      user.restaurantId?.toString(),
      user.branchId,
      (roleObj as any)?.slug,
    );

    return {
      user: {
        id: (user as any)._id.toString(),
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: roleCode,
        restaurantId: user.restaurantId
          ? (user.restaurantId as any).toString()
          : undefined,
        branchId: user.branchId,
        branchName: user.branchName,
        isMainBranch,
        status: user.status,
      },
      permissions,
    };
  }

  async logout(user?: any) {
    return { success: true, message: 'Đăng xuất thành công' };
  }

  /**
   * Tự động khởi tạo dữ liệu mẫu Nhà Hàng "Bếp Nhà" và tài khoản chủ quán:
   * Email: owner@sample.vn / Mật khẩu: Demo@123
   */
  async seedDemoOwner(): Promise<void> {
    try {
      const demoEmail = 'owner@sample.vn';
      const existingUser = await this.usersService.findByEmail(demoEmail);
      if (existingUser) {
        return;
      }

      let restaurant: any = null;
      try {
        restaurant = await this.restaurantsService.findBySlug('bep-nha');
      } catch {
        restaurant = null;
      }
      const mainBranchId = new Types.ObjectId();
      const branchName = 'Chi nhánh Quận 1';

      if (!restaurant) {
        restaurant = await this.restaurantsService.create({
          name: 'Bếp Nhà - Ẩm Thực Việt',
          phone: '0901234567',
          address: '123 Đồng Khởi, Bến Nghé, Quận 1, TP.HCM',
          tagline: 'Hương vị gia đình, trọn vẹn từng khoảnh khắc',
          bankAccount: {
            bankId: 'MB',
            bankName: 'MBBank',
            accountNo: '0901234567',
            accountName: 'NGUYEN MINH AN',
            template: 'compact',
          },
          isOpen: true,
          openingHours: '08:00 - 22:30',
          plan: 'Pro',
          branches: [
            {
              _id: mainBranchId,
              name: branchName,
              address: '123 Đồng Khởi, Bến Nghé, Quận 1, TP.HCM',
              phone: '0901234567',
              isMainBranch: true,
              isActive: true,
            } as any,
          ],
        });
      }

      const branch =
        restaurant.branches && restaurant.branches.length > 0
          ? restaurant.branches[0]
          : { _id: mainBranchId, name: branchName };

      const ownerRole = await this.rolesService.findBySlug('restaurant_admin');
      if (!ownerRole) {
        return;
      }

      const hashedPassword = await hashPassword('Demo@123');

      await this.usersService.createDemoUser({
        username: 'owner',
        email: demoEmail,
        passwordHash: hashedPassword,
        fullName: 'Nguyễn Minh An',
        phone: '0901234567',
        roleId: (ownerRole as any)._id.toString(),
        restaurantId: (restaurant as any)._id.toString(),
        branchId: (branch as any)._id.toString(),
        branchName: (branch as any).name,
      });

      this.logger.log('[Seed] Đã tạo tài khoản demo chủ quán (owner@sample.vn / Demo@123)');
    } catch (err: any) {
      this.logger.warn(`Không thể seed tài khoản demo chủ quán: ${err.message}`);
    }
  }
}
