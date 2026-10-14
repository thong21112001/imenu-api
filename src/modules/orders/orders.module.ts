import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './entities/order.entity';
import { Table, TableSchema } from '../tables/entities/table.entity';
import { MenuItem, MenuItemSchema } from '../menu/entities/menu-item.entity';
import { IdempotencyKey, IdempotencyKeySchema } from './entities/idempotency-key.entity';
import { Restaurant, RestaurantSchema } from '../restaurants/entities/restaurant.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Table.name, schema: TableSchema },
      { name: MenuItem.name, schema: MenuItemSchema },
      { name: IdempotencyKey.name, schema: IdempotencyKeySchema },
      { name: Restaurant.name, schema: RestaurantSchema },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService, MongooseModule],
})
export class OrdersModule {}
