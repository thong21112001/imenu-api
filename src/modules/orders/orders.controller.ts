import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto, AddItemsToOrderDto } from './dto/create-order.dto';
import { UpdateItemStatusDto } from './dto/update-item-status.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { PayOrderDto } from './dto/pay-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { CurrentRestaurant } from '../../shared/common/decorators/current-restaurant.decorator';
import { CurrentUser } from '../../shared/common/decorators/current-user.decorator';
import { RequirePermissions } from '../../shared/common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../shared/common/guards/permissions.guard';
import { ActionType, ResourceType } from '../../shared/common/constants/permission.const';
import { OkResponse } from '../../shared/common/dto/okResponse';
import { JwtUser } from '../auth/interface/jwtUser';

@ApiTags('Orders (Quản Lý Đơn Hàng & POS)')
@ApiBearerAuth('JWT-auth')
@UseGuards(PermissionsGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({ summary: 'Tạo đơn hàng mới (POS hoặc QR bàn)' })
  @RequirePermissions(ResourceType.POS, ActionType.CREATE)
  @Post()
  async create(
    @Body() dto: CreateOrderDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const order = await this.ordersService.create(dto, restaurantId, user);
    return new OkResponse({ message: 'Tạo đơn hàng thành công', data: order });
  }

  @ApiOperation({ summary: 'Lấy danh sách đơn hàng (lọc theo bàn, chi nhánh, trạng thái, phân trang)' })
  @RequirePermissions(ResourceType.POS, ActionType.VIEW)
  @Get()
  async findAll(
    @Query() query: QueryOrderDto,
    @CurrentRestaurant() restaurantId: string,
  ) {
    const result = await this.ordersService.findAll(query, restaurantId);
    return new OkResponse({ message: 'Lấy danh sách đơn hàng thành công', data: result });
  }

  @ApiOperation({ summary: 'Xem chi tiết đơn hàng' })
  @RequirePermissions(ResourceType.POS, ActionType.VIEW)
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentRestaurant() restaurantId: string,
  ) {
    const order = await this.ordersService.findById(id, restaurantId);
    return new OkResponse({ data: order });
  }

  @ApiOperation({ summary: 'Gọi thêm món vào đơn hàng hiện tại của bàn' })
  @RequirePermissions(ResourceType.POS, ActionType.CREATE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/items')
  async addItems(
    @Param('id') id: string,
    @Body() dto: AddItemsToOrderDto,
    @CurrentRestaurant() restaurantId: string,
  ) {
    const order = await this.ordersService.addItems(id, dto, restaurantId);
    return new OkResponse({ message: 'Gọi thêm món thành công', data: order });
  }

  @ApiOperation({ summary: 'Bếp cập nhật trạng thái của món ăn (Cooking, Ready, Served)' })
  @RequirePermissions(ResourceType.KITCHEN, ActionType.UPDATE)
  @Patch(':id/items/:itemId/status')
  async updateItemStatus(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemStatusDto,
    @CurrentRestaurant() restaurantId: string,
  ) {
    const order = await this.ordersService.updateItemStatus(
      id,
      itemId,
      dto.status,
      restaurantId,
    );
    return new OkResponse({ message: 'Cập nhật trạng thái món thành công', data: order });
  }

  @ApiOperation({ summary: 'Cập nhật trạng thái toàn bộ đơn hàng' })
  @RequirePermissions(ResourceType.POS, ActionType.UPDATE)
  @Patch(':id/status')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentRestaurant() restaurantId: string,
  ) {
    const order = await this.ordersService.updateOrderStatus(id, dto, restaurantId);
    return new OkResponse({ message: 'Cập nhật trạng thái đơn thành công', data: order });
  }

  @ApiOperation({ summary: 'Thanh toán đơn hàng & giải phóng bàn ăn' })
  @RequirePermissions(ResourceType.POS, ActionType.CONFIRM)
  @HttpCode(HttpStatus.OK)
  @Post(':id/pay')
  async pay(
    @Param('id') id: string,
    @Body() dto: PayOrderDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.ordersService.pay(id, dto, restaurantId, user);
    return new OkResponse({ message: 'Thanh toán đơn hàng thành công', data: result });
  }

  @ApiOperation({ summary: 'Hủy đơn hàng' })
  @RequirePermissions(ResourceType.POS, ActionType.UPDATE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentRestaurant() restaurantId: string,
  ) {
    const order = await this.ordersService.updateOrderStatus(
      id,
      { status: 'Cancelled', reason },
      restaurantId,
    );
    return new OkResponse({ message: 'Hủy đơn hàng thành công', data: order });
  }
}
