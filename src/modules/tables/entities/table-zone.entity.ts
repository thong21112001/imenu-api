import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'table_zones' })
export class TableZone {
  @Prop({ required: true, trim: true })
  name: string; // Tầng 1, Tầng 2, Ngoài trời, Phòng VIP...

  @Prop({ default: '' })
  description?: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId: Types.ObjectId;

  @Prop({ trim: true })
  branchId?: string;

  @Prop({ default: false, index: true })
  isDeleted: boolean;

  @Prop()
  deletedAt?: Date;
}

export type TableZoneDocument = TableZone & Document;
export const TableZoneSchema = SchemaFactory.createForClass(TableZone);

TableZoneSchema.index({ restaurantId: 1, branchId: 1, isDeleted: 1 });
