import { Prop, Schema } from '@nestjs/mongoose';

@Schema({ _id: false })
export class BankAccount {
  @Prop({ default: '' })
  bankId: string; // VCB, MB, TCB...

  @Prop({ default: '' })
  bankName: string;

  @Prop({ default: '' })
  accountNo: string;

  @Prop({ default: '' })
  accountName: string;

  @Prop({ default: 'compact' })
  template: string;
}
