import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Counter, CounterDocument } from '../schemas/counter.schema';

@Injectable()
export class CounterService {
  private readonly logger = new Logger(CounterService.name);

  constructor(
    @InjectModel(Counter.name) private readonly counterModel: Model<CounterDocument>,
  ) {}

  /**
   * Tăng biến đếm nguyên tử và trả về giá trị seq tiếp theo (CAS / Atomic $inc)
   */
  async getNextSequence(key: string): Promise<number> {
    const counter = await this.counterModel.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return counter.seq;
  }

  /**
   * Sinh mã định dạng: [PREFIX]-[YYMMDD]-[0001] không bao giờ trùng lặp dưới tải đa luồng
   */
  async generateDailyCode(prefix: string, scopeKey?: string): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
    const fullKey = scopeKey ? `${prefix}:${dateStr}:${scopeKey}` : `${prefix}:${dateStr}`;
    const seq = await this.getNextSequence(fullKey);
    const seqStr = seq.toString().padStart(4, '0');
    return `${prefix}-${dateStr}-${seqStr}`;
  }
}
