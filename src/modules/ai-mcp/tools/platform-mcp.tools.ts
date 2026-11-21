import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { McpRegistryService } from '../mcp-registry.service';
import { McpToolDefinition } from '../interfaces/mcp-tool.interface';
import { PlatformService } from '../../platform/platform.service';
import { ReportsService } from '../../reports/reports.service';
import { SalesService } from '../../sales/services/sales.service';
import { ReviewsService } from '../../reviews/reviews.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { Restaurant, RestaurantDocument } from '../../restaurants/entities/restaurant.entity';
import { Order, OrderDocument } from '../../orders/entities/order.entity';
import { CommissionLedger, CommissionLedgerDocument } from '../../sales/entities/commission-ledger.entity';
import { SubscriptionTransaction, SubscriptionTransactionDocument } from '../../sales/entities/subscription-transaction.entity';
import { User, UserDocument } from '../../users/entities/user.entity';

/**
 * PlatformMcpTools (Sub-phase 18.1)
 *
 * Định nghĩa 4 MCP Tools chuẩn hóa chỉ đọc (Read-only) thuộc phạm vi Quản trị Nền tảng (PLATFORM).
 * Kết nối các service sẵn có theo kiến trúc Zero-Bloat, trả về JSON tinh gọn chống tràn bộ nhớ.
 */
@Injectable()
export class PlatformMcpTools implements OnModuleInit {
  private readonly logger = new Logger(PlatformMcpTools.name);

  constructor(
    private readonly mcpRegistryService: McpRegistryService,
    private readonly platformService: PlatformService,
    private readonly reportsService: ReportsService,
    private readonly salesService: SalesService,
    private readonly reviewsService: ReviewsService,
    private readonly activityLogService: ActivityLogService,
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(CommissionLedger.name)
    private readonly commissionLedgerModel: Model<CommissionLedgerDocument>,
    @InjectModel(SubscriptionTransaction.name)
    private readonly subscriptionModel: Model<SubscriptionTransactionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  onModuleInit() {
    const tools = this.getToolDefinitions();
    this.mcpRegistryService.registerTools(tools);
    this.logger.log(`[PlatformMcpTools] Đã nạp thành công 4 MCP Platform Tools vào Registry`);
  }

  /**
   * Danh sách 4 công cụ MCP chuẩn hóa
   */
  getToolDefinitions(): McpToolDefinition[] {
    return [
      this.getPlatformRevenueOverviewTool(),
      this.getDetectRestaurantChurnRiskTool(),
      this.getDiagnoseUnderperformingRestaurantsTool(),
      this.getAuditSalesCommissionsAnomaliesTool(),
    ];
  }

  // ===========================================================================
  // TOOL 1: get_platform_revenue_overview
  // ===========================================================================
  private getPlatformRevenueOverviewTool(): McpToolDefinition {
    return {
      name: 'get_platform_revenue_overview',
      description:
        'Tổng hợp GMV toàn sàn, doanh thu gói cước Subscription SaaS, tốc độ tăng trưởng so với kỳ trước, và danh sách Top nhà hàng đóng góp doanh thu cao nhất trên nền tảng iMenu.',
      scope: 'PLATFORM',
      isReadOnly: true,
      inputSchema: {
        type: 'object',
        properties: {
          startDate: {
            type: 'string',
            description: 'Ngày bắt đầu phân kỳ (định dạng YYYY-MM-DD)',
          },
          endDate: {
            type: 'string',
            description: 'Ngày kết thúc phân kỳ (định dạng YYYY-MM-DD)',
          },
          limit: {
            type: 'number',
            description: 'Số lượng top nhà hàng cần lấy (mặc định 5, tối đa 20)',
            default: 5,
            minimum: 1,
            maximum: 20,
          },
        },
      },
      handler: async (args: { startDate?: string; endDate?: string; limit?: number }) => {
        const limit = Math.min(Math.max(Number(args?.limit || 5), 1), 20);

        // Tái sử dụng PlatformService.getOverview()
        const overview = await this.platformService.getOverview();

        // Tính tốc độ tăng trưởng GMV so sánh 30 ngày gần nhất vs 30 ngày trước đó
        const now = new Date();
        const current30DaysStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const prev30DaysStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        const [currAgg, prevAgg] = await Promise.all([
          this.orderModel.aggregate([
            { $match: { isPaid: true, createdAt: { $gte: current30DaysStart, $lte: now } } },
            { $group: { _id: null, gmv: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
          ]),
          this.orderModel.aggregate([
            { $match: { isPaid: true, createdAt: { $gte: prev30DaysStart, $lt: current30DaysStart } } },
            { $group: { _id: null, gmv: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
          ]),
        ]);

        const currGmv = currAgg[0]?.gmv || 0;
        const prevGmv = prevAgg[0]?.gmv || 0;
        let growthRatePercent = 0;
        if (prevGmv > 0) {
          growthRatePercent = Math.round(((currGmv - prevGmv) / prevGmv) * 1000) / 10;
        } else if (currGmv > 0) {
          growthRatePercent = 100;
        }

        const topRestaurants = (overview.topRestaurants || []).slice(0, limit).map((r: any) => ({
          restaurantId: r.restaurantId?.toString() || r.restaurantId,
          name: r.name,
          slug: r.slug,
          plan: r.plan,
          totalGmv: r.totalGmv,
          ordersCount: r.ordersCount,
        }));

        return {
          summary: {
            totalGmvRevenue: overview.kpi.totalGmvRevenue,
            totalSaaSRevenue: overview.kpi.totalSaaSRevenue,
            totalRevenueCombined: overview.kpi.totalGmvRevenue + overview.kpi.totalSaaSRevenue,
            totalPaidOrders: overview.kpi.totalPaidOrders,
            totalRestaurants: overview.kpi.totalRestaurants,
            activePaidRestaurants: overview.kpi.statusBreakdown?.ACTIVE_PAID || 0,
            activeFreeRestaurants: overview.kpi.statusBreakdown?.ACTIVE_FREE || 0,
            growthRatePercent,
            recent30DaysGmv: currGmv,
            previous30DaysGmv: prevGmv,
          },
          statusBreakdown: overview.kpi.statusBreakdown,
          commissions: overview.kpi.commissions,
          topRevenueRestaurants: topRestaurants,
          generatedAt: new Date().toISOString(),
        };
      },
    };
  }

  // ===========================================================================
  // TOOL 2: detect_restaurant_churn_risk
  // ===========================================================================
  private getDetectRestaurantChurnRiskTool(): McpToolDefinition {
    return {
      name: 'detect_restaurant_churn_risk',
      description:
        'Quét các nhà hàng đang ACTIVE nhưng có nguy cơ rời bỏ nền tảng do lượng đơn hàng giảm mạnh (>40% trong 7-14 ngày gần nhất) hoặc gói Subscription sắp hết hạn trong 7 ngày tới.',
      scope: 'PLATFORM',
      isReadOnly: true,
      inputSchema: {
        type: 'object',
        properties: {
          dropThresholdPercent: {
            type: 'number',
            description: 'Ngưỡng phần trăm sụt giảm đơn hàng để kích hoạt cảnh báo (mặc định 40%)',
            default: 40,
            minimum: 10,
            maximum: 90,
          },
          daysExpiringThreshold: {
            type: 'number',
            description: 'Ngưỡng số ngày còn lại của gói Subscription để cảnh báo (mặc định 7 ngày)',
            default: 7,
            minimum: 1,
            maximum: 30,
          },
          limit: {
            type: 'number',
            description: 'Số lượng nhà hàng cảnh báo tối đa trả về (mặc định 20)',
            default: 20,
            minimum: 1,
            maximum: 50,
          },
        },
      },
      handler: async (args: {
        dropThresholdPercent?: number;
        daysExpiringThreshold?: number;
        limit?: number;
      }) => {
        const dropThreshold = Number(args?.dropThresholdPercent || 40);
        const daysExpiring = Number(args?.daysExpiringThreshold || 7);
        const limit = Math.min(Math.max(Number(args?.limit || 20), 1), 50);

        const now = new Date();
        const w1Start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const w2Start = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        // Lấy danh sách nhà hàng đang hoạt động
        const activeRestaurants = await this.restaurantModel
          .find({
            isSuspended: { $ne: true },
            status: { $nin: ['CANCELLED', 'CLOSED', 'TERMINATED'] },
          })
          .select('_id name slug status subscriptionStatus planExpiresAt plan phone')
          .lean()
          .exec();

        if (activeRestaurants.length === 0) {
          return {
            totalScanned: 0,
            riskCount: 0,
            atRiskRestaurants: [],
            thresholds: { dropThresholdPercent: dropThreshold, daysExpiringThreshold: daysExpiring },
          };
        }

        const restaurantIds = activeRestaurants.map((r) => r._id);

        // Gom nhóm số lượng đơn hàng tuần gần nhất (W1: 0 - 7 ngày trước)
        const w1Agg = await this.orderModel.aggregate([
          {
            $match: {
              restaurantId: { $in: restaurantIds },
              status: { $ne: 'Cancelled' },
              createdAt: { $gte: w1Start, $lte: now },
            },
          },
          { $group: { _id: '$restaurantId', count: { $sum: 1 }, gmv: { $sum: '$totalAmount' } } },
        ]);

        // Gom nhóm số lượng đơn hàng tuần trước đó (W2: 7 - 14 ngày trước)
        const w2Agg = await this.orderModel.aggregate([
          {
            $match: {
              restaurantId: { $in: restaurantIds },
              status: { $ne: 'Cancelled' },
              createdAt: { $gte: w2Start, $lt: w1Start },
            },
          },
          { $group: { _id: '$restaurantId', count: { $sum: 1 }, gmv: { $sum: '$totalAmount' } } },
        ]);

        const w1Map = new Map<string, { count: number; gmv: number }>();
        w1Agg.forEach((item) => w1Map.set(item._id.toString(), { count: item.count, gmv: item.gmv }));

        const w2Map = new Map<string, { count: number; gmv: number }>();
        w2Agg.forEach((item) => w2Map.set(item._id.toString(), { count: item.count, gmv: item.gmv }));

        const atRiskRestaurants: any[] = [];

        for (const rest of activeRestaurants) {
          const restId = rest._id.toString();
          const w1 = w1Map.get(restId) || { count: 0, gmv: 0 };
          const w2 = w2Map.get(restId) || { count: 0, gmv: 0 };

          const reasons: string[] = [];
          let isAtRisk = false;
          let dropPercent = 0;

          // 1. Kiểm tra sụt giảm đơn hàng (> dropThreshold)
          if (w2.count >= 2 && w1.count < w2.count) {
            dropPercent = Math.round(((w2.count - w1.count) / w2.count) * 1000) / 10;
            if (dropPercent >= dropThreshold) {
              isAtRisk = true;
              reasons.push(
                `Lượng đơn sụt giảm ${dropPercent}% trong 7 ngày qua (từ ${w2.count} đơn xuống ${w1.count} đơn)`,
              );
            }
          }

          // 2. Kiểm tra hạn gói Subscription (planExpiresAt hoặc subscriptionExpiresAt)
          let daysUntilExpiry: number | null = null;
          const expiryDateRaw = (rest as any).planExpiresAt || (rest as any).subscriptionExpiresAt;
          if (expiryDateRaw) {
            const expDate = new Date(expiryDateRaw);
            const diffMs = expDate.getTime() - now.getTime();
            daysUntilExpiry = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

            if (daysUntilExpiry <= daysExpiring) {
              isAtRisk = true;
              if (daysUntilExpiry < 0) {
                reasons.push(`Gói cước đã quá hạn ${Math.abs(daysUntilExpiry)} ngày nhưng chưa gia hạn`);
              } else {
                reasons.push(`Gói cước sắp hết hạn sau ${daysUntilExpiry} ngày`);
              }
            }
          }

          if (isAtRisk) {
            const isHigh = dropPercent >= 60 || (daysUntilExpiry !== null && daysUntilExpiry <= 2);
            atRiskRestaurants.push({
              restaurantId: restId,
              name: rest.name,
              slug: rest.slug,
              plan: rest.plan,
              phone: rest.phone || '',
              riskLevel: isHigh ? 'HIGH' : 'MEDIUM',
              reasons,
              metrics: {
                recent7DaysOrders: w1.count,
                previous7DaysOrders: w2.count,
                dropPercent,
                recent7DaysGmv: w1.gmv,
                daysUntilSubscriptionExpiry: daysUntilExpiry,
                subscriptionExpiresAt: expiryDateRaw || null,
              },
              actionLink: `/platform/restaurants?id=${restId}`,
            });
          }
        }

        // Ưu tiên HIGH risk lên đầu, sau đó sắp xếp theo tỷ lệ giảm đơn
        atRiskRestaurants.sort((a, b) => {
          if (a.riskLevel === 'HIGH' && b.riskLevel !== 'HIGH') return -1;
          if (a.riskLevel !== 'HIGH' && b.riskLevel === 'HIGH') return 1;
          return (b.metrics.dropPercent || 0) - (a.metrics.dropPercent || 0);
        });

        const limitedResults = atRiskRestaurants.slice(0, limit);

        return {
          totalScanned: activeRestaurants.length,
          riskCount: limitedResults.length,
          highRiskCount: limitedResults.filter((r) => r.riskLevel === 'HIGH').length,
          mediumRiskCount: limitedResults.filter((r) => r.riskLevel === 'MEDIUM').length,
          atRiskRestaurants: limitedResults,
          thresholds: {
            dropThresholdPercent: dropThreshold,
            daysExpiringThreshold: daysExpiring,
          },
          scannedAt: new Date().toISOString(),
        };
      },
    };
  }

  // ===========================================================================
  // TOOL 3: diagnose_underperforming_restaurants
  // ===========================================================================
  private getDiagnoseUnderperformingRestaurantsTool(): McpToolDefinition {
    return {
      name: 'diagnose_underperforming_restaurants',
      description:
        'Phân tích nguyên nhân nhà hàng có hiệu suất kém hoặc doanh thu sụt giảm dựa trên dữ liệu báo cáo vận hành, tỷ lệ hủy món KDS, và phản hồi đánh giá 1-2 sao của khách hàng.',
      scope: 'PLATFORM',
      isReadOnly: true,
      inputSchema: {
        type: 'object',
        properties: {
          restaurantId: {
            type: 'string',
            description:
              'Mã định danh ObjectId của nhà hàng cần chẩn đoán. Nếu để trống, hệ thống sẽ tự động quét các nhà hàng có hiệu suất thấp nhất.',
          },
          days: {
            type: 'number',
            description: 'Khoảng thời gian phân tích tính theo ngày (mặc định 30 ngày)',
            default: 30,
            minimum: 7,
            maximum: 90,
          },
          cancellationThresholdPercent: {
            type: 'number',
            description: 'Ngưỡng tỷ lệ đơn/món bị hủy xem là bất thường (mặc định 15%)',
            default: 15,
            minimum: 5,
            maximum: 50,
          },
        },
      },
      handler: async (args: {
        restaurantId?: string;
        days?: number;
        cancellationThresholdPercent?: number;
      }) => {
        const days = Number(args?.days || 30);
        const cancelThreshold = Number(args?.cancellationThresholdPercent || 15);

        const now = new Date();
        const startDateObj = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const startDateStr = startDateObj.toISOString().split('T')[0];
        const endDateStr = now.toISOString().split('T')[0];

        // Xác định danh sách nhà hàng mục tiêu
        let targetRestaurants: any[] = [];
        if (args?.restaurantId && Types.ObjectId.isValid(args.restaurantId)) {
          const rest = await this.restaurantModel.findById(args.restaurantId).lean().exec();
          if (rest) {
            targetRestaurants.push(rest);
          }
        } else {
          // Lấy tối đa 5 nhà hàng đang hoạt động để phân tích
          targetRestaurants = await this.restaurantModel
            .find({ isSuspended: { $ne: true } })
            .limit(5)
            .lean()
            .exec();
        }

        const diagnostics: any[] = [];

        for (const rest of targetRestaurants) {
          const restId = rest._id.toString();

          // 1. Tái sử dụng ReportsService để lấy báo cáo doanh thu & đơn hủy
          let report: any = null;
          try {
            report = await this.reportsService.getRevenueReport(restId, {
              startDate: startDateStr,
              endDate: endDateStr,
            });
          } catch (e: any) {
            this.logger.warn(`Không thể lấy revenue report cho nhà hàng ${restId}: ${e?.message}`);
          }

          const orderCount = report?.orderCount || 0;
          const completedOrders = report?.completedOrders || 0;
          const cancelledOrders = report?.cancelledOrders || 0;
          const totalRevenue = report?.totalRevenue || 0;
          const avgOrderValue = report?.averageOrderValue || 0;

          const orderCancellationRate =
            orderCount > 0 ? Math.round((cancelledOrders / orderCount) * 1000) / 10 : 0;

          // 2. Thống kê chi tiết món bị hủy tại bếp KDS từ Order.items
          const ordersWithItems = await this.orderModel
            .find({
              restaurantId: new Types.ObjectId(restId),
              createdAt: { $gte: startDateObj, $lte: now },
            })
            .select('items status')
            .lean()
            .exec();

          let totalItemsCount = 0;
          let cancelledItemsCount = 0;
          const cancelledItemNamesMap: Record<string, number> = {};

          for (const ord of ordersWithItems) {
            if (Array.isArray(ord.items)) {
              for (const it of ord.items) {
                totalItemsCount += it.quantity || 1;
                if (it.status === 'Cancelled') {
                  const qty = it.quantity || 1;
                  cancelledItemsCount += qty;
                  const itName = it.name || 'Món không rõ';
                  cancelledItemNamesMap[itName] = (cancelledItemNamesMap[itName] || 0) + qty;
                }
              }
            }
          }

          const itemCancellationRate =
            totalItemsCount > 0
              ? Math.round((cancelledItemsCount / totalItemsCount) * 1000) / 10
              : 0;

          const topCancelledItems = Object.entries(cancelledItemNamesMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, count]) => ({ name, cancelledCount: count }));

          // 3. Tái sử dụng ReviewsService để lấy thống kê CSAT và phản hồi 1-2 sao
          let reviewSummary: any = null;
          let negativeReviewsList: any[] = [];
          try {
            reviewSummary = await this.reviewsService.getSummary(restId);
            const [rev1, rev2] = await Promise.all([
              this.reviewsService.findAll(restId, { rating: 1, limit: 3 }),
              this.reviewsService.findAll(restId, { rating: 2, limit: 3 }),
            ]);
            negativeReviewsList = [...(rev1?.items || []), ...(rev2?.items || [])];
          } catch (e: any) {
            this.logger.warn(`Không thể lấy reviews cho nhà hàng ${restId}: ${e?.message}`);
          }

          const averageRating = reviewSummary?.averageOverall || 0;
          const totalReviews = reviewSummary?.totalReviews || 0;
          const oneStarCount = reviewSummary?.ratingDistribution?.[1] || 0;
          const twoStarCount = reviewSummary?.ratingDistribution?.[2] || 0;
          const negativeReviewsCount = oneStarCount + twoStarCount;

          const recentComplaints = negativeReviewsList.map((rev: any) => ({
            rating: rev.overallRating,
            comment: rev.comment || '',
            quickTags: rev.quickTags || [],
            createdAt: rev.createdAt,
          }));

          // 4. Phân tích vấn đề & kiến nghị giải pháp
          const detectedIssues: string[] = [];
          const recommendedActions: string[] = [];

          if (orderCancellationRate >= cancelThreshold) {
            detectedIssues.push(
              `Tỷ lệ hủy đơn hàng bất thường: ${orderCancellationRate}% (${cancelledOrders}/${orderCount} đơn) vượt ngưỡng ${cancelThreshold}%`,
            );
            recommendedActions.push(
              'Rà soát quy trình xác nhận đơn và thời gian chờ của khách hàng tại bàn',
            );
          }

          if (itemCancellationRate >= cancelThreshold) {
            detectedIssues.push(
              `Tỷ lệ món bị hủy tại bếp KDS cao: ${itemCancellationRate}% (${cancelledItemsCount}/${totalItemsCount} lượt món). Món hủy nhiều nhất: ${topCancelledItems.map((i) => i.name).join(', ')}`,
            );
            recommendedActions.push(
              'Kiểm tra định lượng kho nguyên liệu và tốc độ ra món tại màn hình KDS nhà bếp',
            );
          }

          if (averageRating > 0 && averageRating < 3.5) {
            detectedIssues.push(
              `Điểm đánh giá CSAT thấp: ${averageRating}/5 sao với ${negativeReviewsCount} lượt đánh giá 1-2 sao`,
            );
            recommendedActions.push(
              'Tập huấn nhân sự phục vụ và rà soát các khiếu nại về chất lượng món ăn / thái độ nhân viên',
            );
          }

          if (orderCount === 0 || totalRevenue === 0) {
            detectedIssues.push('Nhà hàng không ghi nhận doanh thu hoặc đơn hàng nào trong kỳ phân tích');
            recommendedActions.push(
              'Liên hệ chủ nhà hàng để kiểm tra kết nối thiết bị POS / QR bàn hoặc hỗ trợ vận hành',
            );
          }

          const operationalHealth =
            detectedIssues.length === 0 ? 'HEALTHY' : detectedIssues.length >= 2 ? 'CRITICAL' : 'WARNING';

          diagnostics.push({
            restaurantId: restId,
            name: rest.name,
            slug: rest.slug,
            operationalHealth,
            metrics: {
              periodDays: days,
              totalRevenue,
              averageOrderValue: avgOrderValue,
              orderCount,
              completedOrders,
              cancelledOrders,
              orderCancellationRatePercent: orderCancellationRate,
              itemCancellationRatePercent: itemCancellationRate,
              totalItemsCount,
              cancelledItemsCount,
              averageRating,
              totalReviews,
              negativeReviewsCount,
            },
            topCancelledItems,
            recentComplaints: recentComplaints.slice(0, 3),
            detectedIssues,
            recommendedActions,
          });
        }

        return {
          diagnosticCount: diagnostics.length,
          periodDays: days,
          diagnostics,
          analyzedAt: new Date().toISOString(),
        };
      },
    };
  }

  // ===========================================================================
  // TOOL 4: audit_sales_commissions_anomalies
  // ===========================================================================
  private getAuditSalesCommissionsAnomaliesTool(): McpToolDefinition {
    return {
      name: 'audit_sales_commissions_anomalies',
      description:
        'Rà soát bảng kê hoa hồng (commission-ledger) và đối soát nhật ký hoạt động (activity-log) nhằm phát hiện các nhân viên kinh doanh (Sales Rep) có dấu hiệu bất thường, như nhà hàng được giới thiệu không phát sinh đơn hàng thực tế hoặc ghi nhận hoa hồng trùng lặp.',
      scope: 'PLATFORM',
      isReadOnly: true,
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['ALL', 'PENDING', 'APPROVED', 'PAID'],
            description: 'Lọc theo trạng thái hoa hồng cần kiểm toán (mặc định ALL)',
            default: 'ALL',
          },
          minCommissionAmount: {
            type: 'number',
            description: 'Mức hoa hồng tối thiểu cần quét (mặc định 0 VNĐ)',
            default: 0,
            minimum: 0,
          },
          limit: {
            type: 'number',
            description: 'Số lượng phát hiện bất thường tối đa trả về (mặc định 50)',
            default: 50,
            minimum: 1,
            maximum: 100,
          },
        },
      },
      handler: async (args: { status?: string; minCommissionAmount?: number; limit?: number }) => {
        const statusFilter = args?.status || 'ALL';
        const minAmount = Number(args?.minCommissionAmount || 0);
        const limit = Math.min(Math.max(Number(args?.limit || 50), 1), 100);

        const filter: any = {};
        if (statusFilter !== 'ALL') {
          filter.status = statusFilter;
        }
        if (minAmount > 0) {
          filter.commissionAmount = { $gte: minAmount };
        }

        // Truy vấn danh sách bản kê hoa hồng
        const ledgers = await this.commissionLedgerModel
          .find(filter)
          .sort({ createdAt: -1 })
          .lean()
          .exec();

        if (ledgers.length === 0) {
          return {
            anomalyCount: 0,
            totalAmountAtRisk: 0,
            anomalies: [],
            auditedRecordsCount: 0,
            scannedAt: new Date().toISOString(),
          };
        }

        // Lấy thông tin Sales Reps & Restaurants liên quan
        const salesIds = Array.from(new Set(ledgers.map((l) => l.salesId?.toString()).filter(Boolean)));
        const restIds = Array.from(
          new Set(ledgers.map((l) => l.restaurantId?.toString()).filter(Boolean)),
        );

        const [salesUsers, restaurants] = await Promise.all([
          this.userModel
            .find({ _id: { $in: salesIds.map((id) => new Types.ObjectId(id)) } })
            .select('_id fullName email phone')
            .lean()
            .exec(),
          this.restaurantModel
            .find({ _id: { $in: restIds.map((id) => new Types.ObjectId(id)) } })
            .select('_id name slug status subscriptionStatus')
            .lean()
            .exec(),
        ]);

        const salesMap = new Map<string, any>();
        salesUsers.forEach((u) => salesMap.set(u._id.toString(), u));

        const restMap = new Map<string, any>();
        restaurants.forEach((r) => restMap.set(r._id.toString(), r));

        // Gom nhóm thống kê đơn hàng và GMV thực tế của từng nhà hàng
        const orderAgg = await this.orderModel.aggregate([
          { $match: { restaurantId: { $in: restIds.map((id) => new Types.ObjectId(id)) }, isPaid: true } },
          { $group: { _id: '$restaurantId', totalGmv: { $sum: '$totalAmount' }, paidOrdersCount: { $sum: 1 } } },
        ]);

        const orderStatsMap = new Map<string, { totalGmv: number; paidOrdersCount: number }>();
        orderAgg.forEach((item) =>
          orderStatsMap.set(item._id.toString(), {
            totalGmv: item.totalGmv,
            paidOrdersCount: item.paidOrdersCount,
          }),
        );

        const anomalies: any[] = [];
        let totalAmountAtRisk = 0;

        // Kiểm tra tính trùng lặp (Duplicate commission check)
        const duplicateKeyMap = new Map<string, string[]>();

        for (const l of ledgers) {
          const sId = l.salesId?.toString() || '';
          const rId = l.restaurantId?.toString() || '';
          const subId = l.subscriptionTransactionId?.toString() || '';
          const cType = l.commissionType;

          if (sId && rId && cType) {
            const key = `${sId}_${rId}_${cType}_${subId}`;
            if (!duplicateKeyMap.has(key)) {
              duplicateKeyMap.set(key, []);
            }
            duplicateKeyMap.get(key)!.push(l.ledgerCode);
          }
        }

        // Rà soát từng ledger
        for (const l of ledgers) {
          const sId = l.salesId?.toString() || '';
          const rId = l.restaurantId?.toString() || '';
          const salesRep = salesMap.get(sId);
          const rest = restMap.get(rId);
          const orderStat = rId ? orderStatsMap.get(rId) || { totalGmv: 0, paidOrdersCount: 0 } : null;

          // 1. Kiểm tra nhà hàng "ma" (Ghost Restaurant: được tính hoa hồng nhưng 0 đơn hàng thực tế)
          if (rId && rest && orderStat && orderStat.paidOrdersCount === 0) {
            const anomaly = {
              ledgerId: l._id.toString(),
              ledgerCode: l.ledgerCode,
              anomalyType: 'ZERO_GMV_REFERRED_RESTAURANT',
              severity: 'HIGH',
              commissionAmount: l.commissionAmount || 0,
              commissionType: l.commissionType,
              status: l.status,
              salesRep: {
                id: sId,
                fullName: salesRep?.fullName || 'N/A',
                email: salesRep?.email || 'N/A',
                phone: salesRep?.phone || '',
              },
              restaurant: {
                id: rId,
                name: rest.name,
                slug: rest.slug,
                subscriptionStatus: rest.subscriptionStatus,
              },
              actualMetrics: {
                paidOrdersCount: 0,
                totalGmv: 0,
              },
              details: `Nhà hàng "${rest.name}" được ghi nhận hoa hồng ${l.commissionType} (${(l.commissionAmount || 0).toLocaleString()} VNĐ) nhưng chưa phát sinh bất kỳ đơn hàng thực tế nào (0 đơn, 0 VNĐ GMV).`,
              recommendation:
                'Tạm dừng thanh toán (Payout) khoản hoa hồng này và tiến hành liên hệ xác minh thực địa nhà hàng.',
              createdAt: (l as any).createdAt || new Date(),
            };

            anomalies.push(anomaly);
            totalAmountAtRisk += l.commissionAmount || 0;
            continue;
          }

          // 2. Kiểm tra bản ghi hoa hồng trùng lặp (Duplicate commission)
          const key = `${sId}_${rId}_${l.commissionType}_${l.subscriptionTransactionId?.toString() || ''}`;
          const duplicateCodes = duplicateKeyMap.get(key) || [];
          if (duplicateCodes.length > 1 && duplicateCodes[0] !== l.ledgerCode) {
            const anomaly = {
              ledgerId: l._id.toString(),
              ledgerCode: l.ledgerCode,
              anomalyType: 'DUPLICATE_COMMISSION_RECORD',
              severity: 'CRITICAL',
              commissionAmount: l.commissionAmount || 0,
              commissionType: l.commissionType,
              status: l.status,
              salesRep: {
                id: sId,
                fullName: salesRep?.fullName || 'N/A',
                email: salesRep?.email || 'N/A',
                phone: salesRep?.phone || '',
              },
              restaurant: rest
                ? {
                    id: rId,
                    name: rest.name,
                    slug: rest.slug,
                    subscriptionStatus: rest.subscriptionStatus,
                  }
                : null,
              actualMetrics: {
                duplicateLedgerCodes: duplicateCodes,
              },
              details: `Phát hiện bản ghi hoa hồng trùng lặp cho cùng NVKD và nhà hàng/giao dịch. Các mã bảng kê: ${duplicateCodes.join(', ')}`,
              recommendation: 'Từ chối (REJECT) hoặc hủy bỏ bản kê trùng lặp để tránh chi trả thừa hoa hồng.',
              createdAt: (l as any).createdAt || new Date(),
            };

            anomalies.push(anomaly);
            totalAmountAtRisk += l.commissionAmount || 0;
          }
        }

        const limitedAnomalies = anomalies.slice(0, limit);

        return {
          auditedRecordsCount: ledgers.length,
          anomalyCount: limitedAnomalies.length,
          totalAmountAtRisk,
          anomalies: limitedAnomalies,
          scannedAt: new Date().toISOString(),
        };
      },
    };
  }
}
