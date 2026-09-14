import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { Role } from '../../roles/entities/role.entity';
import { UserStatus } from '../interface/user-status.enum';

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ lowercase: true, trim: true, sparse: true })
  username?: string;

  @Prop({ select: false })
  password?: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ trim: true })
  phone: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: true,
    autopopulate: true,
  })
  role: Role;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: false })
  restaurantId?: Types.ObjectId;

  @Prop({ trim: true })
  branchId?: string;

  @Prop({ trim: true })
  branchName?: string;

  // Quyen ca nhan cua tai khoan co dang duoc kich hoat khong
  @Prop({ default: true })
  isRoleActive: boolean;

  @Prop({ default: UserStatus.ACTIVE, enum: Object.values(UserStatus) })
  status: UserStatus;

  @Prop()
  avatarUrl?: string;

  @Prop()
  lastLogin?: Date;
}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ restaurantId: 1, status: 1 });
