import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RolesService } from '../roles/roles.service';
import { hashPassword } from '../../shared/common/utils/password.util';
import { PaginateDto } from '../../shared/common/dto/paginate.dto';
import { createPaginationResponse, PaginationResponse } from '../../shared/common/dto/paginated-result.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
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

  async findByUsername(username: string, selectPassword = false): Promise<UserDocument | null> {
    const query = this.userModel.findOne({ username: username.toLowerCase() });
    if (selectPassword) query.select('+password');
    return query.exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }
    return user;
  }

  async findAllPaginated(query: PaginateDto, restaurantId?: string): Promise<PaginationResponse<User>> {
    const { page = 1, limit = 20, search } = query;
    const filter: any = {};

    if (restaurantId) filter.restaurantId = restaurantId;

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

  async create(dto: CreateUserDto, restaurantId?: string): Promise<User> {
    const existing = await this.userModel.findOne({
      $or: [{ username: dto.username.toLowerCase() }, { email: dto.email.toLowerCase() }],
    });

    if (existing) {
      throw new ConflictException('Tên đăng nhập hoặc Email đã tồn tại');
    }

    const role = await this.rolesService.findById(dto.roleId);
    const hashedPassword = await hashPassword(dto.password);

    const user = new this.userModel({
      ...dto,
      username: dto.username.toLowerCase(),
      email: dto.email.toLowerCase(),
      password: hashedPassword,
      role: role._id,
      restaurantId: restaurantId ? restaurantId : undefined,
    });

    return user.save();
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (dto.password) {
      dto.password = await hashPassword(dto.password);
    }
    Object.assign(user, dto);
    return user.save();
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { lastLogin: new Date() });
  }
}
