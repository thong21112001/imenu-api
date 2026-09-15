import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { TransferUserDto } from './dto/transfer-user.dto';
import { PaginateDto } from '../../shared/common/dto/paginate.dto';
import { OkResponse } from '../../shared/common/dto/okResponse';
import { RequirePermissions } from '../../shared/common/decorators/require-permissions.decorator';
import { ActionType, ResourceType } from '../../shared/common/constants/permission.const';
import { CurrentRestaurant } from '../../shared/common/decorators/current-restaurant.decorator';
import { CurrentUser } from '../../shared/common/decorators/current-user.decorator';
import { PermissionsGuard } from '../../shared/common/guards/permissions.guard';
import { JwtUser } from '../auth/interface/jwtUser';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Lấy danh sách nhân viên / tài khoản có phân trang' })
  @RequirePermissions(ResourceType.STAFF, ActionType.VIEW)
  @Get()
  async findAll(
    @Query() query: PaginateDto & { branchId?: string },
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.usersService.findAllPaginated(query, restaurantId, user);
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
  async create(
    @Body() dto: CreateUserDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const created = await this.usersService.create(dto, restaurantId, user);
    return new OkResponse({ message: 'Tạo tài khoản nhân viên thành công', data: created });
  }

  @ApiOperation({ summary: 'Cập nhật tài khoản nhân viên' })
  @RequirePermissions(ResourceType.STAFF, ActionType.UPDATE)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: JwtUser,
  ) {
    const updated = await this.usersService.update(id, dto, user);
    return new OkResponse({ message: 'Cập nhật tài khoản thành công', data: updated });
  }

  @ApiOperation({ summary: 'Điều chuyển nhân viên sang chi nhánh khác (Chỉ quản trị chi nhánh chính)' })
  @RequirePermissions(ResourceType.STAFF, ActionType.CONFIRM)
  @HttpCode(HttpStatus.OK)
  @Post(':id/transfer')
  async transfer(
    @Param('id') id: string,
    @Body() dto: TransferUserDto,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.usersService.transferStaff(id, dto, user);
    return new OkResponse(result);
  }
}
