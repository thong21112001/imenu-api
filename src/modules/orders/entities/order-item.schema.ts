import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Types } from 'mongoose';

@Schema({ _id: false })
export class SelectedOption {
  @Prop({ required: true })
  groupId: string;

  @Prop({ required: true })
  groupName: string;

  @Prop({ required: true })
  valueId: string;

  @Prop({ required: true })
  valueName: string;

  @Prop({ required: true, default: 0 })
  priceDelta: number;
}

@Schema({ _id: true, timestamps: true })
export class OrderItem {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true })
  menuItemId: Types.ObjectId;

  @Prop({ required: true })
  name: string; // Snapshot ten mon tai thoi diem order

  @Prop({ required: true, min: 0 })
  price: number; // Snapshot gia co ban

  @Prop({ required: true, min: 1, default: 1 })
  quantity: number;

  @Prop({ type: [SelectedOption], default: [] })
  selectedOptions: SelectedOption[];

  @Prop({ default: '' })
  note?: string;

  @Prop({
    default: 'Waiting',
    enum: ['Waiting', 'Cooking', 'Ready', 'Served', 'Cancelled'],
  })
  status: string;

  @Prop({ required: true, min: 0 })
  itemTotal: number;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);
