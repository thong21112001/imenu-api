import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Types } from 'mongoose';

export type OrderItemStatus =
  | 'WaitingConfirmation'
  | 'Waiting'
  | 'Cooking'
  | 'Ready'
  | 'Served'
  | 'Cancelled';

@Schema({ _id: false })
export class SelectedOption {
  @Prop({ required: true, trim: true })
  groupId: string;

  @Prop({ required: true, trim: true })
  groupName: string;

  @Prop({ required: true, trim: true })
  valueId: string;

  @Prop({ required: true, trim: true })
  valueName: string;

  @Prop({ required: true, default: 0 })
  priceDelta: number;
}

export const SelectedOptionSchema = SchemaFactory.createForClass(SelectedOption);

@Schema({ _id: true, timestamps: true })
export class OrderItem {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true })
  menuItemId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string; // Snapshot ten mon tai thoi diem order

  @Prop({ required: true, min: 0 })
  price: number; // Snapshot don gia co ban hieu luc tai chi nhanh

  @Prop({ required: true, min: 1, default: 1 })
  quantity: number;

  @Prop({ type: [SelectedOptionSchema], default: [] })
  selectedOptions: SelectedOption[];

  @Prop({ default: '', trim: true })
  note?: string;

  @Prop({
    required: true,
    default: 'Waiting',
    enum: [
      'WaitingConfirmation',
      'Waiting',
      'Cooking',
      'Ready',
      'Served',
      'Cancelled',
    ],
    index: true,
  })
  status: OrderItemStatus;

  @Prop({ required: true, default: 1 })
  roundNumber: number;

  @Prop({ required: true, min: 0 })
  itemTotal: number;

  @Prop({ default: '', trim: true })
  cancelReason?: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  cancelledBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);
