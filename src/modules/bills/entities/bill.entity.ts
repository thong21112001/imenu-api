import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

export interface BillItemSnapshot {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  itemTotal: number;
  selectedOptions?: any[];
  selectedOptionsNote?: string;
  note?: string;
  roundNumber?: number;
}

export interface BillHeaderSnapshot {
  restaurantName: string;
  branchName?: string;
  address?: string;
  hotline?: string;
  wifiSsid?: string;
  wifiPassword?: string;
}

export interface BillBankAccountSnapshot {
  bankId: string;
  bankName: string;
  accountNo: string;
  accountName: string;
  template?: string;
  resolvedFrom?: 'BRANCH' | 'RESTAURANT';
}

@Schema({ timestamps: true, collection: 'bills' })
export class Bill {
  @Prop({ required: true, trim: true })
  billCode: string; // BILL-240913-001

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true })
  orderId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  orderCode: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true })
  tableId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  tableName: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId: Types.ObjectId;

  @Prop({ trim: true, index: true })
  branchId?: string;

  @Prop({ trim: true })
  branchName?: string;

  // Snapshot thong tin cua hang & chi nhanh
  @Prop({ type: Object, default: {} })
  headerSnapshot: BillHeaderSnapshot;

  // Snapshot danh sach mon an (LOAI TRU TRIET DE MON STATUS === 'Cancelled')
  @Prop({ type: [Object], default: [] })
  items: BillItemSnapshot[];

  @Prop({ required: true, default: 0 })
  subTotal: number;

  @Prop({ default: 0 })
  discountAmount: number;

  @Prop({ default: 0 })
  discountPercent: number;

  @Prop({ default: 0 })
  taxableBase: number;

  @Prop({ default: 0 })
  serviceFee: number;

  @Prop({ default: 0 })
  serviceFeePercent: number;

  @Prop({ default: 0 })
  vatAmount: number;

  @Prop({ default: 0 })
  vatPercent: number;

  @Prop({ required: true, default: 0 })
  finalAmount: number;

  @Prop({ required: true, enum: ['VietQR', 'Cash', 'Card', 'Transfer'] })
  paymentMethod: string;

  @Prop({ default: 0 })
  amountReceived?: number;

  @Prop({ default: 0 })
  changeAmount?: number;

  @Prop({ required: true, default: 'PAID', enum: ['PENDING', 'PAID', 'REFUNDED'] })
  paymentStatus: string;

  @Prop({ default: () => new Date() })
  paidAt: Date;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  cashierId?: Types.ObjectId;

  @Prop({ trim: true })
  cashierName?: string;

  @Prop({ type: Object })
  bankAccountSnapshot?: BillBankAccountSnapshot;

  @Prop({ trim: true })
  vietQrUrl?: string;

  @Prop({ trim: true })
  note?: string;

  @Prop({ default: 0 })
  printCount: number;

  @Prop()
  lastPrintedAt?: Date;
}

export type BillDocument = Bill & Document;
export const BillSchema = SchemaFactory.createForClass(Bill);

// Chốt chặn chống trùng lặp bất biến 1:1 giữa Restaurant và Order
BillSchema.index({ restaurantId: 1, orderId: 1 }, { unique: true });
BillSchema.index({ restaurantId: 1, billCode: 1 }, { unique: true });
BillSchema.index({ restaurantId: 1, createdAt: -1 });
BillSchema.index({ restaurantId: 1, branchId: 1, paymentStatus: 1, createdAt: -1 });
BillSchema.index({ restaurantId: 1, paymentMethod: 1, createdAt: -1 });
