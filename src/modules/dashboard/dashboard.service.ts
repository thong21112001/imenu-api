import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from '../orders/entities/order.entity';
import { Table, TableDocument } from '../tables/entities/table.entity';
import { Restaurant, RestaurantDocument } from '../restaurants/entities/restaurant.entity';
import { JwtUser } from '../auth/interface/jwtUser';

/**
 * Helper tính toán khoảng thời gian bắt đầu và kết thúc ngày theo múi giờ Việt Nam (+07:00)
 */
function getVietnamDateBounds(dateStr?: string) {
  let targetStr = dateStr;
  if (!targetStr) {
    const now = new Date();
    const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    targetStr = vnNow.toISOString().split('T')[0];
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetStr)) {
      throw new BadRequestException('Định dạng ngày không hợp lệ. Vui lòng truyền định dạng YYYY-MM-DD');
    }
  }

  const start = new Date(`${targetStr}T00:00:00.000+07:00`);
  const end = new Date(`${targetStr}T23:59:59.999+07:00`);
  const startYesterday = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const endYesterday = new Date(end.getTime() - 24 * 60 * 60 * 1000);

  return {
    dateStr: targetStr,
    start,
    end,
    startYesterday,
    endYesterday,
  };
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Table.name) private readonly tableModel: Model<TableDocument>,
    @InjectModel(Restaurant.name) private readonly restaurantModel: Model<RestaurantDocument>,
  ) {}

  async getOverview(
    restaurantId: string,
    queryBranchId?: string,
    caller?: JwtUser,
    queryDate?: string,
  ) {
    const restaurant = await this.restaurantModel.findById(restaurantId);
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy nhà hàng');
    }

    // 1. Cưỡng chế phân lập chi nhánh (Multi-Branch Isolation)
    let effectiveBranchId: string | undefined = undefined;

    const isMainOrAdmin =
      !caller ||
      !!caller.isMainBranch ||
      !!(caller as any)?.isOwner ||
      caller.role?.slug === 'restaurant_admin' ||
      caller.role?.slug === 'system_admin' ||
      caller.role?.slug === 'super_admin';

    if (!isMainOrAdmin) {
      // Nhân viên chi nhánh con chỉ được xem dữ liệu chi nhánh mình
      if (queryBranchId && queryBranchId !== caller.branchId) {
        throw new ForbiddenException('Bạn không có quyền truy cập dữ liệu bảng điều khiển của chi nhánh khác');
      }
      effectiveBranchId = caller.branchId;
    } else {
      // Chi nhánh chính / HQ có quyền lọc theo chi nhánh cụ thể hoặc xem toàn bộ chuỗi ('all')
      if (queryBranchId && queryBranchId !== 'all') {
        effectiveBranchId = queryBranchId;
      }
    }

    // 2. Múi giờ Việt Nam (+07:00) cho ngày chỉ định (hoặc hôm nay)
    const { dateStr, start, end, startYesterday, endYesterday } = getVietnamDateBounds(queryDate);

    // 3. Doanh thu & số đơn đã thanh toán trong ngày
    const orderMatch: any = {
      restaurantId: new Types.ObjectId(restaurantId),
      createdAt: { $gte: start, $lte: end },
      $or: [{ status: 'Paid' }, { isPaid: true }],
    };
    if (effectiveBranchId) {
      orderMatch.branchId = effectiveBranchId;
    }

    const paidOrders = await this.orderModel.find(orderMatch).sort({ createdAt: 1 }).exec();
    const todayRevenue = paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const completedOrdersToday = paidOrders.length;

    // 4. Doanh thu ngày hôm qua để tính % tăng trưởng (revenueGrowthRate)
    const yesterdayMatch: any = {
      restaurantId: new Types.ObjectId(restaurantId),
      createdAt: { $gte: startYesterday, $lte: endYesterday },
      $or: [{ status: 'Paid' }, { isPaid: true }],
    };
    if (effectiveBranchId) {
      yesterdayMatch.branchId = effectiveBranchId;
    }
    const yesterdayPaidOrders = await this.orderModel.find(yesterdayMatch).exec();
    const yesterdayRevenue = yesterdayPaidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    let revenueGrowthRate = 0;
    if (yesterdayRevenue > 0) {
      revenueGrowthRate = Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 1000) / 10;
    } else if (todayRevenue > 0) {
      revenueGrowthRate = 100;
    }

    // 5. Giá trị trung bình đơn hàng (AOV)
    const averageOrderValue = completedOrdersToday > 0 ? Math.round(todayRevenue / completedOrdersToday) : 0;

    // 6. Trạng thái bàn ăn (Bắt buộc lọc isDeleted != true)
    const tableFilter: any = {
      restaurantId: new Types.ObjectId(restaurantId),
      isDeleted: { $ne: true },
    };
    if (effectiveBranchId) {
      tableFilter.branchId = effectiveBranchId;
    }

    const tables = await this.tableModel.find(tableFilter).exec();
    const totalTablesCount = tables.length;
    const occupiedTablesCount = tables.filter(
      (t) =>
        t.status === 'Occupied' ||
        t.status === 'PaymentRequested' ||
        (t.status as string)?.toLowerCase() === 'occupied' ||
        (t.status as string)?.toLowerCase() === 'paymentrequested',
    ).length;
    const occupancyRate = totalTablesCount > 0 ? Math.round((occupiedTablesCount / totalTablesCount) * 1000) / 10 : 0;

    // 7. Đơn đang chờ chế biến trong bếp (status IN ['WaitingConfirmation', 'Confirmed', 'Preparing'])
    const pendingKitchenOrders = await this.orderModel.countDocuments({
      restaurantId: new Types.ObjectId(restaurantId),
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      status: { $in: ['WaitingConfirmation', 'Confirmed', 'Preparing'] },
    });

    // 8. Thống kê theo khung giờ (09:00 - 20:00) theo múi giờ Việt Nam +07:00
    const displayHours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const hourlyMap = new Map<number, { revenue: number; ordersCount: number }>();
    paidOrders.forEach((o) => {
      const orderTime = (o as any).createdAt ? new Date((o as any).createdAt) : new Date();
      const vnTime = new Date(orderTime.getTime() + 7 * 60 * 60 * 1000);
      const h = vnTime.getUTCHours();
      const cur = hourlyMap.get(h) || { revenue: 0, ordersCount: 0 };
      cur.revenue += o.totalAmount || 0;
      cur.ordersCount += 1;
      hourlyMap.set(h, cur);
    });

    const hourlyRevenue = displayHours.map((hour) => {
      const stats = hourlyMap.get(hour) || { revenue: 0, ordersCount: 0 };
      return {
        hour,
        hourLabel: `${hour < 10 ? '0' : ''}${hour}:00`,
        revenue: stats.revenue,
        ordersCount: stats.ordersCount,
      };
    });

    // 9. Danh sách 8 đơn hàng gần nhất (recentOrders & activeOrders)
    const recentDocs = await this.orderModel
      .find({
        restaurantId: new Types.ObjectId(restaurantId),
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      })
      .sort({ createdAt: -1 })
      .limit(8)
      .exec();

    const recentOrders = recentDocs.map((o) => ({
      id: o._id.toString(),
      orderCode: o.orderCode,
      tableName: o.tableName,
      totalAmount: o.totalAmount || 0,
      status: o.status,
      itemCount: o.items?.length || 0,
      paymentMethod: o.paymentMethod || null,
      orderSource: o.orderSource,
      createdAt: (o as any).createdAt?.toISOString?.() || o.createdAt,
    }));

    // 10. Tóm tắt phương thức thanh toán (paymentMethodSummary)
    const methodStatsMap: Record<string, { count: number; revenue: number }> = {
      VietQR: { count: 0, revenue: 0 },
      Cash: { count: 0, revenue: 0 },
      Card: { count: 0, revenue: 0 },
      Transfer: { count: 0, revenue: 0 },
    };
    paidOrders.forEach((o) => {
      const method = (o.paymentMethod as string) || 'Cash';
      if (!methodStatsMap[method]) {
        methodStatsMap[method] = { count: 0, revenue: 0 };
      }
      methodStatsMap[method].count += 1;
      methodStatsMap[method].revenue += o.totalAmount || 0;
    });

    const vietQrRevenue = methodStatsMap['VietQR']?.revenue || 0;
    const vietQrPercentage = todayRevenue > 0 ? Math.round((vietQrRevenue / todayRevenue) * 1000) / 10 : 0;
    const paymentMethodSummary = {
      byMethod: methodStatsMap,
      vietQrRevenue,
      vietQrPercentage,
      VietQR: methodStatsMap['VietQR']?.revenue || 0,
      Cash: methodStatsMap['Cash']?.revenue || 0,
      Card: methodStatsMap['Card']?.revenue || 0,
      Transfer: methodStatsMap['Transfer']?.revenue || 0,
    };

    // 11. Phân bổ theo chi nhánh (Chỉ hiển thị khi chi nhánh chính xem toàn chuỗi)
    let branchBreakdown: any[] = [];
    if (isMainOrAdmin && !effectiveBranchId) {
      const branches = restaurant.branches || [];
      const branchRevenueMap: Record<string, { revenue: number; orderCount: number }> = {};

      paidOrders.forEach((o) => {
        const bId = o.branchId || 'unassigned';
        if (!branchRevenueMap[bId]) {
          branchRevenueMap[bId] = { revenue: 0, orderCount: 0 };
        }
        branchRevenueMap[bId].revenue += o.totalAmount || 0;
        branchRevenueMap[bId].orderCount += 1;
      });

      branchBreakdown = branches.map((b: any) => {
        const bId = b._id.toString();
        const stats = branchRevenueMap[bId] || { revenue: 0, orderCount: 0 };
        const pct = todayRevenue > 0 ? Math.round((stats.revenue / todayRevenue) * 100) : 0;
        return {
          branchId: bId,
          branchName: b.name,
          isMainBranch: !!b.isMainBranch,
          status: b.status,
          todayRevenue: stats.revenue,
          orderCount: stats.orderCount,
          percentage: pct,
        };
      });
    }

    // 12. Trả về hợp nhất Dual-Key (UI + Blueprint contract)
    return {
      date: dateStr,
      revenueToday: todayRevenue,
      todayRevenue,
      yesterdayRevenue,
      revenueGrowthRate,
      revenueChangePercent: revenueGrowthRate,
      occupiedTables: occupiedTablesCount,
      occupiedTablesCount,
      totalTables: totalTablesCount,
      totalTablesCount,
      occupancyRate,
      kitchenPendingOrders: pendingKitchenOrders,
      kitchenPendingCount: pendingKitchenOrders,
      pendingKitchenOrders,
      completedOrdersToday,
      completedOrdersCount: completedOrdersToday,
      averageOrderValue,
      hourlyRevenue,
      recentOrders,
      activeOrders: recentOrders,
      paymentMethodSummary,
      effectiveBranchId: effectiveBranchId || 'all',
      isConsolidated: !effectiveBranchId && !!isMainOrAdmin,
      branchBreakdown,
    };
  }
}
