import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateCustomerReviewDto } from './dto/create-customer-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { QueryReviewsDto } from './dto/query-reviews.dto';
import { Public } from '../../shared/common/decorators/public.decorator';
import { JwtAuthGuard } from '../../shared/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../shared/common/guards/permissions.guard';
import { RequirePermissions } from '../../shared/common/decorators/require-permissions.decorator';
import { ResourceType, ActionType } from '../../shared/common/constants/permission.const';
import { CurrentRestaurant } from '../../shared/common/decorators/current-restaurant.decorator';
import { CurrentUser } from '../../shared/common/decorators/current-user.decorator';
import { JwtUser } from '../auth/interface/jwtUser';
import { OkResponse } from '../../shared/common/dto/okResponse';

@ApiTags('Reviews - Đánh Giá & Phản Hồi Khách Hàng')
@Controller('reviews')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @ApiOperation({ summary: 'Khách hàng gửi đánh giá bữa ăn (Public QR hoặc receiptAccessToken)' })
  @Public()
  @Post(['customer', 'public/customer'])
  async createCustomerReview(@Body() dto: CreateCustomerReviewDto) {
    const review = await this.reviewsService.createCustomerReview(dto);
    return new OkResponse({
      message: 'Cảm ơn quý khách đã gửi đánh giá chất lượng bữa ăn!',
      data: review,
    });
  }

  @ApiOperation({ summary: 'Kiểm tra trạng thái đánh giá theo đơn hàng (Public QR hoặc receiptAccessToken)' })
  @Public()
  @Get(['customer/by-order/:orderId', 'public/customer/by-order/:orderId'])
  async getCustomerReviewByOrder(
    @Param('orderId') orderId: string,
    @Query('restaurantSlug') restaurantSlug?: string,
    @Query('tableCode') tableCode?: string,
    @Query('qrToken') qrToken?: string,
    @Query('receiptAccessToken') receiptAccessToken?: string,
  ) {
    const review = await this.reviewsService.getCustomerReviewByOrder(orderId, {
      restaurantSlug,
      tableCode,
      qrToken,
      receiptAccessToken,
    });
    return new OkResponse({
      message: review ? 'Đã tìm thấy đánh giá của đơn hàng' : 'Đơn hàng chưa được đánh giá',
      data: review,
    });
  }

  @ApiOperation({ summary: 'Xem danh sách đánh giá phân trang theo chi nhánh' })
  @ApiBearerAuth()
  @RequirePermissions(ResourceType.REVIEW, ActionType.VIEW, 'perm-review-view')
  @Get()
  async findAll(
    @CurrentRestaurant() restaurantId: string,
    @Query() query: QueryReviewsDto,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.reviewsService.findAll(restaurantId, query, user);
    return new OkResponse({
      message: 'Lấy danh sách đánh giá thành công',
      data: result,
    });
  }

  @ApiOperation({ summary: 'Thống kê tổng quan CSAT theo chi nhánh hoặc toàn chuỗi' })
  @ApiBearerAuth()
  @RequirePermissions(ResourceType.REVIEW, ActionType.VIEW, 'perm-review-view')
  @Get('summary')
  async getSummary(
    @CurrentRestaurant() restaurantId: string,
    @Query('branchId') branchId: string | undefined,
    @CurrentUser() user: JwtUser,
  ) {
    const summary = await this.reviewsService.getSummary(restaurantId, branchId, user);
    return new OkResponse({
      message: 'Lấy thống kê đánh giá thành công',
      data: summary,
    });
  }

  @ApiOperation({ summary: 'Quản lý phản hồi đánh giá của khách hàng' })
  @ApiBearerAuth()
  @RequirePermissions(ResourceType.REVIEW, ActionType.UPDATE, 'perm-review-reply')
  @Post(':id/reply')
  async reply(
    @Param('id') id: string,
    @Body() dto: ReplyReviewDto,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const review = await this.reviewsService.reply(id, dto, restaurantId, user);
    return new OkResponse({
      message: 'Gửi phản hồi đánh giá thành công',
      data: review,
    });
  }

  @ApiOperation({ summary: 'Ẩn/Hiện đánh giá' })
  @ApiBearerAuth()
  @RequirePermissions(ResourceType.REVIEW, ActionType.UPDATE, 'perm-review-reply')
  @Patch(':id/toggle-hidden')
  async toggleHidden(
    @Param('id') id: string,
    @CurrentRestaurant() restaurantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const review = await this.reviewsService.toggleHidden(id, restaurantId, user);
    return new OkResponse({
      message: review.isHidden ? 'Đã ẩn đánh giá' : 'Đã hiện đánh giá',
      data: review,
    });
  }
}
