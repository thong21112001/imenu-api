import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TablesService } from './tables.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto, UpdateTableStatusDto } from './dto/update-table.dto';
import { TransferTableDto, MergeTablesDto, MoveTableItemsDto } from './dto/transfer-table.dto';
import { CallStaffDto } from './dto/call-staff.dto';
import { CurrentRestaurant } from '../../shared/common/decorators/current-restaurant.decorator';
import { CurrentUser } from '../../shared/common/decorators/current-user.decorator';
import { RequirePermissions } from '../../shared/common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../shared/common/guards/permissions.guard';
import { ActionType, ResourceType } from '../../shared/common/constants/permission.const';
import { OkResponse } from '../../shared/common/dto/okResponse';
import { JwtUser } from '../auth/interface/jwtUser';
import { Public } from '../../shared/common/decorators/public.decorator';

@ApiTags('Tables (Sơ Đồ Bàn)')
@ApiBearerAuth('JWT-auth')
@UseGuards(PermissionsGuard)
@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @ApiOperation({ summary: 'Lấy thông tin và danh sách bàn công khai theo restaurant slug (cho trang chọn bàn/quét QR)' })
  @Public()
  @Get('public/by-restaurant/:restaurantSlug')
  async getPublicByRestaurant(@Param('restaurantSlug') restaurantSlug: string) {
    const data = await this.tablesService.findPublicByRestaurant(restaurantSlug);
    return new OkResponse({
      message: 'Lấy danh sách bàn công khai thành công',
      data,
    });
  }

  @ApiOperation({ summary: 'Lấy danh sách bàn ăn (lọc theo khu vực, chi nhánh, trạng thái)' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'zoneId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @RequirePermissions(ResourceType.POS, ActionType.VIEW)
  @Get()
  async findAll(
    @CurrentRestaurant() restaurantId: string,
    @Query('branchId') branchId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @CurrentUser() caller?: JwtUser,
  ) {
    const tables = await this.tablesService.findAll(
      {
        restaurantId,
        branchId,
        zoneId,
        status,
        search,
      },
      caller,
    );
    return new OkResponse({ message: 'Lấy danh sách bàn thành công', data: tables });
  }

  @ApiOperation({ summary: 'Xem chi tiết bàn ăn' })
  @RequirePermissions(ResourceType.POS, ActionType.VIEW)
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() caller?: JwtUser,
  ) {
    const table = await this.tablesService.findById(id, restaurantId, caller);
    return new OkResponse({ data: table });
  }

  @ApiOperation({ summary: 'Tạo bàn ăn mới' })
  @RequirePermissions(ResourceType.TABLE, ActionType.UPDATE)
  @Post()
  async create(
    @Body() dto: CreateTableDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() caller?: JwtUser,
  ) {
    const table = await this.tablesService.create(dto, restaurantId, caller);
    return new OkResponse({ message: 'Tạo bàn mới thành công', data: table });
  }

  @ApiOperation({ summary: 'Khởi tạo sơ đồ bàn mẫu cho nhà hàng mới' })
  @RequirePermissions(ResourceType.TABLE, ActionType.UPDATE)
  @HttpCode(HttpStatus.OK)
  @Post('seed-default')
  async seedDefault(
    @CurrentRestaurant() restaurantId: string,
    @Query('branchId') branchId?: string,
    @CurrentUser() caller?: JwtUser,
  ) {
    const result = await this.tablesService.seedDefaultTables(restaurantId, branchId, caller);
    return new OkResponse({ message: 'Khởi tạo sơ đồ bàn mẫu thành công', data: result });
  }

  @ApiOperation({ summary: 'Đổi bàn / Chuyển bàn gọi món' })
  @RequirePermissions(ResourceType.POS, ActionType.VIEW)
  @HttpCode(HttpStatus.OK)
  @Post('transfer')
  async transfer(
    @Body() dto: TransferTableDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() caller?: JwtUser,
  ) {
    const result = await this.tablesService.transferTable(dto, restaurantId, caller);
    return new OkResponse({ message: result.message, data: result });
  }

  @ApiOperation({ summary: 'Gộp nhiều bàn vào một bàn' })
  @RequirePermissions(ResourceType.POS, ActionType.VIEW)
  @HttpCode(HttpStatus.OK)
  @Post('merge')
  async merge(
    @Body() dto: MergeTablesDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() caller?: JwtUser,
  ) {
    const result = await this.tablesService.mergeTables(dto, restaurantId, caller);
    return new OkResponse({ message: result.message, data: result });
  }

  @ApiOperation({ summary: 'Chuyển món / Tách bàn giữa các bàn' })
  @RequirePermissions(ResourceType.POS, ActionType.VIEW)
  @HttpCode(HttpStatus.OK)
  @Post('move-items')
  async moveItems(
    @Body() dto: MoveTableItemsDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() caller?: JwtUser,
  ) {
    const result = await this.tablesService.moveItemsBetweenTables(dto, restaurantId, caller);
    return new OkResponse({ message: result.message, data: result });
  }

  @ApiOperation({ summary: 'Cập nhật trạng thái bàn (Available, Occupied, Cleaning, v.v.)' })
  @RequirePermissions(ResourceType.POS, ActionType.VIEW)
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTableStatusDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() caller?: JwtUser,
  ) {
    const table = await this.tablesService.updateStatus(
      id,
      dto.status,
      dto.totalGuests,
      restaurantId,
      caller,
    );
    return new OkResponse({ message: 'Cập nhật trạng thái bàn thành công', data: table });
  }

  @ApiOperation({ summary: 'Cập nhật thông tin bàn ăn' })
  @RequirePermissions(ResourceType.TABLE, ActionType.UPDATE)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTableDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() caller?: JwtUser,
  ) {
    const table = await this.tablesService.update(id, dto, restaurantId, caller);
    return new OkResponse({ message: 'Cập nhật bàn thành công', data: table });
  }

  @ApiOperation({ summary: 'Xóa bàn ăn (Soft Delete)' })
  @RequirePermissions(ResourceType.TABLE, ActionType.UPDATE)
  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.tablesService.delete(id, restaurantId, user, user);
    return new OkResponse({ message: result.message, data: result });
  }

  @ApiOperation({ summary: 'Khách gọi nhân viên phục vụ tại bàn' })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post(':tableId/call-staff')
  async callStaff(
    @Param('tableId') tableId: string,
    @Body() dto: CallStaffDto,
    @Headers('x-test-bypass-cooldown') bypassCooldownHeader?: string,
  ) {
    const bypassCooldown = bypassCooldownHeader === 'true' || bypassCooldownHeader === '1';
    const result = await this.tablesService.callStaff(tableId, dto, bypassCooldown);
    return new OkResponse({
      message: result.message || 'Yêu cầu gọi nhân viên đã được gửi thành công',
      data: result,
    });
  }

  @ApiOperation({ summary: 'Nhân viên xác nhận đã tiếp nhận hỗ trợ bàn' })
  @RequirePermissions(ResourceType.POS, ActionType.VIEW)
  @HttpCode(HttpStatus.OK)
  @Post(':tableId/acknowledge-call')
  async acknowledgeCall(
    @Param('tableId') tableId: string,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() caller?: JwtUser,
  ) {
    const result = await this.tablesService.acknowledgeCallStaff(tableId, restaurantId, caller);
    return new OkResponse({
      message: 'Xác nhận hỗ trợ bàn thành công',
      data: result,
    });
  }
}
