import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { OrderItem, OrderItemSchema } from './order-item.schema';

export type OrderStatus =
  | 'WaitingConfirmation'
  | 'Confirmed'
  | 'Preparing'
  | 'Ready'
  | 'Served'
  | 'PaymentRequested'
  | 'Paid'
  | 'Cancelled';

export type PaymentMethod = 'VietQR' | 'Cash' | 'Card' | 'Transfer';

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  @Prop({ required: true, unique: true, trim: true })
  orderCode: string; // IM-240913-001

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true, index: true })
  tableId: Types.ObjectId;

  @Prop({ required: true })
  tableName: string; // Snapshot ten ban

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId: Types.ObjectId;

  @Prop({ trim: true })
  branchId?: string;

  @Prop({ type: [OrderItemSchema], default: [] })
  items: OrderItem[];

  @Prop({ required: true, default: 0 })
  subTotal: number;

  @Prop({ default: 0 })
  discountAmount: number;

  @Prop({ default: 0 })
  serviceFee: number;

  @Prop({ default: 0 })
  vatAmount: number;

  @Prop({ required: true, default: 0 })
  totalAmount: number;

  @Prop({
    default: 'WaitingConfirmation',
    enum: [
      'WaitingConfirmation',
      'Confirmed',
      'Preparing',
      'Ready',
      'Served',
      'PaymentRequested',
      'Paid',
      'Cancelled',
    ],
  })
  status: OrderStatus;

  @Prop({ enum: ['VietQR', 'Cash', 'Card', 'Transfer'] })
  paymentMethod?: PaymentMethod;

  @Prop({ default: false })
  isPaid: boolean;

  @Prop({ default: 'QR_CUSTOMER', enum: ['QR_CUSTOMER', 'STAFF_POS'] })
  orderSource: string;

  @Prop({ default: '' })
  customerNote?: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;
}

export type OrderDocument = Order & Document;
export const OrderSchema = SchemaFactory.createForClass(Order);


OrderSchema.index({ restaurantId: 1, status: 1 });
OrderSchema.index({ restaurantId: 1, tableId: 1 });
OrderSchema.index({ createdAt: -1 });
