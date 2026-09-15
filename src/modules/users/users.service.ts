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
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { TransferUserDto } from './dto/transfer-user.dto';
import { RolesService } from '../roles/roles.service';
import { hashPassword } from '../../shared/common/utils/password.util';
import { PaginateDto } from '../../shared/common/dto/paginate.dto';
import { createPaginationResponse, PaginationResponse } from '../../shared/common/dto/paginated-result.dto';
import { JwtUser } from '../auth/interface/jwtUser';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Restaurant.name) private readonly restaurantModel: Model<RestaurantDocument>,
    private readonly rolesService: RolesService,
  ) {}

  /**
   * Khoi tao Super Admin mac dinh (admin / admin123456) neu DB chua co
   */
  async initAdmin(): Promise<void> {
    const adminUser = await this.userModel.findOne({ username: 'admin' });
    if (!adminUser) {
      const superAdminRole = await this.rolesService.findBySlug('system_admin');
      const hashedPassword = await hashPassword('admin123456');

      await this.userModel.create({
        username: 'admin',
        email: 'admin@imenu.vn',
        password: hashedPassword,
        fullName: 'Quản Trị Viên iMenu',
        phone: '0900000000',
        role: superAdminRole._id,
        isRoleActive: true,
      });

      this.logger.log('[Seed] Đã tạo tài khoản Quản trị viên mặc định (admin / admin123456)');
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
      status: 'ACTIVE',
    });
  }

  async findByUsername(username: string, selectPassword = false): Promise<UserDocument | null> {
    const query = this.userModel.findOne({ username: username.toLowerCase() });
    if (selectPassword) query.select('+password');
    return query.exec();
  }

  async findByEmail(email: string, selectPassword = false): Promise<UserDocument | null> {
    const query = this.userModel.findOne({ email: email.toLowerCase() });
    if (selectPassword) query.select('+password');
    return query.exec();
  }

  async findByEmailOrUsername(identifier: string, selectPassword = false): Promise<UserDocument | null> {
    const query = this.userModel.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier.toLowerCase() },
      ],
    });
    if (selectPassword) query.select('+password');
    return query.exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }
    return user;
  }

  async findAllPaginated(
    query: PaginateDto & { branchId?: string },
    restaurantId?: string,
    caller?: JwtUser,
  ): Promise<PaginationResponse<User>> {
    const { page = 1, limit = 20, search, branchId } = query;
    const filter: any = {};

    if (restaurantId) filter.restaurantId = restaurantId;

    // Chi nhánh con chỉ xem được nhân viên của chi nhánh mình
    if (caller && !caller.isMainBranch && caller.branchId) {
      filter.branchId = caller.branchId;
    } else if (branchId && branchId !== 'all') {
      filter.branchId = branchId;
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
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec();

    return createPaginationResponse(data, total, page, limit);
  }

  async create(dto: CreateUserDto, restaurantId?: string, caller?: JwtUser): Promise<User> {
    const existing = await this.userModel.findOne({
      $or: [{ username: dto.username.toLowerCase() }, { email: dto.email.toLowerCase() }],
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

    if (restaurantId) {
      const restaurant = await this.restaurantModel.findById(restaurantId);
      if (!restaurant) {
        throw new NotFoundException('Không tìm thấy nhà hàng');
      }

      // Kiểm tra phạm vi của caller
      if (caller && !caller.isMainBranch) {
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
          (b: any) => b._id.toString() === targetBranchId || b.id === targetBranchId,
        );
        if (!branch) {
          throw new BadRequestException('Chi nhánh được chỉ định không tồn tại trong nhà hàng');
        }
        if ((branch as any).status === BranchStatus.INACTIVE) {
          throw new BadRequestException('Không thể gán nhân viên vào chi nhánh đã ngừng hoạt động');
        }
        targetBranchName = (branch as any).name;
      }
    }

    const hashedPassword = await hashPassword(dto.password);

    const user = new this.userModel({
      ...dto,
      username: dto.username.toLowerCase(),
      email: dto.email.toLowerCase(),
      password: hashedPassword,
      role: role._id,
      restaurantId: restaurantId ? restaurantId : undefined,
      branchId: targetBranchId,
      branchName: targetBranchName,
    });

    return user.save();
  }

  async update(id: string, dto: UpdateUserDto, caller?: JwtUser): Promise<User> {
    const user = await this.findById(id);

    // Kiểm tra phạm vi branch của caller
    if (caller && !caller.isMainBranch && caller.branchId) {
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
        (b: any) => b._id.toString() === dto.branchId || b.id === dto.branchId,
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

  async transferStaff(id: string, dto: TransferUserDto, caller?: JwtUser): Promise<any> {
    if (caller && !caller.isMainBranch) {
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
      (b: any) => b._id.toString() === dto.targetBranchId || b.id === dto.targetBranchId,
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
