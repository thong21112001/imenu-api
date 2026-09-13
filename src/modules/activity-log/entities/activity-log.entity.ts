import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { ActivityAction, ActivityModule } from '../constants/audit-log.const';

@Schema({ timestamps: true, collection: 'activity_logs' })
export class ActivityLog {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, index: true })
  user?: Types.ObjectId;

  @Prop({ required: true, default: 'Hệ thống' })
  user_name: string;

  @Prop({ default: '' })
  user_role?: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: false, index: true })
  restaurantId?: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(ActivityModule), required: true, index: true })
  module: ActivityModule;

  @Prop({ type: String, enum: Object.values(ActivityAction), required: true })
  action: ActivityAction;

  @Prop({ default: '' })
  target_id?: string;

  @Prop({ default: '' })
  description?: string;

  @Prop({ default: '' })
  ip_address?: string;

  @Prop({ default: '' })
  user_agent?: string;

  @Prop({ default: 'SUCCESS', enum: ['SUCCESS', 'FAILURE'] })
  status: string;
}

export type ActivityLogDocument = ActivityLog & Document;
export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);

ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ restaurantId: 1, createdAt: -1 });
ActivityLogSchema.index({ module: 1, action: 1 });
