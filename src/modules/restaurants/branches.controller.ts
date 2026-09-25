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
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto, CloseBranchDto, DeactivateBranchDto } from './dto/branch.dto';
import { CurrentUser } from '../../shared/common/decorators/current-user.decorator';
import { OkResponse } from '../../shared/common/dto/okResponse';
import { JwtUser, isSuperAdminUser } from '../auth/interface/jwtUser';
import { RequirePermissions } from '../../shared/common/decorators/require-permissions.decorator';
import { ActionType, ResourceType } from '../../shared/common/constants/permission.const';
import { PermissionsGuard } from '../../shared/common/guards/permissions.guard';
import { DemoBlockGuard } from '../../shared/common/guards/demo-block.guard';

@ApiTags('Branches')
@ApiBearerAuth('JWT-auth')
@UseGuards(PermissionsGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @ApiOperation({ summary: 'Lấy danh sách chi nhánh của nhà hàng' })
  @ApiQuery({ name: 'restaurantId', required: false, description: 'ID nhà hàng (Dành cho Super Admin)' })
  @RequirePermissions(ResourceType.BRANCH, ActionType.VIEW)
  @Get()
  async findAll(@CurrentUser() user: JwtUser, @Query('restaurantId') queryRestaurantId?: string) {
    const isSuperAdmin = isSuperAdminUser(user);
    const effectiveRestaurantId = isSuperAdmin ? (queryRestaurantId || user.restaurantId) : user.restaurantId;
    if (!effectiveRestaurantId) {
      throw new BadRequestException('Vui lòng chỉ định nhà hàng (restaurantId)');
    }
    const data = await this.branchesService.findAll(effectiveRestaurantId, user);
    return new OkResponse({ message: 'Lấy danh sách chi nhánh thành công', data });
  }

  @ApiOperation({ summary: 'Lấy chi tiết một chi nhánh' })
  @ApiQuery({ name: 'restaurantId', required: false, description: 'ID nhà hàng (Dành cho Super Admin)' })
  @RequirePermissions(ResourceType.BRANCH, ActionType.VIEW)
  @Get(':id')
  async findOne(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Query('restaurantId') queryRestaurantId?: string,
  ) {
    const isSuperAdmin = isSuperAdminUser(user);
    const effectiveRestaurantId = isSuperAdmin ? (queryRestaurantId || user.restaurantId) : user.restaurantId;
    if (!effectiveRestaurantId) {
      throw new BadRequestException('Vui lòng chỉ định nhà hàng (restaurantId)');
    }
    const data = await this.branchesService.findById(effectiveRestaurantId, id, user);
    return new OkResponse({ message: 'Lấy chi tiết chi nhánh thành công', data });
  }

  @ApiOperation({ summary: 'Tạo chi nhánh mới (Chỉ quản trị chi nhánh chính)' })
  @RequirePermissions(ResourceType.BRANCH, ActionType.CREATE)
  @UseGuards(DemoBlockGuard)
  @Post()
  async create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateBranchDto,
  ) {
    if (!user.restaurantId) {
      throw new BadRequestException('Tài khoản chưa được gán vào nhà hàng nào');
    }
    const data = await this.branchesService.create(user.restaurantId, dto, user);
    return new OkResponse({ message: 'Tạo chi nhánh mới thành công', data });
  }

  @ApiOperation({ summary: 'Cập nhật thông tin chi nhánh (Chỉ quản trị chi nhánh chính)' })
  @RequirePermissions(ResourceType.BRANCH, ActionType.UPDATE)
  @UseGuards(DemoBlockGuard)
  @Put(':id')
  async update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    if (!user.restaurantId) {
      throw new BadRequestException('Tài khoản chưa được gán vào nhà hàng nào');
    }
    const data = await this.branchesService.update(user.restaurantId, id, dto, user);
    return new OkResponse({ message: 'Cập nhật chi nhánh thành công', data });
  }

  @ApiOperation({ summary: 'Tạm đóng chi nhánh (Chỉ quản trị chi nhánh chính)' })
  @RequirePermissions(ResourceType.BRANCH, ActionType.CONFIRM)
  @UseGuards(DemoBlockGuard)
  @Patch(':id/close')
  async close(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CloseBranchDto,
  ) {
    if (!user.restaurantId) {
      throw new BadRequestException('Tài khoản chưa được gán vào nhà hàng nào');
    }
    const data = await this.branchesService.closeBranch(user.restaurantId, id, dto, user);
    return new OkResponse({ message: 'Tạm đóng chi nhánh thành công', data });
  }

  @ApiOperation({ summary: 'Mở lại chi nhánh đang tạm đóng (Chỉ quản trị chi nhánh chính)' })
  @RequirePermissions(ResourceType.BRANCH, ActionType.CONFIRM)
  @UseGuards(DemoBlockGuard)
  @Patch(':id/reopen')
  async reopen(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    if (!user.restaurantId) {
      throw new BadRequestException('Tài khoản chưa được gán vào nhà hàng nào');
    }
    const data = await this.branchesService.reopenBranch(user.restaurantId, id, user);
    return new OkResponse({ message: 'Mở lại chi nhánh thành công', data });
  }

  @ApiOperation({ summary: 'Ngừng hoạt động vĩnh viễn chi nhánh (Chỉ quản trị chi nhánh chính)' })
  @RequirePermissions(ResourceType.BRANCH, ActionType.CONFIRM)
  @UseGuards(DemoBlockGuard)
  @Patch(':id/deactivate')
  async deactivate(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: DeactivateBranchDto,
  ) {
    if (!user.restaurantId) {
      throw new BadRequestException('Tài khoản chưa được gán vào nhà hàng nào');
    }
    const data = await this.branchesService.deactivateBranch(user.restaurantId, id, dto, user);
    return new OkResponse({ message: 'Ngừng hoạt động chi nhánh thành công', data });
  }

  @ApiOperation({ summary: 'Xóa chi nhánh (Chỉ xóa nếu chưa có đơn hàng lịch sử)' })
  @RequirePermissions(ResourceType.BRANCH, ActionType.DELETE)
  @UseGuards(DemoBlockGuard)
  @Delete(':id')
  async delete(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    if (!user.restaurantId) {
      throw new BadRequestException('Tài khoản chưa được gán vào nhà hàng nào');
    }
    const result = await this.branchesService.delete(user.restaurantId, id, user);
    return new OkResponse(result);
  }
}
