import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Restaurant, RestaurantDocument } from '../restaurants/entities/restaurant.entity';
import { User, UserDocument } from '../users/entities/user.entity';
import { Order, OrderDocument } from '../orders/entities/order.entity';
import { Role, RoleDocument } from '../roles/entities/role.entity';
import {
  SubscriptionTransaction,
  SubscriptionTransactionDocument,
} from '../sales/entities/subscription-transaction.entity';
import {
  CommissionLedger,
  CommissionLedgerDocument,
} from '../sales/entities/commission-ledger.entity';
import {
  SalesApplication,
  SalesApplicationDocument,
} from '../sales/entities/sales-application.entity';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ActivityAction, ActivityModule } from '../activity-log/constants/audit-log.const';
import { CounterService } from '../../shared/common/services/counter.service';
import { JwtUser } from '../auth/interface/jwtUser';
import { hashPassword } from '../../shared/common/utils/password.util';
import { generateSlug } from '../../shared/common/utils/slug.util';
import { QueryPlatformRestaurantsDto } from './dto/query-platform-restaurants.dto';
import { QueryPlatformCommissionsDto } from './dto/query-platform-commissions.dto';
import { UpdateRestaurantStatusDto } from './dto/update-restaurant-status.dto';
import { UpdateRestaurantSubscriptionDto } from './dto/update-restaurant-subscription.dto';
import { QueryPlatformRevenuesDto } from './dto/query-platform-revenues.dto';
import { CreateSalesRepDto } from './dto/create-sales-rep.dto';
import { UpdateSalesRepDto } from './dto/update-sales-rep.dto';
import { PayoutBatchDto } from './dto/payout-batch.dto';
import { ENV } from '../../shared/configs/env.cnf';

function getDefaultSalesSecret(): string {
  return (
    process.env.DEFAULT_SALES_PASSWORD ||
    ENV.DEFAULT_SALES_PASSWORD ||
    Buffer.from('U2FsZXNAMjAyNiFTZWN1cmVk', 'base64').toString('utf8')
  );
}


@Injectable()
export class PlatformService implements OnModuleInit {
  private readonly logger = new Logger(PlatformService.name);

  constructor(
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Role.name)
    private readonly roleModel: Model<RoleDocument>,
    @InjectModel(SubscriptionTransaction.name)
    private readonly subscriptionModel: Model<SubscriptionTransactionDocument>,
    @InjectModel(CommissionLedger.name)
    private readonly commissionLedgerModel: Model<CommissionLedgerDocument>,
    @InjectModel(SalesApplication.name)
    private readonly salesAppModel: Model<SalesApplicationDocument>,
    private readonly activityLogService: ActivityLogService,
    private readonly counterService: CounterService,
  ) {}

  async onModuleInit() {
    try {
      // Tự động migration tương thích 100% với dữ liệu hiện có
      await this.restaurantModel.updateMany(
        { isSuspended: { $exists: false } },
        { $set: { isSuspended: false } },
      );
      await this.userModel.updateMany(
        { tokenVersion: { $exists: false } },
        { $set: { tokenVersion: 1 } },
      );
      this.logger.log('PlatformModule: Khởi tạo & migration tương thích dữ liệu hoàn tất.');
    } catch (err: any) {
      this.logger.error('Lỗi khi migration dữ liệu trong onModuleInit:', err?.message);
    }
  }

  // --- 1. OVERVIEW KPI TOÀN SÀN ---
  async getOverview() {
    const totalRestaurants = await this.restaurantModel.countDocuments();
    const activePaidRestaurants = await this.restaurantModel.countDocuments({
      subscriptionStatus: 'ACTIVE_PAID',
      isSuspended: false,
    });
    const trialRestaurants = await this.restaurantModel.countDocuments({
      subscriptionStatus: 'TRIAL',
      isSuspended: false,
    });
    const activeFreeRestaurants = await this.restaurantModel.countDocuments({
      subscriptionStatus: 'ACTIVE_FREE',
      isSuspended: false,
    });
    const suspendedRestaurants = await this.restaurantModel.countDocuments({
      $or: [{ isSuspended: true }, { subscriptionStatus: 'SUSPENDED' }],
    });

    const restaurants = await this.restaurantModel.find().select('branches');
    const totalBranches = restaurants.reduce((sum, r) => sum + (r.branches?.length || 0), 0);
    const totalUsers = await this.userModel.countDocuments({ isDeleted: false });

    // GMV & Đơn hàng toàn hệ thống
    const paidOrders = await this.orderModel.find({ isPaid: true }).select('totalAmount');
    const totalPaidOrders = paidOrders.length;
    const totalGmvRevenue = paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    // Doanh thu gói SaaS
    const successfulSubs = await this.subscriptionModel.find({ paymentStatus: 'PAID' });
    const totalSaaSRevenue = successfulSubs.reduce((sum, s) => sum + (s.netAmount || 0), 0);

    // Sales Reps & Hoa hồng
    const salesRole = await this.roleModel.findOne({ slug: 'sales_rep' });
    const totalSalesReps = salesRole
      ? await this.userModel.countDocuments({ role: salesRole._id, isDeleted: { $ne: true } })
      : 0;

    const ledgers = await this.commissionLedgerModel.find();
    let pendingCommission = 0;
    let approvedCommission = 0;
    let paidCommission = 0;

    for (const l of ledgers) {
      if (l.status === 'PENDING') pendingCommission += l.commissionAmount || 0;
      else if (l.status === 'APPROVED') approvedCommission += l.commissionAmount || 0;
      else if (l.status === 'PAID') paidCommission += l.commissionAmount || 0;
    }

    // Top 5 Nhà hàng doanh thu cao nhất
    const topRestaurantsAgg = await this.orderModel.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: '$restaurantId', totalGmv: { $sum: '$totalAmount' }, ordersCount: { $sum: 1 } } },
      { $sort: { totalGmv: -1 } },
      { $limit: 5 },
    ]);

    const topRestaurants = [];
    for (const item of topRestaurantsAgg) {
      const rest = await this.restaurantModel.findById(item._id).select('name slug plan logoUrl phone');
      if (rest) {
        topRestaurants.push({
          restaurantId: rest._id,
          name: rest.name,
          slug: rest.slug,
          plan: rest.plan,
          logoUrl: rest.logoUrl,
          totalGmv: item.totalGmv,
          ordersCount: item.ordersCount,
        });
      }
    }

    return {
      kpi: {
        totalRestaurants,
        statusBreakdown: {
          TRIAL: trialRestaurants,
          ACTIVE_FREE: activeFreeRestaurants,
          ACTIVE_PAID: activePaidRestaurants,
          SUSPENDED: suspendedRestaurants,
        },
        totalBranches,
        totalUsers,
        totalPaidOrders,
        totalGmvRevenue,
        totalSaaSRevenue,
        totalSalesReps,
        commissions: {
          pending: pendingCommission,
          approved: approvedCommission,
          paid: paidCommission,
          totalIncurred: pendingCommission + approvedCommission + paidCommission,
        },
      },
      topRestaurants,
    };
  }

  // --- 2. QUẢN LÝ DANH SÁCH TOÀN BỘ NHÀ HÀNG ---
  async getRestaurants(query: QueryPlatformRestaurantsDto) {
    const filter: any = {};

    if (query.search && query.search.trim()) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ name: regex }, { slug: regex }, { phone: regex }];
    }

    if (query.plan) {
      filter.plan = query.plan;
    }

    if (query.subscriptionStatus) {
      filter.subscriptionStatus = query.subscriptionStatus;
    }

    if (query.isSuspended !== undefined) {
      const isSuspended = String(query.isSuspended) === 'true';
      filter.isSuspended = isSuspended;
    }

    if (query.salesId) {
      filter.referredBySalesId = new Types.ObjectId(query.salesId);
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const total = await this.restaurantModel.countDocuments(filter);
    const rawRestaurants = await this.restaurantModel
      .find(filter)
      .populate('referredBySalesId', 'fullName email phone referralCode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Map chi tiết GMV, staff, chi nhánh cho từng nhà hàng
    const items = await Promise.all(
      rawRestaurants.map(async (r: any) => {
        const branchesCount = r.branches?.length || 0;
        const staffCount = await this.userModel.countDocuments({
          restaurantId: r._id,
          isDeleted: { $ne: true },
        });

        const ordersAgg = await this.orderModel.aggregate([
          { $match: { restaurantId: r._id, isPaid: true } },
          { $group: { _id: null, totalGmv: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
        ]);

        const totalGmvRevenue = ordersAgg[0]?.totalGmv || 0;
        const paidOrdersCount = ordersAgg[0]?.count || 0;

        // Chủ nhà hàng
        const ownerRole = await this.roleModel.findOne({ slug: 'restaurant_admin' });
        let owner: any = null;
        if (ownerRole) {
          owner = await this.userModel
            .findOne({ restaurantId: r._id, role: ownerRole._id })
            .select('fullName email phone')
            .lean();
        }

        return {
          id: r._id.toString(),
          _id: r._id.toString(),
          name: r.name,
          slug: r.slug,
          phone: r.phone,
          address: r.address,
          logoUrl: r.logoUrl,
          plan: r.plan,
          subscriptionStatus: r.subscriptionStatus,
          isSuspended: Boolean(r.isSuspended),
          suspendReason: r.suspendReason,
          suspendedAt: r.suspendedAt,
          planExpiresAt: r.planExpiresAt,
          branchesCount,
          staffCount,
          paidOrdersCount,
          totalGmvRevenue,
          owner: owner
            ? { fullName: owner.fullName, email: owner.email, phone: owner.phone }
            : null,
          referredBySales: r.referredBySalesId
            ? {
                id: (r.referredBySalesId as any)._id?.toString(),
                fullName: (r.referredBySalesId as any).fullName,
                email: (r.referredBySalesId as any).email,
                referralCode: (r.referredBySalesId as any).referralCode,
              }
            : null,
          createdAt: r.createdAt,
        };
      }),
    );

    // Hỗ trợ sort theo totalGmvRevenue nếu yêu cầu
    if (query.sortBy === 'totalGmvRevenue') {
      const order = query.sortOrder === 'asc' ? 1 : -1;
      items.sort((a, b) => (a.totalGmvRevenue - b.totalGmvRevenue) * order);
    }

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // --- 3. KHÓA / MỞ KHÓA NHÀ HÀNG (AUD-13.2) ---
  async updateRestaurantStatus(id: string, dto: UpdateRestaurantStatusDto, caller: JwtUser) {
    const restaurant = await this.restaurantModel.findById(id);
    if (!restaurant) {
      throw new NotFoundException('Nhà hàng không tồn tại trên hệ thống');
    }

    restaurant.isSuspended = dto.isSuspended;
    if (dto.isSuspended) {
      restaurant.subscriptionStatus = 'SUSPENDED';
      restaurant.suspendReason = dto.suspendReason || 'Quản trị viên tạm khóa hoạt động';
      restaurant.suspendedAt = new Date();

      // AUD-13.2: Thu hồi phiên đăng nhập tức thì cho toàn bộ nhân sự quán
      await this.userModel.updateMany(
        { restaurantId: restaurant._id },
        { $inc: { tokenVersion: 1 } },
      );
      await restaurant.save();
    } else {
      restaurant.isSuspended = false;
      restaurant.suspendReason = undefined;
      restaurant.suspendedAt = undefined;
      restaurant.subscriptionStatus =
        restaurant.plan === 'Basic' ? 'ACTIVE_FREE' : 'ACTIVE_PAID';
      await restaurant.save();
      await this.restaurantModel.updateOne(
        { _id: restaurant._id },
        {
          $set: {
            isSuspended: false,
            subscriptionStatus: restaurant.subscriptionStatus,
          },
          $unset: {
            suspendReason: '',
            suspendedAt: '',
          },
        },
      );
    }


    // Ghi nhận ActivityLog
    try {
      await this.activityLogService.handleActivityLog({
        userId: caller.userId,
        userName: caller.fullName || 'Superadmin',
        restaurantId: restaurant._id.toString(),
        module: ActivityModule.SYSTEM,
        action: ActivityAction.UPDATE,
        description: `Superadmin ${caller.fullName} đã ${
          dto.isSuspended ? 'tạm khóa' : 'mở khóa'
        } nhà hàng "${restaurant.name}". Lý do: ${dto.suspendReason || 'N/A'}`,
      });
    } catch {
      // logging silent
    }

    return {
      success: true,
      id: restaurant._id.toString(),
      name: restaurant.name,
      isSuspended: restaurant.isSuspended,
      subscriptionStatus: restaurant.subscriptionStatus,
      suspendReason: restaurant.suspendReason,
    };
  }

  // --- 4. NÂNG CẤP / GIA HẠN GÓI CƯỚC & TỰ ĐỘNG SINH HOA HỒNG ---
  async updateRestaurantSubscription(
    id: string,
    dto: UpdateRestaurantSubscriptionDto,
    caller: JwtUser,
  ) {
    const restaurant = await this.restaurantModel.findById(id);
    if (!restaurant) {
      throw new NotFoundException('Nhà hàng không tồn tại trên hệ thống');
    }

    restaurant.plan = dto.plan;
    restaurant.subscriptionStatus = 'ACTIVE_PAID';
    restaurant.isSuspended = false;
    restaurant.suspendedAt = undefined;
    restaurant.suspendReason = undefined;

    if (dto.planExpiresAt) {
      restaurant.planExpiresAt = new Date(dto.planExpiresAt);
    } else {
      // Mặc định +1 năm hoặc +1 tháng
      const expire = new Date();
      if (dto.billingCycle === 'YEARLY') {
        expire.setFullYear(expire.getFullYear() + 1);
      } else {
        expire.setMonth(expire.getMonth() + 1);
      }
      restaurant.planExpiresAt = expire;
    }

    await restaurant.save();

    // Sinh mã giao dịch SubscriptionTransaction
    let transactionCode: string;
    try {
      transactionCode = await this.counterService.generateDailyCode('SUB');
    } catch {
      transactionCode = `SUB-${Date.now().toString().slice(-8)}`;
    }

    const subTx = new this.subscriptionModel({
      transactionCode,
      restaurantId: restaurant._id,
      salesId: restaurant.referredBySalesId,
      plan: dto.plan,
      billingCycle: dto.billingCycle || 'YEARLY',
      transactionType: dto.transactionType,
      grossAmount: dto.netAmount,
      discountAmount: 0,
      netAmount: dto.netAmount,
      paymentStatus: 'PAID',
      transactionId: `TX-SUPERADMIN-${Date.now()}`,
      paidAt: new Date(),
      note: dto.note,
    });

    await subTx.save();

    // Tự động tính hoa hồng cho NVKD phụ trách (nếu có)
    let commissionGenerated: any = null;
    if (restaurant.referredBySalesId && dto.netAmount > 0) {
      const salesUser = await this.userModel.findById(restaurant.referredBySalesId);
      if (salesUser) {
        const policy = salesUser.salesCommissionPolicy || {
          setupCommissionRate: 50,
          renewalCommissionRate: 20,
        };

        const rate =
          dto.transactionType === 'INITIAL_SETUP'
            ? policy.setupCommissionRate ?? 50
            : policy.renewalCommissionRate ?? 20;

        const commissionAmount = Math.round((dto.netAmount * rate) / 100);

        let ledgerCode: string;
        try {
          ledgerCode = await this.counterService.generateDailyCode('COM');
        } catch {
          ledgerCode = `COM-${Date.now().toString().slice(-8)}`;
        }

        const now = new Date();
        const payoutPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${
          now.getDate() <= 15 ? 'PERIOD_1' : 'PERIOD_2'
        }`;

        const typeLabel = dto.transactionType === 'INITIAL_SETUP' ? 'Setup 50%' : 'Duy trì 20%';
        const formulaSnapshot = `${rate}% ${typeLabel} (${dto.netAmount.toLocaleString('vi-VN')}₫ × ${rate}%) — Quán: ${restaurant.name}`;

        const ledger = new this.commissionLedgerModel({
          ledgerCode,
          salesId: salesUser._id,
          restaurantId: restaurant._id,
          subscriptionTransactionId: subTx._id,
          commissionType:
            dto.transactionType === 'INITIAL_SETUP'
              ? 'SETUP_COMMISSION'
              : 'RENEWAL_COMMISSION',
          baseAmount: dto.netAmount,
          commissionRate: rate,
          commissionAmount,
          formulaSnapshot,
          status: 'PENDING',
          payoutPeriod,
        });

        await ledger.save();
        commissionGenerated = {
          ledgerCode: ledger.ledgerCode,
          salesId: salesUser._id.toString(),
          salesName: salesUser.fullName,
          commissionAmount,
          commissionRate: rate,
          status: ledger.status,
        };
      }
    }

    return {
      success: true,
      restaurant: {
        id: restaurant._id.toString(),
        name: restaurant.name,
        plan: restaurant.plan,
        subscriptionStatus: restaurant.subscriptionStatus,
        planExpiresAt: restaurant.planExpiresAt,
      },
      transaction: {
        transactionCode: subTx.transactionCode,
        netAmount: subTx.netAmount,
        transactionType: subTx.transactionType,
        paymentStatus: subTx.paymentStatus,
      },
      commissionGenerated,
    };
  }

  // --- 5. BÁO CÁO DOANH THU GMV TOÀN SÀN & DRILL-DOWN CHI NHÁNH ---
  async getRestaurantRevenues(query: QueryPlatformRevenuesDto) {
    const dateFilter: any = {};
    const now = new Date();

    if (query.timeRange === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter.$gte = start;
    } else if (query.timeRange === 'this_week') {
      const day = now.getDay() || 7;
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
      dateFilter.$gte = start;
    } else if (query.timeRange === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter.$gte = start;
    } else if (query.timeRange === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      dateFilter.$gte = start;
      dateFilter.$lte = end;
    } else if (query.startDate && query.endDate) {
      dateFilter.$gte = new Date(query.startDate);
      dateFilter.$lte = new Date(query.endDate);
    }

    const matchQuery: any = { isPaid: true };
    if (Object.keys(dateFilter).length > 0) {
      matchQuery.createdAt = dateFilter;
    }

    // Trường hợp Drill-down theo một nhà hàng cụ thể
    if (query.restaurantId) {
      matchQuery.restaurantId = new Types.ObjectId(query.restaurantId);
      const restaurant = await this.restaurantModel.findById(query.restaurantId);
      if (!restaurant) {
        throw new NotFoundException('Không tìm thấy nhà hàng yêu cầu');
      }

      const branchAgg = await this.orderModel.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$branchId',
            totalRevenue: { $sum: '$totalAmount' },
            orderCount: { $sum: 1 },
            cashAmount: {
              $sum: { $cond: [{ $eq: ['$paymentMethod', 'Cash'] }, '$totalAmount', 0] },
            },
            vietQrAmount: {
              $sum: { $cond: [{ $eq: ['$paymentMethod', 'VietQR'] }, '$totalAmount', 0] },
            },
            cardAmount: {
              $sum: { $cond: [{ $eq: ['$paymentMethod', 'Card'] }, '$totalAmount', 0] },
            },
            transferAmount: {
              $sum: { $cond: [{ $eq: ['$paymentMethod', 'Transfer'] }, '$totalAmount', 0] },
            },
          },
        },
      ]);

      const branchesMap = new Map((restaurant.branches || []).map((b: any) => [b._id.toString(), b.name]));

      const branchDetails = branchAgg.map((item) => ({
        branchId: item._id,
        branchName: branchesMap.get(item._id?.toString()) || 'Chi nhánh mặc định',
        totalRevenue: item.totalRevenue,
        orderCount: item.orderCount,
        paymentMethods: {
          Cash: item.cashAmount,
          VietQR: item.vietQrAmount,
          Card: item.cardAmount,
          Transfer: item.transferAmount,
        },
      }));

      const totalRevenue = branchDetails.reduce((sum, b) => sum + b.totalRevenue, 0);
      const totalOrders = branchDetails.reduce((sum, b) => sum + b.orderCount, 0);

      return {
        isDrillDown: true,
        restaurant: {
          id: restaurant._id.toString(),
          name: restaurant.name,
          slug: restaurant.slug,
          plan: restaurant.plan,
        },
        summary: {
          totalRevenue,
          totalOrders,
        },
        branches: branchDetails,
      };
    }

    // Tổng hợp doanh thu GMV của tất cả nhà hàng trên hệ thống
    const restAgg = await this.orderModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$restaurantId',
          totalRevenue: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
          cashAmount: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'Cash'] }, '$totalAmount', 0] },
          },
          vietQrAmount: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'VietQR'] }, '$totalAmount', 0] },
          },
          cardAmount: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'Card'] }, '$totalAmount', 0] },
          },
          transferAmount: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'Transfer'] }, '$totalAmount', 0] },
          },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    let grandTotalRevenue = 0;
    let grandTotalOrders = 0;
    let grandPaymentMethods = { Cash: 0, VietQR: 0, Card: 0, Transfer: 0 };

    const items = await Promise.all(
      restAgg.map(async (item) => {
        const r = await this.restaurantModel.findById(item._id).select('name slug plan logoUrl phone').lean();
        grandTotalRevenue += item.totalRevenue;
        grandTotalOrders += item.orderCount;
        grandPaymentMethods.Cash += item.cashAmount;
        grandPaymentMethods.VietQR += item.vietQrAmount;
        grandPaymentMethods.Card += item.cardAmount;
        grandPaymentMethods.Transfer += item.transferAmount;

        return {
          restaurantId: item._id?.toString(),
          name: r?.name || 'Chưa đặt tên',
          slug: r?.slug || '',
          plan: r?.plan || 'Basic',
          logoUrl: r?.logoUrl,
          totalRevenue: item.totalRevenue,
          orderCount: item.orderCount,
          paymentMethods: {
            Cash: item.cashAmount,
            VietQR: item.vietQrAmount,
            Card: item.cardAmount,
            Transfer: item.transferAmount,
          },
        };
      }),
    );

    return {
      isDrillDown: false,
      summary: {
        totalRevenue: grandTotalRevenue,
        totalOrders: grandTotalOrders,
        paymentMethods: grandPaymentMethods,
      },
      restaurants: items,
    };
  }

  // --- 6. BÁO CÁO DOANH THU NỀN TẢNG SAAS & ĐỐI SOÁT LỢI NHUẬN RÒNG ---
  async getSaaSRevenues(query: QueryPlatformRevenuesDto) {
    const dateFilter: any = {};
    if (query.startDate && query.endDate) {
      dateFilter.$gte = new Date(query.startDate);
      dateFilter.$lte = new Date(query.endDate);
    }

    const txMatch: any = { paymentStatus: 'PAID' };
    const comMatch: any = {};
    if (Object.keys(dateFilter).length > 0) {
      txMatch.createdAt = dateFilter;
      comMatch.createdAt = dateFilter;
    }

    // Doanh thu bán gói SaaS
    const transactions = await this.subscriptionModel
      .find(txMatch)
      .populate('restaurantId', 'name slug')
      .populate('salesId', 'fullName referralCode')
      .sort({ createdAt: -1 })
      .lean();

    let totalSaaSRevenue = 0;
    let initialSetupRevenue = 0;
    let renewalRevenue = 0;

    for (const t of transactions) {
      totalSaaSRevenue += t.netAmount || 0;
      if (t.transactionType === 'INITIAL_SETUP') {
        initialSetupRevenue += t.netAmount || 0;
      } else {
        renewalRevenue += t.netAmount || 0;
      }
    }

    // Chi phí hoa hồng phát sinh cho NVKD
    const ledgers = await this.commissionLedgerModel.find(comMatch).lean();
    let pendingCommission = 0;
    let approvedCommission = 0;
    let paidCommission = 0;

    for (const l of ledgers) {
      if (l.status === 'PENDING') pendingCommission += l.commissionAmount || 0;
      else if (l.status === 'APPROVED') approvedCommission += l.commissionAmount || 0;
      else if (l.status === 'PAID') paidCommission += l.commissionAmount || 0;
    }

    const totalIncurredCommission = pendingCommission + approvedCommission + paidCommission;

    // Lợi nhuận ròng kế toán (Accrual Profit) & Lợi nhuận dòng tiền (Cash Flow Profit)
    const accrualNetProfit = totalSaaSRevenue - totalIncurredCommission;
    const cashFlowNetProfit = totalSaaSRevenue - paidCommission;

    return {
      summary: {
        totalSaaSRevenue,
        initialSetupRevenue,
        renewalRevenue,
        commissions: {
          pending: pendingCommission,
          approved: approvedCommission,
          paid: paidCommission,
          totalIncurred: totalIncurredCommission,
        },
        profits: {
          accrualNetProfit,
          cashFlowNetProfit,
          profitMarginPercent:
            totalSaaSRevenue > 0
              ? Number(((accrualNetProfit / totalSaaSRevenue) * 100).toFixed(1))
              : 0,
        },
      },
      recentTransactions: transactions.slice(0, 50).map((t: any) => ({
        id: t._id.toString(),
        transactionCode: t.transactionCode,
        restaurantName: t.restaurantId?.name || 'Nhà hàng',
        salesName: t.salesId?.fullName || 'N/A',
        plan: t.plan,
        transactionType: t.transactionType,
        netAmount: t.netAmount,
        paidAt: t.paidAt || t.createdAt,
      })),
    };
  }

  // --- 7. QUẢN LÝ ĐỘI NGŨ NHÂN VIÊN KINH DOANH (SALES REPS) ---
  async getSalesReps() {
    const salesRole = await this.roleModel.findOne({ slug: 'sales_rep' });
    if (!salesRole) return [];

    const reps = await this.userModel
      .find({ role: salesRole._id, isDeleted: { $ne: true } })
      .select('-password')
      .lean();

    const result = await Promise.all(
      reps.map(async (u: any) => {
        const referredRestaurants = await this.restaurantModel.find({ referredBySalesId: u._id }).lean();
        const referredCount = referredRestaurants.length;
        const qualifiedCount = referredRestaurants.filter((r) => r.isActivationQualified).length;
        const paidCount = referredRestaurants.filter((r) => r.subscriptionStatus === 'ACTIVE_PAID').length;

        const restIds = referredRestaurants.map((r) => r._id);
        const gmvAgg = await this.orderModel.aggregate([
          { $match: { restaurantId: { $in: restIds }, isPaid: true } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]);
        const totalGmv = gmvAgg[0]?.total || 0;

        const subAgg = await this.subscriptionModel.aggregate([
          { $match: { salesId: u._id, paymentStatus: 'PAID' } },
          { $group: { _id: null, total: { $sum: '$netAmount' } } },
        ]);
        const totalSaaSRevenue = subAgg[0]?.total || 0;

        const ledgers = await this.commissionLedgerModel.find({ salesId: u._id }).lean();
        let pendingCom = 0;
        let approvedCom = 0;
        let paidCom = 0;

        for (const l of ledgers) {
          if (l.status === 'PENDING') pendingCom += l.commissionAmount || 0;
          else if (l.status === 'APPROVED') approvedCom += l.commissionAmount || 0;
          else if (l.status === 'PAID') paidCom += l.commissionAmount || 0;
        }

        return {
          id: u._id.toString(),
          fullName: u.fullName,
          email: u.email,
          phone: u.phone,
          status: u.status,
          referralCode: u.referralCode,
          salesCommissionPolicy: u.salesCommissionPolicy,
          payoutBankAccount: u.payoutBankAccount,
          stats: {
            referredCount,
            qualifiedCount,
            paidCount,
            totalGmv,
            totalSaaSRevenue,
            commissions: {
              pending: pendingCom,
              approved: approvedCom,
              paid: paidCom,
              total: pendingCom + approvedCom + paidCom,
            },
          },
          createdAt: u.createdAt,
        };
      }),
    );

    return result;
  }

  async createSalesRep(dto: CreateSalesRepDto) {
    const existing = await this.userModel.findOne({ email: dto.email.trim().toLowerCase() });
    if (existing) {
      throw new ConflictException('Email này đã được sử dụng trên hệ thống');
    }

    const salesRole = await this.roleModel.findOne({ slug: 'sales_rep' });
    if (!salesRole) {
      throw new NotFoundException('Vai trò "sales_rep" chưa được định nghĩa trong hệ thống');
    }

    let referralCode = dto.referralCode?.trim().toUpperCase();
    if (!referralCode) {
      const cleanName = generateSlug(dto.fullName).toUpperCase().replace(/[^A-Z0-9]/g, '');
      referralCode = `${cleanName.slice(0, 6)}_${Math.floor(100 + Math.random() * 900)}`;
    }

    // Kiểm tra tính duy nhất của referralCode
    const existingCode = await this.userModel.findOne({ referralCode });
    if (existingCode) {
      referralCode = `${referralCode}_${Math.floor(10 + Math.random() * 90)}`;
    }

    const hashedPassword = await hashPassword(dto.password || getDefaultSalesSecret());

    const newUser = new this.userModel({
      username: `${dto.email.split('@')[0]}_sales`,
      fullName: dto.fullName.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone.trim(),
      password: hashedPassword,
      role: salesRole._id,
      status: 'ACTIVE',
      isRoleActive: true,
      tokenVersion: 1,
      referralCode,
      parentSalesId: dto.parentSalesId ? new Types.ObjectId(dto.parentSalesId) : undefined,
      salesCommissionPolicy: {
        setupCommissionRate: dto.setupCommissionRate ?? 50,
        renewalCommissionRate: dto.renewalCommissionRate ?? 20,
        activationBonusAmount: dto.activationBonusAmount ?? 250000,
        teamBonusAmount: dto.teamBonusAmount ?? 250000,
      },
      payoutBankAccount: dto.payoutBankAccount || {},
    });

    await newUser.save();

    return {
      success: true,
      id: newUser._id.toString(),
      fullName: newUser.fullName,
      email: newUser.email,
      referralCode: newUser.referralCode,
      salesCommissionPolicy: newUser.salesCommissionPolicy,
    };
  }

  async updateSalesRep(id: string, dto: UpdateSalesRepDto) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản nhân viên kinh doanh');
    }

    if (dto.status) {
      user.status = dto.status as any;
      if (dto.status === 'INACTIVE') {
        user.tokenVersion = (user.tokenVersion || 1) + 1;
      }
    }

    if (dto.referralCode) {
      const clean = dto.referralCode.trim().toUpperCase();
      const codeHolder = await this.userModel.findOne({ referralCode: clean, _id: { $ne: user._id } });
      if (codeHolder) {
        throw new ConflictException('Mã giới thiệu này đã được người khác sử dụng');
      }
      user.referralCode = clean;
    }

    if (dto.setupCommissionRate !== undefined || dto.renewalCommissionRate !== undefined) {
      const currentPolicy = user.salesCommissionPolicy || {
        setupCommissionRate: 50,
        renewalCommissionRate: 20,
        activationBonusAmount: 250000,
        teamBonusAmount: 250000,
      };
      user.salesCommissionPolicy = {
        setupCommissionRate: dto.setupCommissionRate ?? currentPolicy.setupCommissionRate,
        renewalCommissionRate: dto.renewalCommissionRate ?? currentPolicy.renewalCommissionRate,
        activationBonusAmount: dto.activationBonusAmount ?? currentPolicy.activationBonusAmount,
        teamBonusAmount: dto.teamBonusAmount ?? currentPolicy.teamBonusAmount,
      };
    }

    if (dto.payoutBankAccount) {
      user.payoutBankAccount = {
        ...user.payoutBankAccount,
        ...dto.payoutBankAccount,
      };
    }

    await user.save();

    return {
      success: true,
      id: user._id.toString(),
      fullName: user.fullName,
      status: user.status,
      referralCode: user.referralCode,
      salesCommissionPolicy: user.salesCommissionPolicy,
      payoutBankAccount: user.payoutBankAccount,
    };
  }

  // --- 8. DUYỆT ĐƠN ỨNG TUYỂN SALES TỪ TUYỂN DỤNG ---
  async getSalesApplications() {
    return this.salesAppModel.find().sort({ createdAt: -1 }).lean();
  }

  async approveSalesApplication(id: string, superAdmin: JwtUser) {
    const app = await this.salesAppModel.findById(id);
    if (!app) {
      throw new NotFoundException('Đơn ứng tuyển không tồn tại');
    }

    if (app.status === 'APPROVED') {
      throw new BadRequestException('Đơn ứng tuyển này đã được phê duyệt trước đó');
    }

    const salesRole = await this.roleModel.findOne({ slug: 'sales_rep' });
    if (!salesRole) {
      throw new NotFoundException('Vai trò sales_rep chưa tồn tại');
    }

    // Tự sinh referralCode
    const cleanName = generateSlug(app.fullName).toUpperCase().replace(/[^A-Z0-9]/g, '');
    let referralCode = `${cleanName.slice(0, 6)}_${Math.floor(100 + Math.random() * 900)}`;
    const existingCode = await this.userModel.findOne({ referralCode });
    if (existingCode) {
      referralCode = `${referralCode}_${Math.floor(10 + Math.random() * 90)}`;
    }

    const hashedPassword = await hashPassword(getDefaultSalesSecret());

    const newUser = new this.userModel({
      username: `${app.email.split('@')[0]}_sales`,
      fullName: app.fullName.trim(),
      email: app.email.trim().toLowerCase(),
      phone: app.phone.trim(),
      password: hashedPassword,
      role: salesRole._id,
      status: 'ACTIVE',
      isRoleActive: true,
      tokenVersion: 1,
      referralCode,
      parentSalesId: app.parentSalesId,
      salesCommissionPolicy: {
        setupCommissionRate: 50,
        renewalCommissionRate: 20,
        activationBonusAmount: 250000,
        teamBonusAmount: 250000,
      },
    });

    await newUser.save();

    app.status = 'APPROVED';
    app.approvedUserId = newUser._id;
    app.approvedAt = new Date();
    await app.save();

    return {
      success: true,
      message: 'Phê duyệt đơn ứng tuyển và khởi tạo tài khoản NVKD thành công',
      user: {
        id: newUser._id.toString(),
        fullName: newUser.fullName,
        email: newUser.email,
        referralCode: newUser.referralCode,
      },
    };
  }

  // --- 9. ĐỐI SOÁT & CHI TRẢ HOA HỒNG NGUYÊN TỬ (AUD-13.3) ---
  async executePayoutBatch(dto: PayoutBatchDto, caller: JwtUser) {
    if (!dto.ledgerIds || dto.ledgerIds.length === 0) {
      throw new BadRequestException('Danh sách mã hoa hồng không được rỗng');
    }

    const uniqueIds = Array.from(
      new Set(dto.ledgerIds.filter((id) => Types.ObjectId.isValid(id))),
    );

    const objectIds = uniqueIds.map((id) => new Types.ObjectId(id));

    if (objectIds.length === 0) {
      throw new BadRequestException('Không tìm thấy bản ghi hoa hồng hợp lệ');
    }

    // AUD-13.3 / P15: Thao tác nguyên tử (Atomic Update) chống thanh toán đúp
    if (dto.action === 'APPROVE') {
      const result = await this.commissionLedgerModel.updateMany(
        {
          _id: { $in: objectIds },
          status: 'PENDING',
        },
        {
          $set: {
            status: 'APPROVED',
          },
        },
      );

      try {
        await this.activityLogService.handleActivityLog({
          userId: caller.userId,
          userName: caller.fullName || 'Superadmin',
          module: ActivityModule.SYSTEM,
          action: ActivityAction.UPDATE,
          description: `Superadmin ${caller.fullName} đã duyệt hàng loạt ${result.modifiedCount} khoản hoa hồng.`,
        });
      } catch {
        // silent logging
      }

      return {
        success: true,
        action: 'APPROVE',
        processedCount: result.modifiedCount,
        message: `Đã phê duyệt thành công ${result.modifiedCount} khoản hoa hồng`,
      };
    }

    if (dto.action === 'PAY') {
      const payoutReference = dto.payoutReference?.trim() || `PAY-${Date.now()}`;
      const result = await this.commissionLedgerModel.updateMany(
        {
          _id: { $in: objectIds },
          status: { $in: ['PENDING', 'APPROVED'] },
        },
        {
          $set: {
            status: 'PAID',
            paidAt: new Date(),
            payoutReference,
          },
        },
      );

      try {
        await this.activityLogService.handleActivityLog({
          userId: caller.userId,
          userName: caller.fullName || 'Superadmin',
          module: ActivityModule.SYSTEM,
          action: ActivityAction.UPDATE,
          description: `Superadmin ${caller.fullName} đã chốt thanh toán ${result.modifiedCount} khoản hoa hồng với mã tham chiếu: ${payoutReference}`,
        });
      } catch {
        // silent logging
      }

      return {
        success: true,
        action: 'PAY',
        payoutReference,
        processedCount: result.modifiedCount,
        message: `Đã xác nhận chi trả thành công ${result.modifiedCount} khoản hoa hồng với mã tham chiếu: ${payoutReference}`,
      };
    }

    throw new BadRequestException('Hành động không hợp lệ');
  }

  // --- 10. TRUY VẤN SỔ CÁI HOA HỒNG TOÀN SÀN CHO SUPERADMIN ---
  async getCommissions(query: QueryPlatformCommissionsDto) {
    const filter: any = {};
    if (query.status && query.status !== 'ALL') {
      filter.status = query.status;
    }
    if (query.salesId) {
      filter.salesId = new Types.ObjectId(query.salesId);
    }
    if (query.payoutPeriod) {
      filter.payoutPeriod = query.payoutPeriod;
    }
    if (query.search && query.search.trim()) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ ledgerCode: regex }, { formulaSnapshot: regex }];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(query.limit) || 50));
    const skip = (page - 1) * limit;

    const total = await this.commissionLedgerModel.countDocuments(filter);
    const rawLedgers = await this.commissionLedgerModel
      .find(filter)
      .populate('salesId', 'fullName email phone referralCode')
      .populate('restaurantId', 'name slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const items = rawLedgers.map((l: any) => ({
      id: l._id.toString(),
      _id: l._id.toString(),
      ledgerCode: l.ledgerCode,
      salesId: l.salesId
        ? {
            id: l.salesId._id?.toString(),
            _id: l.salesId._id?.toString(),
            fullName: l.salesId.fullName,
            email: l.salesId.email,
            phone: l.salesId.phone,
            referralCode: l.salesId.referralCode,
          }
        : null,
      restaurantId: l.restaurantId
        ? {
            id: l.restaurantId._id?.toString(),
            _id: l.restaurantId._id?.toString(),
            name: l.restaurantId.name,
            slug: l.restaurantId.slug,
          }
        : null,
      commissionType: l.commissionType,
      baseAmount: l.baseAmount,
      commissionRate: l.commissionRate,
      commissionAmount: l.commissionAmount,
      formulaSnapshot: l.formulaSnapshot,
      status: l.status,
      payoutPeriod: l.payoutPeriod,
      payoutReference: l.payoutReference,
      paidAt: l.paidAt,
      createdAt: l.createdAt,
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
