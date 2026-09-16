import {
  Controller,
  Get,
  Put,
  Body,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RestaurantsService } from './restaurants.service';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { CurrentUser } from '../../shared/common/decorators/current-user.decorator';
import { OkResponse } from '../../shared/common/dto/okResponse';
import { JwtUser } from '../auth/interface/jwtUser';
import { UseGuards } from '@nestjs/common';
import { DemoBlockGuard } from '../../shared/common/guards/demo-block.guard';

@ApiTags('Restaurants')
@ApiBearerAuth('JWT-auth')
@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @ApiOperation({ summary: 'Lấy thông tin nhà hàng hiện tại của người dùng' })
  @Get('current')
  async getCurrent(@CurrentUser() user: JwtUser) {
    if (!user.restaurantId) {
      throw new BadRequestException('Tài khoản chưa được gán vào nhà hàng nào');
    }
    const data = await this.restaurantsService.getCurrent(user.restaurantId);
    return new OkResponse({ message: 'Lấy thông tin nhà hàng thành công', data });
  }

  @ApiOperation({ summary: 'Cập nhật thông tin nhà hàng hiện tại' })
  @UseGuards(DemoBlockGuard)
  @Put('current')
  async updateCurrent(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateRestaurantDto,
  ) {
    if (!user.restaurantId) {
      throw new BadRequestException('Tài khoản chưa được gán vào nhà hàng nào');
    }
    const data = await this.restaurantsService.updateCurrent(
      user.restaurantId,
      dto,
      user,
    );
    return new OkResponse({
      message: 'Cập nhật thông tin nhà hàng thành công',
      data,
    });
  }
}
