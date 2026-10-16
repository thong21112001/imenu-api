import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from '../orders/entities/order.entity';
import { Restaurant, RestaurantDocument } from '../restaurants/entities/restaurant.entity';
import { RevenueQueryDto } from './dto/revenue-query.dto';
import { JwtUser } from '../auth/interface/jwtUser';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ActivityAction, ActivityModule } from '../activity-log/constants/audit-log.const';

/**
 * Helper phân giải khoảng ngày theo múi giờ Việt Nam (+07:00)
 */
function parseDateRangeVietnam(startDateStr?: string, endDateStr?: string) {
  let start: Date;
  let end: Date;

  if (endDateStr) {
    const cleanEnd = endDateStr.split('T')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanEnd)) {
      throw new BadRequestException('endDate không hợp lệ. Vui lòng truyền định dạng YYYY-MM-DD');
    }
    end = new Date(`${cleanEnd}T23:59:59.999+07:00`);
  } else {
    const now = new Date();
    const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const todayStr = vnNow.toISOString().split('T')[0];
    end = new Date(`${todayStr}T23:59:59.999+07:00`);
  }

  if (startDateStr) {
    const cleanStart = startDateStr.split('T')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanStart)) {
      throw new BadRequestException('startDate không hợp lệ. Vui lòng truyền định dạng YYYY-MM-DD');
    }
    start = new Date(`${cleanStart}T00:00:00.000+07:00`);
  } else {
    // Mặc định 30 ngày trước end
    start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    const vnStart = new Date(start.getTime() + 7 * 60 * 60 * 1000);
    const startStr = vnStart.toISOString().split('T')[0];
    start = new Date(`${startStr}T00:00:00.000+07:00`);
  }

  if (start.getTime() > end.getTime()) {
    throw new BadRequestException('startDate phải nhỏ hơn hoặc bằng endDate');
  }

  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays > 366) {
    throw new BadRequestException('Khoảng cách giữa startDate và endDate không được vượt quá 366 ngày');
  }

  const startVnStr = new Date(start.getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endVnStr = new Date(end.getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];

  return { start, end, startVnStr, endVnStr };
}

/**
 * Phòng chống CSV Formula Injection (CWE-1236)
 */
function sanitizeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/\r\n/g, ' ').replace(/\n/g, ' ');
  // Nếu ký tự đầu là =, +, -, @, \t, \r -> prefix nháy đơn '
  if (/^[=+\-@\t\r]/.test(str)) {
    return `"'${str.replace(/"/g, '""')}"`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Restaurant.name) private readonly restaurantModel: Model<RestaurantDocument>,
    private readonly activityLogService: ActivityLogService,
  ) {}

  private resolveBranchScope(caller?: JwtUser, queryBranchId?: string): string | undefined {
    let effectiveBranchId: string | undefined = undefined;
    const isMainOrAdmin =
      !caller ||
      !!caller.isMainBranch ||
      !!(caller as any)?.isOwner ||
      caller.role?.slug === 'restaurant_admin' ||
      caller.role?.slug === 'system_admin' ||
      caller.role?.slug === 'super_admin';

    if (!isMainOrAdmin) {
      if (queryBranchId && queryBranchId !== caller.branchId) {
        throw new ForbiddenException('Bạn không có quyền xem báo cáo của chi nhánh khác');
      }
      effectiveBranchId = caller.branchId;
    } else {
      if (queryBranchId && queryBranchId !== 'all') {
        effectiveBranchId = queryBranchId;
      }
    }
    return effectiveBranchId;
  }

  async getRevenueReport(restaurantId: string, query: RevenueQueryDto, caller?: JwtUser) {
    const restaurant = await this.restaurantModel.findById(restaurantId);
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy nhà hàng');
    }

    const effectiveBranchId = this.resolveBranchScope(caller, query.branchId);
    const { start, end, startVnStr, endVnStr } = parseDateRangeVietnam(query.startDate, query.endDate);

    // Truy vấn tất cả đơn hàng phát sinh trong khoảng thời gian
    const orderMatch: any = {
      restaurantId: new Types.ObjectId(restaurantId),
      createdAt: { $gte: start, $lte: end },
    };
    if (effectiveBranchId) {
      orderMatch.branchId = effectiveBranchId;
    }

    const allOrders = await this.orderModel.find(orderMatch).sort({ createdAt: 1 }).exec();
    const paidOrders = allOrders.filter((o) => o.status === 'Paid' || o.isPaid === true);
    const completedOrders = paidOrders.length;
    const cancelledOrders = allOrders.filter((o) => o.status === 'Cancelled').length;
    const orderCount = allOrders.length;

    // Tính toán tài chính
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const subTotal = paidOrders.reduce((sum, o) => sum + (o.subTotal || 0), 0);
    const totalDiscount = paidOrders.reduce((sum, o) => sum + (o.discountAmount || 0), 0);
    const totalServiceFee = paidOrders.reduce((sum, o) => sum + (o.serviceFee || 0), 0);
    const totalVat = paidOrders.reduce((sum, o) => sum + (o.vatAmount || 0), 0);
    const totalGuests = paidOrders.reduce((sum, o) => sum + ((o as any).guestCount || 2), 0);
    const averageOrderValue = completedOrders > 0 ? Math.round(totalRevenue / completedOrders) : 0;

    // Thống kê theo phương thức thanh toán
    const methodMap: Record<string, { label: string; count: number; revenue: number }> = {
      VietQR: { label: 'Chuyển khoản VietQR', count: 0, revenue: 0 },
      Cash: { label: 'Tiền mặt', count: 0, revenue: 0 },
      Card: { label: 'Thẻ ngân hàng', count: 0, revenue: 0 },
      Transfer: { label: 'Chuyển khoản khác', count: 0, revenue: 0 },
    };

    paidOrders.forEach((o) => {
      const m = (o.paymentMethod as string) || 'Cash';
      if (!methodMap[m]) {
        methodMap[m] = { label: m, count: 0, revenue: 0 };
      }
      methodMap[m].count += 1;
      methodMap[m].revenue += o.totalAmount || 0;
    });

    const paymentMethodStats = Object.entries(methodMap).map(([method, val]) => ({
      method,
      label: val.label,
      orderCount: val.count,
      revenue: val.revenue,
      percentage: totalRevenue > 0 ? Math.round((val.revenue / totalRevenue) * 1000) / 10 : 0,
    }));

    const vietQrRevenue = methodMap['VietQR'].revenue;
    const vietQrPercentage = totalRevenue > 0 ? Math.round((vietQrRevenue / totalRevenue) * 1000) / 10 : 0;

    // Phân bổ theo chi nhánh
    const branches = restaurant.branches || [];
    const branchStatsMap: Record<string, { revenue: number; orderCount: number }> = {};

    paidOrders.forEach((o) => {
      const bId = o.branchId || 'unassigned';
      if (!branchStatsMap[bId]) {
        branchStatsMap[bId] = { revenue: 0, orderCount: 0 };
      }
      branchStatsMap[bId].revenue += o.totalAmount || 0;
      branchStatsMap[bId].orderCount += 1;
    });

    let branchBreakdown = branches.map((b: any) => {
      const bId = b._id.toString();
      const stats = branchStatsMap[bId] || { revenue: 0, orderCount: 0 };
      const pct = totalRevenue > 0 ? Math.round((stats.revenue / totalRevenue) * 1000) / 10 : 0;
      return {
        branchId: bId,
        branchName: b.name,
        isMainBranch: !!b.isMainBranch,
        status: b.status,
        revenue: stats.revenue,
        orderCount: stats.orderCount,
        percentage: pct,
        averageOrderValue: stats.orderCount > 0 ? Math.round(stats.revenue / stats.orderCount) : 0,
      };
    });

    if (effectiveBranchId) {
      branchBreakdown = branchBreakdown.filter((b) => b.branchId === effectiveBranchId);
    }

    const mainBranchStat = branchBreakdown.find((b) => b.isMainBranch);
    const mainBranchRevenue = mainBranchStat?.revenue || 0;
    const childBranchesRevenue = branchBreakdown
      .filter((b) => !b.isMainBranch)
      .reduce((sum, b) => sum + b.revenue, 0);

    // Gom nhóm dòng thời gian (timeline) theo múi giờ Việt Nam +07:00
    const timelineMap: Record<string, { total: number; orderCount: number; branches: Record<string, number> }> = {};

    paidOrders.forEach((o) => {
      const createdAt = (o as any).createdAt ? new Date((o as any).createdAt) : new Date();
      const vnTime = new Date(createdAt.getTime() + 7 * 60 * 60 * 1000);
      let dateKey = vnTime.toISOString().split('T')[0];
      if (query.groupBy === 'month' || query.period === 'monthly') {
        dateKey = dateKey.slice(0, 7); // YYYY-MM
      }
      const bId = o.branchId || 'unassigned';

      if (!timelineMap[dateKey]) {
        timelineMap[dateKey] = { total: 0, orderCount: 0, branches: {} };
      }
      timelineMap[dateKey].total += o.totalAmount || 0;
      timelineMap[dateKey].orderCount += 1;
      timelineMap[dateKey].branches[bId] =
        (timelineMap[dateKey].branches[bId] || 0) + (o.totalAmount || 0);
    });

    const timeline = Object.keys(timelineMap)
      .sort()
      .map((date) => ({
        date,
        dateLabel: date,
        revenue: timelineMap[date].total,
        orderCount: timelineMap[date].orderCount,
        branches: timelineMap[date].branches,
      }));

    // Trả về hợp nhất Dual Output (phẳng ở root + lồng trong summary/byBranch)
    return {
      branchId: effectiveBranchId || null,
      startDate: startVnStr,
      endDate: endVnStr,
      totalRevenue,
      subTotal,
      totalDiscount,
      totalServiceFee,
      totalVat,
      orderCount,
      completedOrders,
      cancelledOrders,
      totalGuests,
      averageOrderValue,
      vietQrPercentage,
      paymentMethodStats,
      branchBreakdown,
      timeline,
      effectiveBranchId: effectiveBranchId || 'all',
      isConsolidated: !effectiveBranchId && (!caller || !!caller.isMainBranch || !!(caller as any)?.isOwner || caller.role?.slug === 'restaurant_admin'),

      summary: {
        totalRevenue,
        subTotal,
        totalDiscount,
        totalServiceFee,
        totalVat,
        totalOrders: orderCount,
        completedOrders,
        cancelledOrders,
        totalGuests,
        avgOrderValue: averageOrderValue,
        averageOrderValue,
        vietQrPercentage,
        mainBranchRevenue,
        childBranchesRevenue,
        startDate: startVnStr,
        endDate: endVnStr,
      },
      byBranch: branchBreakdown,
    };
  }

  async getTopItems(restaurantId: string, query: RevenueQueryDto, caller?: JwtUser) {
    const restaurant = await this.restaurantModel.findById(restaurantId);
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy nhà hàng');
    }

    const effectiveBranchId = this.resolveBranchScope(caller, query.branchId);
    const { start, end, startVnStr, endVnStr } = parseDateRangeVietnam(query.startDate, query.endDate);

    const matchStage: any = {
      restaurantId: new Types.ObjectId(restaurantId),
      createdAt: { $gte: start, $lte: end },
      $or: [{ status: 'Paid' }, { isPaid: true }],
    };

    if (effectiveBranchId) {
      matchStage.branchId = effectiveBranchId;
    }

    const pipeline: any[] = [
      { $match: matchStage },
      { $unwind: '$items' },
      // BẮT BUỘC: Lọc bỏ món đã hủy
      { $match: { 'items.status': { $ne: 'Cancelled' } } },
      {
        $group: {
          _id: { menuItemId: '$items.menuItemId', name: '$items.name' },
          itemId: { $first: '$items.menuItemId' },
          name: { $first: '$items.name' },
          quantity: { $sum: '$items.quantity' },
          revenue: {
            $sum: {
              $ifNull: [
                '$items.itemTotal',
                { $multiply: [{ $ifNull: ['$items.price', 0] }, { $ifNull: ['$items.quantity', 1] }] },
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'menu_items',
          localField: 'itemId',
          foreignField: '_id',
          as: 'itemDoc',
        },
      },
      {
        $unwind: {
          path: '$itemDoc',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'menu_categories',
          localField: 'itemDoc.category',
          foreignField: '_id',
          as: 'catDoc',
        },
      },
      {
        $unwind: {
          path: '$catDoc',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          itemId: { $ifNull: ['$itemId', '$_id.menuItemId'] },
          name: 1,
          quantity: 1,
          revenue: 1,
          categoryName: {
            $ifNull: ['$catDoc.name', { $ifNull: ['$itemDoc.categoryName', 'Món chính'] }],
          },
        },
      },
      { $sort: { revenue: -1, quantity: -1 } },
    ];

    const rawTop = await this.orderModel.aggregate(pipeline);
    const totalTopRevenue = rawTop.reduce((sum, it) => sum + (it.revenue || 0), 0);
    const limitCount = Number(query.limit) || 10;

    const topItems = rawTop.slice(0, limitCount).map((it, idx) => ({
      rank: idx + 1,
      itemId: it.itemId ? it.itemId.toString() : `item-${idx + 1}`,
      name: it.name,
      itemName: it.name,
      categoryName: it.categoryName,
      quantity: it.quantity,
      revenue: it.revenue,
      percentageOfRevenue: totalTopRevenue > 0 ? Math.round((it.revenue / totalTopRevenue) * 1000) / 10 : 0,
    }));

    // Phân bổ doanh thu theo danh mục món
    const catMap: Record<string, { quantity: number; revenue: number }> = {};
    rawTop.forEach((it) => {
      const c = it.categoryName || 'Khác';
      if (!catMap[c]) catMap[c] = { quantity: 0, revenue: 0 };
      catMap[c].quantity += it.quantity;
      catMap[c].revenue += it.revenue;
    });

    const categoryBreakdown = Object.entries(catMap).map(([catName, stats]) => ({
      categoryName: catName,
      quantity: stats.quantity,
      revenue: stats.revenue,
      percentage: totalTopRevenue > 0 ? Math.round((stats.revenue / totalTopRevenue) * 1000) / 10 : 0,
    }));

    return {
      startDate: startVnStr,
      endDate: endVnStr,
      effectiveBranchId: effectiveBranchId || 'all',
      totalRevenue: totalTopRevenue,
      items: topItems,
      categoryBreakdown,
    };
  }

  async exportReport(restaurantId: string, query: RevenueQueryDto, user: JwtUser): Promise<string> {
    const revReport = await this.getRevenueReport(restaurantId, query, user);
    const topItemsData = await this.getTopItems(restaurantId, query, user);

    // Ghi nhận Audit Log
    try {
      await this.activityLogService.handleActivityLog({
        userId: user.userId,
        userName: user.fullName || user.username || user.email,
        userRole: (user.role as any)?.slug || (user.role as any)?.name || 'staff',
        restaurantId,
        branchId: revReport.branchId || user.branchId,
        module: ActivityModule.REPORT,
        action: ActivityAction.EXPORT,
        description: `Xuất báo cáo doanh thu từ ${revReport.startDate} đến ${revReport.endDate}`,
        metadata: {
          startDate: revReport.startDate,
          endDate: revReport.endDate,
          branchId: revReport.branchId,
          totalRevenue: revReport.totalRevenue,
          orderCount: revReport.orderCount,
        },
        status: 'SUCCESS',
      });
    } catch (logErr: any) {
      this.logger.warn(`Lỗi ghi audit log export: ${logErr.message}`);
    }

    // Nếu format là json -> trả chuỗi JSON
    if (query.format === 'json') {
      return JSON.stringify({ revenue: revReport, topItems: topItemsData }, null, 2);
    }

    // Xuất CSV UTF-8 BOM kèm chống Formula Injection
    const lines: string[] = [];

    // Khối 1: Tóm tắt
    lines.push([sanitizeCsvCell('BÁO CÁO DOANH THU VÀ HOẠT ĐỘNG KINH DOANH - iMenu')].join(','));
    lines.push([sanitizeCsvCell('Từ ngày'), sanitizeCsvCell(revReport.startDate), sanitizeCsvCell('Đến ngày'), sanitizeCsvCell(revReport.endDate)].join(','));
    lines.push('');
    lines.push([sanitizeCsvCell('CHỈ SỐ TỔNG HỢP'), sanitizeCsvCell('GIÁ TRỊ')].join(','));
    lines.push([sanitizeCsvCell('Tổng doanh thu (VNĐ)'), sanitizeCsvCell(revReport.totalRevenue)].join(','));
    lines.push([sanitizeCsvCell('Tạm tính món (VNĐ)'), sanitizeCsvCell(revReport.subTotal)].join(','));
    lines.push([sanitizeCsvCell('Tổng giảm giá (VNĐ)'), sanitizeCsvCell(revReport.totalDiscount)].join(','));
    lines.push([sanitizeCsvCell('Tổng phí dịch vụ (VNĐ)'), sanitizeCsvCell(revReport.totalServiceFee)].join(','));
    lines.push([sanitizeCsvCell('Tổng thuế VAT (VNĐ)'), sanitizeCsvCell(revReport.totalVat)].join(','));
    lines.push([sanitizeCsvCell('Tổng số đơn phát sinh'), sanitizeCsvCell(revReport.orderCount)].join(','));
    lines.push([sanitizeCsvCell('Số đơn hoàn thành'), sanitizeCsvCell(revReport.completedOrders)].join(','));
    lines.push([sanitizeCsvCell('Số đơn đã hủy'), sanitizeCsvCell(revReport.cancelledOrders)].join(','));
    lines.push([sanitizeCsvCell('Tổng lượt khách ước tính'), sanitizeCsvCell(revReport.totalGuests)].join(','));
    lines.push([sanitizeCsvCell('Giá trị đơn trung bình AOV (VNĐ)'), sanitizeCsvCell(revReport.averageOrderValue)].join(','));
    lines.push([sanitizeCsvCell('Tỷ trọng VietQR (%)'), sanitizeCsvCell(`${revReport.vietQrPercentage}%`)].join(','));
    lines.push('');

    // Khối 2: Tỷ trọng phương thức thanh toán
    lines.push([sanitizeCsvCell('PHƯƠNG THỨC THANH TOÁN'), sanitizeCsvCell('SỐ ĐƠN'), sanitizeCsvCell('DOANH THU (VNĐ)'), sanitizeCsvCell('TỶ TRỌNG (%)')].join(','));
    revReport.paymentMethodStats.forEach((p) => {
      lines.push([
        sanitizeCsvCell(p.label),
        sanitizeCsvCell(p.orderCount),
        sanitizeCsvCell(p.revenue),
        sanitizeCsvCell(`${p.percentage}%`),
      ].join(','));
    });
    lines.push('');

    // Khối 3: Phân bổ theo chi nhánh
    if (revReport.branchBreakdown && revReport.branchBreakdown.length > 0) {
      lines.push([sanitizeCsvCell('CHI NHÁNH'), sanitizeCsvCell('TRỤ SỞ'), sanitizeCsvCell('SỐ ĐƠN'), sanitizeCsvCell('DOANH THU (VNĐ)'), sanitizeCsvCell('TỶ TRỌNG (%)')].join(','));
      revReport.branchBreakdown.forEach((b) => {
        lines.push([
          sanitizeCsvCell(b.branchName),
          sanitizeCsvCell(b.isMainBranch ? 'Trụ sở chính' : 'Chi nhánh con'),
          sanitizeCsvCell(b.orderCount),
          sanitizeCsvCell(b.revenue),
          sanitizeCsvCell(`${b.percentage}%`),
        ].join(','));
      });
      lines.push('');
    }

    // Khối 4: Top món bán chạy
    lines.push([sanitizeCsvCell('HẠNG'), sanitizeCsvCell('TÊN MÓN ĂN'), sanitizeCsvCell('DANH MỤC'), sanitizeCsvCell('SỐ LƯỢNG BÁN'), sanitizeCsvCell('DOANH THU (VNĐ)'), sanitizeCsvCell('TỶ TRỌNG DOANH SỐ (%)')].join(','));
    topItemsData.items.forEach((it) => {
      lines.push([
        sanitizeCsvCell(it.rank),
        sanitizeCsvCell(it.name),
        sanitizeCsvCell(it.categoryName),
        sanitizeCsvCell(it.quantity),
        sanitizeCsvCell(it.revenue),
        sanitizeCsvCell(`${it.percentageOfRevenue}%`),
      ].join(','));
    });

    return lines.join('\r\n');
  }
}
