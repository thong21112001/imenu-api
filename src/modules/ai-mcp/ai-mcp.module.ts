import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiMcpController } from './ai-mcp.controller';
import { McpRegistryService } from './mcp-registry.service';
import { PlatformMcpTools } from './tools/platform-mcp.tools';
import { AiOrchestratorService } from './services/ai-orchestrator.service';
import { CompositeRateLimiterService } from '../../shared/common/services/composite-rate-limiter.service';
import { PlatformModule } from '../platform/platform.module';
import { ReportsModule } from '../reports/reports.module';
import { SalesModule } from '../sales/sales.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { SuperAdminGuard } from '../../shared/common/guards/super-admin.guard';

// Mongoose Entities
import { Restaurant, RestaurantSchema } from '../restaurants/entities/restaurant.entity';
import { Order, OrderSchema } from '../orders/entities/order.entity';
import { CommissionLedger, CommissionLedgerSchema } from '../sales/entities/commission-ledger.entity';
import { SubscriptionTransaction, SubscriptionTransactionSchema } from '../sales/entities/subscription-transaction.entity';
import { User, UserSchema } from '../users/entities/user.entity';

/**
 * AiMcpModule (Sub-phase 18.1 & 18.2)
 *
 * Module quản lý kiến trúc Model Context Protocol (MCP) Core và AI Orchestrator trong iMenu.
 * Đóng gói McpRegistryService, 4 Read-only Platform Tools, AiOrchestratorService và Controller bảo mật.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: Order.name, schema: OrderSchema },
      { name: CommissionLedger.name, schema: CommissionLedgerSchema },
      { name: SubscriptionTransaction.name, schema: SubscriptionTransactionSchema },
      { name: User.name, schema: UserSchema },
    ]),
    PlatformModule,
    ReportsModule,
    SalesModule,
    ReviewsModule,
    ActivityLogModule,
  ],
  controllers: [AiMcpController],
  providers: [
    McpRegistryService,
    PlatformMcpTools,
    AiOrchestratorService,
    CompositeRateLimiterService,
    SuperAdminGuard,
  ],
  exports: [McpRegistryService, PlatformMcpTools, AiOrchestratorService],
})
export class AiMcpModule {}
