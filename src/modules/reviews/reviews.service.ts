import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Review, ReviewDocument } from './entities/review.entity';
import { Order, OrderDocument } from '../orders/entities/order.entity';
import { OrdersService } from '../orders/orders.service';
import { CreateCustomerReviewDto } from './dto/create-customer-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { QueryReviewsDto } from './dto/query-reviews.dto';
import { JwtUser, isSuperAdminUser } from '../auth/interface/jwtUser';
import { ActivityAction, ActivityModule } from '../activity-log/constants/audit-log.const';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly ordersService: OrdersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Khách hàng gửi đánh giá chất lượng bữa ăn (AUD-11.1, AUD-11.2, AUD-11.3, AUD-11.4)
   */
  async createCustomerReview(dto: CreateCustomerReviewDto): Promise<Review> {
    if (!Types.ObjectId.isValid(dto.orderId)) {
      throw new BadRequestException('Mã đơn hàng orderId không hợp lệ');
    }
    const orderOid = new Types.ObjectId(dto.orderId);

    let order: any;

    // Xác thực quyền sở hữu đơn hàng
    if (dto.receiptAccessToken) {
      // Cơ chế 2: Khách dùng receiptAccessToken (Sau khi bàn đã giải phóng - AUD-11.4)
      order = await this.orderModel.findOne({
        _id: orderOid,
        receiptAccessToken: dto.receiptAccessToken,
      });

      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng hoặc mã receiptAccessToken không hợp lệ');
      }

      // Kiểm tra TTL 24 giờ sau thời điểm kết thúc đơn
      const referenceTime = order.closedAt || order.updatedAt || order.createdAt;
      const ageMs = Date.now() - new Date(referenceTime).getTime();
      const MAX_AGE_MS = 24 * 60 * 60 * 1000;
      if (ageMs > MAX_AGE_MS) {
        throw new BadRequestException('Mã hóa đơn điện tử đã hết hạn đánh giá (chỉ khả dụng trong vòng 24 giờ sau thanh toán)');
      }
    } else if (dto.restaurantSlug && dto.tableCode && dto.qrToken) {
      // Cơ chế 1: Khách dùng bộ 3 QR tại bàn (AUD-11.3)
      const session = await this.ordersService.validateQrSession(
        dto.restaurantSlug,
        dto.tableCode,
        dto.qrToken,
      );

      order = await this.orderModel.findOne({
        _id: orderOid,
        restaurantId: session.restaurant._id,
        tableId: session.table._id,
      });

      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng tương ứng với bàn ăn này');
      }
    } else {
      throw new BadRequestException(
        'Yêu cầu cung cấp thông tin phiên QR hợp lệ (restaurantSlug, tableCode, qrToken) hoặc receiptAccessToken',
      );
    }

    // AUD-11.2: Chặn đánh giá đơn chưa gọi thanh toán hoặc đơn đã hủy
    const allowedStatuses = ['PaymentRequested', 'Paid'];
    if (!allowedStatuses.includes(order.status) && !order.isPaid) {
      throw new BadRequestException(
        `Chỉ có thể đánh giá khi đơn hàng đã gọi thanh toán hoặc đã thanh toán xong (Trạng thái hiện tại: ${order.status})`,
      );
    }

    // AUD-11.1: Atomic CAS trên Order để ngăn Race Condition Double Review
    const claimedOrder = await this.orderModel.findOneAndUpdate(
      {
        _id: orderOid,
        isReviewed: { $ne: true },
      },
      {
        $set: { isReviewed: true },
      },
      { new: true },
    );

    if (!claimedOrder) {
      throw new ConflictException('Đơn hàng này đã được gửi đánh giá trước đó');
    }

    // Tạo bản ghi Review mới với MongoDB Unique Index { restaurantId: 1, orderId: 1 }
    let savedReview: ReviewDocument;
    try {
      savedReview = await this.reviewModel.create({
        restaurantId: order.restaurantId,
        branchId: order.branchId,
        branchName: order.branchName || '',
        orderId: order._id,
        orderCode: order.orderCode,
        billId: order.billId,
        tableId: order.tableId,
        tableName: order.tableName,
        overallRating: Math.round(dto.overallRating),
        foodRating: dto.foodRating ? Math.round(dto.foodRating) : undefined,
        serviceRating: dto.serviceRating ? Math.round(dto.serviceRating) : undefined,
        ambianceRating: dto.ambianceRating ? Math.round(dto.ambianceRating) : undefined,
        quickTags: Array.isArray(dto.quickTags) ? dto.quickTags.slice(0, 10) : [],
        comment: (dto.comment || '').trim().slice(0, 500),
        itemFeedbacks: dto.itemFeedbacks || [],
        customerName: dto.customerName?.trim(),
        customerPhone: dto.customerPhone?.trim(),
        isHidden: false,
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException('Đơn hàng này đã được gửi đánh giá trước đó');
      }
      throw err;
    }

    // Liên kết reviewId vào đơn hàng
    await this.orderModel.updateOne(
      { _id: orderOid },
      { $set: { reviewId: savedReview._id } },
    );

    // Phát sự kiện realtime review.created
    const isLowRatingAlert = savedReview.overallRating <= 2;
    this.eventEmitter.emit('review.created', {
      review: savedReview.toObject(),
      restaurantId: savedReview.restaurantId.toString(),
      branchId: savedReview.branchId,
      orderId: savedReview.orderId.toString(),
      overallRating: savedReview.overallRating,
      isLowRatingAlert,
    });

    this.logger.log(
      `[Review] Tạo đánh giá mới: ${savedReview.overallRating} sao cho đơn ${savedReview.orderCode} (Branch: ${savedReview.branchId})`,
    );

    return savedReview.toObject();
  }

  /**
   * Khách hàng kiểm tra trạng thái đánh giá theo đơn hàng
   */
  async getCustomerReviewByOrder(
    orderId: string,
    credentials: {
      restaurantSlug?: string;
      tableCode?: string;
      qrToken?: string;
      receiptAccessToken?: string;
    },
  ): Promise<Review | null> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new BadRequestException('Mã đơn hàng không hợp lệ');
    }
    const orderOid = new Types.ObjectId(orderId);

    let order: any;
    if (credentials.receiptAccessToken) {
      order = await this.orderModel.findOne({
        _id: orderOid,
        receiptAccessToken: credentials.receiptAccessToken,
      });
    } else if (credentials.restaurantSlug && credentials.tableCode && credentials.qrToken) {
      const session = await this.ordersService.validateQrSession(
        credentials.restaurantSlug,
        credentials.tableCode,
        credentials.qrToken,
      );
      order = await this.orderModel.findOne({
        _id: orderOid,
        restaurantId: session.restaurant._id,
        tableId: session.table._id,
      });
    } else {
      throw new BadRequestException('Yêu cầu thông tin phiên QR hợp lệ hoặc receiptAccessToken');
    }

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    return this.reviewModel.findOne({
      restaurantId: order.restaurantId,
      orderId: order._id,
    }).lean().exec();
  }

  /**
   * Nhà hàng xem danh sách đánh giá có phân trang & lọc theo Chi nhánh (AUD-11.5)
   */
  async findAll(
    restaurantId: string,
    query: QueryReviewsDto,
    user?: JwtUser,
  ): Promise<{ items: Review[]; total: number; page: number; limit: number; totalPages: number }> {
    const restaurantOid = new Types.ObjectId(restaurantId);
    const filter: any = { restaurantId: restaurantOid };

    const isSuperAdmin = isSuperAdminUser(user);
    const isMainBranch = isSuperAdmin || Boolean(user?.isMainBranch);

    // AUD-11.5: Cưỡng chế phân lập chi nhánh cho Quản lý chi nhánh con
    if (!isMainBranch && user?.branchId) {
      filter.branchId = user.branchId;
    } else if (query.branchId) {
      filter.branchId = query.branchId;
    }

    if (query.rating) {
      filter.overallRating = query.rating;
    }

    if (query.hasReply === true) {
      filter['merchantReply.content'] = { $exists: true, $ne: '' };
    } else if (query.hasReply === false) {
      filter.$or = [
        { merchantReply: { $exists: false } },
        { 'merchantReply.content': { $exists: false } },
        { 'merchantReply.content': '' },
      ];
    }

    if (query.fromDate || query.toDate) {
      const dateCondition: any = {};
      if (query.fromDate) {
        dateCondition.$gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        const to = new Date(query.toDate);
        to.setHours(23, 59, 59, 999);
        dateCondition.$lte = to;
      }
      filter.createdAt = dateCondition;
    }

    if (query.search && query.search.trim()) {
      const keyword = query.search.trim();
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { orderCode: regex },
        { tableName: regex },
        { comment: regex },
        { customerName: regex },
      ];
    }

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.reviewModel.countDocuments(filter),
    ]);

    return {
      items: items as any,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Thống kê tổng quan CSAT theo Chi nhánh và Toàn chuỗi (AUD-11.5)
   */
  async getSummary(
    restaurantId: string,
    queryBranchId?: string,
    user?: JwtUser,
  ): Promise<any> {
    const restaurantOid = new Types.ObjectId(restaurantId);
    const filter: any = { restaurantId: restaurantOid };

    const isSuperAdmin = isSuperAdminUser(user);
    const isMainBranch = isSuperAdmin || Boolean(user?.isMainBranch);

    // AUD-11.5: Cưỡng chế phân lập chi nhánh cho Quản lý chi nhánh
    let effectiveBranchId: string | undefined = undefined;
    if (!isMainBranch && user?.branchId) {
      effectiveBranchId = user.branchId;
      filter.branchId = user.branchId;
    } else if (queryBranchId) {
      effectiveBranchId = queryBranchId;
      filter.branchId = queryBranchId;
    }

    const reviews = await this.reviewModel.find(filter).lean().exec();
    const totalReviews = reviews.length;

    if (totalReviews === 0) {
      return {
        totalReviews: 0,
        averageOverall: 0,
        averageFood: 0,
        averageService: 0,
        averageAmbiance: 0,
        fiveStarRate: 0,
        responseRate: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        topTags: [],
        branchBreakdown: [],
      };
    }

    let sumOverall = 0;
    let sumFood = 0;
    let countFood = 0;
    let sumService = 0;
    let countService = 0;
    let sumAmbiance = 0;
    let countAmbiance = 0;
    let repliedCount = 0;

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const tagCountMap: Record<string, number> = {};
    const branchMap: Record<string, { branchId: string; branchName: string; sum: number; count: number }> = {};

    for (const r of reviews) {
      sumOverall += r.overallRating;
      distribution[r.overallRating] = (distribution[r.overallRating] || 0) + 1;

      if (r.foodRating) {
        sumFood += r.foodRating;
        countFood++;
      }
      if (r.serviceRating) {
        sumService += r.serviceRating;
        countService++;
      }
      if (r.ambianceRating) {
        sumAmbiance += r.ambianceRating;
        countAmbiance++;
      }
      if (r.merchantReply?.content) {
        repliedCount++;
      }

      if (Array.isArray(r.quickTags)) {
        for (const tag of r.quickTags) {
          if (tag) tagCountMap[tag] = (tagCountMap[tag] || 0) + 1;
        }
      }

      const bId = r.branchId || 'main';
      if (!branchMap[bId]) {
        branchMap[bId] = {
          branchId: bId,
          branchName: r.branchName || bId,
          sum: 0,
          count: 0,
        };
      }
      branchMap[bId].sum += r.overallRating;
      branchMap[bId].count += 1;
    }

    const averageOverall = Number((sumOverall / totalReviews).toFixed(1));
    const averageFood = countFood > 0 ? Number((sumFood / countFood).toFixed(1)) : averageOverall;
    const averageService = countService > 0 ? Number((sumService / countService).toFixed(1)) : averageOverall;
    const averageAmbiance = countAmbiance > 0 ? Number((sumAmbiance / countAmbiance).toFixed(1)) : averageOverall;

    const fiveStarRate = Number((((distribution[5] || 0) / totalReviews) * 100).toFixed(1));
    const responseRate = Number(((repliedCount / totalReviews) * 100).toFixed(1));

    const topTags = Object.entries(tagCountMap)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const branchBreakdown = Object.values(branchMap).map((b) => ({
      branchId: b.branchId,
      branchName: b.branchName,
      totalReviews: b.count,
      averageRating: Number((b.sum / b.count).toFixed(1)),
    }));

    return {
      totalReviews,
      averageOverall,
      averageFood,
      averageService,
      averageAmbiance,
      fiveStarRate,
      responseRate,
      ratingDistribution: distribution,
      topTags,
      branchBreakdown,
    };
  }

  /**
   * Quản lý phản hồi đánh giá của khách hàng (AUD-11.5)
   */
  async reply(
    id: string,
    dto: ReplyReviewDto,
    restaurantId: string,
    user: JwtUser,
  ): Promise<Review> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã đánh giá không hợp lệ');
    }

    const review = await this.reviewModel.findOne({
      _id: new Types.ObjectId(id),
      restaurantId: new Types.ObjectId(restaurantId),
    });

    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá tương ứng');
    }

    const isSuperAdmin = isSuperAdminUser(user);
    const isMainBranch = isSuperAdmin || Boolean(user?.isMainBranch);

    // AUD-11.5: Chặn nhân viên chi nhánh khác phản hồi đánh giá không thuộc chi nhánh mình
    if (!isMainBranch && user?.branchId && review.branchId !== user.branchId) {
      throw new ForbiddenException('Bạn không có quyền phản hồi đánh giá của chi nhánh khác');
    }

    const callerOid = user.userId && Types.ObjectId.isValid(user.userId) ? new Types.ObjectId(user.userId) : undefined;
    review.merchantReply = {
      content: dto.content.trim(),
      repliedBy: callerOid,
      repliedByName: user.fullName || user.username || 'Quản lý nhà hàng',
      repliedAt: new Date(),
    };

    await review.save();

    // Ghi nhật ký kiểm toán (Activity Log)
    this.eventEmitter.emit('activity.log', {
      action: ActivityAction.UPDATE || 'update',
      module: ActivityModule.SYSTEM || 'review',
      entityType: 'Review',
      restaurantId,
      branchId: review.branchId,
      targetId: review._id.toString(),
      userId: user.userId,
      userName: user.fullName || user.username || 'Quản lý',
      userRole: user.role,
      newData: { replyContent: dto.content.trim(), orderCode: review.orderCode },
      note: `Phản hồi đánh giá đơn ${review.orderCode}`,
    });

    return review.toObject();
  }

  /**
   * Ẩn/Hiện đánh giá (Chỉ dành cho Super Admin & Chủ nhà hàng)
   */
  async toggleHidden(
    id: string,
    restaurantId: string,
    user: JwtUser,
  ): Promise<Review> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã đánh giá không hợp lệ');
    }

    const review = await this.reviewModel.findOne({
      _id: new Types.ObjectId(id),
      restaurantId: new Types.ObjectId(restaurantId),
    });

    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }

    const isSuperAdmin = isSuperAdminUser(user);
    const roleObj = user?.role as any;
    const roleSlug = (typeof roleObj === 'string' ? roleObj : roleObj?.slug || roleObj?.code || '').toLowerCase();
    const isOwner = roleSlug === 'restaurant_admin' || roleSlug === 'owner';

    if (!isSuperAdmin && !isOwner) {
      throw new ForbiddenException('Chỉ Chủ nhà hàng hoặc Super Admin mới có quyền ẩn/hiện đánh giá');
    }

    review.isHidden = !review.isHidden;
    await review.save();

    // Ghi nhật ký kiểm toán (Activity Log)
    this.eventEmitter.emit('activity.log', {
      action: ActivityAction.UPDATE || 'update',
      module: ActivityModule.SYSTEM || 'review',
      entityType: 'Review',
      restaurantId,
      branchId: review.branchId,
      targetId: review._id.toString(),
      userId: user.userId,
      userName: user.fullName || user.username || 'Quản lý',
      userRole: user.role,
      newData: { isHidden: review.isHidden, orderCode: review.orderCode },
      note: `${review.isHidden ? 'Ẩn' : 'Hiện'} đánh giá đơn ${review.orderCode}`,
    });

    return review.toObject();
  }
}
