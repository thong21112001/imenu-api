import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, RoleDocument } from './entities/role.entity';
import { User, UserDocument } from '../users/entities/user.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ActionType, ResourceType } from '../../shared/common/constants/permission.const';
import {
  convertPermissionIdsToSubdocs,
  convertSubdocsToPermissionIds,
} from '../../shared/common/utils/permission-mapping.util';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /**
   * Tu dong khoi tao 6 vai tro he thong mac dinh khi ung dung khoi dong
   */
  async seedDefaultRoles(): Promise<void> {
    const allResources = Object.values(ResourceType);
    const allActions = Object.values(ActionType);

    const defaultRoles = [
      {
        name: 'Quản trị viên Hệ thống (SaaS)',
        slug: 'system_admin',
        isSystem: true,
        color: '#dc2626',
        description: 'Toàn quyền quản trị cao nhất trên toàn hệ thống SaaS iMenu',
        permissions: allResources.map((res) => ({
          resource: res,
          actions: allActions,
        })),
      },
      {
        name: 'Chủ nhà hàng / Chi nhánh',
        slug: 'restaurant_admin',
        isSystem: true,
        color: '#7c3aed',
        description: 'Quản trị toàn bộ hoạt động của nhà hàng và các chi nhánh',
        permissions: allResources.map((res) => ({
          resource: res,
          actions: allActions,
        })),
      },
      {
        name: 'Quản lý nhà hàng',
        slug: 'restaurant_manager',
        isSystem: true,
        color: '#2563eb',
        description: 'Quản lý vận hành, sơ đồ bàn, menu, nhân viên ca làm việc',
        permissions: [
          { resource: ResourceType.DASHBOARD, actions: [ActionType.VIEW] },
          { resource: ResourceType.TABLE, actions: [ActionType.VIEW, ActionType.UPDATE] },
          { resource: ResourceType.POS, actions: [ActionType.VIEW, ActionType.CREATE, ActionType.CONFIRM] },
          { resource: ResourceType.KITCHEN, actions: [ActionType.VIEW, ActionType.UPDATE] },
          { resource: ResourceType.MENU, actions: [ActionType.VIEW, ActionType.UPDATE] },
          { resource: ResourceType.QR_CODE, actions: [ActionType.VIEW, ActionType.CREATE, ActionType.PRINT] },
          { resource: ResourceType.BILL, actions: [ActionType.VIEW, ActionType.PRINT] },
          { resource: ResourceType.REPORT, actions: [ActionType.VIEW, ActionType.EXPORT] },
          { resource: ResourceType.STAFF, actions: [ActionType.VIEW, ActionType.CREATE, ActionType.UPDATE] },
          { resource: ResourceType.BRANCH, actions: [ActionType.VIEW] },
        ],
      },
      {
        name: 'Thu ngân (POS Cashier)',
        slug: 'cashier',
        isSystem: true,
        color: '#059669',
        description: 'Phụ trách order tại quầy, chốt bàn, in hóa đơn và nhận thanh toán',
        permissions: [
          { resource: ResourceType.TABLE, actions: [ActionType.VIEW] },
          { resource: ResourceType.POS, actions: [ActionType.VIEW, ActionType.CREATE, ActionType.CONFIRM] },
          { resource: ResourceType.BILL, actions: [ActionType.VIEW, ActionType.PRINT] },
          { resource: ResourceType.MENU, actions: [ActionType.VIEW] },
          { resource: ResourceType.BRANCH, actions: [ActionType.VIEW] },
        ],
      },
      {
        name: 'Nhân viên Bếp (KDS)',
        slug: 'kitchen',
        isSystem: true,
        color: '#ea580c',
        description: 'Theo dõi hàng đợi gọi món KDS và cập nhật trạng thái chế biến',
        permissions: [
          { resource: ResourceType.KITCHEN, actions: [ActionType.VIEW, ActionType.UPDATE] },
          { resource: ResourceType.MENU, actions: [ActionType.VIEW] },
        ],
      },
      {
        name: 'Nhân viên Phục vụ (Waiter)',
        slug: 'waiter',
        isSystem: true,
        color: '#d97706',
        description: 'Hỗ trợ khách tại bàn, mở bàn, nhận món từ bếp và phục vụ',
        permissions: [
          { resource: ResourceType.TABLE, actions: [ActionType.VIEW] },
          { resource: ResourceType.POS, actions: [ActionType.VIEW, ActionType.CREATE] },
          { resource: ResourceType.KITCHEN, actions: [ActionType.VIEW] },
        ],
      },
    ];

    for (const roleData of defaultRoles) {
      const exists = await this.roleModel.findOne({ slug: roleData.slug });
      if (!exists) {
        await this.roleModel.create(roleData);
        this.logger.log(`[Seed] Đã tạo vai trò hệ thống: ${roleData.name} (${roleData.slug})`);
      } else if (roleData.isSystem) {
        await this.roleModel.updateOne(
          { _id: exists._id },
          { $set: { permissions: roleData.permissions, description: roleData.description } },
        );
      }
    }
  }

  async findAll(restaurantId?: string): Promise<any[]> {
    const filter: any = { isActive: true };
    if (restaurantId) {
      filter.$or = [{ isSystem: true }, { restaurantId }];
    }
    const roles = await this.roleModel.find(filter).exec();
    return roles.map((r) => {
      const obj = r.toObject();
      return {
        ...obj,
        permissionIds: convertSubdocsToPermissionIds(obj.permissions),
      };
    });
  }

  async findBySlug(slug: string): Promise<RoleDocument> {
    const role = await this.roleModel.findOne({ slug });
    if (!role) {
      throw new NotFoundException(`Không tìm thấy vai trò với slug: ${slug}`);
    }
    return role;
  }

  async findById(id: string): Promise<any> {
    const role = await this.roleModel.findById(id);
    if (!role) {
      throw new NotFoundException('Không tìm thấy vai trò');
    }
    const obj = role.toObject();
    return {
      ...obj,
      permissionIds: convertSubdocsToPermissionIds(obj.permissions),
    };
  }

  async create(createRoleDto: CreateRoleDto, restaurantId?: string): Promise<any> {
    const exists = await this.roleModel.findOne({ slug: createRoleDto.slug });
    if (exists) {
      throw new ConflictException('Mã vai trò (slug) đã tồn tại');
    }

    let finalPermissions = createRoleDto.permissions;
    if (createRoleDto.permissionIds && createRoleDto.permissionIds.length > 0) {
      finalPermissions = convertPermissionIdsToSubdocs(createRoleDto.permissionIds);
    }

    const role = new this.roleModel({
      ...createRoleDto,
      permissions: finalPermissions || [],
      isSystem: false,
      restaurantId: restaurantId ? restaurantId : undefined,
    });

    const saved = await role.save();
    const obj = saved.toObject();
    return {
      ...obj,
      permissionIds: convertSubdocsToPermissionIds(obj.permissions),
    };
  }

  async update(id: string, updateRoleDto: UpdateRoleDto): Promise<any> {
    const role = await this.roleModel.findById(id);
    if (!role) {
      throw new NotFoundException('Không tìm thấy vai trò');
    }

    if (role.isSystem && updateRoleDto.slug && updateRoleDto.slug !== role.slug) {
      throw new ConflictException('Không thể thay đổi slug của vai trò hệ thống');
    }

    const updatePayload: any = { ...updateRoleDto };

    if (updateRoleDto.permissionIds && updateRoleDto.permissionIds.length > 0) {
      updatePayload.permissions = convertPermissionIdsToSubdocs(updateRoleDto.permissionIds);
    }

    delete updatePayload.permissionIds;
    Object.assign(role, updatePayload);
    const saved = await role.save();
    const obj = saved.toObject();
    return {
      ...obj,
      permissionIds: convertSubdocsToPermissionIds(obj.permissions),
    };
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const role = await this.roleModel.findById(id);
    if (!role) {
      throw new NotFoundException('Không tìm thấy vai trò');
    }

    if (role.isSystem) {
      throw new BadRequestException('Không thể xóa vai trò mặc định của hệ thống');
    }

    // Kiem tra xem co user nao dang su dung role nay khong
    const userCount = await this.userModel.countDocuments({
      role: id,
      isDeleted: { $ne: true },
    });

    if (userCount > 0) {
      throw new BadRequestException(`Không thể xóa vai trò này vì đang có ${userCount} nhân viên được gán vai trò`);
    }

    await this.roleModel.findByIdAndDelete(id);
    return {
      success: true,
      message: 'Đã xóa vai trò thành công',
    };
  }
}
