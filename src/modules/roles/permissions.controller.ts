import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OkResponse } from '../../shared/common/dto/okResponse';
import { PERMISSION_CATALOG } from '../../shared/common/constants/permission.const';
import { PermissionsGuard } from '../../shared/common/guards/permissions.guard';

@ApiTags('Permissions')
@ApiBearerAuth('JWT-auth')
@UseGuards(PermissionsGuard)
@Controller('permissions')
export class PermissionsController {
  @ApiOperation({ summary: 'Lấy danh mục 17 quyền hạn chuẩn của hệ thống' })
  @Get()
  findAll() {
    return new OkResponse({
      message: 'Lấy danh mục quyền hạn thành công',
      data: PERMISSION_CATALOG,
    });
  }
}
