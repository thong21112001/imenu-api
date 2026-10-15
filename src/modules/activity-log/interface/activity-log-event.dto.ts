import { ActivityAction, ActivityModule } from '../constants/audit-log.const';

export interface ActivityLogEventPayload {
  userId?: string;
  userName: string;
  userRole?: string;
  restaurantId?: string;
  branchId?: string;
  module: ActivityModule;
  action: ActivityAction;
  targetId?: string;
  entityType?: string;
  description?: string;
  previousData?: Record<string, any>;
  newData?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status?: 'SUCCESS' | 'FAILURE';
}

