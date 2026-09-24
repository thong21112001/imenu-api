import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BankAccount } from './bank-account.schema';

export enum BranchStatus {
  ACTIVE = 'ACTIVE',
  TEMPORARILY_CLOSED = 'TEMPORARILY_CLOSED',
  INACTIVE = 'INACTIVE',
}

@Schema({ _id: true, timestamps: true })
export class Branch {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ default: false })
  isMainBranch: boolean;

  @Prop({
    default: BranchStatus.ACTIVE,
    enum: Object.values(BranchStatus),
  })
  status: BranchStatus;

  @Prop()
  closedAt?: Date;

  @Prop({ default: '' })
  closedReason?: string;

  @Prop({ type: BankAccount, default: () => ({}) })
  bankAccount: BankAccount;

  @Prop({ default: '08:00 - 22:00' })
  openingHours: string;

  @Prop({ default: '' })
  tagline: string;
}

export const BranchSchema = SchemaFactory.createForClass(Branch);
