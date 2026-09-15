import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from '../orders/entities/order.entity';
import { Restaurant, RestaurantDocument } from '../restaurants/entities/restaurant.entity';
import { RevenueQueryDto } from './dto/revenue-query.dto';
import { JwtUser } from '../auth/interface/jwtUser';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Restaurant.name) private readonly restaurantModel: Model<RestaurantDocument>,
  ) {}

  async getRevenueReport(restaurantId: string, query: RevenueQueryDto, caller?: JwtUser) {
    const restaurant = await this.restaurantModel.findById(restaurantId);
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy nhà hàng');
    }

    // 1. Xác thực phạm vi chi nhánh (Branch Scope Verification)
    let effectiveBranchId: string | undefined = undefined;

    if (caller && !caller.isMainBranch) {
      if (query.branchId && query.branchId !== caller.branchId) {
        throw new ForbiddenException('Bạn không có quyền xem báo cáo doanh thu của chi nhánh khác');
      }
      effectiveBranchId = caller.branchId;
    } else {
      if (query.branchId && query.branchId !== 'all') {
        effectiveBranchId = query.branchId;
      }
    }

    // 2. Phân giải khoảng thời gian (Date Range)
    const end = query.endDate ? new Date(query.endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const start = query.startDate
      ? new Date(query.startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);

    // 3. Match stage cho đơn hàng đã thanh toán
    const matchStage: any = {
      restaurantId: new Types.ObjectId(restaurantId),
      createdAt: { $gte: start, $lte: end },
      $or: [{ status: 'Paid' }, { isPaid: true }],
    };

    if (effectiveBranchId) {
      matchStage.branchId = effectiveBranchId;
    }

    // 4. Lấy tất cả các đơn hàng thỏa mãn
    const orders = await this.orderModel.find(matchStage).sort({ createdAt: 1 }).exec();

    // 5. Tính toán tổng quan (Summary)
    const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // 6. Phân bổ theo chi nhánh (byBranch)
    const branches = restaurant.branches || [];
    const branchStatsMap: Record<string, { revenue: number; orderCount: number }> = {};

    orders.forEach((o) => {
      const bId = o.branchId || 'unassigned';
      if (!branchStatsMap[bId]) {
        branchStatsMap[bId] = { revenue: 0, orderCount: 0 };
      }
      branchStatsMap[bId].revenue += o.totalAmount || 0;
      branchStatsMap[bId].orderCount += 1;
    });

    let byBranch = branches.map((b: any) => {
      const bId = b._id.toString();
      const stats = branchStatsMap[bId] || { revenue: 0, orderCount: 0 };
      return {
        branchId: bId,
        branchName: b.name,
        isMainBranch: !!b.isMainBranch,
        status: b.status,
        revenue: stats.revenue,
        orderCount: stats.orderCount,
        avgOrderValue: stats.orderCount > 0 ? Math.round(stats.revenue / stats.orderCount) : 0,
      };
    });

    if (effectiveBranchId) {
      byBranch = byBranch.filter((b) => b.branchId === effectiveBranchId);
    }

    // Tách riêng doanh thu chi nhánh chính vs các chi nhánh con
    const mainBranchStat = byBranch.find((b) => b.isMainBranch);
    const mainBranchRevenue = mainBranchStat?.revenue || 0;
    const childBranchesRevenue = byBranch
      .filter((b) => !b.isMainBranch)
      .reduce((sum, b) => sum + b.revenue, 0);

    // 7. Thống kê theo dòng thời gian (Timeline)
    const timelineMap: Record<string, { total: number; branches: Record<string, number> }> = {};

    orders.forEach((o) => {
      const createdAt = (o as any).createdAt ? new Date((o as any).createdAt) : new Date();
      const dateKey = createdAt.toISOString().split('T')[0];
      const bId = o.branchId || 'unassigned';

      if (!timelineMap[dateKey]) {
        timelineMap[dateKey] = { total: 0, branches: {} };
      }
      timelineMap[dateKey].total += o.totalAmount || 0;
      timelineMap[dateKey].branches[bId] =
        (timelineMap[dateKey].branches[bId] || 0) + (o.totalAmount || 0);
    });

    const timeline = Object.keys(timelineMap)
      .sort()
      .map((date) => ({
        date,
        total: timelineMap[date].total,
        branches: timelineMap[date].branches,
      }));

    return {
      summary: {
        totalRevenue,
        totalOrders,
        avgOrderValue,
        mainBranchRevenue,
        childBranchesRevenue,
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      },
      effectiveBranchId: effectiveBranchId || 'all',
      isConsolidated: !effectiveBranchId && !!caller?.isMainBranch,
      byBranch,
      timeline,
    };
  }

  async getTopItems(restaurantId: string, query: RevenueQueryDto, caller?: JwtUser) {
    const restaurant = await this.restaurantModel.findById(restaurantId);
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy nhà hàng');
    }

    let effectiveBranchId: string | undefined = undefined;

    if (caller && !caller.isMainBranch) {
      if (query.branchId && query.branchId !== caller.branchId) {
        throw new ForbiddenException('Bạn không có quyền xem báo cáo của chi nhánh khác');
      }
      effectiveBranchId = caller.branchId;
    } else {
      if (query.branchId && query.branchId !== 'all') {
        effectiveBranchId = query.branchId;
      }
    }

    const end = query.endDate ? new Date(query.endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const start = query.startDate
      ? new Date(query.startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);

    const matchStage: any = {
      restaurantId: new Types.ObjectId(restaurantId),
      createdAt: { $gte: start, $lte: end },
      $or: [{ status: 'Paid' }, { isPaid: true }],
    };

    if (effectiveBranchId) {
      matchStage.branchId = effectiveBranchId;
    }

    const limitCount = Number(query.limit) || 10;

    const pipeline: any[] = [
      { $match: matchStage },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.name',
          itemId: { $first: '$items.itemId' },
          itemName: { $first: '$items.name' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: {
            $sum: { $multiply: ['$items.price', '$items.quantity'] },
          },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: limitCount },
    ];

    const result = await this.orderModel.aggregate(pipeline);

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      effectiveBranchId: effectiveBranchId || 'all',
      items: result.map((r, index) => ({
        rank: index + 1,
        itemId: r.itemId,
        itemName: r.itemName,
        quantity: r.totalQuantity,
        revenue: r.totalRevenue,
      })),
    };
  }
}
