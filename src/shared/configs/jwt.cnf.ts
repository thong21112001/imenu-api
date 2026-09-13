import { JwtModuleOptions } from '@nestjs/jwt';
import { ENV } from './env.cnf';

export const jwtConfig: JwtModuleOptions = {
  secret: ENV.JWT_SECRET,
  signOptions: {
    expiresIn: (ENV.JWT_EXPIRES_IN as any) || '1d',
  },
};
