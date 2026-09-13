import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginateDto } from '../../shared/common/dto/paginate.dto';
import { OkResponse } from '../../shared/common/dto/okResponse';
import { RequirePermissions } from '../../shared/common/decorators/require-permissions.decorator';
import { ActionType, ResourceType } from '../../shared/common/constants/permission.const';
import { CurrentRestaurant } from '../../shared/common/decorators/current-restaurant.decorator';
import { PermissionsGuard } from '../../shared/common/guards/permissions.guard';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Lấy danh sách nhân viên / tài khoản có phân trang' })
  @RequirePermissions(ResourceType.STAFF, ActionType.VIEW)
  @Get()
  async findAll(@Query() query: PaginateDto, @CurrentRestaurant() restaurantId: string) {
    const result = await this.usersService.findAllPaginated(query, restaurantId);
    return new OkResponse({ data: result });
  }

  @ApiOperation({ summary: 'Xem chi tiết tài khoản' })
  @RequirePermissions(ResourceType.STAFF, ActionType.VIEW)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    return new OkResponse({ data: user });
  }

  @ApiOperation({ summary: 'Tạo tài khoản nhân viên mới' })
  @RequirePermissions(ResourceType.STAFF, ActionType.CREATE)
  @Post()
  async create(@Body() dto: CreateUserDto, @CurrentRestaurant() restaurantId: string) {
    const user = await this.usersService.create(dto, restaurantId);
    return new OkResponse({ message: 'Tạo tài khoản nhân viên thành công', data: user });
  }

  @ApiOperation({ summary: 'Cập nhật tài khoản nhân viên' })
  @RequirePermissions(ResourceType.STAFF, ActionType.UPDATE)
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const user = await this.usersService.update(id, dto);
    return new OkResponse({ message: 'Cập nhật tài khoản thành công', data: user });
  }
}
