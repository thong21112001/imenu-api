import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OnEvent } from '@nestjs/event-emitter';
import { ActivityLog, ActivityLogDocument } from './entities/activity-log.entity';
import { ActivityLogEventPayload } from './interface/activity-log-event.dto';
import { QueryActivityLogDto } from './dto/query-activity-log.dto';
import { createPaginationResponse, PaginationResponse } from '../../shared/common/dto/paginated-result.dto';
import { JwtUser, isSuperAdminUser } from '../auth/interface/jwtUser';

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
        user: payload.userId && Types.ObjectId.isValid(payload.userId) ? new Types.ObjectId(payload.userId) : undefined,
        user_name: payload.userName,
        user_role: payload.userRole,
        restaurantId: payload.restaurantId && Types.ObjectId.isValid(payload.restaurantId) ? new Types.ObjectId(payload.restaurantId) : undefined,
        branchId: payload.branchId,
        module: payload.module,
        action: payload.action,
        target_id: payload.targetId,
        entityType: payload.entityType,
        description: payload.description,
        previousData: payload.previousData,
        newData: payload.newData,
        metadata: payload.metadata,
        ip_address: payload.ipAddress,
        user_agent: payload.userAgent,
        status: payload.status || 'SUCCESS',
      });
    } catch (err: any) {
      this.logger.error('Lỗi khi lưu ActivityLog:', err.stack);
    }
  }

  async findAll(
    query: QueryActivityLogDto,
    restaurantId?: string,
    caller?: JwtUser,
  ): Promise<PaginationResponse<ActivityLog>> {
    const { page = 1, limit = 20, module, action, targetId } = query;
    const filter: any = {};

    if (restaurantId && Types.ObjectId.isValid(restaurantId)) {
      filter.restaurantId = new Types.ObjectId(restaurantId);
    }

    // Phan lap chi nhanh
    if (caller && !caller.isMainBranch && caller.branchId && !isSuperAdminUser(caller)) {
      filter.branchId = caller.branchId;
    } else if (query.branchId && query.branchId !== 'all') {
      filter.branchId = query.branchId;
    }

    if (module) filter.module = module;
    if (action) filter.action = action;
    if (targetId) filter.target_id = targetId;

    if (query.fromDate || query.toDate) {
      filter.createdAt = {};
      if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
      if (query.toDate) {
        const to = new Date(query.toDate);
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }

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
