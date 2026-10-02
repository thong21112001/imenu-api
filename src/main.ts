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
  app.enableCors({
    origin: true, // Chap nhan origin tu request de ho tro gui credentials
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With',
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
