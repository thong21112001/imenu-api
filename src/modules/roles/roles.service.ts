import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role, RoleDocument } from './entities/role.entity';
import { User, UserDocument } from '../users/entities/user.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ActionType, ALL_SYSTEM_PERMISSION_IDS, ResourceType } from '../../shared/common/constants/permission.const';
import {
  convertPermissionIdsToSubdocs,
  convertSubdocsToPermissionIds,
} from '../../shared/common/utils/permission-mapping.util';
import { JwtUser, isSuperAdminUser } from '../auth/interface/jwtUser';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /**
   * Danh sach toan bo cac string permission IDs chuan cua he thong
   */
  getAllPermissionIds(): string[] {
    return ALL_SYSTEM_PERMISSION_IDS;
  }

  /**
   * Tu dong khoi tao 6 vai tro he thong mac dinh khi ung dung khoi dong
   */
  async seedDefaultRoles(): Promise<void> {
    const allResources = Object.values(ResourceType);
    const allActions = Object.values(ActionType);
    const allPermissionIds = this.getAllPermissionIds();

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
        permissionIds: allPermissionIds,
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
        permissionIds: [
          'perm-menu-view', 'perm-menu-create', 'perm-menu-status', 'perm-menu-category',
          'perm-pos-view', 'perm-pos-order', 'perm-pos-pay', 'perm-pos-table',
          'perm-kds-view', 'perm-kds-cook', 'perm-kds-out',
          'perm-rep-view', 'perm-rep-export',
          'perm-staff-manage', 'perm-role-manage', 'perm-qr-print', 'perm-settings',
        ],
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
        permissionIds: [
          'perm-menu-view', 'perm-menu-create', 'perm-menu-status', 'perm-menu-category',
          'perm-pos-view', 'perm-pos-order', 'perm-pos-pay', 'perm-pos-table',
          'perm-kds-view', 'perm-kds-cook', 'perm-kds-out',
          'perm-rep-view', 'perm-qr-print',
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
        permissionIds: [
          'perm-menu-view', 'perm-menu-status',
          'perm-pos-view', 'perm-pos-order', 'perm-pos-pay',
          'perm-rep-view',
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
        permissionIds: [
          'perm-kds-view', 'perm-kds-cook', 'perm-kds-out',
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
        permissionIds: [
          'perm-menu-view', 'perm-pos-view', 'perm-pos-order',
        ],
      },
    ];

    for (const roleData of defaultRoles) {
      const exists = await this.roleModel.findOne({ slug: roleData.slug });
      if (!exists) {
        await this.roleModel.create(roleData);
        this.logger.log(`[Seed] Đã tạo vai trò hệ thống: ${roleData.name} (${roleData.slug})`);
      } else {
        // Neu la system_admin: Luon dong bo permissions va permissionIds day du nhat
        if (roleData.slug === 'system_admin') {
          await this.roleModel.updateOne(
            { _id: exists._id },
            {
              $set: {
                permissions: roleData.permissions,
                permissionIds: allPermissionIds,
              },
            },
          );
        } else {
          // Voi cac role he thong khac (isSystem: true): Dong bo permissionIds theo seed definition
          // de tranh mat quyen do chuyen doi subdoc->permId khong 1:1 (vi du perm-kds-cook va perm-kds-out
          // cung map sang KITCHEN:UPDATE, khi convert nguoc lai chi con 1 trong 2)
          const seedPermIds = (roleData as any).permissionIds || [];
          const existingPermIds = exists.permissionIds || [];
          const needsSync = seedPermIds.length > 0 && (
            existingPermIds.length === 0 ||
            existingPermIds.length !== seedPermIds.length ||
            !seedPermIds.every((id: string) => existingPermIds.includes(id))
          );
          if (needsSync) {
            await this.roleModel.updateOne(
              { _id: exists._id },
              { $set: { permissionIds: seedPermIds } },
            );
            this.logger.log(`[Seed] Đồng bộ permissionIds cho vai trò: ${roleData.name} (${seedPermIds.length} quyền)`);
          }
        }
      }
    }
  }

  async findAll(restaurantId?: string, isSuperAdmin = false): Promise<any[]> {
    const filter: any = { isActive: true };
    if (restaurantId) {
      filter.$or = [{ isSystem: true }, { restaurantId }];
    }
    if (!isSuperAdmin) {
      filter.slug = { $nin: ['system_admin', 'super_admin', 'SYSTEM_ADMIN'] };
    }
    const roles = await this.roleModel.find(filter).exec();
    const allIds = this.getAllPermissionIds();
    return roles.map((r) => {
      const obj = r.toObject();
      const isSuperAdminRole = obj.slug === 'system_admin' || obj.slug === 'super_admin';
      const permissionIds = isSuperAdminRole
        ? allIds
        : (obj.permissionIds && obj.permissionIds.length > 0
            ? obj.permissionIds
            : convertSubdocsToPermissionIds(obj.permissions));
      return {
        ...obj,
        permissionIds,
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

  async findByIdOrSlug(identifier: string): Promise<RoleDocument | null> {
    if (!identifier) return null;
    let role: any = null;
    if (Types.ObjectId.isValid(identifier)) {
      role = await this.roleModel.findById(identifier).exec();
    }
    if (!role) {
      role = await this.roleModel.findOne({
        $or: [
          { slug: identifier },
          { slug: identifier.toLowerCase() },
          { name: identifier },
        ],
      }).exec();
    }
    return role;
  }

  async findById(id: string): Promise<any> {
    const role = await this.roleModel.findById(id);
    if (!role) {
      throw new NotFoundException('Không tìm thấy vai trò');
    }
    const obj = role.toObject();
    const isSuperAdminRole = obj.slug === 'system_admin' || obj.slug === 'super_admin';
    const permissionIds = isSuperAdminRole
      ? this.getAllPermissionIds()
      : (obj.permissionIds && obj.permissionIds.length > 0
          ? obj.permissionIds
          : convertSubdocsToPermissionIds(obj.permissions));
    return {
      ...obj,
      permissionIds,
    };
  }

  async create(createRoleDto: CreateRoleDto, restaurantId?: string, caller?: JwtUser): Promise<any> {
    const isSuperAdmin = isSuperAdminUser(caller);
    if (!isSuperAdmin && caller && !caller.isMainBranch) {
      throw new ForbiddenException('Chi nhánh con không có quyền tạo vai trò phân quyền mới');
    }

    const exists = await this.roleModel.findOne({ slug: createRoleDto.slug });
    if (exists) {
      throw new ConflictException('Mã vai trò (slug) đã tồn tại');
    }

    let finalPermissions = createRoleDto.permissions;
    let finalPermissionIds = createRoleDto.permissionIds || [];
    if (finalPermissionIds.length > 0 && (!finalPermissions || finalPermissions.length === 0)) {
      finalPermissions = convertPermissionIdsToSubdocs(finalPermissionIds);
    } else if (finalPermissions && finalPermissions.length > 0 && finalPermissionIds.length === 0) {
      finalPermissionIds = convertSubdocsToPermissionIds(finalPermissions as any);
    }

    const role = new this.roleModel({
      ...createRoleDto,
      permissions: finalPermissions || [],
      permissionIds: finalPermissionIds,
      isSystem: false,
      restaurantId: restaurantId ? restaurantId : undefined,
    });

    const saved = await role.save();
    const obj = saved.toObject();
    return {
      ...obj,
      permissionIds: (obj.permissionIds && obj.permissionIds.length > 0)
        ? obj.permissionIds
        : convertSubdocsToPermissionIds(obj.permissions),
    };
  }

  async update(id: string, updateRoleDto: UpdateRoleDto, caller?: JwtUser): Promise<any> {
    const role = await this.roleModel.findById(id);
    if (!role) {
      throw new NotFoundException('Không tìm thấy vai trò');
    }

    const isSuperAdmin = isSuperAdminUser(caller);
    if (role.isSystem && !isSuperAdmin) {
      throw new ForbiddenException('Chỉ Quản trị viên hệ thống (Super Admin) mới có quyền chỉnh sửa các vai trò chuẩn của hệ thống');
    }
    if (!isSuperAdmin && caller && !caller.isMainBranch) {
      throw new ForbiddenException('Chi nhánh con không có quyền chỉnh sửa phân quyền');
    }

    if (role.isSystem && updateRoleDto.slug && updateRoleDto.slug !== role.slug) {
      throw new ConflictException('Không thể thay đổi slug của vai trò hệ thống');
    }

    const updatePayload: any = { ...updateRoleDto };

    if (updateRoleDto.permissionIds !== undefined) {
      updatePayload.permissionIds = updateRoleDto.permissionIds;
      updatePayload.permissions = convertPermissionIdsToSubdocs(updateRoleDto.permissionIds);
    } else if (updateRoleDto.permissions !== undefined) {
      updatePayload.permissions = updateRoleDto.permissions;
      updatePayload.permissionIds = convertSubdocsToPermissionIds(updateRoleDto.permissions as any);
    }

    Object.assign(role, updatePayload);
    const saved = await role.save();
    const obj = saved.toObject();
    return {
      ...obj,
      permissionIds: (obj.permissionIds && obj.permissionIds.length > 0)
        ? obj.permissionIds
        : convertSubdocsToPermissionIds(obj.permissions),
    };
  }

  async delete(id: string, caller?: JwtUser): Promise<{ success: boolean; message: string }> {
    const isSuperAdmin = isSuperAdminUser(caller);
    if (!isSuperAdmin && caller && !caller.isMainBranch) {
      throw new ForbiddenException('Chi nhánh con không có quyền xóa vai trò phân quyền');
    }

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
