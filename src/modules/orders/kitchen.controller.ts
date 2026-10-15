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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { MenuItemsService } from '../menu/menu-items.service';
import { QueryKitchenOrdersDto } from './dto/query-kitchen-orders.dto';
import { BatchKitchenItemsDto } from './dto/batch-kitchen-items.dto';
import { KitchenToggleAvailabilityDto } from './dto/kitchen-item-availability.dto';
import { CurrentRestaurant } from '../../shared/common/decorators/current-restaurant.decorator';
import { CurrentUser } from '../../shared/common/decorators/current-user.decorator';
import { RequirePermissions } from '../../shared/common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../shared/common/guards/permissions.guard';
import { ActionType, ResourceType } from '../../shared/common/constants/permission.const';
import { OkResponse } from '../../shared/common/dto/okResponse';
import { JwtUser, isSuperAdminUser } from '../auth/interface/jwtUser';

@ApiTags('Kitchen KDS (Màn Hình Điều Phối Bếp)')
@ApiBearerAuth('JWT-auth')
@UseGuards(PermissionsGuard)
@Controller('kitchen')
export class KitchenController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly menuItemsService: MenuItemsService,
  ) {}

  @ApiOperation({ summary: 'Lấy danh sách đơn hàng active cho KDS (FIFO: createdAt ASC)' })
  @RequirePermissions(ResourceType.KITCHEN, ActionType.VIEW)
  @Get('orders')
  async getKitchenOrders(
    @Query() query: QueryKitchenOrdersDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const orders = await this.ordersService.getKitchenOrders(query, restaurantId, user);
    return new OkResponse({
      message: 'Lấy danh sách đơn hàng cho bếp thành công',
      data: orders,
    });
  }

  @ApiOperation({ summary: 'Gom nhóm số lượng món đang Waiting và Cooking trên toàn chi nhánh' })
  @RequirePermissions(ResourceType.KITCHEN, ActionType.VIEW)
  @ApiQuery({ name: 'branchId', required: false, description: 'ID chi nhánh' })
  @Get('items-summary')
  async getKitchenItemsSummary(
    @Query('branchId') branchId: string | undefined,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const targetBranchId = branchId || user?.branchId;
    const summary = await this.ordersService.getKitchenItemsSummary(targetBranchId, restaurantId, user);
    return new OkResponse({
      message: 'Lấy danh sách tổng hợp món chế biến thành công',
      data: summary,
    });
  }

  @ApiOperation({ summary: 'Bếp bắt đầu nấu món ăn (Waiting -> Cooking)' })
  @RequirePermissions(ResourceType.KITCHEN, ActionType.UPDATE)
  @HttpCode(HttpStatus.OK)
  @Post('orders/:orderId/items/:itemId/start-cooking')
  async startCooking(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const order = await this.ordersService.startCookingItem(itemId, restaurantId, user, orderId);
    return new OkResponse({
      message: 'Đã bắt đầu chế biến món ăn',
      data: order,
    });
  }

  @ApiOperation({ summary: 'Bếp hoàn tất món ăn (Cooking -> Ready)' })
  @RequirePermissions(ResourceType.KITCHEN, ActionType.UPDATE)
  @HttpCode(HttpStatus.OK)
  @Post('orders/:orderId/items/:itemId/mark-ready')
  async markReady(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const order = await this.ordersService.markItemReady(itemId, restaurantId, user, orderId);
    return new OkResponse({
      message: 'Món ăn đã chế biến xong, sẵn sàng phục vụ',
      data: order,
    });
  }

  @ApiOperation({ summary: 'Báo đã phục vụ món ăn ra bàn (Ready -> Served)' })
  @RequirePermissions(ResourceType.KITCHEN, ActionType.UPDATE)
  @HttpCode(HttpStatus.OK)
  @Post('orders/:orderId/items/:itemId/mark-served')
  async markServed(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const order = await this.ordersService.markItemServed(itemId, restaurantId, user, orderId);
    return new OkResponse({
      message: 'Đã phục vụ món ăn ra bàn',
      data: order,
    });
  }

  @ApiOperation({ summary: 'Bắt đầu nấu hàng loạt món trong vé bếp hoặc đợt gọi' })
  @RequirePermissions(ResourceType.KITCHEN, ActionType.UPDATE, 'perm-kds-cook')
  @HttpCode(HttpStatus.OK)
  @Post('orders/:orderId/start-cooking-all')
  async startCookingAll(
    @Param('orderId') orderId: string,
    @Body() dto: BatchKitchenItemsDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.ordersService.batchUpdateKitchenItems(
      orderId,
      'Cooking',
      restaurantId,
      user,
      dto?.roundNumber,
    );
    return new OkResponse({
      message: `Đã bắt đầu nấu ${result.updatedCount || 0} món thành công`,
      data: result,
    });
  }

  @ApiOperation({ summary: 'Hoàn tất hàng loạt món trong vé bếp hoặc đợt gọi' })
  @RequirePermissions(ResourceType.KITCHEN, ActionType.UPDATE, 'perm-kds-cook')
  @HttpCode(HttpStatus.OK)
  @Post('orders/:orderId/mark-ready-all')
  async markReadyAll(
    @Param('orderId') orderId: string,
    @Body() dto: BatchKitchenItemsDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.ordersService.batchUpdateKitchenItems(
      orderId,
      'Ready',
      restaurantId,
      user,
      dto?.roundNumber,
    );
    return new OkResponse({
      message: `Đã hoàn tất ${result.updatedCount || 0} món thành công`,
      data: result,
    });
  }

  @ApiOperation({ summary: 'Bếp xem danh sách thực đơn và tình trạng Còn/Hết món theo chi nhánh' })
  @RequirePermissions(ResourceType.KITCHEN, ActionType.VIEW, 'perm-kds-view')
  @ApiQuery({ name: 'branchId', required: false })
  @Get('menu-items')
  async getKitchenMenuItems(
    @Query('branchId') branchId: string | undefined,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const targetBranchId = branchId || user?.branchId;
    const result = await this.menuItemsService.findAll(
      restaurantId,
      { limit: 200 } as any,
      targetBranchId,
    );
    return new OkResponse({
      message: 'Lấy danh sách thực đơn cho bếp thành công',
      data: result,
    });
  }

  @ApiOperation({ summary: 'Bếp báo hết nguyên liệu / bật tắt trạng thái Còn món theo chi nhánh' })
  @RequirePermissions(ResourceType.KITCHEN, ActionType.UPDATE, 'perm-kds-out', ['perm-menu-status'])
  @Patch('menu-items/:id/availability')
  async toggleItemAvailability(
    @Param('id') itemId: string,
    @Body() dto: KitchenToggleAvailabilityDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const targetBranchId = dto.branchId || user?.branchId;
    const updated = await this.menuItemsService.toggleStatus(
      itemId,
      restaurantId,
      dto.isAvailable,
      user,
      targetBranchId,
    );
    const isAvail =
      updated.effectiveIsAvailable !== undefined
        ? updated.effectiveIsAvailable
        : updated.isAvailable;
    const statusText = isAvail ? 'Còn món' : 'Hết món';
    return new OkResponse({
      message: `Đã cập nhật trạng thái món "${updated.name}" sang: ${statusText}`,
      data: updated,
    });
  }
}
