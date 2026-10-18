import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SalesApplication, SalesApplicationSchema } from './entities/sales-application.entity';
import {
  SubscriptionTransaction,
  SubscriptionTransactionSchema,
} from './entities/subscription-transaction.entity';
import {
  CommissionLedger,
  CommissionLedgerSchema,
} from './entities/commission-ledger.entity';
import { User, UserSchema } from '../users/entities/user.entity';
import { Restaurant, RestaurantSchema } from '../restaurants/entities/restaurant.entity';
import { Role, RoleSchema } from '../roles/entities/role.entity';
import { Table, TableSchema } from '../tables/entities/table.entity';
import { TableZone, TableZoneSchema } from '../tables/entities/table-zone.entity';
import { MenuCategory, MenuCategorySchema } from '../menu/entities/menu-category.entity';
import { MenuItem, MenuItemSchema } from '../menu/entities/menu-item.entity';
import { CounterModule } from '../../shared/common/counter/counter.module';
import { SalesService } from './services/sales.service';
import { ReferralsController } from './controllers/referrals.controller';
import { SalesController } from './controllers/sales.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SalesApplication.name, schema: SalesApplicationSchema },
      { name: SubscriptionTransaction.name, schema: SubscriptionTransactionSchema },
      { name: CommissionLedger.name, schema: CommissionLedgerSchema },
      { name: User.name, schema: UserSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Table.name, schema: TableSchema },
      { name: TableZone.name, schema: TableZoneSchema },
      { name: MenuCategory.name, schema: MenuCategorySchema },
      { name: MenuItem.name, schema: MenuItemSchema },
    ]),
    CounterModule,
  ],
  controllers: [ReferralsController, SalesController],
  providers: [SalesService],
  exports: [SalesService, MongooseModule],
})
export class SalesModule {}
