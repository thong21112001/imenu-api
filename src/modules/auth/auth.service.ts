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
import { CANONICAL_UI_PERMISSION_IDS, ALL_SYSTEM_PERMISSION_IDS } from '../../shared/common/constants/permission.const';
import { ENV } from '../../shared/configs/env.cnf';
import { CompositeRateLimiterService } from '../../shared/common/services/composite-rate-limiter.service';

// Danh muc 17 quyen han chuan cua nha hang duoc dong bo voi frontend ma tran phan quyen
const SYSTEM_PERMISSIONS = CANONICAL_UI_PERMISSION_IDS;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly restaurantsService: RestaurantsService,
    private readonly jwtService: JwtService,
    private readonly rateLimiter: CompositeRateLimiterService,
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
      case 'sales_rep':
        return 'SALES_REP';
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
    if (roleSlug === 'sales_rep') {
      return ['perm-sales-view', 'perm-sales-create-restaurant'];
    }
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

  async login(loginDto: LoginDto, ip = '127.0.0.1') {
    const identifier = loginDto.email || loginDto.username;
    if (!identifier) {
      throw new BadRequestException('Vui lòng cung cấp email hoặc tên đăng nhập');
    }

    // AUD-13.5: Kiểm tra Composite Rate Limiting (IP + Identifier)
    this.rateLimiter.checkRateLimit(ip, identifier);

    const user = await this.validateUser(identifier, loginDto.password);
    if (!user) {
      this.rateLimiter.recordFailure(ip, identifier);
      throw new UnauthorizedException('Email / tên đăng nhập hoặc mật khẩu không chính xác');
    }

    // Reset bộ đếm số lần sai khi đăng nhập thành công
    this.rateLimiter.resetAttempts(ip, identifier);

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
      tokenVersion: user.tokenVersion || 1,
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
    // Xử lý mã giới thiệu và attribution NVKD (Phase 12)
    let referredBySalesId: Types.ObjectId | undefined;
    let referralCodeUsed: string | undefined;
    let acquisitionChannel = dto.acquisitionChannel || 'ORGANIC';

    if (dto.referralCode && dto.referralCode.trim()) {
      const cleanCode = dto.referralCode.trim().toUpperCase();
      const salesUser = await this.usersService.findByReferralCode(cleanCode);
      if (!salesUser) {
        throw new BadRequestException('Mã giới thiệu không tồn tại hoặc đã hết hiệu lực');
      }

      // AUD-12.5: Chống tự giới thiệu chính mình (Self-referral guard)
      if (
        salesUser.email.toLowerCase() === dto.owner.email.trim().toLowerCase() ||
        (salesUser.phone && salesUser.phone === dto.owner.phone?.trim())
      ) {
        throw new BadRequestException('Chủ quán không được phép tự giới thiệu chính mình!');
      }

      referredBySalesId = salesUser._id;
      referralCodeUsed = cleanCode;
      if (!dto.acquisitionChannel) {
        acquisitionChannel = 'REFERRAL_CODE';
      }
    }

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
      referredBySalesId,
      referralCodeUsed,
      acquisitionChannel,
      subscriptionStatus: 'TRIAL',
      isActivationQualified: false,
      activationPaidBillsCount: 0,
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

      if (!user || user.status === 'INACTIVE') {
        throw new UnauthorizedException('Tài khoản đã bị tạm ngưng hoạt động');
      }

      if (
        decoded.tokenVersion !== undefined &&
        user.tokenVersion !== undefined &&
        decoded.tokenVersion !== user.tokenVersion
      ) {
        throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.');
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
        tokenVersion: user.tokenVersion || 1,
      };

      const accessToken = this.jwtService.sign(payload, {
        expiresIn: (JwtConstants.expiresIn as any) || '1d',
      });
      return { accessToken };
    } catch (err: any) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
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
   * Tự động khởi tạo dữ liệu mẫu Nhà Hàng "Bếp Nhà" và tài khoản chủ quán
   * (Mật khẩu được đọc từ cấu hình biến môi trường DEMO_USER_PASSWORD)
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

      const sampleAccounts = [
        {
          username: 'owner',
          email: 'owner@sample.vn',
          fullName: 'Nguyễn Minh An',
          phone: '0901234567',
          roleSlug: 'restaurant_admin',
        },
        {
          username: 'manager',
          email: 'manager@sample.vn',
          fullName: 'Trần Quốc Bảo',
          phone: '0902345678',
          roleSlug: 'restaurant_manager',
        },
        {
          username: 'cashier',
          email: 'cashier@sample.vn',
          fullName: 'Lê Thu Thảo',
          phone: '0903456789',
          roleSlug: 'cashier',
        },
        {
          username: 'kitchen',
          email: 'kitchen@sample.vn',
          fullName: 'Hoàng Văn Bếp',
          phone: '0904567890',
          roleSlug: 'kitchen',
        },
        {
          username: 'waiter',
          email: 'waiter@sample.vn',
          fullName: 'Phạm Văn Phục',
          phone: '0905678901',
          roleSlug: 'waiter',
        },
      ];

      const demoPassword = process.env.DEMO_USER_PASSWORD || ENV.DEMO_USER_PASSWORD;
      if (!demoPassword) {
        this.logger.warn('[Seed] DEMO_USER_PASSWORD chưa được cấu hình trong .env');
        return;
      }
      const hashedPassword = await hashPassword(demoPassword);

      for (const acc of sampleAccounts) {
        const existing = await this.usersService.findByEmail(acc.email);
        const role = await this.rolesService.findBySlug(acc.roleSlug);
        if (!role) continue;

        if (!existing) {
          await this.usersService.createDemoUser({
            username: acc.username,
            email: acc.email,
            passwordHash: hashedPassword,
            fullName: acc.fullName,
            phone: acc.phone,
            roleId: (role as any)._id.toString(),
            restaurantId: (restaurant as any)._id.toString(),
            branchId: (branch as any)._id.toString(),
            branchName: (branch as any).name,
          });
        } else {
          // Dam bao tai khoan luon hoat dong va dung thong tin
          await (this.usersService as any).userModel.updateOne(
            { _id: existing._id },
            {
              $set: {
                role: (role as any)._id,
                restaurantId: (restaurant as any)._id,
                branchId: (branch as any)._id.toString(),
                branchName: (branch as any).name,
                isRoleActive: true,
                status: 'ACTIVE',
                isDeleted: false,
              },
            },
          );
        }
      }

      this.logger.log('[Seed] Đã tạo/đồng bộ 5 tài khoản demo vai trò (owner, manager, cashier, kitchen, waiter)');
    } catch (err: any) {
      this.logger.warn(`Không thể seed tài khoản demo: ${err.message}`);
    }
  }
}
