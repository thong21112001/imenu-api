import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'subscription_transactions' })
export class SubscriptionTransaction {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  transactionCode: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true,
    index: true,
  })
  restaurantId: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true,
  })
  salesId?: Types.ObjectId;

  @Prop({ required: true, default: 'Standard' })
  plan: string;

  @Prop({ default: 'MONTHLY', enum: ['MONTHLY', 'YEARLY'] })
  billingCycle: string;

  @Prop({
    required: true,
    enum: ['INITIAL_SETUP', 'RENEWAL', 'UPGRADE'],
    index: true,
  })
  transactionType: string;

  @Prop({ required: true })
  grossAmount: number;

  @Prop({ default: 0 })
  discountAmount: number;

  @Prop({ required: true })
  netAmount: number;

  @Prop({
    default: 'PAID',
    enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
    index: true,
  })
  paymentStatus: string;

  @Prop({ uppercase: true, trim: true })
  transactionId?: string;

  @Prop()
  paidAt?: Date;

  @Prop({ trim: true })
  note?: string;
}

export type SubscriptionTransactionDocument = SubscriptionTransaction & Document;
export const SubscriptionTransactionSchema = SchemaFactory.createForClass(SubscriptionTransaction);

SubscriptionTransactionSchema.index({ restaurantId: 1, transactionType: 1, paymentStatus: 1 });
SubscriptionTransactionSchema.index({ salesId: 1, createdAt: -1 });
SubscriptionTransactionSchema.index({ transactionId: 1 }, { unique: true, sparse: true });
