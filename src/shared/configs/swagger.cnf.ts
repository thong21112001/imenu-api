import { DocumentBuilder, SwaggerCustomOptions } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('iMenu Backend API')
  .setDescription('Tai lieu API he thong Quan tri Nha hang & Menu Dien tu iMenu')
  .setVersion('1.0')
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'Nhap JWT Bearer Token',
      in: 'header',
    },
    'JWT-auth',
  )
  .addTag('Health', 'Kiem tra trang thai may chu')
  .addTag('Auth', 'Xac thuc dang nhap, dang ky & token')
  .addTag('Users', 'Quan ly tai khoan nguoi dung & nhan vien')
  .addTag('Roles', 'Quan ly vai tro & ma tran phan quyen RBAC')
  .addTag('Activity Logs', 'Kiem toan & lich su hoat dong he thong')
  .build();

export const swaggerOption: SwaggerCustomOptions = {
  swaggerOptions: {
    persistAuthorization: true,
  },
  customSiteTitle: 'iMenu API Documentation',
};
