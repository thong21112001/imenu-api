import { Controller, Get, Post, Body, Param, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { OkResponse } from '../../shared/common/dto/okResponse';
import { RequirePermissions } from '../../shared/common/decorators/require-permissions.decorator';
import { ActionType, IMENU_PERMISSIONS, ResourceType } from '../../shared/common/constants/permission.const';
import { CurrentRestaurant } from '../../shared/common/decorators/current-restaurant.decorator';
import { PermissionsGuard } from '../../shared/common/guards/permissions.guard';

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
  async findAll(@CurrentRestaurant() restaurantId: string) {
    const roles = await this.rolesService.findAll(restaurantId);
    return new OkResponse({ data: roles });
  }

  @ApiOperation({ summary: 'Tạo vai trò mới tùy chỉnh cho nhà hàng' })
  @RequirePermissions(ResourceType.STAFF, ActionType.CREATE)
  @Post()
  async create(@Body() createRoleDto: CreateRoleDto, @CurrentRestaurant() restaurantId: string) {
    const role = await this.rolesService.create(createRoleDto, restaurantId);
    return new OkResponse({ message: 'Tạo vai trò mới thành công', data: role });
  }

  @ApiOperation({ summary: 'Cập nhật thông tin vai trò' })
  @RequirePermissions(ResourceType.STAFF, ActionType.UPDATE)
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    const role = await this.rolesService.update(id, updateRoleDto);
    return new OkResponse({ message: 'Cập nhật vai trò thành công', data: role });
  }
}
