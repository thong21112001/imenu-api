import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ENV } from './shared/configs/env.cnf';
import { swaggerConfig, swaggerOption } from './shared/configs/swagger.cnf';
import { MorganLogService } from './shared/loggers/morgan.logger';
import { RolesService } from './modules/roles/roles.service';
import { UsersService } from './modules/users/users.service';
import { AuthService } from './modules/auth/auth.service';
import { RestaurantsService } from './modules/restaurants/restaurants.service';
import { CategoriesService } from './modules/menu/categories.service';
import { TablesService } from './modules/tables/tables.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 1. Cau hinh CORS
  const configuredOrigins = ENV.CORS_ORIGINS.length > 0
    ? ENV.CORS_ORIGINS
    : ['http://localhost:3000', 'http://localhost:3003', 'http://localhost:3004', 'http://localhost:3005'];

  app.enableCors({
    origin: (origin, callback) => {
      // Cho phep non-browser hoac server-to-server requests khong co origin
      if (!origin) return callback(null, true);
      // Kiem tra danh sach domain hop le hoac moi truong dev
      const isAllowed =
        ENV.NODE_ENV !== 'production' ||
        configuredOrigins.includes(origin) ||
        configuredOrigins.some((allowed) => allowed === '*' || origin.endsWith(allowed.replace('*.', '')));
      callback(null, isAllowed);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders:
      'Content-Type, Accept, Authorization, X-Requested-With, idempotency-key, x-idempotency-key, Idempotency-Key, X-Idempotency-Key',
    exposedHeaders: 'X-Idempotent-Replay, x-idempotent-replay',
  });

  // 2. Chuan hoa URL path va rewrite /api/v1/* thanh /api/*
  app.use((req: any, _res: any, next: any) => {
    req.url = req.url.replace(/\/\//g, '/');
    if (req.url.startsWith('/api/v1/')) {
      req.url = req.url.replace('/api/v1/', '/api/');
    }
    next();
  });

  // 3. Bao mat HTTP Headers voi Helmet
  app.use(helmet());

  // 4. Global Validation Pipe voi class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // 5. Morgan Logger Middleware
  const morganLog = new MorganLogService();
  app.use(morganLog.middleware());

  // 6. Global API Prefix
  app.setGlobalPrefix('api', {
    exclude: ['health', ''],
  });

  // 7. Swagger Documentation tai /api-docs va /api/v1/api-docs
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(ENV.SWAGGER_PATH, app, document, swaggerOption);
  SwaggerModule.setup('api/v1/' + ENV.SWAGGER_PATH, app, document, swaggerOption);

  // 8. Đảm bảo vai trò hệ thống & Super Admin sẵn sàng
  try {
    const rolesService = app.get(RolesService);
    await rolesService.seedDefaultRoles();

    const usersService = app.get(UsersService);
    await usersService.initAdmin();

    const authService = app.get(AuthService);
    await authService.seedDemoOwner();

    const restaurantsService = app.get(RestaurantsService);
    const bepNha = await restaurantsService.findBySlug('bep-nha').catch(() => null);
    if (bepNha) {
      const bepNhaId = (bepNha as any)._id.toString();
      const categoriesService = app.get(CategoriesService);
      await categoriesService.seedDefaultMenu(bepNhaId);

      const tablesService = app.get(TablesService);
      await tablesService.seedDefaultTables(bepNhaId);
    }
  } catch (err: any) {
    logger.error('Lỗi khi khởi tạo dữ liệu hệ thống ban đầu:', err.message);
  }

  // 9. Khoi dong HTTP Server
  const port = ENV.PORT || 3001;
  await app.listen(port);
  logger.log(`🚀 iMenu API Server đang chạy tại: http://localhost:${port}`);
  logger.log(`📑 Swagger API Docs sẵn sàng tại: http://localhost:${port}/${ENV.SWAGGER_PATH}`);
}

bootstrap();
