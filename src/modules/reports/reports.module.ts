import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Order, OrderSchema } from '../orders/entities/order.entity';
import { Restaurant, RestaurantSchema } from '../restaurants/entities/restaurant.entity';
import { MenuItem, MenuItemSchema } from '../menu/entities/menu-item.entity';
import { MenuCategory, MenuCategorySchema } from '../menu/entities/menu-category.entity';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: MenuItem.name, schema: MenuItemSchema },
      { name: MenuCategory.name, schema: MenuCategorySchema },
    ]),
    ActivityLogModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
