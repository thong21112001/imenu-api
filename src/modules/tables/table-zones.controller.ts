import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TableZonesService } from './table-zones.service';
import { CreateTableZoneDto, UpdateTableZoneDto } from './dto/create-zone.dto';
import { CurrentRestaurant } from '../../shared/common/decorators/current-restaurant.decorator';
import { CurrentUser } from '../../shared/common/decorators/current-user.decorator';
import { RequirePermissions } from '../../shared/common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../shared/common/guards/permissions.guard';
import { ActionType, ResourceType } from '../../shared/common/constants/permission.const';
import { OkResponse } from '../../shared/common/dto/okResponse';
import { JwtUser } from '../auth/interface/jwtUser';

@ApiTags('Table Zones (Khu Vực Bàn)')
@ApiBearerAuth('JWT-auth')
@UseGuards(PermissionsGuard)
@Controller('table-zones')
export class TableZonesController {
  constructor(private readonly zonesService: TableZonesService) {}

  @ApiOperation({ summary: 'Lấy danh sách các khu vực bàn của nhà hàng' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Lọc theo chi nhánh' })
  @RequirePermissions(ResourceType.POS, ActionType.VIEW)
  @Get()
  async findAll(
    @CurrentRestaurant() restaurantId: string,
    @Query('branchId') branchId?: string,
    @CurrentUser() caller?: JwtUser,
  ) {
    const zones = await this.zonesService.findAll(restaurantId, branchId, caller);
    return new OkResponse({ message: 'Lấy danh sách khu vực thành công', data: zones });
  }

  @ApiOperation({ summary: 'Xem chi tiết khu vực bàn' })
  @RequirePermissions(ResourceType.POS, ActionType.VIEW)
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() caller?: JwtUser,
  ) {
    const zone = await this.zonesService.findById(id, restaurantId, caller);
    return new OkResponse({ data: zone });
  }

  @ApiOperation({ summary: 'Tạo khu vực bàn mới' })
  @RequirePermissions(ResourceType.TABLE, ActionType.UPDATE)
  @Post()
  async create(
    @Body() dto: CreateTableZoneDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() caller?: JwtUser,
  ) {
    const zone = await this.zonesService.create(dto, restaurantId, caller);
    return new OkResponse({ message: 'Tạo khu vực bàn thành công', data: zone });
  }

  @ApiOperation({ summary: 'Cập nhật khu vực bàn' })
  @RequirePermissions(ResourceType.TABLE, ActionType.UPDATE)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTableZoneDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() caller?: JwtUser,
  ) {
    const zone = await this.zonesService.update(id, dto, restaurantId, caller);
    return new OkResponse({ message: 'Cập nhật khu vực bàn thành công', data: zone });
  }

  @ApiOperation({ summary: 'Xóa khu vực bàn' })
  @RequirePermissions(ResourceType.TABLE, ActionType.UPDATE)
  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() caller?: JwtUser,
  ) {
    const res = await this.zonesService.delete(id, restaurantId, caller);
    return new OkResponse(res);
  }
}
