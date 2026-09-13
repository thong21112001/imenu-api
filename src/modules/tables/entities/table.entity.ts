import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { TableZone } from './table-zone.entity';

export type TableStatus = 'Available' | 'Occupied' | 'PaymentRequested' | 'Reserved' | 'Cleaning';

@Schema({ timestamps: true, collection: 'tables' })
export class Table {
  @Prop({ required: true, trim: true })
  code: string; // ban-01, ban-02...

  @Prop({ required: true, trim: true })
  name: string; // Bàn 01, Bàn 02...

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: TableZone.name, required: true, autopopulate: true })
  zone: TableZone;

  @Prop({ default: 4 })
  capacity: number;

  @Prop({
    default: 'Available',
    enum: ['Available', 'Occupied', 'PaymentRequested', 'Reserved', 'Cleaning'],
  })
  status: TableStatus;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: false })
  currentOrderId?: Types.ObjectId;

  @Prop({ default: 0 })
  totalGuests?: number;

  @Prop({ default: '' })
  qrCodeUrl?: string;

  @Prop({ default: 'active', enum: ['active', 'revoked', 'inactive'] })
  qrStatus: string;

  @Prop({ default: '' })
  qrToken?: string;

  @Prop()
  qrGeneratedAt?: Date;

  @Prop({ default: '' })
  wifiSsid?: string;

  @Prop({ default: '' })
  wifiPassword?: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId: Types.ObjectId;

  @Prop({ trim: true })
  branchId?: string;
}

export type TableDocument = Table & Document;
export const TableSchema = SchemaFactory.createForClass(Table);

TableSchema.index({ restaurantId: 1, code: 1 }, { unique: true });
TableSchema.index({ restaurantId: 1, status: 1 });
TableSchema.index({ qrToken: 1 });
