import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Types } from 'mongoose';

export type RoundStatus = 'WaitingConfirmation' | 'Confirmed' | 'Cancelled';
export type OrderSource = 'STAFF_POS' | 'QR_CUSTOMER';

@Schema({ _id: false })
export class OrderRound {
  @Prop({ required: true, type: Number })
  roundNumber: number;

  @Prop({ required: true, enum: ['STAFF_POS', 'QR_CUSTOMER'] })
  source: OrderSource;

  @Prop({
    required: true,
    enum: ['WaitingConfirmation', 'Confirmed', 'Cancelled'],
    default: 'WaitingConfirmation',
  })
  status: RoundStatus;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date })
  confirmedAt?: Date;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  confirmedBy?: Types.ObjectId;

  @Prop({ type: Date })
  cancelledAt?: Date;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  cancelledBy?: Types.ObjectId;

  @Prop({ default: '' })
  cancelReason?: string;

  @Prop({ required: true, default: 0, min: 0 })
  roundSubTotal: number;
}

export const OrderRoundSchema = SchemaFactory.createForClass(OrderRound);
