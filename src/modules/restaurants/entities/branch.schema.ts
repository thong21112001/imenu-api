import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export enum BranchStatus {
  ACTIVE = 'ACTIVE',
  TEMPORARILY_CLOSED = 'TEMPORARILY_CLOSED',
  INACTIVE = 'INACTIVE',
}

@Schema({ _id: true, timestamps: true })
export class Branch {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ default: false })
  isMainBranch: boolean;

  @Prop({
    default: BranchStatus.ACTIVE,
    enum: Object.values(BranchStatus),
  })
  status: BranchStatus;

  @Prop()
  closedAt?: Date;

  @Prop({ default: '' })
  closedReason?: string;
}

export const BranchSchema = SchemaFactory.createForClass(Branch);
