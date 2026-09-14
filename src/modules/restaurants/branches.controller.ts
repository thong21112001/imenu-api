import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';
import { CurrentUser } from '../../shared/common/decorators/current-user.decorator';
import { OkResponse } from '../../shared/common/dto/okResponse';
import { JwtUser } from '../auth/interface/jwtUser';

@ApiTags('Branches')
@ApiBearerAuth('JWT-auth')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @ApiOperation({ summary: 'Lấy danh sách chi nhánh của nhà hàng' })
  @Get()
  async findAll(@CurrentUser() user: JwtUser) {
    if (!user.restaurantId) {
      throw new BadRequestException('Tài khoản chưa được gán vào nhà hàng nào');
    }
    const data = await this.branchesService.findAll(user.restaurantId);
    return new OkResponse({ message: 'Lấy danh sách chi nhánh thành công', data });
  }

  @ApiOperation({ summary: 'Lấy chi tiết một chi nhánh' })
  @Get(':id')
  async findOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    if (!user.restaurantId) {
      throw new BadRequestException('Tài khoản chưa được gán vào nhà hàng nào');
    }
    const data = await this.branchesService.findById(user.restaurantId, id);
    return new OkResponse({ message: 'Lấy chi tiết chi nhánh thành công', data });
  }

  @ApiOperation({ summary: 'Tạo chi nhánh mới' })
  @Post()
  async create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateBranchDto,
  ) {
    if (!user.restaurantId) {
      throw new BadRequestException('Tài khoản chưa được gán vào nhà hàng nào');
    }
    const data = await this.branchesService.create(user.restaurantId, dto);
    return new OkResponse({ message: 'Tạo chi nhánh mới thành công', data });
  }

  @ApiOperation({ summary: 'Cập nhật thông tin chi nhánh' })
  @Put(':id')
  async update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    if (!user.restaurantId) {
      throw new BadRequestException('Tài khoản chưa được gán vào nhà hàng nào');
    }
    const data = await this.branchesService.update(user.restaurantId, id, dto);
    return new OkResponse({ message: 'Cập nhật chi nhánh thành công', data });
  }

  @ApiOperation({ summary: 'Xóa chi nhánh' })
  @Delete(':id')
  async delete(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    if (!user.restaurantId) {
      throw new BadRequestException('Tài khoản chưa được gán vào nhà hàng nào');
    }
    const result = await this.branchesService.delete(user.restaurantId, id);
    return new OkResponse(result);
  }
}
