import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Order, OrderSchema } from '../orders/entities/order.entity';
import { Table, TableSchema } from '../tables/entities/table.entity';
import { Restaurant, RestaurantSchema } from '../restaurants/entities/restaurant.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Table.name, schema: TableSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
