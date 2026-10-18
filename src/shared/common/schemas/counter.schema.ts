import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'counters' })
export class Counter {
  @Prop({ required: true, unique: true, trim: true })
  key: string;

  @Prop({ required: true, default: 0 })
  seq: number;
}

export type CounterDocument = Counter & Document;
export const CounterSchema = SchemaFactory.createForClass(Counter);
