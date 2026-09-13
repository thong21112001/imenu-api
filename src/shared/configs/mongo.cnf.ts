import { MongooseModuleOptions } from '@nestjs/mongoose';
import { ENV } from './env.cnf';

const connectUrl = ENV.MONGODB_URL;

// Kiem tra cau hinh auth user/password
const authConfig =
  ENV.MONGODB_USERNAME && ENV.MONGODB_PASSWORD
    ? {
        auth: {
          username: ENV.MONGODB_USERNAME,
          password: ENV.MONGODB_PASSWORD,
        },
        authSource: 'admin',
      }
    : {};

const connectOptions: MongooseModuleOptions = {
  ...authConfig,
  connectionFactory: (connection) => {
    // Tu dong populate cac quan he ref khi truy van
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    connection.plugin(require('mongoose-autopopulate'));
    return connection;
  },
};

export { connectUrl, connectOptions };
