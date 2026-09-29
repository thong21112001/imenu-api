import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MenuItemsService } from './menu-items.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { QueryMenuItemDto } from './dto/query-menu-item.dto';
import { ToggleItemStatusDto } from './dto/toggle-item-status.dto';
import { OkResponse } from '../../shared/common/dto/okResponse';
import { RequirePermissions } from '../../shared/common/decorators/require-permissions.decorator';
import { ActionType, ResourceType } from '../../shared/common/constants/permission.const';
import { CurrentRestaurant } from '../../shared/common/decorators/current-restaurant.decorator';
import { CurrentUser } from '../../shared/common/decorators/current-user.decorator';
import { JwtUser, isSuperAdminUser } from '../auth/interface/jwtUser';
import { PermissionsGuard } from '../../shared/common/guards/permissions.guard';
import { DemoBlockGuard } from '../../shared/common/guards/demo-block.guard';
import { Public } from '../../shared/common/decorators/public.decorator';

@ApiTags('Menu Items')
@ApiBearerAuth('JWT-auth')
@UseGuards(PermissionsGuard)
@Controller('menu-items')
export class MenuItemsController {
  constructor(private readonly menuItemsService: MenuItemsService) {}

  @ApiOperation({ summary: 'Lấy danh sách món ăn công khai cho khách hàng quét mã QR' })
  @ApiQuery({ name: 'restaurantId', required: true, description: 'ID nhà hàng' })
  @Public()
  @Get('public')
  async findPublicItems(
    @Query('restaurantId') restaurantId: string,
    @Query() query: QueryMenuItemDto,
  ) {
    const queryDto: QueryMenuItemDto = {
      ...query,
      isAvailable: 'true', // Khach hang chi xem mon con phuc vu
    };
    const result = await this.menuItemsService.findAll(restaurantId, queryDto);
    return new OkResponse({ data: result });
  }

  @ApiOperation({ summary: 'Lấy danh sách món ăn có phân trang và bộ lọc' })
  @ApiQuery({ name: 'restaurantId', required: false, description: 'Dành cho Super Admin' })
  @RequirePermissions(ResourceType.MENU, ActionType.VIEW)
  @Get()
  async findAll(
    @Query() query: QueryMenuItemDto,
    @CurrentRestaurant() currentRestId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const targetRestId = isSuperAdminUser(user) && query.restaurantId ? query.restaurantId : currentRestId;
    const result = await this.menuItemsService.findAll(targetRestId, query);
    return new OkResponse({ data: result });
  }

  @ApiOperation({ summary: 'Xem chi tiết một món ăn' })
  @RequirePermissions(ResourceType.MENU, ActionType.VIEW)
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentRestaurant() currentRestId: string,
    @CurrentUser() user: JwtUser,
    @Query('restaurantId') queryRestId?: string,
  ) {
    const targetRestId = isSuperAdminUser(user) && queryRestId ? queryRestId : currentRestId;
    const item = await this.menuItemsService.findById(id, targetRestId);
    return new OkResponse({ data: item });
  }

  @ApiOperation({ summary: 'Thêm món ăn mới vào thực đơn' })
  @RequirePermissions(ResourceType.MENU, ActionType.CREATE)
  @UseGuards(DemoBlockGuard)
  @Post()
  async create(
    @Body() dto: CreateMenuItemDto,
    @CurrentRestaurant() currentRestId: string,
    @CurrentUser() user: JwtUser,
    @Query('restaurantId') queryRestId?: string,
  ) {
    const targetRestId = isSuperAdminUser(user) && queryRestId ? queryRestId : currentRestId;
    const created = await this.menuItemsService.create(dto, targetRestId);
    return new OkResponse({ message: 'Thêm món ăn mới thành công', data: created });
  }

  @ApiOperation({ summary: 'Cập nhật thông tin món ăn' })
  @RequirePermissions(ResourceType.MENU, ActionType.UPDATE)
  @UseGuards(DemoBlockGuard)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMenuItemDto,
    @CurrentRestaurant() currentRestId: string,
    @CurrentUser() user: JwtUser,
    @Query('restaurantId') queryRestId?: string,
  ) {
    const targetRestId = isSuperAdminUser(user) && queryRestId ? queryRestId : currentRestId;
    const updated = await this.menuItemsService.update(id, dto, targetRestId);
    return new OkResponse({ message: 'Cập nhật món ăn thành công', data: updated });
  }

  @ApiOperation({ summary: 'Bật/Tắt nhanh trạng thái Còn món / Hết món (Dành cho Thu ngân & Bếp)' })
  @RequirePermissions(ResourceType.MENU, ActionType.UPDATE)
  @Patch(':id/status')
  async toggleStatus(
    @Param('id') id: string,
    @Body() dto: ToggleItemStatusDto,
    @CurrentRestaurant() currentRestId: string,
    @CurrentUser() user: JwtUser,
    @Query('restaurantId') queryRestId?: string,
  ) {
    const targetRestId = isSuperAdminUser(user) && queryRestId ? queryRestId : currentRestId;
    const updated = await this.menuItemsService.toggleStatus(id, targetRestId, dto?.isAvailable);
    const statusText = updated.isAvailable ? 'Còn món' : 'Hết món';
    return new OkResponse({
      message: `Đã cập nhật trạng thái món "${updated.name}" sang: ${statusText}`,
      data: updated,
    });
  }

  @ApiOperation({ summary: 'Xóa món ăn khỏi thực đơn' })
  @RequirePermissions(ResourceType.MENU, ActionType.DELETE)
  @UseGuards(DemoBlockGuard)
  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentRestaurant() currentRestId: string,
    @CurrentUser() user: JwtUser,
    @Query('restaurantId') queryRestId?: string,
  ) {
    const targetRestId = isSuperAdminUser(user) && queryRestId ? queryRestId : currentRestId;
    const result = await this.menuItemsService.delete(id, targetRestId);
    return new OkResponse({ message: result.message, data: { success: true } });
  }
}
