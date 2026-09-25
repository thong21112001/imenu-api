import 'dotenv/config';

/**
 * Dinh nghia va parse toan bo bien moi truong he thong
 */
export const ENV = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URL: process.env.MONGODB_URL || 'mongodb://localhost:27017/imenu-db',
  MONGODB_USERNAME: process.env.MONGODB_USERNAME || '',
  MONGODB_PASSWORD: process.env.MONGODB_PASSWORD || '',
  JWT_SECRET: process.env.JWT_SECRET || 'imenu_jwt_secret_key_super_secure_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  CORS_ORIGINS: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  SWAGGER_PATH: process.env.SWAGGER_PATH || 'api-docs',
  SUPERADMIN_EMAIL: process.env.SUPERADMIN_EMAIL || 'superadmin@imenu.vn',
  SUPERADMIN_USERNAME: process.env.SUPERADMIN_USERNAME || 'superadmin',
  SUPERADMIN_PASSWORD: process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@2026!',
  SUPERADMIN_FULLNAME: process.env.SUPERADMIN_FULLNAME || 'Quan Tri Vien He Thong iMenu',
  SUPERADMIN_PHONE: process.env.SUPERADMIN_PHONE || '0900000000',
};
