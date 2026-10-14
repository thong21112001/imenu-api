import {
  Controller,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CurrentRestaurant } from '../../shared/common/decorators/current-restaurant.decorator';
import { CurrentUser } from '../../shared/common/decorators/current-user.decorator';
import { RequirePermissions } from '../../shared/common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../shared/common/guards/permissions.guard';
import { ActionType, ResourceType } from '../../shared/common/constants/permission.const';
import { OkResponse } from '../../shared/common/dto/okResponse';
import { JwtUser } from '../auth/interface/jwtUser';

@ApiTags('Order Items (KDS Direct Actions)')
@ApiBearerAuth('JWT-auth')
@UseGuards(PermissionsGuard)
@Controller('order-items')
export class OrderItemsController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({ summary: 'Bếp bắt đầu nấu món ăn trực tiếp qua ID món (Waiting -> Cooking)' })
  @RequirePermissions(ResourceType.KITCHEN, ActionType.UPDATE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/start-cooking')
  async startCooking(
    @Param('id') id: string,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const order = await this.ordersService.startCookingItem(id, restaurantId, user);
    return new OkResponse({
      message: 'Đã bắt đầu chế biến món ăn',
      data: order,
    });
  }

  @ApiOperation({ summary: 'Bếp hoàn tất món ăn trực tiếp qua ID món (Cooking -> Ready)' })
  @RequirePermissions(ResourceType.KITCHEN, ActionType.UPDATE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/mark-ready')
  async markReady(
    @Param('id') id: string,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const order = await this.ordersService.markItemReady(id, restaurantId, user);
    return new OkResponse({
      message: 'Món ăn đã chế biến xong, sẵn sàng phục vụ',
      data: order,
    });
  }

  @ApiOperation({ summary: 'Báo đã phục vụ món ăn trực tiếp qua ID món (Ready -> Served)' })
  @RequirePermissions(ResourceType.KITCHEN, ActionType.UPDATE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/mark-served')
  async markServed(
    @Param('id') id: string,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const order = await this.ordersService.markItemServed(id, restaurantId, user);
    return new OkResponse({
      message: 'Đã phục vụ món ăn ra bàn',
      data: order,
    });
  }
}
