import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from '../orders/entities/order.entity';
import { Table, TableDocument } from '../tables/entities/table.entity';
import { Restaurant, RestaurantDocument } from '../restaurants/entities/restaurant.entity';
import { JwtUser } from '../auth/interface/jwtUser';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Table.name) private readonly tableModel: Model<TableDocument>,
    @InjectModel(Restaurant.name) private readonly restaurantModel: Model<RestaurantDocument>,
  ) {}

  async getOverview(restaurantId: string, queryBranchId?: string, caller?: JwtUser) {
    const restaurant = await this.restaurantModel.findById(restaurantId);
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy nhà hàng');
    }

    // Xác định phạm vi branch
    let effectiveBranchId: string | undefined = undefined;

    if (caller && !caller.isMainBranch) {
      // Chi nhánh con chỉ xem được dữ liệu của mình
      if (queryBranchId && queryBranchId !== caller.branchId) {
        throw new ForbiddenException('Bạn không có quyền truy cập dữ liệu bảng điều khiển của chi nhánh khác');
      }
      effectiveBranchId = caller.branchId;
    } else {
      // Chi nhánh chính có thể lọc theo chi nhánh cụ thể hoặc xem toàn bộ chuỗi
      if (queryBranchId && queryBranchId !== 'all') {
        effectiveBranchId = queryBranchId;
      }
    }

    // Thời gian đầu ngày hôm nay (00:00:00) theo giờ địa phương
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Filter đơn hàng hôm nay
    const orderMatch: any = {
      restaurantId: new Types.ObjectId(restaurantId),
      createdAt: { $gte: startOfToday, $lte: endOfToday },
    };
    if (effectiveBranchId) {
      orderMatch.branchId = effectiveBranchId;
    }

    // 1. Doanh thu & số đơn đã thanh toán hôm nay
    const paidOrders = await this.orderModel.find({
      ...orderMatch,
      $or: [{ status: 'Paid' }, { isPaid: true }],
    });
    const todayRevenue = paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const completedOrdersToday = paidOrders.length;

    // 2. Trạng thái bàn (Bàn đang phục vụ & tổng số bàn)
    const tableFilter: any = {
      restaurantId: new Types.ObjectId(restaurantId),
    };
    if (effectiveBranchId) {
      tableFilter.branchId = effectiveBranchId;
    }

    const tables = await this.tableModel.find(tableFilter);
    const totalTablesCount = tables.length;
    const occupiedTablesCount = tables.filter(
      (t) => t.status === 'Occupied' || t.status === 'PaymentRequested',
    ).length;

    // 3. Đơn đang chờ chế biến trong bếp
    const pendingKitchenOrders = await this.orderModel.countDocuments({
      restaurantId: new Types.ObjectId(restaurantId),
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      status: { $in: ['WaitingConfirmation', 'Preparing'] },
    });

    // 4. Phân bổ theo chi nhánh (Chỉ hiển thị cho chi nhánh chính khi xem toàn chuỗi)
    let branchBreakdown: any[] = [];
    if (caller?.isMainBranch && !effectiveBranchId) {
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
        return {
          branchId: bId,
          branchName: b.name,
          isMainBranch: !!b.isMainBranch,
          status: b.status,
          todayRevenue: stats.revenue,
          orderCount: stats.orderCount,
        };
      });
    }

    return {
      todayRevenue,
      completedOrdersToday,
      occupiedTablesCount,
      totalTablesCount,
      occupancyRate: totalTablesCount > 0 ? Math.round((occupiedTablesCount / totalTablesCount) * 100) : 0,
      pendingKitchenOrders,
      effectiveBranchId: effectiveBranchId || 'all',
      isConsolidated: !effectiveBranchId && !!caller?.isMainBranch,
      branchBreakdown,
    };
  }
}
