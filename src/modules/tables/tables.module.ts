import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Table, TableSchema } from './entities/table.entity';
import { TableZone, TableZoneSchema } from './entities/table-zone.entity';
import { Order, OrderSchema } from '../orders/entities/order.entity';
import { Restaurant, RestaurantSchema } from '../restaurants/entities/restaurant.entity';
import { TablesService } from './tables.service';
import { TableZonesService } from './table-zones.service';
import { TablesController } from './tables.controller';
import { TableZonesController } from './table-zones.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Table.name, schema: TableSchema },
      { name: TableZone.name, schema: TableZoneSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
    ]),
  ],
  controllers: [TablesController, TableZonesController],
  providers: [TablesService, TableZonesService],
  exports: [TablesService, TableZonesService, MongooseModule],
})
export class TablesModule {}
