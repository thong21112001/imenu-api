import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

export interface ItemFeedback {
  menuItemId?: string;
  menuItemName?: string;
  rating?: number;
  comment?: string;
}

export interface MerchantReply {
  content: string;
  repliedBy?: Types.ObjectId;
  repliedByName?: string;
  repliedAt: Date;
}

@Schema({ timestamps: true, collection: 'reviews' })
export class Review {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  branchId: string;

  @Prop({ trim: true, default: '' })
  branchName?: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true })
  orderId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  orderCode: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Bill', required: false })
  billId?: Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true })
  tableId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  tableName: string;

  @Prop({ required: true, min: 1, max: 5 })
  overallRating: number;

  @Prop({ min: 1, max: 5 })
  foodRating?: number;

  @Prop({ min: 1, max: 5 })
  serviceRating?: number;

  @Prop({ min: 1, max: 5 })
  ambianceRating?: number;

  @Prop({ type: [String], default: [] })
  quickTags: string[];

  @Prop({ trim: true, maxlength: 500, default: '' })
  comment: string;

  @Prop({ type: Array, default: [] })
  itemFeedbacks?: ItemFeedback[];

  @Prop({ trim: true })
  customerName?: string;

  @Prop({ trim: true })
  customerPhone?: string;

  @Prop({ type: Object })
  merchantReply?: MerchantReply;

  @Prop({ default: false, index: true })
  isHidden: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export type ReviewDocument = Review & Document;
export const ReviewSchema = SchemaFactory.createForClass(Review);

// 1. Partial/Unique Index: Chốt chặn cứng 1 Order = tối đa 1 Review (AUD-11.1)
ReviewSchema.index({ restaurantId: 1, orderId: 1 }, { unique: true });

// 2. Query Indexes theo Chi nhánh & Điểm đánh giá (AUD-11.5)
ReviewSchema.index({ restaurantId: 1, branchId: 1, createdAt: -1 });
ReviewSchema.index({ restaurantId: 1, branchId: 1, overallRating: 1, createdAt: -1 });
ReviewSchema.index({ restaurantId: 1, createdAt: -1 });
