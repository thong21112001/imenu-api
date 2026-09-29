import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { OkResponse } from '../../shared/common/dto/okResponse';
import { RequirePermissions } from '../../shared/common/decorators/require-permissions.decorator';
import { ActionType, ResourceType } from '../../shared/common/constants/permission.const';
import { CurrentRestaurant } from '../../shared/common/decorators/current-restaurant.decorator';
import { CurrentUser } from '../../shared/common/decorators/current-user.decorator';
import { JwtUser, isSuperAdminUser } from '../auth/interface/jwtUser';
import { PermissionsGuard } from '../../shared/common/guards/permissions.guard';
import { DemoBlockGuard } from '../../shared/common/guards/demo-block.guard';
import { Public } from '../../shared/common/decorators/public.decorator';

@ApiTags('Menu Categories')
@ApiBearerAuth('JWT-auth')
@UseGuards(PermissionsGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @ApiOperation({ summary: 'Lấy danh mục thực đơn công khai cho khách hàng quét mã QR' })
  @ApiQuery({ name: 'restaurantId', required: true, description: 'ID nhà hàng' })
  @Public()
  @Get('public')
  async findPublicCategories(@Query('restaurantId') restaurantId: string) {
    const categories = await this.categoriesService.findAll(restaurantId, true);
    return new OkResponse({ data: categories });
  }

  @ApiOperation({ summary: 'Lấy danh sách danh mục thực đơn của nhà hàng' })
  @ApiQuery({ name: 'restaurantId', required: false, description: 'Dành cho Super Admin' })
  @RequirePermissions(ResourceType.MENU, ActionType.VIEW)
  @Get()
  async findAll(
    @CurrentRestaurant() currentRestId: string,
    @CurrentUser() user: JwtUser,
    @Query('restaurantId') queryRestId?: string,
  ) {
    const targetRestId = isSuperAdminUser(user) && queryRestId ? queryRestId : currentRestId;
    const categories = await this.categoriesService.findAll(targetRestId);
    return new OkResponse({ data: categories });
  }

  @ApiOperation({ summary: 'Xem chi tiết một danh mục thực đơn' })
  @RequirePermissions(ResourceType.MENU, ActionType.VIEW)
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentRestaurant() currentRestId: string,
    @CurrentUser() user: JwtUser,
    @Query('restaurantId') queryRestId?: string,
  ) {
    const targetRestId = isSuperAdminUser(user) && queryRestId ? queryRestId : currentRestId;
    const category = await this.categoriesService.findById(id, targetRestId);
    return new OkResponse({ data: category });
  }

  @ApiOperation({ summary: 'Tạo mới danh mục thực đơn' })
  @RequirePermissions(ResourceType.MENU, ActionType.CREATE)
  @UseGuards(DemoBlockGuard)
  @Post()
  async create(
    @Body() dto: CreateCategoryDto,
    @CurrentRestaurant() currentRestId: string,
    @CurrentUser() user: JwtUser,
    @Query('restaurantId') queryRestId?: string,
  ) {
    const targetRestId = isSuperAdminUser(user) && queryRestId ? queryRestId : currentRestId;
    const created = await this.categoriesService.create(dto, targetRestId);
    return new OkResponse({ message: 'Tạo danh mục thực đơn thành công', data: created });
  }

  @ApiOperation({ summary: 'Khởi tạo nhanh thực đơn mẫu chuẩn cho nhà hàng mới' })
  @RequirePermissions(ResourceType.MENU, ActionType.CREATE)
  @UseGuards(DemoBlockGuard)
  @HttpCode(HttpStatus.OK)
  @Post('seed-default')
  async seedDefault(
    @CurrentRestaurant() currentRestId: string,
    @CurrentUser() user: JwtUser,
    @Query('restaurantId') queryRestId?: string,
  ) {
    const targetRestId = isSuperAdminUser(user) && queryRestId ? queryRestId : currentRestId;
    await this.categoriesService.seedDefaultMenu(targetRestId);
    const categories = await this.categoriesService.findAll(targetRestId);
    return new OkResponse({ message: 'Khởi tạo thực đơn mẫu thành công', data: categories });
  }

  @ApiOperation({ summary: 'Cập nhật danh mục thực đơn' })
  @RequirePermissions(ResourceType.MENU, ActionType.UPDATE)
  @UseGuards(DemoBlockGuard)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentRestaurant() currentRestId: string,
    @CurrentUser() user: JwtUser,
    @Query('restaurantId') queryRestId?: string,
  ) {
    const targetRestId = isSuperAdminUser(user) && queryRestId ? queryRestId : currentRestId;
    const updated = await this.categoriesService.update(id, dto, targetRestId);
    return new OkResponse({ message: 'Cập nhật danh mục thành công', data: updated });
  }

  @ApiOperation({ summary: 'Xóa danh mục thực đơn (chặn xóa nếu còn món ăn)' })
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
    const result = await this.categoriesService.delete(id, targetRestId);
    return new OkResponse({ message: result.message, data: { success: true } });
  }
}
