import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { Restaurant, RestaurantSchema } from '../restaurants/entities/restaurant.entity';
import { User, UserSchema } from '../users/entities/user.entity';
import { Order, OrderSchema } from '../orders/entities/order.entity';
import { Role, RoleSchema } from '../roles/entities/role.entity';
import {
  SubscriptionTransaction,
  SubscriptionTransactionSchema,
} from '../sales/entities/subscription-transaction.entity';
import {
  CommissionLedger,
  CommissionLedgerSchema,
} from '../sales/entities/commission-ledger.entity';
import {
  SalesApplication,
  SalesApplicationSchema,
} from '../sales/entities/sales-application.entity';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { CounterModule } from '../../shared/common/counter/counter.module';
import { SuperAdminGuard } from '../../shared/common/guards/super-admin.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: User.name, schema: UserSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Role.name, schema: RoleSchema },
      { name: SubscriptionTransaction.name, schema: SubscriptionTransactionSchema },
      { name: CommissionLedger.name, schema: CommissionLedgerSchema },
      { name: SalesApplication.name, schema: SalesApplicationSchema },
    ]),
    ActivityLogModule,
    CounterModule,
  ],
  controllers: [PlatformController],
  providers: [PlatformService, SuperAdminGuard],
  exports: [PlatformService, SuperAdminGuard],
})
export class PlatformModule {}
