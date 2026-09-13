import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './shared/common/decorators/public.decorator';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @ApiOperation({ summary: 'Kiểm tra trạng thái hoạt động của server & database' })
  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }

  @Public()
  @ApiOperation({ summary: 'Route gốc máy chủ' })
  @Get()
  getRoot() {
    return {
      name: 'iMenu Backend API',
      version: '1.0.0',
      docs: '/api-docs',
    };
  }
}
