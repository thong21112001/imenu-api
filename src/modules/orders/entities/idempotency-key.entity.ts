import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

export type IdempotencyStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED';

@Schema({ timestamps: true, collection: 'idempotency_keys' })
export class IdempotencyKey {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  key: string;

  @Prop({ required: true, trim: true })
  endpoint: string;

  @Prop({ required: true, trim: true })
  requestHash: string;

  @Prop({
    required: true,
    enum: ['PROCESSING', 'COMPLETED', 'FAILED'],
    default: 'PROCESSING',
  })
  status: IdempotencyStatus;

  @Prop({ type: Number })
  responseCode?: number;

  @Prop({ type: mongoose.Schema.Types.Mixed })
  responseBody?: any;

  @Prop({ type: Date, default: Date.now, expires: 86400 })
  createdAt: Date;

  updatedAt: Date;
}

export type IdempotencyKeyDocument = IdempotencyKey & Document;
export const IdempotencyKeySchema = SchemaFactory.createForClass(IdempotencyKey);

IdempotencyKeySchema.index({ restaurantId: 1, key: 1 }, { unique: true });
