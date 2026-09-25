import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'bills' })
export class Bill {
  @Prop({ required: true, unique: true, trim: true })
  billCode: string; // BILL-240913-001

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true })
  orderId: Types.ObjectId;

  @Prop({ required: true })
  orderCode: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true })
  tableId: Types.ObjectId;

  @Prop({ required: true })
  tableName: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId: Types.ObjectId;

  @Prop({ trim: true })
  branchId?: string;

  @Prop({ required: true })
  subTotal: number;

  @Prop({ default: 0 })
  discountAmount: number;

  @Prop({ default: 0 })
  vatAmount: number;

  @Prop({ required: true })
  finalAmount: number;

  @Prop({ required: true, enum: ['VietQR', 'Cash', 'Card', 'Transfer'] })
  paymentMethod: string;

  @Prop({ required: true, default: 'PAID', enum: ['PENDING', 'PAID', 'REFUNDED'] })
  paymentStatus: string;

  @Prop()
  paidAt?: Date;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  cashierId?: Types.ObjectId;

  @Prop()
  cashierName?: string;
}

export type BillDocument = Bill & Document;
export const BillSchema = SchemaFactory.createForClass(Bill);


BillSchema.index({ restaurantId: 1, createdAt: -1 });
BillSchema.index({ restaurantId: 1, branchId: 1, paymentStatus: 1, createdAt: -1 });
