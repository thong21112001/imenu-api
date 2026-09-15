import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Order, OrderSchema } from '../orders/entities/order.entity';
import { Restaurant, RestaurantSchema } from '../restaurants/entities/restaurant.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
