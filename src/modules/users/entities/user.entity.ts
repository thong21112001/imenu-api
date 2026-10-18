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

  @Prop({ default: false, index: true })
  isDeleted: boolean;

  @Prop()
  deletedAt?: Date;

  @Prop()
  avatarUrl?: string;

  @Prop()
  lastLogin?: Date;

  // --- THUỘC TÍNH NVKD & AFFILIATE (PHASE 12) ---
  @Prop({ uppercase: true, trim: true })
  referralCode?: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, index: true })
  parentSalesId?: Types.ObjectId;

  @Prop({
    type: {
      setupCommissionRate: { type: Number, default: 50 },
      renewalCommissionRate: { type: Number, default: 20 },
      activationBonusAmount: { type: Number, default: 250000 },
      teamBonusAmount: { type: Number, default: 250000 },
    },
    default: () => ({
      setupCommissionRate: 50,
      renewalCommissionRate: 20,
      activationBonusAmount: 250000,
      teamBonusAmount: 250000,
    }),
  })
  salesCommissionPolicy?: {
    setupCommissionRate: number;
    renewalCommissionRate: number;
    activationBonusAmount: number;
    teamBonusAmount: number;
  };

  @Prop({
    type: {
      bankId: { type: String, trim: true },
      bankName: { type: String, trim: true },
      accountNo: { type: String, trim: true },
      accountName: { type: String, trim: true },
    },
    default: () => ({}),
  })
  payoutBankAccount?: {
    bankId?: string;
    bankName?: string;
    accountNo?: string;
    accountName?: string;
  };
}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ restaurantId: 1, isDeleted: 1, status: 1 });
UserSchema.index({ referralCode: 1 }, { unique: true, sparse: true });
