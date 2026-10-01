import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './entities/order.entity';
import { Table, TableSchema } from '../tables/entities/table.entity';
import { MenuItem, MenuItemSchema } from '../menu/entities/menu-item.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Table.name, schema: TableSchema },
      { name: MenuItem.name, schema: MenuItemSchema },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService, MongooseModule],
})
export class OrdersModule {}
