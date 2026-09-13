import { ENV } from '../../configs/env.cnf';

export const PORT = ENV.PORT;
export const NODE_ENV = ENV.NODE_ENV;
export const JwtConstants = {
  secret: ENV.JWT_SECRET,
  expiresIn: ENV.JWT_EXPIRES_IN,
  refreshExpiresIn: ENV.JWT_REFRESH_EXPIRES_IN,
};
