import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { OkResponse } from '../../shared/common/dto/okResponse';
import { RequirePermissions } from '../../shared/common/decorators/require-permissions.decorator';
import { ActionType, IMENU_PERMISSIONS, ResourceType } from '../../shared/common/constants/permission.const';
import { CurrentRestaurant } from '../../shared/common/decorators/current-restaurant.decorator';
import { CurrentUser } from '../../shared/common/decorators/current-user.decorator';
import { JwtUser, isSuperAdminUser } from '../auth/interface/jwtUser';
import { PermissionsGuard } from '../../shared/common/guards/permissions.guard';
import { DemoBlockGuard } from '../../shared/common/guards/demo-block.guard';

@ApiTags('Roles')
@ApiBearerAuth('JWT-auth')
@UseGuards(PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @ApiOperation({ summary: 'Lấy danh mục các quyền chuẩn của hệ thống' })
  @Get('permissions/matrix')
  getPermissionsMatrix() {
    return new OkResponse({
      message: 'Lấy danh mục quyền thành công',
      data: IMENU_PERMISSIONS,
    });
  }

  @ApiOperation({ summary: 'Lấy danh sách tất cả các vai trò' })
  @RequirePermissions(ResourceType.STAFF, ActionType.VIEW)
  @Get()
  async findAll(
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const isSuperAdmin = isSuperAdminUser(user);
    const roles = await this.rolesService.findAll(restaurantId, isSuperAdmin);
    return new OkResponse({ data: roles });
  }

  @ApiOperation({ summary: 'Tạo vai trò mới tùy chỉnh cho nhà hàng' })
  @RequirePermissions(ResourceType.STAFF, ActionType.CREATE)
  @UseGuards(DemoBlockGuard)
  @Post()
  async create(
    @Body() createRoleDto: CreateRoleDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const role = await this.rolesService.create(createRoleDto, restaurantId, user);
    return new OkResponse({ message: 'Tạo vai trò mới thành công', data: role });
  }

  @ApiOperation({ summary: 'Xem chi tiết vai trò' })
  @RequirePermissions(ResourceType.STAFF, ActionType.VIEW)
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    const role = await this.rolesService.findById(id);
    if ((role.slug === 'system_admin' || role.slug === 'super_admin') && !isSuperAdminUser(user)) {
      return new OkResponse({ data: null });
    }
    return new OkResponse({ data: role });
  }

  @ApiOperation({ summary: 'Cập nhật thông tin vai trò' })
  @RequirePermissions(ResourceType.STAFF, ActionType.UPDATE)
  @UseGuards(DemoBlockGuard)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @CurrentUser() user: JwtUser,
  ) {
    const role = await this.rolesService.update(id, updateRoleDto, user);
    return new OkResponse({ message: 'Cập nhật vai trò thành công', data: role });
  }

  @ApiOperation({ summary: 'Xóa vai trò tùy chỉnh' })
  @RequirePermissions(ResourceType.STAFF, ActionType.DELETE)
  @UseGuards(DemoBlockGuard)
  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    const result = await this.rolesService.delete(id, user);
    return new OkResponse(result);
  }
}
