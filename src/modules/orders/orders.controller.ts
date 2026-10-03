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
import {
  UpdateOrderStatusDto,
  CancelOrderDto,
  CancelOrderItemDto,
  CancelRoundDto,
} from './dto/update-order-status.dto';
import { PayOrderDto } from './dto/pay-order.dto';
import { BillPreviewDto } from './dto/bill-preview.dto';
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
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.ordersService.findAll(query, restaurantId, user);
    return new OkResponse({ message: 'Lấy danh sách đơn hàng thành công', data: result });
  }

  @ApiOperation({ summary: 'Lấy đơn hàng đang hoạt động của một bàn (dành cho POS)' })
  @RequirePermissions(ResourceType.POS, ActionType.VIEW)
  @Get('by-table/:tableId')
  async getActiveOrderByTable(
    @Param('tableId') tableId: string,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const order = await this.ordersService.getActiveOrderByTable(tableId, restaurantId, user);
    return new OkResponse({
      message: order ? 'Lấy đơn hàng của bàn thành công' : 'Bàn hiện đang trống, chưa có đơn hàng hoạt động',
      data: order,
    });
  }

  @ApiOperation({ summary: 'Xem chi tiết đơn hàng' })
  @RequirePermissions(ResourceType.POS, ActionType.VIEW)
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const order = await this.ordersService.findById(id, restaurantId, user);
    return new OkResponse({ data: order });
  }

  @ApiOperation({ summary: 'Xem trước hóa đơn tạm tính (Pre-bill) với chiết khấu, VAT, phí dịch vụ' })
  @RequirePermissions(ResourceType.POS, ActionType.VIEW)
  @Get(':id/bill-preview')
  async previewBill(
    @Param('id') id: string,
    @Query() query: BillPreviewDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const preview = await this.ordersService.previewBill(id, query, restaurantId, user);
    return new OkResponse({ message: 'Tính toán hóa đơn tạm tính thành công', data: preview });
  }

  @ApiOperation({ summary: 'Gọi thêm món vào đơn hàng hiện tại của bàn' })
  @RequirePermissions(ResourceType.POS, ActionType.CREATE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/items')
  async addItems(
    @Param('id') id: string,
    @Body() dto: AddItemsToOrderDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const order = await this.ordersService.addItems(id, dto, restaurantId, user);
    return new OkResponse({ message: 'Gọi thêm món thành công', data: order });
  }

  @ApiOperation({ summary: 'Bếp cập nhật trạng thái của món ăn (Waiting, Cooking, Ready, Served)' })
  @RequirePermissions(ResourceType.KITCHEN, ActionType.UPDATE)
  @Patch(':id/items/:itemId/status')
  async updateItemStatus(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemStatusDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const order = await this.ordersService.updateItemStatus(
      id,
      itemId,
      dto.status,
      restaurantId,
      user,
    );
    return new OkResponse({ message: 'Cập nhật trạng thái món thành công', data: order });
  }

  @ApiOperation({ summary: 'Duyệt đợt gọi món (Confirm Round)' })
  @RequirePermissions(ResourceType.POS, ActionType.CONFIRM)
  @HttpCode(HttpStatus.OK)
  @Post(':id/rounds/:roundNumber/confirm')
  async confirmRound(
    @Param('id') id: string,
    @Param('roundNumber') roundNumber: number,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const order = await this.ordersService.confirmRound(id, Number(roundNumber), restaurantId, user);
    return new OkResponse({ message: 'Duyệt đợt gọi món thành công', data: order });
  }

  @ApiOperation({ summary: 'Hủy/Từ chối đợt gọi món (Cancel Round)' })
  @RequirePermissions(ResourceType.POS, ActionType.CONFIRM)
  @HttpCode(HttpStatus.OK)
  @Post(':id/rounds/:roundNumber/cancel')
  async cancelRound(
    @Param('id') id: string,
    @Param('roundNumber') roundNumber: number,
    @Body() dto: CancelRoundDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const reason = dto?.reason || 'Hủy đợt gọi món';
    const order = await this.ordersService.cancelRound(id, Number(roundNumber), reason, restaurantId, user);
    return new OkResponse({ message: 'Hủy đợt gọi món thành công', data: order });
  }

  @ApiOperation({ summary: 'Duyệt toàn bộ đơn hàng (Confirm Order)' })
  @RequirePermissions(ResourceType.POS, ActionType.CONFIRM)
  @HttpCode(HttpStatus.OK)
  @Post(':id/confirm')
  async confirmOrder(
    @Param('id') id: string,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const order = await this.ordersService.confirmOrder(id, restaurantId, user);
    return new OkResponse({ message: 'Xác nhận đơn hàng thành công', data: order });
  }

  @ApiOperation({ summary: 'Hủy đơn hàng' })
  @RequirePermissions(ResourceType.POS, ActionType.UPDATE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const reason = dto?.reason || 'Hủy đơn hàng';
    const order = await this.ordersService.cancelOrder(
      id,
      reason,
      restaurantId,
      user,
    );
    return new OkResponse({ message: 'Hủy đơn hàng thành công', data: order });
  }

  @ApiOperation({ summary: 'Hủy món ăn trong đơn' })
  @RequirePermissions(ResourceType.POS, ActionType.UPDATE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/items/:itemId/cancel')
  async cancelItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: CancelOrderItemDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const reason = dto?.reason || 'Hủy món ăn';
    const order = await this.ordersService.cancelItem(
      id,
      itemId,
      reason,
      restaurantId,
      user,
    );
    return new OkResponse({ message: 'Hủy món thành công', data: order });
  }

  @ApiOperation({ summary: 'Yêu cầu thanh toán (Served -> PaymentRequested)' })
  @RequirePermissions(ResourceType.POS, ActionType.CREATE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/request-payment')
  async requestPayment(
    @Param('id') id: string,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const order = await this.ordersService.requestPayment(id, restaurantId, user);
    return new OkResponse({ message: 'Yêu cầu thanh toán thành công', data: order });
  }

  @ApiOperation({ summary: 'Hoàn tác yêu cầu thanh toán (PaymentRequested -> Served)' })
  @RequirePermissions(ResourceType.POS, ActionType.CREATE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/revert-payment-request')
  async revertPaymentRequest(
    @Param('id') id: string,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const order = await this.ordersService.revertPaymentRequest(id, restaurantId, user);
    return new OkResponse({ message: 'Hoàn tác yêu cầu thanh toán thành công', data: order });
  }

  @ApiOperation({ summary: 'Cập nhật trạng thái toàn bộ đơn hàng' })
  @RequirePermissions(ResourceType.POS, ActionType.UPDATE)
  @Patch(':id/status')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const order = await this.ordersService.updateOrderStatus(id, dto, restaurantId, user);
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
}
