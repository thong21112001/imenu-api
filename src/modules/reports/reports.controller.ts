import { Controller, Get, Query, BadRequestException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { RevenueQueryDto } from './dto/revenue-query.dto';
import { CurrentUser } from '../../shared/common/decorators/current-user.decorator';
import { OkResponse } from '../../shared/common/dto/okResponse';
import { JwtUser } from '../auth/interface/jwtUser';
import { RequirePermissions } from '../../shared/common/decorators/require-permissions.decorator';
import { ActionType, ResourceType } from '../../shared/common/constants/permission.const';
import { PermissionsGuard } from '../../shared/common/guards/permissions.guard';

@ApiTags('Reports')
@ApiBearerAuth('JWT-auth')
@UseGuards(PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiOperation({ summary: 'Báo cáo doanh thu theo chi nhánh hoặc toàn bộ chuỗi' })
  @RequirePermissions(ResourceType.REPORT, ActionType.VIEW)
  @Get('revenue')
  async getRevenueReport(
    @CurrentUser() user: JwtUser,
    @Query() query: RevenueQueryDto,
  ) {
    if (!user.restaurantId) {
      throw new BadRequestException('Tài khoản chưa được gán vào nhà hàng nào');
    }
    const data = await this.reportsService.getRevenueReport(user.restaurantId, query, user);
    return new OkResponse({
      message: 'Lấy báo cáo doanh thu thành công',
      data,
    });
  }

  @ApiOperation({ summary: 'Báo cáo Top món bán chạy nhất theo doanh thu và số lượng' })
  @RequirePermissions(ResourceType.REPORT, ActionType.VIEW)
  @Get('top-items')
  async getTopItems(
    @CurrentUser() user: JwtUser,
    @Query() query: RevenueQueryDto,
  ) {
    if (!user.restaurantId) {
      throw new BadRequestException('Tài khoản chưa được gán vào nhà hàng nào');
    }
    const data = await this.reportsService.getTopItems(user.restaurantId, query, user);
    return new OkResponse({
      message: 'Lấy danh sách món bán chạy thành công',
      data,
    });
  }
}
