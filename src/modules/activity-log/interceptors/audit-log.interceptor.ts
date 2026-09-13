import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ActivityAction, ActivityModule } from '../constants/audit-log.const';
import { ActivityLogEventPayload } from '../interface/activity-log-event.dto';

/**
 * Audit Log Interceptor ke thua pattern tu happyco-api:
 * Tu dong bat request mutating (POST, PUT, PATCH, DELETE),
 * ban event 'activity.log' qua EventEmitter2 bat dong bo (khong nghen luong HTTP chinh)
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest();
    const method = (request?.method || '').toUpperCase();
    const url = request?.originalUrl || request?.url || '';

    // Chi bat cac HTTP methods co bien doi du lieu
    const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!mutatingMethods.includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (response) => {
          try {
            this.emitAudit(request, method, url, response);
          } catch (err: any) {
            this.logger.warn(`Bỏ qua audit log: ${err.message}`);
          }
        },
      }),
    );
  }

  private emitAudit(req: any, method: string, url: string, _res: any) {
    const user = req.user;
    if (!user) return; // Bo qua neu chua authenticated

    let module = ActivityModule.SYSTEM;
    if (url.includes('/orders')) module = ActivityModule.ORDER;
    else if (url.includes('/menu')) module = ActivityModule.MENU;
    else if (url.includes('/tables')) module = ActivityModule.TABLE;
    else if (url.includes('/bills')) module = ActivityModule.BILL;
    else if (url.includes('/users') || url.includes('/staff')) module = ActivityModule.STAFF;
    else if (url.includes('/roles')) module = ActivityModule.ROLE;
    else if (url.includes('/settings')) module = ActivityModule.SETTING;

    let action = ActivityAction.UPDATE;
    if (method === 'POST') action = ActivityAction.CREATE;
    else if (method === 'DELETE') action = ActivityAction.DELETE;

    const payload: ActivityLogEventPayload = {
      userId: user.userId,
      userName: user.fullName || user.username,
      userRole: user.role?.name || user.role?.slug,
      restaurantId: user.restaurantId,
      module,
      action,
      targetId: req.params?.id,
      description: `${method} ${url}`,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
      status: 'SUCCESS',
    };

    this.eventEmitter.emit('activity.log', payload);
  }
}
