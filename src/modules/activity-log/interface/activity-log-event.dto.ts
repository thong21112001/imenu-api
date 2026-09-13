import { ActivityAction, ActivityModule } from '../constants/audit-log.const';

export interface ActivityLogEventPayload {
  userId?: string;
  userName: string;
  userRole?: string;
  restaurantId?: string;
  module: ActivityModule;
  action: ActivityAction;
  targetId?: string;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  status?: 'SUCCESS' | 'FAILURE';
}
