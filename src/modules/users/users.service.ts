import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './entities/user.entity';
import { Restaurant, RestaurantDocument } from '../restaurants/entities/restaurant.entity';
import { BranchStatus } from '../restaurants/entities/branch.schema';
import { UserStatus } from './interface/user-status.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { TransferUserDto } from './dto/transfer-user.dto';
import { RolesService } from '../roles/roles.service';
import { hashPassword } from '../../shared/common/utils/password.util';
import { PaginateDto } from '../../shared/common/dto/paginate.dto';
import { createPaginationResponse, PaginationResponse } from '../../shared/common/dto/paginated-result.dto';
import { JwtUser, isSuperAdminUser } from '../auth/interface/jwtUser';
import { SuperAdminConstants } from '../../shared/common/constants/envConstants';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Restaurant.name) private readonly restaurantModel: Model<RestaurantDocument>,
    private readonly rolesService: RolesService,
  ) {}

  /**
   * Khoi tao va luon ghi de password hash Super Admin tu bien moi truong (.env)
   */
  async initAdmin(): Promise<void> {
    const superAdminRole = await this.rolesService.findBySlug('system_admin');
    if (!superAdminRole) {
      this.logger.warn('[Seed] Chua co vai tro system_admin, bo qua khoi tao Super Admin');
      return;
    }

    const targetEmail = SuperAdminConstants.email.toLowerCase();
    const targetUsername = SuperAdminConstants.username.toLowerCase();
    const hashedPassword = await hashPassword(SuperAdminConstants.password);

    // Tim admin hien tai theo role system_admin HOAC theo username/email
    let adminUser = await this.userModel.findOne({
      $or: [
        { role: superAdminRole._id },
        { email: targetEmail },
        { username: targetUsername },
        { username: 'admin' },
      ],
    });

    if (adminUser) {
      // LUON GHI DE PASSWORD HASH VA PROFILE TU ENV
      adminUser.username = targetUsername;
      adminUser.email = targetEmail;
      adminUser.password = hashedPassword;
      adminUser.fullName = SuperAdminConstants.fullName;
      adminUser.phone = SuperAdminConstants.phone;
      adminUser.role = superAdminRole._id as any;
      adminUser.status = UserStatus.ACTIVE;
      adminUser.isRoleActive = true;
      adminUser.isDeleted = false;
      adminUser.deletedAt = undefined;
      await adminUser.save();

      this.logger.log(`[Seed] Da dong bo & luon ghi de password Super Admin tu ENV: ${targetEmail}`);
    } else {
      // Tao moi Super Admin neu chua ton tai
      await this.userModel.create({
        username: targetUsername,
        email: targetEmail,
        password: hashedPassword,
        fullName: SuperAdminConstants.fullName,
        phone: SuperAdminConstants.phone,
        role: superAdminRole._id,
        isRoleActive: true,
        status: UserStatus.ACTIVE,
        isDeleted: false,
      });

      this.logger.log(`[Seed] Da tao tai khoan Super Admin moi tu ENV: ${targetEmail}`);
    }
  }

  async createDemoUser(userData: {
    username: string;
    email: string;
    passwordHash: string;
    fullName: string;
    phone: string;
    roleId: string;
    restaurantId: string;
    branchId?: string;
    branchName?: string;
  }): Promise<UserDocument> {
    return this.userModel.create({
      username: userData.username.toLowerCase(),
      email: userData.email.toLowerCase(),
      password: userData.passwordHash,
      fullName: userData.fullName,
      phone: userData.phone,
      role: userData.roleId,
      restaurantId: userData.restaurantId,
      branchId: userData.branchId,
      branchName: userData.branchName,
      isRoleActive: true,
      status: UserStatus.ACTIVE,
      isDeleted: false,
    });
  }

  async findByUsername(username: string, selectPassword = false): Promise<UserDocument | null> {
    const query = this.userModel.findOne({
      username: username.toLowerCase(),
      isDeleted: { $ne: true },
    });
    if (selectPassword) query.select('+password');
    return query.exec();
  }

  async findByEmail(email: string, selectPassword = false): Promise<UserDocument | null> {
    const query = this.userModel.findOne({
      email: email.toLowerCase(),
      isDeleted: { $ne: true },
    });
    if (selectPassword) query.select('+password');
    return query.exec();
  }

  async findByEmailOrUsername(identifier: string, selectPassword = false): Promise<UserDocument | null> {
    const query = this.userModel.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier.toLowerCase() },
      ],
      isDeleted: { $ne: true },
    });
    if (selectPassword) query.select('+password');
    return query.exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findOne({ _id: id, isDeleted: { $ne: true } }).exec();
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }
    return user;
  }

  async findAllPaginated(
    query: PaginateDto & { branchId?: string; restaurantId?: string },
    restaurantId?: string,
    caller?: JwtUser,
  ): Promise<PaginationResponse<User>> {
    const { page = 1, limit = 20, search, branchId } = query;
    const filter: any = { isDeleted: { $ne: true } };

    const isSuperAdmin = isSuperAdminUser(caller);
    const targetRestaurantId = query.restaurantId || restaurantId;

    if (isSuperAdmin) {
      // Super Admin: neu co restaurantId -> loc theo nha hang, neu khong -> xem toan he thong
      if (targetRestaurantId && targetRestaurantId !== 'all') {
        filter.restaurantId = new Types.ObjectId(targetRestaurantId);
      }
    } else {
      // User thong thuong: bat buoc chi xem nha hang cua minh
      const effectiveRestaurantId = targetRestaurantId || caller?.restaurantId;
      if (effectiveRestaurantId) {
        filter.restaurantId = new Types.ObjectId(effectiveRestaurantId);
      }

      // Chi nhánh con chỉ xem được nhân viên của chi nhánh mình
      if (caller && !caller.isMainBranch && caller.branchId) {
        filter.branchId = caller.branchId;
      } else if (branchId && branchId !== 'all') {
        filter.branchId = branchId;
      }
    }

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await this.userModel.countDocuments(filter);
    const data = await this.userModel
      .find(filter)
      .populate('role')
      .populate('restaurantId', 'name slug')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec();

    return createPaginationResponse(data, total, page, limit);
  }

  async create(dto: CreateUserDto, restaurantId?: string, caller?: JwtUser): Promise<User> {
    const isSuperAdmin = isSuperAdminUser(caller);
    const effectiveRestaurantId = isSuperAdmin
      ? (dto.restaurantId || restaurantId)
      : (restaurantId || caller?.restaurantId);

    const cleanEmail = dto.email.toLowerCase().trim();
    const cleanUsername = (dto.username || cleanEmail.split('@')[0]).toLowerCase().trim();

    const existing = await this.userModel.findOne({
      $or: [{ username: cleanUsername }, { email: cleanEmail }],
      isDeleted: { $ne: true },
    });

    if (existing) {
      throw new ConflictException('Tên đăng nhập hoặc Email đã tồn tại');
    }

    const role = await this.rolesService.findById(dto.roleId);
    if ((role as any).slug === 'system_admin' || (role as any).slug === 'super_admin') {
      throw new ForbiddenException('Không thể gán vai trò Quản trị viên hệ thống SaaS');
    }

    let targetBranchId = dto.branchId;
    let targetBranchName = dto.branchName;

    if (effectiveRestaurantId) {
      const restaurant = await this.restaurantModel.findById(effectiveRestaurantId);
      if (!restaurant) {
        throw new NotFoundException('Không tìm thấy nhà hàng');
      }

      // Kiểm tra phạm vi của caller neu khong phai Super Admin
      if (!isSuperAdmin && caller && !caller.isMainBranch) {
        if ((role as any).slug === 'restaurant_admin') {
          throw new ForbiddenException('Quản lý chi nhánh không thể tạo tài khoản Chủ nhà hàng');
        }
        if (dto.branchId && dto.branchId !== caller.branchId) {
          throw new ForbiddenException('Bạn chỉ có quyền tạo nhân sự cho chi nhánh của mình');
        }
        targetBranchId = caller.branchId;
      }

      // Nếu không chỉ định branchId -> Mặc định gán vào chi nhánh chính
      if (!targetBranchId) {
        const mainBranch: any = restaurant.branches.find((b: any) => b.isMainBranch) || restaurant.branches[0];
        targetBranchId = mainBranch?._id?.toString();
        targetBranchName = mainBranch?.name;
      } else {
        const branch = restaurant.branches.find(
          (b: any) => b._id?.toString() === targetBranchId || (b as any).id === targetBranchId,
        );
        if (!branch) {
          throw new BadRequestException('Chi nhánh được chỉ định không tồn tại trong nhà hàng');
        }
        if ((branch as any).status === BranchStatus.INACTIVE) {
          throw new BadRequestException('Không thể gán nhân viên vào chi nhánh đã ngừng hoạt động');
        }
        targetBranchName = (branch as any).name;
      }
    } else if (isSuperAdmin) {
      // Super Admin tao nhan vien bat buoc phai chon nha hang
      throw new BadRequestException('Super Admin cần chỉ định nhà hàng (restaurantId) khi tạo nhân viên');
    }

    const hashedPassword = await hashPassword(dto.password);

    const user = new this.userModel({
      ...dto,
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword,
      role: role._id,
      restaurantId: effectiveRestaurantId ? new Types.ObjectId(effectiveRestaurantId) : undefined,
      branchId: targetBranchId,
      branchName: targetBranchName,
      status: UserStatus.ACTIVE,
      isRoleActive: true,
      isDeleted: false,
    });

    return user.save();
  }

  async update(id: string, dto: UpdateUserDto, caller?: JwtUser): Promise<User> {
    const user = await this.findById(id);
    const isSuperAdmin = isSuperAdminUser(caller);

    // Kiểm tra phạm vi branch của caller neu khong phai Super Admin
    if (!isSuperAdmin && caller && !caller.isMainBranch && caller.branchId) {
      if (user.branchId !== caller.branchId) {
        throw new ForbiddenException('Bạn không có quyền cập nhật nhân viên của chi nhánh khác');
      }
      if (dto.branchId && dto.branchId !== caller.branchId) {
        throw new ForbiddenException('Nhân viên chi nhánh không thể tự điều chuyển nhân sự sang chi nhánh khác');
      }
    }

    // Nếu người dùng chính đổi branchId
    if (dto.branchId && dto.branchId !== user.branchId && user.restaurantId) {
      const restaurant = await this.restaurantModel.findById(user.restaurantId);
      const branch = restaurant?.branches.find(
        (b: any) => b._id?.toString() === dto.branchId || (b as any).id === dto.branchId,
      );
      if (!branch) {
        throw new BadRequestException('Chi nhánh đích không tồn tại');
      }
      if ((branch as any).status === BranchStatus.INACTIVE) {
        throw new BadRequestException('Không thể gán nhân viên vào chi nhánh đã ngừng hoạt động');
      }
      dto.branchName = (branch as any).name;
    }

    if (dto.password) {
      dto.password = await hashPassword(dto.password);
    }
    Object.assign(user, dto);
    return user.save();
  }

  /**
   * Bat / tat trang thai hoat dong cua nhan vien (ACTIVE <-> INACTIVE)
   */
  async toggleStatus(id: string, caller: JwtUser): Promise<User> {
    const user = await this.userModel.findOne({ _id: id, isDeleted: { $ne: true } }).populate('role');
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    // Khong the tu khoa tai khoan cua chinh minh
    if (caller.userId === id.toString()) {
      throw new BadRequestException('Không thể tự khóa tài khoản của chính mình');
    }

    // Khong the khoa tai khoan Super Admin
    const roleSlug = (user.role as any)?.slug;
    if (roleSlug === 'system_admin' || roleSlug === 'super_admin') {
      throw new ForbiddenException('Không thể khóa tài khoản Quản trị viên hệ thống (Super Admin)');
    }

    // Kiem tra quyen theo nha hang
    const isSuperAdmin = isSuperAdminUser(caller);
    if (!isSuperAdmin && user.restaurantId?.toString() !== caller.restaurantId) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên nhân sự của nhà hàng khác');
    }

    user.status = user.status === UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE;
    return user.save();
  }

  /**
   * Xoa nhan vien su dung phuong phap Soft Delete
   */
  async deleteUser(id: string, caller: JwtUser): Promise<{ success: boolean; message: string }> {
    const user = await this.userModel.findOne({ _id: id, isDeleted: { $ne: true } }).populate('role');
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    // Khong the tu xoa tai khoan cua chinh minh
    if (caller.userId === id.toString()) {
      throw new BadRequestException('Không thể tự xóa tài khoản của chính mình');
    }

    // Khong the xoa tai khoan Super Admin
    const roleSlug = (user.role as any)?.slug;
    if (roleSlug === 'system_admin' || roleSlug === 'super_admin') {
      throw new ForbiddenException('Không thể xóa tài khoản Quản trị viên hệ thống (Super Admin)');
    }

    // Kiem tra quyen theo nha hang
    const isSuperAdmin = isSuperAdminUser(caller);
    if (!isSuperAdmin && user.restaurantId?.toString() !== caller.restaurantId) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên nhân sự của nhà hàng khác');
    }

    // Thuc hien Soft Delete
    const timestamp = Date.now();
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.status = UserStatus.DELETED;
    user.email = `${user.email}_deleted_${timestamp}`;
    if (user.username) {
      user.username = `${user.username}_deleted_${timestamp}`;
    }

    await user.save();

    this.logger.log(`[Soft Delete] Đã xóa mềm nhân viên: ${user.fullName} (${id}) bởi ${caller.email}`);

    return {
      success: true,
      message: 'Đã xóa nhân viên thành công',
    };
  }

  async transferStaff(id: string, dto: TransferUserDto, caller?: JwtUser): Promise<any> {
    const isSuperAdmin = isSuperAdminUser(caller);
    if (!isSuperAdmin && caller && !caller.isMainBranch) {
      throw new ForbiddenException(
        'Chỉ quản trị viên chi nhánh chính mới có quyền điều chuyển nhân sự giữa các chi nhánh',
      );
    }

    const user = await this.findById(id);
    if (!user.restaurantId) {
      throw new BadRequestException('Tài khoản này không thuộc nhà hàng nào');
    }

    const restaurant = await this.restaurantModel.findById(user.restaurantId);
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy nhà hàng');
    }

    const targetBranch = restaurant.branches.find(
      (b: any) => b._id?.toString() === dto.targetBranchId || (b as any).id === dto.targetBranchId,
    );
    if (!targetBranch) {
      throw new NotFoundException('Không tìm thấy chi nhánh đích');
    }

    if ((targetBranch as any).status === BranchStatus.INACTIVE) {
      throw new BadRequestException('Không thể điều chuyển nhân sự tới chi nhánh đã ngừng hoạt động');
    }

    const oldBranchName = user.branchName || 'Chưa gán';
    user.branchId = (targetBranch as any)._id.toString();
    user.branchName = (targetBranch as any).name;

    await user.save();

    this.logger.log(
      `[Staff Transfer] Nhân viên "${user.fullName}" (${user._id}) được chuyển từ "${oldBranchName}" sang "${targetBranch.name}". Lý do: ${dto.reason || 'N/A'}`,
    );

    return {
      success: true,
      message: `Đã điều chuyển nhân viên ${user.fullName} sang chi nhánh ${targetBranch.name} thành công`,
      data: user,
    };
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { lastLogin: new Date() });
  }
}
