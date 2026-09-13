import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ActivityLogService } from './activity-log.service';
import { QueryActivityLogDto } from './dto/query-activity-log.dto';
import { OkResponse } from '../../shared/common/dto/okResponse';
import { RequirePermissions } from '../../shared/common/decorators/require-permissions.decorator';
import { ActionType, ResourceType } from '../../shared/common/constants/permission.const';
import { CurrentRestaurant } from '../../shared/common/decorators/current-restaurant.decorator';
import { PermissionsGuard } from '../../shared/common/guards/permissions.guard';

@ApiTags('Activity Logs')
@ApiBearerAuth('JWT-auth')
@UseGuards(PermissionsGuard)
@Controller('activity-logs')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @ApiOperation({ summary: 'Truy vấn nhật ký kiểm toán hệ thống có phân trang & lọc module' })
  @RequirePermissions(ResourceType.SETTING, ActionType.VIEW)
  @Get()
  async findAll(@Query() query: QueryActivityLogDto, @CurrentRestaurant() restaurantId: string) {
    const result = await this.activityLogService.findAll(query, restaurantId);
    return new OkResponse({ data: result });
  }
}
