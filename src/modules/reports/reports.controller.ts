import { Controller, Get, Query, BadRequestException, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
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
  @RequirePermissions(ResourceType.REPORT, ActionType.VIEW, 'perm-rep-view')
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
  @RequirePermissions(ResourceType.REPORT, ActionType.VIEW, 'perm-rep-view')
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

  @ApiOperation({ summary: 'Xuất dữ liệu báo cáo doanh thu ra file CSV (UTF-8 BOM) hoặc JSON' })
  @RequirePermissions(ResourceType.REPORT, ActionType.EXPORT, 'perm-rep-export')
  @Get('export')
  async exportReport(
    @CurrentUser() user: JwtUser,
    @Query() query: RevenueQueryDto,
    @Res() res: Response,
  ) {
    if (!user.restaurantId) {
      throw new BadRequestException('Tài khoản chưa được gán vào nhà hàng nào');
    }
    const content = await this.reportsService.exportReport(user.restaurantId, query, user);
    if (query.format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.send(content);
    }
    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="imenu-report-${dateStr}.csv"`);
    // Gắn tiền tố UTF-8 BOM \uFEFF (EF BB BF) để Excel hiển thị tiếng Việt có dấu chuẩn 100%
    const bomBuffer = Buffer.from([0xef, 0xbb, 0xbf]);
    const contentBuffer = Buffer.from(content, 'utf-8');
    return res.send(Buffer.concat([bomBuffer, contentBuffer]));
  }
}
