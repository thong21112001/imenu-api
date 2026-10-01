import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { jwtConfig } from '../../shared/configs/jwt.cnf';
import { RealtimeGateway } from './realtime.gateway';

@Global()
@Module({
  imports: [JwtModule.register(jwtConfig)],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
