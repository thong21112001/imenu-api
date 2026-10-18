import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SalesApplication, SalesApplicationDocument } from '../entities/sales-application.entity';
import {
  SubscriptionTransaction,
  SubscriptionTransactionDocument,
} from '../entities/subscription-transaction.entity';
import {
  CommissionLedger,
  CommissionLedgerDocument,
} from '../entities/commission-ledger.entity';
import { User, UserDocument } from '../../users/entities/user.entity';
import { Restaurant, RestaurantDocument } from '../../restaurants/entities/restaurant.entity';
import { Role, RoleDocument } from '../../roles/entities/role.entity';
import { Table, TableDocument } from '../../tables/entities/table.entity';
import { TableZone, TableZoneDocument } from '../../tables/entities/table-zone.entity';
import { MenuCategory, MenuCategoryDocument } from '../../menu/entities/menu-category.entity';
import { MenuItem, MenuItemDocument } from '../../menu/entities/menu-item.entity';
import { CounterService } from '../../../shared/common/services/counter.service';
import { ApplyReferralDto } from '../dto/apply-referral.dto';
import { ProcessSubscriptionDto } from '../dto/process-subscription.dto';
import { CreateAssistedRestaurantDto } from '../dto/create-assisted-restaurant.dto';
import { UpdatePayoutBankDto } from '../dto/update-payout-bank.dto';
import { QueryCommissionsDto } from '../dto/query-commissions.dto';
import { QueryReferredRestaurantsDto } from '../dto/query-referred-restaurants.dto';
import { hashPassword } from '../../../shared/common/utils/password.util';
import { generateSlug } from '../../../shared/common/utils/slug.util';
import { JwtUser, isSuperAdminUser } from '../../auth/interface/jwtUser';

@Injectable()
export class SalesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    @InjectModel(SalesApplication.name)
    private readonly applicationModel: Model<SalesApplicationDocument>,
    @InjectModel(SubscriptionTransaction.name)
    private readonly subscriptionModel: Model<SubscriptionTransactionDocument>,
    @InjectModel(CommissionLedger.name)
    private readonly commissionLedgerModel: Model<CommissionLedgerDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectModel(Role.name)
    private readonly roleModel: Model<RoleDocument>,
    @InjectModel(Table.name)
    private readonly tableModel: Model<TableDocument>,
    @InjectModel(TableZone.name)
    private readonly tableZoneModel: Model<TableZoneDocument>,
    @InjectModel(MenuCategory.name)
    private readonly categoryModel: Model<MenuCategoryDocument>,
    @InjectModel(MenuItem.name)
    private readonly menuItemModel: Model<MenuItemDocument>,
    private readonly counterService: CounterService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.seedDemoSalesAccounts();
    } catch (err: any) {
      this.logger.warn(`Lỗi khởi tạo tài khoản NVKD demo: ${err?.message}`);
    }
  }

  /**
   * Tính toán kỳ đối soát hoa hồng: YYYY-MM-K1 (ngày 01-15) hoặc YYYY-MM-K2 (ngày 16-hết tháng)
   */
  private resolvePayoutPeriod(date: Date = new Date()): string {
    const yyyy = date.getFullYear();
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const period = date.getDate() <= 15 ? 'K1' : 'K2';
    return `${yyyy}-${mm}-${period}`;
  }

  /**
   * Sinh mã referralCode chuẩn: IMENU-TENVIETHOA (thêm số nếu trùng)
   */
  async generateUniqueReferralCode(fullName: string): Promise<string> {
    const cleanName = generateSlug(fullName).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const baseCode = cleanName ? `IMENU-${cleanName}` : 'IMENU-SALES';
    let code = baseCode;
    let attempt = 0;
    while (await this.userModel.exists({ referralCode: code })) {
      attempt++;
      code = `${baseCode}${attempt.toString().padStart(2, '0')}`;
    }
    return code;
  }

  // ===========================================================================
  // 1. PUBLIC REFERRALS & APPLICATION
  // ===========================================================================

  /**
   * Kiểm tra tính hợp lệ của mã giới thiệu
   */
  async validateReferralCode(code: string) {
    if (!code || typeof code !== 'string') {
      return {
        valid: false,
        message: 'Mã giới thiệu không hợp lệ',
      };
    }

    const cleanCode = code.trim().toUpperCase();
    const user = await this.userModel
      .findOne({ referralCode: cleanCode, isDeleted: { $ne: true } })
      .populate('role');

    if (!user) {
      return {
        valid: false,
        message: 'Mã giới thiệu không tồn tại hoặc đã hết hiệu lực',
      };
    }

    const roleSlug = (user.role as any)?.slug || (user.role as any)?.name || '';
    if (roleSlug !== 'sales_rep' && roleSlug !== 'system_admin' && roleSlug !== 'super_admin') {
      return {
        valid: false,
        message: 'Tài khoản không thuộc đối tác kinh doanh iMenu',
      };
    }

    return {
      valid: true,
      salesId: user._id.toString(),
      fullName: user.fullName,
      phone: user.phone ? user.phone.slice(0, 4) + '***' + user.phone.slice(-3) : '',
      referralCode: user.referralCode,
    };
  }

  /**
   * Tiếp nhận đơn ứng tuyển NVKD / Đối tác kinh doanh (AUD-12.6: Chống spam 24h)
   */
  async submitApplication(dto: ApplyReferralDto) {
    const phone = dto.phone.trim();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentApplication = await this.applicationModel.findOne({
      phone,
      createdAt: { $gte: oneDayAgo },
    });

    if (recentApplication) {
      throw new BadRequestException(
        'Số điện thoại này đã gửi đơn ứng tuyển trong vòng 24 giờ qua. Bộ phận nhân sự sẽ liên hệ với bạn trong thời gian sớm nhất!',
      );
    }

    let parentCode = dto.parentReferralCode ? dto.parentReferralCode.trim().toUpperCase() : undefined;
    let parentSalesId: Types.ObjectId | undefined = undefined;
    if (parentCode) {
      const parentUser = await this.userModel.findOne({ referralCode: parentCode, isDeleted: { $ne: true } });
      if (!parentUser) {
        parentCode = undefined;
      } else {
        parentSalesId = parentUser._id;
      }
    }

    const application = await this.applicationModel.create({
      fullName: dto.fullName.trim(),
      phone: phone,
      email: dto.email.trim().toLowerCase(),
      city: dto.city ? dto.city.trim() : '',
      note: dto.note ? dto.note.trim() : '',
      parentReferralCode: parentCode,
      parentSalesId: parentSalesId,
      status: 'PENDING',
    });

    return {
      success: true,
      message: 'Đơn đăng ký ứng tuyển đã được tiếp nhận thành công. Chuyên viên iMenu sẽ liên hệ trong 24h!',
      applicationId: application._id.toString(),
    };
  }

  /**
   * SuperAdmin phê duyệt đơn ứng tuyển ➔ Tự động sinh User sales_rep
   */
  async approveApplication(applicationId: string, caller?: JwtUser) {
    const app = await this.applicationModel.findById(applicationId);
    if (!app) {
      throw new NotFoundException('Không tìm thấy đơn ứng tuyển');
    }

    if (app.status === 'APPROVED') {
      throw new BadRequestException('Đơn ứng tuyển này đã được phê duyệt trước đó');
    }

    // Kiểm tra email xem đã đăng ký chưa
    const existingUser = await this.userModel.findOne({ email: app.email });
    if (existingUser) {
      throw new ConflictException(`Email ${app.email} đã được đăng ký trên hệ thống`);
    }

    let salesRole = await this.roleModel.findOne({ slug: 'sales_rep' });
    if (!salesRole) {
      salesRole = await this.roleModel.create({
        name: 'Nhân viên Kinh doanh / Đối tác Phát triển (Sales Rep)',
        slug: 'sales_rep',
        isSystem: true,
        color: '#0d9488',
        description: 'Phát triển thị trường, kết nối nhà hàng đối tác và quản lý hoa hồng tiếp thị liên kết',
        permissions: [],
        permissionIds: ['perm-sales-view', 'perm-sales-create-restaurant'],
      });
    }

    // Phân giải parentSalesId nếu có parentReferralCode
    let parentSalesId: Types.ObjectId | undefined;
    if (app.parentReferralCode) {
      const parentUser = await this.userModel.findOne({ referralCode: app.parentReferralCode.toUpperCase() });
      if (parentUser) {
        parentSalesId = parentUser._id;
      }
    }

    const referralCode = await this.generateUniqueReferralCode(app.fullName);
    const defaultPassword = process.env.DEMO_USER_PASSWORD || 'Demo@123456';
    const hashedPassword = await hashPassword(defaultPassword);

    const generatedUsername = `${app.email.split('@')[0]}_sales`;

    const newUser = await this.userModel.create({
      username: generatedUsername,
      email: app.email,
      password: hashedPassword,
      fullName: app.fullName,
      phone: app.phone,
      role: salesRole._id,
      referralCode,
      parentSalesId,
      salesCommissionPolicy: {
        setupCommissionRate: 50,
        renewalCommissionRate: 20,
        activationBonusAmount: 250000,
        teamBonusAmount: 250000,
      },
      payoutBankAccount: {},
      isRoleActive: true,
      status: 'ACTIVE',
    });

    app.status = 'APPROVED';
    app.approvedUserId = newUser._id;
    app.approvedAt = new Date();
    await app.save();

    return {
      success: true,
      message: 'Đã phê duyệt đơn ứng tuyển thành công',
      user: {
        id: newUser._id.toString(),
        fullName: newUser.fullName,
        email: newUser.email,
        referralCode: newUser.referralCode,
        role: 'SALES_REP',
      },
    };
  }

  // ===========================================================================
  // 2. SUBSCRIPTION TRANSACTIONS & COMMISSION ENGINE (TẦNG 1 & TẦNG 2)
  // ===========================================================================

  /**
   * Xử lý giao dịch gói dịch vụ SaaS (Setup, Gia hạn, Nâng cấp) và tính hoa hồng tương ứng
   */
  async processSubscriptionTransaction(dto: ProcessSubscriptionDto, caller?: JwtUser) {
    const restaurant = await this.restaurantModel.findById(dto.restaurantId);
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy nhà hàng');
    }

    // Kiểm tra trùng lặp transactionId (AUD-12.1 Concurrency & Idempotency)
    if (dto.transactionId) {
      const existingTx = await this.subscriptionModel.findOne({ transactionId: dto.transactionId });
      if (existingTx) {
        throw new BadRequestException('Mã giao dịch đăng ký gói (transactionId) đã tồn tại trên hệ thống');
      }
    }

    const plan = dto.plan || (dto.planType ? (dto.planType === 'SETUP' ? 'Standard' : 'Professional') : 'Standard');
    let transactionType: 'INITIAL_SETUP' | 'RENEWAL' | 'UPGRADE' = 'INITIAL_SETUP';
    if (dto.transactionType) {
      transactionType = dto.transactionType === 'SETUP' ? 'INITIAL_SETUP' : (dto.transactionType as 'INITIAL_SETUP' | 'RENEWAL' | 'UPGRADE');
    } else if (dto.planType) {
      transactionType = dto.planType === 'SETUP' ? 'INITIAL_SETUP' : dto.planType === 'RENEWAL' ? 'RENEWAL' : 'INITIAL_SETUP';
    }

    const grossAmount = dto.grossAmount !== undefined ? dto.grossAmount : (dto.amount || 0);
    const netAmount = dto.netAmount !== undefined ? dto.netAmount : grossAmount - (dto.discountAmount || 0);
    const billingCycle = dto.billingCycle || (dto.durationMonths && dto.durationMonths >= 12 ? 'YEARLY' : 'MONTHLY');
    const transactionCode = await this.counterService.generateDailyCode('SUB', restaurant._id.toString());

    const transaction = await this.subscriptionModel.create({
      transactionCode,
      transactionId: dto.transactionId,
      restaurantId: restaurant._id,
      salesId: restaurant.referredBySalesId || undefined,
      plan,
      billingCycle,
      transactionType,
      grossAmount,
      discountAmount: dto.discountAmount || 0,
      netAmount,
      paymentStatus: dto.paymentStatus || 'PAID',
      paidAt: new Date(),
    });

    // Cập nhật trạng thái nhà hàng
    const daysToAdd = billingCycle === 'YEARLY' ? 365 : 30;
    const now = new Date();
    const currentExpiry = restaurant.planExpiresAt && restaurant.planExpiresAt > now ? restaurant.planExpiresAt : now;
    const newExpiresAt = new Date(currentExpiry.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

    restaurant.subscriptionStatus = 'ACTIVE';
    restaurant.plan = plan;
    restaurant.planExpiresAt = newExpiresAt;
    await restaurant.save();

    // Tự động kích hoạt tính hoa hồng nếu có NVKD phụ trách
    let commissionResult: any = null;
    if (restaurant.referredBySalesId && transaction.paymentStatus === 'PAID') {
      commissionResult = await this.recordSubscriptionCommission(transaction, restaurant);
    }

    return {
      success: true,
      transaction,
      restaurant: {
        id: restaurant._id.toString(),
        name: restaurant.name,
        plan: restaurant.plan,
        subscriptionStatus: restaurant.subscriptionStatus,
        planExpiresAt: restaurant.planExpiresAt,
      },
      commission: commissionResult,
    };
  }

  /**
   * Ghi sổ hoa hồng Tầng 1 (50% Setup) hoặc Tầng 2 (20% Renewal)
   */
  private async recordSubscriptionCommission(
    transaction: SubscriptionTransactionDocument,
    restaurant: RestaurantDocument,
  ) {
    if (!restaurant.referredBySalesId) return null;

    const salesUser = await this.userModel.findById(restaurant.referredBySalesId);
    if (!salesUser) return null;

    const policy = salesUser.salesCommissionPolicy || {
      setupCommissionRate: 50,
      renewalCommissionRate: 20,
    };

    let commissionType: string;
    let rate: number;
    let typeLabel: string;

    if (transaction.transactionType === 'INITIAL_SETUP') {
      commissionType = 'SETUP_COMMISSION';
      rate = policy.setupCommissionRate ?? 50;
      typeLabel = 'Khởi tạo / Setup gói trả phí';
    } else {
      commissionType = 'RENEWAL_COMMISSION';
      rate = policy.renewalCommissionRate ?? 20;
      typeLabel = 'Duy trì hằng năm';
    }

    const commissionAmount = Math.round((transaction.netAmount * rate) / 100);
    const formulaSnapshot = `${rate}% ${typeLabel} (${transaction.netAmount.toLocaleString('vi-VN')}₫ × ${rate}%) — Quán: ${restaurant.name}`;
    const payoutPeriod = this.resolvePayoutPeriod(transaction.paidAt || new Date());
    const ledgerCode = await this.counterService.generateDailyCode('COM', salesUser._id.toString());

    try {
      const ledger = await this.commissionLedgerModel.findOneAndUpdate(
        {
          subscriptionTransactionId: transaction._id,
          commissionType,
          salesId: salesUser._id,
        },
        {
          $setOnInsert: {
            ledgerCode,
            salesId: salesUser._id,
            restaurantId: restaurant._id,
            subscriptionTransactionId: transaction._id,
            commissionType,
            baseAmount: transaction.netAmount,
            commissionRate: rate,
            commissionAmount,
            formulaSnapshot,
            status: 'APPROVED',
            payoutPeriod,
            paidAt: undefined,
          },
        },
        { upsert: true, new: true },
      );
      return ledger;
    } catch (err: any) {
      if (err.code === 11000) {
        return await this.commissionLedgerModel.findOne({
          subscriptionTransactionId: transaction._id,
          commissionType,
          salesId: salesUser._id,
        });
      }
      throw err;
    }
  }

  // ===========================================================================
  // 3. THƯỞNG MỞ MỚI VẬN HÀNH & THƯỞNG ĐỘI NGŨ CTV (TẦNG 3 & TẦNG 4)
  // ===========================================================================

  @OnEvent('order.payment_completed')
  async handleOrderPaymentEvent(payload: { restaurantId: string; order?: any }) {
    if (payload?.restaurantId) {
      await this.handleBillPaymentForActivationBonus(payload.restaurantId, payload.order);
    }
  }

  /**
   * Kích hoạt khi có bill chuyển trạng thái PAID:
   * Tăng biến đếm hóa đơn thanh toán thật và kích hoạt thưởng 250K khi đạt ngưỡng cấu hình (AUD-12.2)
   */
  async onBillPaid(restaurantId: string | Types.ObjectId, bill?: any) {
    return this.handleBillPaymentForActivationBonus(restaurantId, bill);
  }

  async handleBillPaymentForActivationBonus(restaurantId: string | Types.ObjectId, bill?: any) {
    const restaurant = await this.restaurantModel.findById(restaurantId);
    if (!restaurant || !restaurant.referredBySalesId) {
      return null;
    }

    // 1. Tăng nguyên tử activationPaidBillsCount
    const updated = await this.restaurantModel.findByIdAndUpdate(
      restaurantId,
      { $inc: { activationPaidBillsCount: 1 } },
      { new: true },
    );

    const threshold = Number(process.env.ACTIVATION_PAID_BILLS_THRESHOLD || 5);

    // 2. Kiểm tra điều kiện mở mới vận hành
    if (updated.activationPaidBillsCount >= threshold && !updated.isActivationQualified) {
      // CAS Lock nguyên tử chống Race Condition nhiều luồng bill PAID đồng thời (AUD-12.2)
      const casLocked = await this.restaurantModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(restaurantId.toString()),
          isActivationQualified: { $ne: true },
        },
        {
          $set: {
            isActivationQualified: true,
            activationQualifiedAt: new Date(),
          },
        },
        { new: true },
      );

      // Nếu casLocked !== null ➔ Ta là luồng duy nhất thắng giải thưởng mở mới
      if (casLocked) {
        const salesId = restaurant.referredBySalesId;
        const salesUser = await this.userModel.findById(salesId);
        const bonusAmount = salesUser?.salesCommissionPolicy?.activationBonusAmount ?? 250000;
        const payoutPeriod = this.resolvePayoutPeriod(new Date());
        const ledgerCode = await this.counterService.generateDailyCode('COM', salesId.toString());

        const formulaSnapshot = `Thưởng Mở mới Vận hành Thực tế (Đạt ${threshold} hóa đơn PAID — Quán: ${restaurant.name})`;

        try {
          await this.commissionLedgerModel.findOneAndUpdate(
            {
              restaurantId: new Types.ObjectId(restaurantId.toString()),
              commissionType: 'ACTIVATION_BONUS',
              salesId: salesId,
            },
            {
              $setOnInsert: {
                ledgerCode,
                salesId,
                restaurantId: new Types.ObjectId(restaurantId.toString()),
                commissionType: 'ACTIVATION_BONUS',
                baseAmount: bonusAmount,
                commissionRate: 100,
                commissionAmount: bonusAmount,
                formulaSnapshot,
                status: 'APPROVED',
                payoutPeriod,
              },
            },
            { upsert: true, new: true },
          );
        } catch (err: any) {
          this.logger.warn(`Lỗi ghi sổ ACTIVATION_BONUS (có thể do race duplicate): ${err?.message}`);
        }

        // TẦNG 4: Thưởng Phát triển Đội ngũ CTV (TEAM_OVERRIDE_BONUS)
        if (salesUser && salesUser.parentSalesId) {
          await this.checkAndAwardTeamOverrideBonus(salesUser, restaurant);
        }
      }
    }

    return updated;
  }

  /**
   * Thưởng 250.000₫ cho NVKD cấp trên khi CTV cấp dưới có quán ĐẦU TIÊN đạt chuẩn (AUD-12.2)
   */
  private async checkAndAwardTeamOverrideBonus(ctvUser: UserDocument, restaurant: RestaurantDocument) {
    const parentSalesId = ctvUser.parentSalesId;
    if (!parentSalesId) return;

    // Kiểm tra xem CTV này đã từng kích hoạt TEAM_OVERRIDE_BONUS cho cấp trên chưa
    const existingBonus = await this.commissionLedgerModel.findOne({
      sourceSalesId: ctvUser._id,
      commissionType: 'TEAM_OVERRIDE_BONUS',
    });

    if (existingBonus) {
      // Đã từng thưởng cho quán đầu tiên rồi ➔ Không thưởng quán thứ 2 trở đi
      return;
    }

    const parentUser = await this.userModel.findById(parentSalesId);
    const teamBonusAmount = parentUser?.salesCommissionPolicy?.teamBonusAmount ?? 250000;
    const payoutPeriod = this.resolvePayoutPeriod(new Date());
    const ledgerCode = await this.counterService.generateDailyCode('COM', parentSalesId.toString());
    const formulaSnapshot = `Thưởng Phát triển Đội ngũ CTV (${ctvUser.fullName} có quán đầu tiên "${restaurant.name}" đạt chuẩn)`;

    try {
      await this.commissionLedgerModel.findOneAndUpdate(
        {
          sourceSalesId: ctvUser._id,
          commissionType: 'TEAM_OVERRIDE_BONUS',
        },
        {
          $setOnInsert: {
            ledgerCode,
            salesId: parentSalesId,
            sourceSalesId: ctvUser._id,
            restaurantId: restaurant._id,
            commissionType: 'TEAM_OVERRIDE_BONUS',
            baseAmount: teamBonusAmount,
            commissionRate: 100,
            commissionAmount: teamBonusAmount,
            formulaSnapshot,
            status: 'APPROVED',
            payoutPeriod,
          },
        },
        { upsert: true, new: true },
      );
    } catch (err: any) {
      // Compound Unique index ngăn chặn đúp thưởng
      this.logger.warn(`Lỗi ghi sổ TEAM_OVERRIDE_BONUS (đã tồn tại): ${err?.message}`);
    }
  }

  // ===========================================================================
  // 4. SALES PORTAL APIS (DASHBOARD, RESTAURANTS, COMMISSIONS, SUB-TEAM)
  // ===========================================================================

  /**
   * Lấy số liệu KPI tổng quan của NVKD hiện tại (Port 3003)
   */
  async getSalesDashboard(salesUserId: string) {
    const user = await this.userModel.findById(salesUserId);
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản NVKD');
    }

    const salesOid = new Types.ObjectId(salesUserId);

    // Đếm số nhà hàng do NVKD mời
    const totalReferred = await this.restaurantModel.countDocuments({
      referredBySalesId: salesOid,
    });

    // Đếm số quán do NVKD tạo giúp trực tiếp
    const totalAssisted = await this.restaurantModel.countDocuments({
      createdBySalesId: salesOid,
    });

    // Đếm số quán đã đạt chuẩn vận hành (5 bills)
    const totalQualified = await this.restaurantModel.countDocuments({
      referredBySalesId: salesOid,
      isActivationQualified: true,
    });

    // Đếm số quán trả phí
    const totalPaid = await this.restaurantModel.countDocuments({
      referredBySalesId: salesOid,
      subscriptionStatus: 'ACTIVE_PAID',
    });

    // Tổng doanh số gói SaaS mang về
    const revenueAgg = await this.subscriptionModel.aggregate([
      { $match: { salesId: salesOid, paymentStatus: 'PAID' } },
      { $group: { _id: null, total: { $sum: '$netAmount' } } },
    ]);
    const totalRevenueGenerated = revenueAgg[0]?.total || 0;

    // Tổng hoa hồng tích lũy
    const commissionAgg = await this.commissionLedgerModel.aggregate([
      { $match: { salesId: salesOid, status: { $ne: 'VOIDED' } } },
      { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
    ]);
    const totalCommissionEarned = commissionAgg[0]?.total || 0;

    // Hoa hồng kỳ hiện tại (05 hoặc 20)
    const currentPeriod = this.resolvePayoutPeriod(new Date());
    const periodAgg = await this.commissionLedgerModel.aggregate([
      { $match: { salesId: salesOid, payoutPeriod: currentPeriod, status: { $ne: 'VOIDED' } } },
      { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
    ]);
    const currentPeriodCommission = periodAgg[0]?.total || 0;

    // Số CTV cấp dưới
    const subTeamCount = await this.userModel.countDocuments({
      parentSalesId: salesOid,
      isDeleted: { $ne: true },
    });

    const referralCode = user.referralCode || '';
    const affiliateUrl = `http://localhost:3004/dang-ky?ref=${referralCode}`;
    const recruitAffiliateUrl = `http://localhost:3004/tuyen-dung-nhan-vien-kinh-doanh?parentRef=${referralCode}`;

    return {
      kpi: {
        totalReferred,
        totalAssisted,
        totalQualified,
        totalPaid,
        totalRevenueGenerated,
        totalCommissionEarned,
        currentPeriodCommission,
        subTeamCount,
      },
      affiliate: {
        referralCode,
        affiliateUrl,
        recruitAffiliateUrl,
        payoutPeriod: currentPeriod,
      },
      policy: user.salesCommissionPolicy || {
        setupCommissionRate: 50,
        renewalCommissionRate: 20,
        activationBonusAmount: 250000,
        teamBonusAmount: 250000,
      },
      bankAccount: user.payoutBankAccount || {},
    };
  }

  /**
   * Danh sách nhà hàng do NVKD hiện tại mời hoặc tạo giúp (AUD-12.4: Cross-Sales Isolation)
   */
  async getReferredRestaurants(salesUserId: string, query: QueryReferredRestaurantsDto) {
    const filter: any = {
      referredBySalesId: new Types.ObjectId(salesUserId),
    };

    if (query.subscriptionStatus) {
      filter.subscriptionStatus = query.subscriptionStatus;
    }

    if (query.isActivationQualified !== undefined && query.isActivationQualified !== '') {
      filter.isActivationQualified = query.isActivationQualified === 'true';
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { phone: searchRegex },
        { address: searchRegex },
      ];
    }

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.restaurantModel
        .find(filter)
        .select(
          'name slug phone address plan subscriptionStatus planExpiresAt isActivationQualified activationQualifiedAt activationPaidBillsCount acquisitionChannel createdAt',
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.restaurantModel.countDocuments(filter),
    ]);

    const threshold = Number(process.env.ACTIVATION_PAID_BILLS_THRESHOLD || 5);

    const data = items.map((r: any) => ({
      id: r._id.toString(),
      name: r.name,
      slug: r.slug,
      phone: r.phone,
      address: r.address,
      plan: r.plan,
      subscriptionStatus: r.subscriptionStatus,
      planExpiresAt: r.planExpiresAt,
      isActivationQualified: r.isActivationQualified,
      activationQualifiedAt: r.activationQualifiedAt,
      activationPaidBillsCount: r.activationPaidBillsCount || 0,
      activationTargetBills: threshold,
      acquisitionChannel: r.acquisitionChannel,
      createdAt: r.createdAt,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * NVKD tạo giúp nhà hàng mới + tài khoản chủ quán + thực đơn & bàn mẫu
   */
  async createAssistedRestaurant(salesUserId: string, dto: CreateAssistedRestaurantDto) {
    const salesUser = await this.userModel.findById(salesUserId);
    if (!salesUser) {
      throw new NotFoundException('Không tìm thấy tài khoản NVKD');
    }

    // Kiểm tra email chủ quán trùng
    const existingEmail = await this.userModel.findOne({ email: dto.owner.email.trim().toLowerCase() });
    if (existingEmail) {
      throw new ConflictException('Email chủ quán đã được đăng ký trên hệ thống');
    }

    const mainBranchId = new Types.ObjectId();
    const branchName = 'Chi nhánh chính';

    // 1. Tạo Nhà hàng
    let baseSlug = generateSlug(dto.restaurant.name);
    let restaurantSlug = baseSlug;
    let attempt = 0;
    while (await this.restaurantModel.exists({ slug: restaurantSlug })) {
      attempt++;
      restaurantSlug = `${baseSlug}-${attempt}`;
    }

    const createdRestaurant = await this.restaurantModel.create({
      name: dto.restaurant.name.trim(),
      slug: restaurantSlug,
      phone: dto.restaurant.phone.trim(),
      address: dto.restaurant.address.trim(),
      tagline: dto.restaurant.tagline ? dto.restaurant.tagline.trim() : 'Chào mừng quý khách!',
      plan: 'Basic',
      isOpen: true,
      referredBySalesId: salesUser._id,
      createdBySalesId: salesUser._id,
      referralCodeUsed: salesUser.referralCode,
      acquisitionChannel: 'SALES_ASSISTED',
      subscriptionStatus: 'TRIAL',
      isActivationQualified: false,
      activationPaidBillsCount: 0,
      branches: [
        {
          _id: mainBranchId,
          name: branchName,
          address: dto.restaurant.address.trim(),
          phone: dto.restaurant.phone.trim(),
          isMainBranch: true,
          isActive: true,
        } as any,
      ],
    });

    const restaurantId = createdRestaurant._id;

    // 2. Tạo tài khoản chủ quán
    let ownerRole = await this.roleModel.findOne({ slug: 'restaurant_admin' });
    if (!ownerRole) {
      ownerRole = await this.roleModel.create({
        name: 'Chủ nhà hàng / Chi nhánh',
        slug: 'restaurant_admin',
        isSystem: true,
        color: '#7c3aed',
        description: 'Quản trị toàn bộ hoạt động của nhà hàng và các chi nhánh',
        permissions: [],
      });
    }

    const hashedPassword = await hashPassword(dto.owner.password);
    const generatedUsername = `${dto.owner.email.split('@')[0]}_owner`;

    const ownerUser = await this.userModel.create({
      username: generatedUsername,
      email: dto.owner.email.trim().toLowerCase(),
      password: hashedPassword,
      fullName: dto.owner.fullName.trim(),
      phone: dto.owner.phone.trim(),
      role: ownerRole._id,
      restaurantId: restaurantId,
      branchId: mainBranchId.toString(),
      branchName: branchName,
      isRoleActive: true,
      status: 'ACTIVE',
    });

    // 3. Khởi tạo mẫu 12 bàn ăn nếu được yêu cầu (Mặc định: true)
    if (dto.seedDemoTables !== false) {
      try {
        const zone = await this.tableZoneModel.create({
          name: 'Tầng 1 (Khu chính)',
          restaurantId: restaurantId,
          branchId: mainBranchId.toString(),
          isDeleted: false,
        });

        const tableDocs = [];
        for (let i = 1; i <= 12; i++) {
          const numStr = i.toString().padStart(2, '0');
          tableDocs.push({
            code: `ban-${numStr}`,
            name: `Bàn ${numStr}`,
            zone: zone._id,
            capacity: i <= 4 ? 2 : i <= 10 ? 4 : 8,
            status: 'Available',
            restaurantId: restaurantId,
            branchId: mainBranchId.toString(),
            qrStatus: 'active',
            isDeleted: false,
          });
        }
        await this.tableModel.insertMany(tableDocs);
      } catch (err: any) {
        this.logger.warn(`Lỗi tạo bàn mẫu: ${err?.message}`);
      }
    }

    // 4. Khởi tạo thực đơn mẫu nếu được yêu cầu (Mặc định: true)
    if (dto.seedDemoMenu !== false) {
      try {
        const catSpecial = await this.categoryModel.create({
          name: 'Món Đặc Sắc',
          slug: 'mon-dac-sac',
          icon: 'Utensils',
          order: 1,
          isActive: true,
          restaurantId: restaurantId,
          branchIds: [mainBranchId.toString()],
        });

        const catDrinks = await this.categoryModel.create({
          name: 'Đồ Uống & Tráng Miệng',
          slug: 'do-uong-trang-mieng',
          icon: 'Coffee',
          order: 2,
          isActive: true,
          restaurantId: restaurantId,
          branchIds: [mainBranchId.toString()],
        });

        const sampleItems = [
          {
            category: catSpecial._id,
            name: 'Phở Bò Đặc Biệt',
            slug: 'pho-bo-dac-biet',
            price: 65000,
            originalPrice: 75000,
            isAvailable: true,
            restaurantId: restaurantId,
            branchIds: [mainBranchId.toString()],
            description: 'Phở bò gia truyền thơm ngon đậm đà',
          },
          {
            category: catSpecial._id,
            name: 'Cơm Tấm Sườn Bì Chả',
            slug: 'com-tam-suon-bi-cha',
            price: 55000,
            isAvailable: true,
            restaurantId: restaurantId,
            branchIds: [mainBranchId.toString()],
            description: 'Sườn nướng mật ong vàng giòn, bì dai chả trứng béo ngậy',
          },
          {
            category: catDrinks._id,
            name: 'Cà Phê Sữa Đá Sài Gòn',
            slug: 'ca-phe-sua-da-sai-gon',
            price: 25000,
            isAvailable: true,
            restaurantId: restaurantId,
            branchIds: [mainBranchId.toString()],
            description: 'Cà phê nguyên chất pha phin truyền thống',
          },
          {
            category: catDrinks._id,
            name: 'Trà Đào Cam Sả',
            slug: 'tra-dao-cam-sa',
            price: 35000,
            isAvailable: true,
            restaurantId: restaurantId,
            branchIds: [mainBranchId.toString()],
            description: 'Vị thanh ngọt dịu mát, miếng đào giòn sần sật',
          },
        ];

        await this.menuItemModel.insertMany(sampleItems);
      } catch (err: any) {
        this.logger.warn(`Lỗi tạo món ăn mẫu: ${err?.message}`);
      }
    }

    return {
      success: true,
      message: 'Đã tạo thành công nhà hàng và tài khoản chủ quán',
      restaurant: {
        id: createdRestaurant._id.toString(),
        name: createdRestaurant.name,
        slug: createdRestaurant.slug,
        phone: createdRestaurant.phone,
        address: createdRestaurant.address,
        acquisitionChannel: createdRestaurant.acquisitionChannel,
        subscriptionStatus: createdRestaurant.subscriptionStatus,
      },
      owner: {
        id: ownerUser._id.toString(),
        fullName: ownerUser.fullName,
        email: ownerUser.email,
        phone: ownerUser.phone,
      },
    };
  }

  /**
   * Tra cứu sổ cái hoa hồng của NVKD (AUD-12.4: Cô lập tuyệt đối theo salesId)
   */
  async getCommissions(salesUserId: string, query: QueryCommissionsDto) {
    const filter: any = {
      salesId: new Types.ObjectId(salesUserId),
    };

    if (query.commissionType) {
      filter.commissionType = query.commissionType;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.payoutPeriod) {
      filter.payoutPeriod = query.payoutPeriod;
    }

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.commissionLedgerModel
        .find(filter)
        .populate('restaurantId', 'name slug phone')
        .populate('sourceSalesId', 'fullName email referralCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.commissionLedgerModel.countDocuments(filter),
    ]);

    const data = items.map((item: any) => ({
      id: item._id.toString(),
      ledgerCode: item.ledgerCode,
      commissionType: item.commissionType,
      baseAmount: item.baseAmount,
      commissionRate: item.commissionRate,
      commissionAmount: item.commissionAmount,
      formulaSnapshot: item.formulaSnapshot,
      status: item.status,
      payoutPeriod: item.payoutPeriod,
      paidAt: item.paidAt,
      payoutReference: item.payoutReference,
      restaurant: item.restaurantId
        ? {
            id: item.restaurantId._id.toString(),
            name: item.restaurantId.name,
            slug: item.restaurantId.slug,
          }
        : undefined,
      sourceSales: item.sourceSalesId
        ? {
            id: item.sourceSalesId._id.toString(),
            fullName: item.sourceSalesId.fullName,
            referralCode: item.sourceSalesId.referralCode,
          }
        : undefined,
      createdAt: item.createdAt,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Lấy danh sách CTV cấp dưới thuộc đội ngũ của NVKD
   */
  async getSubTeam(salesUserId: string) {
    const salesOid = new Types.ObjectId(salesUserId);
    const ctvList = await this.userModel
      .find({ parentSalesId: salesOid, isDeleted: { $ne: true } })
      .select('fullName email phone referralCode createdAt status')
      .sort({ createdAt: -1 })
      .lean();

    const result = await Promise.all(
      ctvList.map(async (ctv: any) => {
        const ctvId = ctv._id;
        const totalReferred = await this.restaurantModel.countDocuments({ referredBySalesId: ctvId });
        const totalQualified = await this.restaurantModel.countDocuments({
          referredBySalesId: ctvId,
          isActivationQualified: true,
        });
        const totalPaid = await this.restaurantModel.countDocuments({
          referredBySalesId: ctvId,
          subscriptionStatus: 'ACTIVE_PAID',
        });

        return {
          id: ctv._id.toString(),
          fullName: ctv.fullName,
          email: ctv.email,
          phone: ctv.phone ? ctv.phone.slice(0, 4) + '***' + ctv.phone.slice(-3) : '',
          referralCode: ctv.referralCode,
          status: ctv.status,
          createdAt: ctv.createdAt,
          performance: {
            totalReferred,
            totalQualified,
            totalPaid,
          },
        };
      }),
    );

    return {
      total: result.length,
      members: result,
    };
  }

  /**
   * Cập nhật tài khoản ngân hàng nhận hoa hồng đối soát
   */
  async updatePayoutBankAccount(salesUserId: string, dto: UpdatePayoutBankDto) {
    const user = await this.userModel.findById(salesUserId);
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản NVKD');
    }

    user.payoutBankAccount = {
      bankId: dto.bankId.trim(),
      bankName: dto.bankName.trim(),
      accountNo: dto.accountNo.trim(),
      accountName: dto.accountName.trim().toUpperCase(),
    };
    await user.save();

    return {
      success: true,
      message: 'Cập nhật tài khoản ngân hàng nhận hoa hồng thành công',
      payoutBankAccount: user.payoutBankAccount,
    };
  }

  // ===========================================================================
  // 5. DEMO SEED ACCOUNTS
  // ===========================================================================

  /**
   * Khởi tạo sẵn 2 tài khoản NVKD mẫu: IMENU-DEMO88 và CTV cấp dưới IMENU-CTV99
   */
  async seedDemoSalesAccounts(): Promise<void> {
    let salesRole = await this.roleModel.findOne({ slug: 'sales_rep' });
    if (!salesRole) {
      salesRole = await this.roleModel.create({
        name: 'Nhân viên Kinh doanh / Đối tác Phát triển (Sales Rep)',
        slug: 'sales_rep',
        isSystem: true,
        color: '#0d9488',
        description: 'Phát triển thị trường, kết nối nhà hàng đối tác và quản lý hoa hồng tiếp thị liên kết',
        permissions: [],
        permissionIds: ['perm-sales-view', 'perm-sales-create-restaurant'],
      });
    }

    const defaultPassword = process.env.DEMO_USER_PASSWORD || 'Demo@123456';
    const hashedPassword = await hashPassword(defaultPassword);

    // 1. NVKD Trực tiếp: IMENU-DEMO88
    let demoSales = await this.userModel.findOne({ email: 'sales.demo@imenu.vn' });
    if (!demoSales) {
      demoSales = await this.userModel.create({
        username: 'sales_demo',
        email: 'sales.demo@imenu.vn',
        password: hashedPassword,
        fullName: 'Nguyễn Văn Kinh Doanh',
        phone: '0908888999',
        role: salesRole._id,
        referralCode: 'IMENU-DEMO88',
        salesCommissionPolicy: {
          setupCommissionRate: 50,
          renewalCommissionRate: 20,
          activationBonusAmount: 250000,
          teamBonusAmount: 250000,
        },
        payoutBankAccount: {
          bankId: 'MB',
          bankName: 'MBBank',
          accountNo: '0908888999',
          accountName: 'NGUYEN VAN KINH DOANH',
        },
        isRoleActive: true,
        status: 'ACTIVE',
      });
      this.logger.log('[Seed] Đã tạo tài khoản NVKD mẫu: sales.demo@imenu.vn (Mã: IMENU-DEMO88)');
    }

    // 2. CTV Cấp dưới: IMENU-CTV99
    const demoCtv = await this.userModel.findOne({ email: 'ctv.demo@imenu.vn' });
    if (!demoCtv && demoSales) {
      await this.userModel.create({
        username: 'ctv_demo',
        email: 'ctv.demo@imenu.vn',
        password: hashedPassword,
        fullName: 'Trần Thị Thu CTV',
        phone: '0907777888',
        role: salesRole._id,
        referralCode: 'IMENU-CTV99',
        parentSalesId: demoSales._id,
        salesCommissionPolicy: {
          setupCommissionRate: 50,
          renewalCommissionRate: 20,
          activationBonusAmount: 250000,
          teamBonusAmount: 250000,
        },
        payoutBankAccount: {
          bankId: 'VCB',
          bankName: 'Vietcombank',
          accountNo: '0907777888',
          accountName: 'TRAN THI THU CTV',
        },
        isRoleActive: true,
        status: 'ACTIVE',
      });
      this.logger.log('[Seed] Đã tạo tài khoản CTV mẫu: ctv.demo@imenu.vn (Mã: IMENU-CTV99)');
    }
  }
}
