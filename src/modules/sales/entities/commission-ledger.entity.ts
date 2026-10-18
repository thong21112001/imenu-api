import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'commission_ledgers' })
export class CommissionLedger {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  ledgerCode: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  salesId: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true,
  })
  sourceSalesId?: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: false,
    index: true,
  })
  restaurantId?: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionTransaction',
    required: false,
    index: true,
  })
  subscriptionTransactionId?: Types.ObjectId;

  @Prop({
    required: true,
    enum: [
      'SETUP_COMMISSION',
      'RENEWAL_COMMISSION',
      'ACTIVATION_BONUS',
      'TEAM_OVERRIDE_BONUS',
    ],
    index: true,
  })
  commissionType: string;

  @Prop({ required: true })
  baseAmount: number;

  @Prop()
  commissionRate?: number;

  @Prop({ required: true })
  commissionAmount: number;

  @Prop({ required: true, trim: true })
  formulaSnapshot: string;

  @Prop({
    default: 'APPROVED',
    enum: ['PENDING', 'APPROVED', 'PAID', 'VOIDED'],
    index: true,
  })
  status: string;

  @Prop({ required: true, trim: true, index: true })
  payoutPeriod: string;

  @Prop()
  paidAt?: Date;

  @Prop({ trim: true })
  payoutReference?: string;
}

export type CommissionLedgerDocument = CommissionLedger & Document;
export const CommissionLedgerSchema = SchemaFactory.createForClass(CommissionLedger);

// Chống ghi trùng hoa hồng cho cùng một giao dịch SaaS (Tầng 1 & 2 - AUD-12.2)
CommissionLedgerSchema.index(
  { subscriptionTransactionId: 1, commissionType: 1, salesId: 1 },
  { unique: true, partialFilterExpression: { subscriptionTransactionId: { $exists: true, $type: 'objectId' } } },
);

// Đảm bảo mỗi nhà hàng chỉ phát sinh duy nhất 1 lần Thưởng Mở Mới Vận Hành 250k (Tầng 3 - AUD-12.2)
CommissionLedgerSchema.index(
  { restaurantId: 1, commissionType: 1, salesId: 1 },
  { unique: true, partialFilterExpression: { restaurantId: { $exists: true, $type: 'objectId' }, commissionType: 'ACTIVATION_BONUS' } },
);

// Đảm bảo mỗi CTV cấp dưới chỉ kích hoạt duy nhất 1 lần Thưởng Phát Triển Đội Ngũ cho cấp trên (Tầng 4 - AUD-12.2)
CommissionLedgerSchema.index(
  { sourceSalesId: 1, commissionType: 1 },
  { unique: true, partialFilterExpression: { sourceSalesId: { $exists: true, $type: 'objectId' }, commissionType: 'TEAM_OVERRIDE_BONUS' } },
);

CommissionLedgerSchema.index({ salesId: 1, status: 1, createdAt: -1 });
