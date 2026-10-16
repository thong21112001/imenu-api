import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Bill, BillSchema } from './entities/bill.entity';
import { Restaurant, RestaurantSchema } from '../restaurants/entities/restaurant.entity';
import { Table, TableSchema } from '../tables/entities/table.entity';
import { BillsService } from './bills.service';
import { BillsController } from './bills.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Bill.name, schema: BillSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: Table.name, schema: TableSchema },
    ]),
  ],
  controllers: [BillsController],
  providers: [BillsService],
  exports: [BillsService, MongooseModule],
})
export class BillsModule {}
