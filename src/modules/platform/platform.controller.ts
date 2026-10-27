import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformService } from './platform.service';
import { JwtAuthGuard } from '../../shared/common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../shared/common/guards/super-admin.guard';
import { CurrentUser } from '../../shared/common/decorators/current-user.decorator';
import { JwtUser } from '../auth/interface/jwtUser';
import { QueryPlatformRestaurantsDto } from './dto/query-platform-restaurants.dto';
import { QueryPlatformCommissionsDto } from './dto/query-platform-commissions.dto';
import { UpdateRestaurantStatusDto } from './dto/update-restaurant-status.dto';
import { UpdateRestaurantSubscriptionDto } from './dto/update-restaurant-subscription.dto';
import { QueryPlatformRevenuesDto } from './dto/query-platform-revenues.dto';
import { CreateSalesRepDto } from './dto/create-sales-rep.dto';
import { UpdateSalesRepDto } from './dto/update-sales-rep.dto';
import { PayoutBatchDto } from './dto/payout-batch.dto';

@ApiTags('Platform (SuperAdmin)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @ApiOperation({ summary: 'Thống kê KPI toàn hệ thống iMenu' })
  @Get('overview')
  async getOverview() {
    const data = await this.platformService.getOverview();
    return { success: true, data };
  }

  @ApiOperation({ summary: 'Danh sách toàn bộ nhà hàng kèm chỉ số doanh thu GMV và gói cước' })
  @Get('restaurants')
  async getRestaurants(@Query() query: QueryPlatformRestaurantsDto) {
    const data = await this.platformService.getRestaurants(query);
    return { success: true, data, ...data };
  }

  @ApiOperation({ summary: 'Khóa / Mở khóa hoạt động nhà hàng (AUD-13.2)' })
  @Patch('restaurants/:id/status')
  async updateRestaurantStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRestaurantStatusDto,
    @CurrentUser() user: JwtUser,
  ) {
    const data = await this.platformService.updateRestaurantStatus(id, dto, user);
    return { success: true, data };
  }

  @ApiOperation({ summary: 'Nâng cấp / Gia hạn gói cước và kích hoạt tính hoa hồng cho NVKD' })
  @Patch('restaurants/:id/subscription')
  async updateRestaurantSubscription(
    @Param('id') id: string,
    @Body() dto: UpdateRestaurantSubscriptionDto,
    @CurrentUser() user: JwtUser,
  ) {
    const data = await this.platformService.updateRestaurantSubscription(id, dto, user);
    return { success: true, data };
  }

  @ApiOperation({ summary: 'Báo cáo doanh thu bán hàng GMV của toàn bộ nhà hàng và chi nhánh' })
  @Get('revenues/restaurants')
  async getRestaurantRevenues(@Query() query: QueryPlatformRevenuesDto) {
    const data = await this.platformService.getRestaurantRevenues(query);
    return { success: true, data };
  }

  @ApiOperation({ summary: 'Báo cáo doanh thu nền tảng SaaS & đối soát lợi nhuận ròng' })
  @Get('revenues/saas')
  async getSaaSRevenues(@Query() query: QueryPlatformRevenuesDto) {
    const data = await this.platformService.getSaaSRevenues(query);
    return { success: true, data };
  }

  @ApiOperation({ summary: 'Danh sách toàn bộ Nhân viên Kinh doanh kèm hiệu quả phát triển' })
  @Get('sales-reps')
  async getSalesReps() {
    const data = await this.platformService.getSalesReps();
    return { success: true, data };
  }

  @ApiOperation({ summary: 'Tạo tài khoản Nhân viên Kinh doanh mới với mã giới thiệu tùy chỉnh' })
  @Post('sales-reps')
  async createSalesRep(@Body() dto: CreateSalesRepDto) {
    const data = await this.platformService.createSalesRep(dto);
    return { success: true, data };
  }

  @ApiOperation({ summary: 'Cập nhật trạng thái hoặc chính sách hoa hồng cho NVKD' })
  @Patch('sales-reps/:id')
  async updateSalesRep(@Param('id') id: string, @Body() dto: UpdateSalesRepDto) {
    const data = await this.platformService.updateSalesRep(id, dto);
    return { success: true, data };
  }

  @ApiOperation({ summary: 'Danh sách đơn ứng tuyển Nhân viên Kinh doanh' })
  @Get('sales-applications')
  async getSalesApplications() {
    const data = await this.platformService.getSalesApplications();
    return { success: true, data };
  }

  @ApiOperation({ summary: 'Phê duyệt đơn ứng tuyển NVKD và tự động cấp tài khoản' })
  @HttpCode(HttpStatus.OK)
  @Post('sales-applications/:id/approve')
  async approveSalesApplication(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const data = await this.platformService.approveSalesApplication(id, user);
    return { success: true, ...data };
  }

  @ApiOperation({ summary: 'Danh sách hoa hồng toàn sàn phục vụ đối soát và chi trả hàng loạt' })
  @Get('commissions')
  async getCommissions(@Query() query: QueryPlatformCommissionsDto) {
    const data = await this.platformService.getCommissions(query);
    return { success: true, data, ...data };
  }

  @ApiOperation({ summary: 'Duyệt hoặc chốt thanh toán kỳ đối soát hoa hồng nguyên tử (AUD-13.3)' })
  @HttpCode(HttpStatus.OK)
  @Post(['commissions/payout-batch', 'commission/payout-batch'])
  async executePayoutBatch(
    @Body() dto: PayoutBatchDto,
    @CurrentUser() user: JwtUser,
  ) {
    const data = await this.platformService.executePayoutBatch(dto, user);
    return { success: true, ...data };
  }
}
