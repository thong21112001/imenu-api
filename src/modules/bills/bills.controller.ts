import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BillsService } from './bills.service';
import { QueryBillDto } from './dto/query-bill.dto';
import { RequirePermissions } from '../../shared/common/decorators/require-permissions.decorator';
import { CurrentRestaurant } from '../../shared/common/decorators/current-restaurant.decorator';
import { CurrentUser } from '../../shared/common/decorators/current-user.decorator';
import { ResourceType, ActionType } from '../../shared/common/constants/permission.const';
import { JwtUser } from '../auth/interface/jwtUser';
import { OkResponse } from '../../shared/common/dto/okResponse';

@ApiTags('Bills - Quản lý Hóa đơn & In ấn')
@ApiBearerAuth()
@Controller('bills')
export class BillsController {
  constructor(private readonly billsService: BillsService) {}

  @ApiOperation({ summary: 'Lấy danh sách hóa đơn có bộ lọc và phân trang' })
  @RequirePermissions(ResourceType.BILL, ActionType.VIEW, 'perm-bill-view', ['perm-pos-pay'])
  @Get()
  async findAll(
    @Query() query: QueryBillDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.billsService.findAll(query, restaurantId, user);
    return new OkResponse({
      message: 'Lấy danh sách hóa đơn thành công',
      data: result,
    });
  }

  @ApiOperation({ summary: 'Xem chi tiết hóa đơn theo Order ID' })
  @RequirePermissions(ResourceType.BILL, ActionType.VIEW, 'perm-bill-view', ['perm-pos-pay'])
  @Get('by-order/:orderId')
  async findByOrderId(
    @Param('orderId') orderId: string,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.billsService.findByOrderId(orderId, restaurantId, user);
    return new OkResponse({
      message: 'Lấy thông tin hóa đơn theo đơn hàng thành công',
      data: result,
    });
  }

  @ApiOperation({ summary: 'Xem chi tiết hóa đơn theo Bill ID' })
  @RequirePermissions(ResourceType.BILL, ActionType.VIEW, 'perm-bill-view', ['perm-pos-pay'])
  @Get(':id')
  async findById(
    @Param('id') id: string,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.billsService.findById(id, restaurantId, user);
    return new OkResponse({
      message: 'Lấy chi tiết hóa đơn thành công',
      data: result,
    });
  }

  @ApiOperation({ summary: 'Ghi nhận in hóa đơn & lấy mã lệnh nhị phân ESC/POS 80mm' })
  @RequirePermissions(ResourceType.BILL, ActionType.PRINT, 'perm-bill-print', ['perm-pos-pay'])
  @HttpCode(HttpStatus.OK)
  @Post(':id/print')
  async printBill(
    @Param('id') id: string,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.billsService.printBill(id, restaurantId, user);
    return new OkResponse({
      message: 'Khởi tạo lệnh in hóa đơn thành công',
      data: result,
    });
  }
}
