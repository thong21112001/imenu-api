import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { Branch, BranchSchema } from './branch.schema';
import { BankAccount } from './bank-account.schema';

export { BankAccount };

@Schema({ timestamps: true, collection: 'restaurants' })
export class Restaurant {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ required: true, trim: true })
  address: string;

  @Prop()
  logoUrl?: string;

  @Prop()
  coverUrl?: string;

  @Prop({ default: '' })
  tagline?: string;

  @Prop({ default: '08:00 - 22:00' })
  openingHours?: string;

  @Prop({ default: true })
  isOpen: boolean;

  @Prop({ type: BankAccount, default: () => ({}) })
  bankAccount: BankAccount;

  @Prop({ type: [BranchSchema], default: [] })
  branches: Branch[];

  @Prop({ default: null, trim: true })
  wifiSsid?: string;

  @Prop({ default: null, trim: true })
  wifiPassword?: string;

  @Prop({ default: 'Basic', enum: ['Basic', 'Standard', 'Advanced', 'Pro', 'Professional', 'Enterprise'] })
  plan: string;

  // --- THUỘC TÍNH AFFILIATE & SALES PARTNER (PHASE 12) ---
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, index: true })
  referredBySalesId?: Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false })
  createdBySalesId?: Types.ObjectId;

  @Prop({ uppercase: true, trim: true })
  referralCodeUsed?: string;

  @Prop({
    default: 'ORGANIC',
    enum: ['ORGANIC', 'AFFILIATE_LINK', 'REFERRAL_CODE', 'SALES_ASSISTED', 'SALES_DIRECT_CREATE'],
  })
  acquisitionChannel: string;

  @Prop({
    default: 'TRIAL',
    enum: ['TRIAL', 'ACTIVE', 'ACTIVE_FREE', 'ACTIVE_PAID', 'SUSPENDED'],
  })
  subscriptionStatus: string;

  @Prop()
  planExpiresAt?: Date;

  @Prop({ default: false, index: true })
  isActivationQualified: boolean;

  @Prop()
  activationQualifiedAt?: Date;

  @Prop({ default: 0 })
  activationPaidBillsCount: number;

  // --- THUỘC TÍNH KHÓA & TẠM NGƯNG HOẠT ĐỘNG (PHASE 13) ---
  @Prop({ default: false, index: true })
  isSuspended: boolean;

  @Prop({ trim: true })
  suspendReason?: string;

  @Prop()
  suspendedAt?: Date;
}

export type RestaurantDocument = Restaurant & Document;
export const RestaurantSchema = SchemaFactory.createForClass(Restaurant);

RestaurantSchema.index({ referredBySalesId: 1, isActivationQualified: 1 });
RestaurantSchema.index({ subscriptionStatus: 1 });


