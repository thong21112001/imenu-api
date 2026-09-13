import { Global, Module } from '@nestjs/common';
import { WinstonLogService } from './winston.logger';
import { MorganLogService } from './morgan.logger';

@Global()
@Module({
  providers: [WinstonLogService, MorganLogService],
  exports: [WinstonLogService, MorganLogService],
})
export class LoggerModule {}
