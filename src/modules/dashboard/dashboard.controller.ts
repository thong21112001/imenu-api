import { Controller, Get, Query, BadRequestException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../../shared/common/decorators/current-user.decorator';
import { OkResponse } from '../../shared/common/dto/okResponse';
import { JwtUser } from '../auth/interface/jwtUser';
import { RequirePermissions } from '../../shared/common/decorators/require-permissions.decorator';
import { ActionType, ResourceType } from '../../shared/common/constants/permission.const';
import { PermissionsGuard } from '../../shared/common/guards/permissions.guard';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT-auth')
@UseGuards(PermissionsGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @ApiOperation({ summary: 'Lấy dữ liệu tổng quan và KPI vận hành thời gian thực' })
  @ApiQuery({ name: 'branchId', required: false, description: 'ID chi nhánh (chỉ chi nhánh chính mới có thể lọc hoặc xem toàn bộ)' })
  @RequirePermissions(ResourceType.DASHBOARD, ActionType.VIEW)
  @Get('overview')
  async getOverview(
    @CurrentUser() user: JwtUser,
    @Query('branchId') branchId?: string,
  ) {
    if (!user.restaurantId) {
      throw new BadRequestException('Tài khoản chưa được gán vào nhà hàng nào');
    }
    const data = await this.dashboardService.getOverview(user.restaurantId, branchId, user);
    return new OkResponse({
      message: 'Lấy dữ liệu bảng điều khiển thành công',
      data,
    });
  }
}
