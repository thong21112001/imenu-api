import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Table, TableSchema } from './entities/table.entity';
import { TableZone, TableZoneSchema } from './entities/table-zone.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Table.name, schema: TableSchema },
      { name: TableZone.name, schema: TableZoneSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class TablesModule {}
