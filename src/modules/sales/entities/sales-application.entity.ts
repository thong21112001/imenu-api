import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'sales_applications' })
export class SalesApplication {
  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ required: true, trim: true, lowercase: true })
  email: string;

  @Prop({ trim: true, default: '' })
  city?: string;

  @Prop({ trim: true, default: '' })
  note?: string;

  @Prop({ uppercase: true, trim: true })
  parentReferralCode?: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, index: true })
  parentSalesId?: Types.ObjectId;

  @Prop({
    default: 'PENDING',
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    index: true,
  })
  status: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false })
  approvedUserId?: Types.ObjectId;

  @Prop()
  approvedAt?: Date;
}

export type SalesApplicationDocument = SalesApplication & Document;
export const SalesApplicationSchema = SchemaFactory.createForClass(SalesApplication);

SalesApplicationSchema.index({ phone: 1, createdAt: -1 });
SalesApplicationSchema.index({ status: 1, createdAt: -1 });
