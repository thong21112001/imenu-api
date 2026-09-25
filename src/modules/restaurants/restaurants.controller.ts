import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  BadRequestException,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RestaurantsService } from './restaurants.service';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { CurrentUser } from '../../shared/common/decorators/current-user.decorator';
import { OkResponse } from '../../shared/common/dto/okResponse';
import { JwtUser, isSuperAdminUser } from '../auth/interface/jwtUser';
import { DemoBlockGuard } from '../../shared/common/guards/demo-block.guard';
import { PermissionsGuard } from '../../shared/common/guards/permissions.guard';
import { RequirePermissions } from '../../shared/common/decorators/require-permissions.decorator';
import { ActionType, ResourceType } from '../../shared/common/constants/permission.const';

@ApiTags('Restaurants')
@ApiBearerAuth('JWT-auth')
@UseGuards(PermissionsGuard)
@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @ApiOperation({ summary: 'Lấy danh sách tất cả nhà hàng (Dành cho Super Admin)' })
  @RequirePermissions(ResourceType.SETTING, ActionType.VIEW)
  @Get()
  async findAll(@CurrentUser() user: JwtUser) {
    const isSuperAdmin = isSuperAdminUser(user);
    if (!isSuperAdmin) {
      throw new ForbiddenException('Chỉ Quản trị viên hệ thống (Super Admin) mới có quyền truy cập');
    }
    const data = await this.restaurantsService.findAllRestaurants();
    return new OkResponse({ message: 'Lấy danh sách nhà hàng thành công', data });
  }

  @ApiOperation({ summary: 'Lấy thông tin nhà hàng hiện tại của người dùng' })
  @Get('current')
  async getCurrent(@CurrentUser() user: JwtUser) {
    if (!user.restaurantId) {
      const isSuperAdmin = isSuperAdminUser(user);
      if (isSuperAdmin) {
        return new OkResponse({
          message: 'Super Admin - Chưa chọn nhà hàng cụ thể',
          data: { isPlatformAdmin: true },
        });
      }
      throw new BadRequestException('Tài khoản chưa được gán vào nhà hàng nào');
    }
    const data = await this.restaurantsService.getCurrent(user.restaurantId);
    return new OkResponse({ message: 'Lấy thông tin nhà hàng thành công', data });
  }

  @ApiOperation({ summary: 'Xem chi tiết một nhà hàng theo ID (Dành cho Super Admin)' })
  @RequirePermissions(ResourceType.SETTING, ActionType.VIEW)
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    const isSuperAdmin = isSuperAdminUser(user);
    if (!isSuperAdmin && user.restaurantId !== id) {
      throw new ForbiddenException('Bạn không có quyền truy cập nhà hàng này');
    }
    const data = await this.restaurantsService.getCurrent(id);
    return new OkResponse({ message: 'Lấy thông tin nhà hàng thành công', data });
  }

  @ApiOperation({ summary: 'Cập nhật thông tin nhà hàng hiện tại' })
  @UseGuards(DemoBlockGuard)
  @Put('current')
  async updateCurrent(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateRestaurantDto,
  ) {
    if (!user.restaurantId) {
      throw new BadRequestException('Tài khoản chưa được gán vào nhà hàng nào');
    }
    const data = await this.restaurantsService.updateCurrent(
      user.restaurantId,
      dto,
      user,
    );
    return new OkResponse({
      message: 'Cập nhật thông tin nhà hàng thành công',
      data,
    });
  }
}
