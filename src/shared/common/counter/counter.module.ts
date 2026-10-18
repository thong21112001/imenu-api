import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Counter, CounterSchema } from '../schemas/counter.schema';
import { CounterService } from '../services/counter.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Counter.name, schema: CounterSchema }]),
  ],
  providers: [CounterService],
  exports: [CounterService, MongooseModule],
})
export class CounterModule {}
