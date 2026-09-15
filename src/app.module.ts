import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { connectUrl, connectOptions } from './shared/configs/mongo.cnf';
import { LoggerModule } from './shared/loggers/logger.module';
import { AllExceptionsFilter } from './shared/common/filters/exceptionFilter';
import { JwtAuthGuard } from './shared/common/guards/jwt-auth.guard';
import { PermissionsGuard } from './shared/common/guards/permissions.guard';
import { AuditLogInterceptor } from './modules/activity-log/interceptors/audit-log.interceptor';

// Feature Modules
import { RolesModule } from './modules/roles/roles.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ActivityLogModule } from './modules/activity-log/activity-log.module';
import { RestaurantsModule } from './modules/restaurants/restaurants.module';
import { TablesModule } from './modules/tables/tables.module';
import { MenuModule } from './modules/menu/menu.module';
import { OrdersModule } from './modules/orders/orders.module';
import { BillsModule } from './modules/bills/bills.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    MongooseModule.forRoot(connectUrl, connectOptions),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
    }),
    LoggerModule,
    RolesModule,
    UsersModule,
    AuthModule,
    ActivityLogModule,
    RestaurantsModule,
    TablesModule,
    MenuModule,
    OrdersModule,
    BillsModule,
    DashboardModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global Exception Filter
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    // Global JWT Auth Guard (Bỏ qua với @Public())
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global Permissions Guard (Bỏ qua nếu route không có @RequirePermissions)
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    // Global Audit Log Interceptor (Tự động ghi nhận request mutating)
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}
