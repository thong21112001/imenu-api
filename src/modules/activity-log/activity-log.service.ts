import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OnEvent } from '@nestjs/event-emitter';
import { ActivityLog, ActivityLogDocument } from './entities/activity-log.entity';
import { ActivityLogEventPayload } from './interface/activity-log-event.dto';
import { QueryActivityLogDto } from './dto/query-activity-log.dto';
import { createPaginationResponse, PaginationResponse } from '../../shared/common/dto/paginated-result.dto';

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(
    @InjectModel(ActivityLog.name) private readonly logModel: Model<ActivityLogDocument>,
  ) {}

  /**
   * Listener nhan event bat dong bo de luu nhat ky thao tac
   */
  @OnEvent('activity.log', { async: true })
  async handleActivityLog(payload: ActivityLogEventPayload): Promise<void> {
    try {
      await this.logModel.create({
        user: payload.userId ? payload.userId : undefined,
        user_name: payload.userName,
        user_role: payload.userRole,
        restaurantId: payload.restaurantId ? payload.restaurantId : undefined,
        module: payload.module,
        action: payload.action,
        target_id: payload.targetId,
        description: payload.description,
        ip_address: payload.ipAddress,
        user_agent: payload.userAgent,
        status: payload.status || 'SUCCESS',
      });
    } catch (err: any) {
      this.logger.error('Lỗi khi lưu ActivityLog:', err.stack);
    }
  }

  async findAll(query: QueryActivityLogDto, restaurantId?: string): Promise<PaginationResponse<ActivityLog>> {
    const { page = 1, limit = 20, module } = query;
    const filter: any = {};

    if (restaurantId) filter.restaurantId = restaurantId;
    if (module) filter.module = module;

    const total = await this.logModel.countDocuments(filter);
    const data = await this.logModel
      .find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec();

    return createPaginationResponse(data, total, page, limit);
  }
}
