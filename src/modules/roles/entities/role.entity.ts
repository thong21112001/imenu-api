import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { PermissionSchema, PermissionSubdocument } from './permission.schema';

@Schema({ timestamps: true, collection: 'roles' })
export class Role {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, unique: true })
  slug: string; // Ma dinh danh vai tro: "system_admin", "restaurant_admin", "cashier"...

  @Prop({ default: false })
  isSystem: boolean; // Neu la vai tro he thong -> Khong cho phep xoa

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: '#6366f1' })
  color: string;

  // Ma tran quyen han cua vai tro
  @Prop({ type: [PermissionSchema], default: [] })
  permissions: PermissionSubdocument[];

  // Khoa vai tro theo nha hang (null neu la vai tro toan he thong)
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: false })
  restaurantId?: Types.ObjectId;
}

export type RoleDocument = Role & Document;
export const RoleSchema = SchemaFactory.createForClass(Role);


RoleSchema.index({ isSystem: 1, isActive: 1 });
RoleSchema.index({ restaurantId: 1 });
