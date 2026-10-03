import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { OrderItem, OrderItemSchema } from './order-item.schema';
import { OrderRound, OrderRoundSchema, OrderSource } from './order-round.schema';

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

export { OrderSource };

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  @Prop({ required: true, unique: true, trim: true })
  orderCode: string; // Business: ORD-YYMMDD-XXXX

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  branchId: string; // Relational: Dong bo string voi cac module khac (Required)

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true, index: true })
  tableId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  tableName: string; // Snapshot ten ban tai thoi diem mo don

  @Prop({
    required: true,
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
    index: true,
  })
  status: OrderStatus;

  @Prop({
    required: true,
    default: 'QR_CUSTOMER',
    enum: ['STAFF_POS', 'QR_CUSTOMER'],
  })
  orderSource: OrderSource;

  @Prop({ type: [OrderRoundSchema], default: [] })
  rounds: OrderRound[]; // Subdocument: Danh sach cac dot goi mon

  @Prop({ type: [OrderItemSchema], default: [] })
  items: OrderItem[]; // Subdocument: Mang phang cac mon an (Single Source of Truth cho KDS)

  @Prop({ required: true, default: 0, min: 0 })
  subTotal: number; // Derived: Tong tien mon = sum(items.itemTotal)

  @Prop({ default: 0, min: 0 })
  discountAmount: number;

  @Prop({ default: 0, min: 0 })
  serviceFee: number;

  @Prop({ default: 0, min: 0 })
  vatAmount: number;

  @Prop({ required: true, default: 0, min: 0 })
  totalAmount: number; // Derived: subTotal - discount + serviceFee + vat

  @Prop({ default: false, index: true })
  isPaid: boolean;

  @Prop({ enum: ['VietQR', 'Cash', 'Card', 'Transfer'] })
  paymentMethod?: PaymentMethod;

  @Prop({ default: '', trim: true })
  customerNote?: string;

  @Prop({ trim: true })
  idempotencyKey?: string;

  // --- Business Timestamps ---
  @Prop({ type: Date, default: Date.now })
  openedAt: Date; // Thoi diem bat dau phien phuc vu ban an

  @Prop({ type: Date })
  closedAt?: Date; // Thoi diem thanh toan / dong ban

  // --- Audit Fields ---
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId; // Nhan vien tao don POS

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  confirmedBy?: Types.ObjectId; // Nhan vien duyet don QR

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  cancelledBy?: Types.ObjectId; // Nhan vien huy don

  @Prop({ default: '', trim: true })
  cancelReason?: string; // Ly do huy don

  @Prop({ type: Date })
  cancelledAt?: Date; // Thoi diem huy don

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  paidBy?: Types.ObjectId; // Thu ngan chot bill thanh toan

  createdAt: Date;
  updatedAt: Date;
}

export type OrderDocument = Order & Document;
export const OrderSchema = SchemaFactory.createForClass(Order);

// 1. Partial Unique Index: Chot chan cung One Active Order per Table
OrderSchema.index(
  { restaurantId: 1, tableId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: {
        $in: [
          'WaitingConfirmation',
          'Confirmed',
          'Preparing',
          'Ready',
          'Served',
          'PaymentRequested',
        ],
      },
    },
  },
);

// 2. Query Indexes
OrderSchema.index({ restaurantId: 1, branchId: 1, status: 1, createdAt: -1 });
OrderSchema.index({ restaurantId: 1, branchId: 1, isPaid: 1, createdAt: -1 });
OrderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
OrderSchema.index({ restaurantId: 1, idempotencyKey: 1 }, { sparse: true });
OrderSchema.index({ createdAt: -1 });
