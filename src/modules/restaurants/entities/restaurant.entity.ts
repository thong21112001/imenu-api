import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Branch, BranchSchema } from './branch.schema';

@Schema({ _id: false })
export class BankAccount {
  @Prop({ default: '' })
  bankId: string; // VCB, MB, TCB...

  @Prop({ default: '' })
  bankName: string;

  @Prop({ default: '' })
  accountNo: string;

  @Prop({ default: '' })
  accountName: string;

  @Prop({ default: 'compact' })
  template: string;
}

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

  @Prop({ default: 'Basic', enum: ['Basic', 'Standard', 'Advanced', 'Pro', 'Enterprise'] })
  plan: string;
}

export type RestaurantDocument = Restaurant & Document;
export const RestaurantSchema = SchemaFactory.createForClass(Restaurant);


