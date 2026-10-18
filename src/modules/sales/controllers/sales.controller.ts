import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { SalesService } from '../services/sales.service';
import { CurrentUser } from '../../../shared/common/decorators/current-user.decorator';
import { JwtUser, isSuperAdminUser } from '../../auth/interface/jwtUser';
import { ProcessSubscriptionDto } from '../dto/process-subscription.dto';
import { CreateAssistedRestaurantDto } from '../dto/create-assisted-restaurant.dto';
import { UpdatePayoutBankDto } from '../dto/update-payout-bank.dto';
import { QueryCommissionsDto } from '../dto/query-commissions.dto';
import { QueryReferredRestaurantsDto } from '../dto/query-referred-restaurants.dto';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  private checkSalesOrAdmin(user: JwtUser) {
    const roleSlug = typeof user.role === 'string' ? user.role : ((user.role as any)?.slug || (user.role as any)?.name || '');
    const isSales = roleSlug.toLowerCase() === 'sales_rep';
    const isAdmin = isSuperAdminUser(user);
    if (!isSales && !isAdmin) {
      throw new ForbiddenException('Chức năng chỉ dành cho Nhân viên Kinh doanh hoặc Quản trị viên hệ thống');
    }
  }

  @Get('dashboard')
  async getDashboard(@CurrentUser() user: JwtUser) {
    this.checkSalesOrAdmin(user);
    const data = await this.salesService.getSalesDashboard(user.userId);
    return {
      success: true,
      data,
    };
  }

  @Get('restaurants')
  async getReferredRestaurants(
    @CurrentUser() user: JwtUser,
    @Query() query: QueryReferredRestaurantsDto,
  ) {
    this.checkSalesOrAdmin(user);
    const result = await this.salesService.getReferredRestaurants(user.userId, query);
    return {
      success: true,
      data: result,
      ...result,
    };
  }

  @Post('restaurants')
  async createAssistedRestaurant(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateAssistedRestaurantDto,
  ) {
    this.checkSalesOrAdmin(user);
    const result = await this.salesService.createAssistedRestaurant(user.userId, dto);
    return {
      success: true,
      data: result,
      ...result,
    };
  }

  @Get('commissions')
  async getCommissions(
    @CurrentUser() user: JwtUser,
    @Query() query: QueryCommissionsDto,
  ) {
    this.checkSalesOrAdmin(user);
    const result = await this.salesService.getCommissions(user.userId, query);
    return {
      success: true,
      data: result,
      ...result,
    };
  }

  @Get('sub-team')
  async getSubTeam(@CurrentUser() user: JwtUser) {
    this.checkSalesOrAdmin(user);
    const result = await this.salesService.getSubTeam(user.userId);
    return {
      success: true,
      data: result,
      ...result,
    };
  }

  @Put('profile/bank-account')
  async updatePayoutBank(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdatePayoutBankDto,
  ) {
    this.checkSalesOrAdmin(user);
    const result = await this.salesService.updatePayoutBankAccount(user.userId, dto);
    return {
      success: true,
      data: result,
      ...result,
    };
  }

  @Post('subscriptions/process')
  async processSubscription(
    @CurrentUser() user: JwtUser,
    @Body() dto: ProcessSubscriptionDto,
  ) {
    // Cho phép SuperAdmin hoặc NVKD hỗ trợ thanh toán
    const result = await this.salesService.processSubscriptionTransaction(dto, user);
    return {
      success: true,
      data: result,
      ...result,
    };
  }

  @Post('applications/:id/approve')
  async approveApplication(
    @Param('id') applicationId: string,
    @CurrentUser() user: JwtUser,
  ) {
    if (!isSuperAdminUser(user)) {
      throw new ForbiddenException('Chỉ Quản trị viên cấp cao mới có quyền phê duyệt đơn ứng tuyển');
    }
    const result = await this.salesService.approveApplication(applicationId, user);
    return result;
  }
}
