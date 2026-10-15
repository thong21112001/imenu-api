import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Bill, BillDocument } from './entities/bill.entity';
import { Restaurant, RestaurantDocument } from '../restaurants/entities/restaurant.entity';
import { Table, TableDocument } from '../tables/entities/table.entity';
import { QueryBillDto } from './dto/query-bill.dto';
import { ReceiptData } from './interfaces/receipt-data.interface';
import { EscPosEncoder } from './helpers/escpos-encoder.helper';
import {
  resolveEffectiveBankAccount,
  generateVietQRMemo,
  generateVietQRUrl,
} from './helpers/vietqr.helper';
import { buildVietnameseRegex } from '../../shared/common/utils/vietnamese-search.util';
import { JwtUser, isSuperAdminUser } from '../auth/interface/jwtUser';
import { ActivityAction, ActivityModule } from '../activity-log/constants/audit-log.const';

@Injectable()
export class BillsService implements OnModuleInit {
  private readonly logger = new Logger(BillsService.name);

  constructor(
    @InjectModel(Bill.name) private readonly billModel: Model<BillDocument>,
    @InjectModel(Restaurant.name) private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectModel(Table.name) private readonly tableModel: Model<TableDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    try {
      await this.billModel.collection.dropIndex('billCode_1');
    } catch {}
  }

  /**
   * Tạo hoặc lấy hóa đơn bất biến từ đơn hàng đã thanh toán (1:1 với Order)
   */
  async createOrGetFromPaidOrder(
    order: any,
    financial: {
      subTotal: number;
      discountAmount?: number;
      discountPercent?: number;
      taxableAmount?: number;
      serviceFee?: number;
      serviceFeePercent?: number;
      vatAmount?: number;
      vatPercent?: number;
      totalAmount: number;
    },
    cashierUser?: any,
    options?: {
      amountReceived?: number;
      changeAmount?: number;
      note?: string;
      paymentMethod?: string;
    },
  ): Promise<BillDocument> {
    const restaurantId = order.restaurantId?._id || order.restaurantId;
    const orderId = order._id;

    // 1. Kiểm tra xem Bill đã tồn tại trước đó chưa
    const existingBill = await this.billModel.findOne({
      restaurantId,
      orderId,
    });
    if (existingBill) {
      return existingBill;
    }

    // 2. Lấy thông tin nhà hàng & chi nhánh để chụp snapshot Header
    const restaurant = await this.restaurantModel.findById(restaurantId);
    let branchName = '';
    let address = restaurant?.address || '';
    let hotline = restaurant?.phone || '';
    let wifiSsid = '';
    let wifiPassword = '';

    if (order.branchId && Array.isArray(restaurant?.branches)) {
      const branch = restaurant.branches.find(
        (b: any) =>
          (b._id ? b._id.toString() : b.id ? b.id.toString() : '') === order.branchId.toString(),
      );
      if (branch) {
        branchName = branch.name || '';
        if (branch.address) address = branch.address;
        if (branch.phone) hotline = branch.phone;
      }
    }

    // Thử lấy thông tin wifi từ bàn ăn
    if (order.tableId) {
      const table = await this.tableModel.findById(order.tableId);
      if (table) {
        wifiSsid = table.wifiSsid || '';
        wifiPassword = table.wifiPassword || '';
      }
    }

    // 3. Phân giải tài khoản ngân hàng hiệu lực (Ưu tiên Branch -> Fallback Restaurant)
    const effectiveBank = resolveEffectiveBankAccount(restaurant, order.branchId?.toString());
    const paymentMethod = options?.paymentMethod || order.paymentMethod || 'VietQR';
    const memo = generateVietQRMemo(order.orderCode);
    let vietQrUrl = '';

    if (effectiveBank) {
      vietQrUrl = generateVietQRUrl({
        bankId: effectiveBank.bankId,
        accountNo: effectiveBank.accountNo,
        template: effectiveBank.template,
        amount: financial.totalAmount,
        memo,
        accountName: effectiveBank.accountName,
      });
    }

    // 4. Sinh mã hóa đơn billCode: BILL-YYMMDD-XXXX (đảm bảo không trùng lặp)
    const now = new Date();
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const countToday = await this.billModel.countDocuments({
      restaurantId: new Types.ObjectId(restaurantId),
      createdAt: { $gte: startOfDay },
    });
    const seq = (countToday + 1).toString().padStart(4, '0');
    let candidate = `BILL-${dateStr}-${seq}`;
    let attempt = 0;
    while (await this.billModel.exists({ restaurantId: new Types.ObjectId(restaurantId), billCode: candidate })) {
      attempt++;
      candidate = `BILL-${dateStr}-${seq}-${attempt}`;
    }
    const billCode = candidate;

    // 5. Chụp snapshot các món ăn (LOẠI TRỪ TOÀN BỘ MÓN CÓ STATUS === 'Cancelled')
    const activeItems = (order.items || []).filter((it: any) => it.status !== 'Cancelled');
    const itemsSnapshot = activeItems.map((it: any) => {
      const optionsNote = Array.isArray(it.selectedOptions)
        ? it.selectedOptions.map((o: any) => o.valueName || o.name).filter(Boolean).join(', ')
        : '';
      return {
        menuItemId: it.menuItemId?._id ? it.menuItemId._id.toString() : it.menuItemId?.toString() || it.id?.toString(),
        name: it.name,
        price: it.price,
        quantity: it.quantity,
        itemTotal: it.itemTotal || it.price * it.quantity,
        selectedOptions: it.selectedOptions || [],
        selectedOptionsNote: optionsNote,
        note: it.note || '',
        roundNumber: it.roundNumber || 1,
      };
    });

    const cashierId =
      cashierUser?._id ? new Types.ObjectId(cashierUser._id) :
      cashierUser?.userId ? new Types.ObjectId(cashierUser.userId) :
      cashierUser?.id && Types.ObjectId.isValid(cashierUser.id) ? new Types.ObjectId(cashierUser.id) : undefined;
    const cashierName = cashierUser?.fullName || cashierUser?.name || 'Thu ngân';

    try {
      const newBill = await this.billModel.create({
        billCode,
        orderId: new Types.ObjectId(orderId),
        orderCode: order.orderCode,
        tableId: new Types.ObjectId(order.tableId?._id || order.tableId),
        tableName: order.tableName,
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: order.branchId ? order.branchId.toString() : undefined,
        branchName: branchName || undefined,
        headerSnapshot: {
          restaurantName: restaurant?.name || 'Nhà hàng iMenu',
          branchName: branchName || undefined,
          address,
          hotline,
          wifiSsid: wifiSsid || undefined,
          wifiPassword: wifiPassword || undefined,
        },
        items: itemsSnapshot,
        subTotal: financial.subTotal,
        discountAmount: financial.discountAmount || 0,
        discountPercent: financial.discountPercent || 0,
        taxableBase: financial.taxableAmount || Math.max(0, financial.subTotal - (financial.discountAmount || 0)),
        serviceFee: financial.serviceFee || 0,
        serviceFeePercent: financial.serviceFeePercent || 0,
        vatAmount: financial.vatAmount || 0,
        vatPercent: financial.vatPercent || 0,
        finalAmount: financial.totalAmount,
        paymentMethod,
        amountReceived: options?.amountReceived ?? financial.totalAmount,
        changeAmount: options?.changeAmount ?? 0,
        paymentStatus: 'PAID',
        paidAt: order.closedAt || now,
        cashierId,
        cashierName,
        bankAccountSnapshot: effectiveBank || undefined,
        vietQrUrl: vietQrUrl || undefined,
        note: options?.note || '',
        printCount: 0,
      });

      return newBill;
    } catch (err: any) {
      // Trường hợp concurrency race: nếu trùng key, lấy bản ghi đã tạo
      if (err.code === 11000) {
        const found = await this.billModel.findOne({
          restaurantId: new Types.ObjectId(restaurantId),
          orderId: new Types.ObjectId(orderId),
        });
        if (found) return found;
      }
      throw err;
    }
  }

  /**
   * Truy vấn danh sách hóa đơn có bộ lọc, tìm kiếm và phân trang
   */
  async findAll(
    query: QueryBillDto,
    restaurantId: string,
    caller?: JwtUser,
  ): Promise<{
    data: Bill[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    if (!restaurantId || !Types.ObjectId.isValid(restaurantId)) {
      throw new BadRequestException('Mã nhà hàng không hợp lệ');
    }

    const restOid = new Types.ObjectId(restaurantId);
    const filter: any = { restaurantId: restOid };

    // Phân lập chi nhánh
    if (caller && !caller.isMainBranch && caller.branchId && !isSuperAdminUser(caller)) {
      filter.branchId = caller.branchId;
    } else if (query.branchId && query.branchId !== 'all') {
      filter.branchId = query.branchId;
    }

    if (query.paymentMethod) {
      filter.paymentMethod = query.paymentMethod;
    }

    if (query.paymentStatus) {
      filter.paymentStatus = query.paymentStatus;
    }

    if (query.fromDate || query.toDate) {
      filter.createdAt = {};
      if (query.fromDate) {
        filter.createdAt.$gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        const to = new Date(query.toDate);
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      const viRegex = buildVietnameseRegex(term);
      filter.$or = [
        { billCode: { $regex: term, $options: 'i' } },
        { orderCode: { $regex: term, $options: 'i' } },
        { tableName: viRegex },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      this.billModel.countDocuments(filter),
      this.billModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Xem chi tiết hóa đơn theo ID
   */
  async findById(
    id: string,
    restaurantId: string,
    caller?: JwtUser,
  ): Promise<{ bill: BillDocument; receiptData: ReceiptData }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã hóa đơn không hợp lệ');
    }

    const bill = await this.billModel.findOne({
      _id: new Types.ObjectId(id),
      restaurantId: new Types.ObjectId(restaurantId),
    });

    if (!bill) {
      throw new NotFoundException('Không tìm thấy hóa đơn');
    }

    this.checkBranchAccess(bill.branchId, caller);

    const receiptData = this.buildReceiptData(bill);
    return { bill, receiptData };
  }

  /**
   * Xem hóa đơn gắn liền với Order
   */
  async findByOrderId(
    orderId: string,
    restaurantId: string,
    caller?: JwtUser,
  ): Promise<{ bill: BillDocument; receiptData: ReceiptData }> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new BadRequestException('Mã đơn hàng không hợp lệ');
    }

    const bill = await this.billModel.findOne({
      orderId: new Types.ObjectId(orderId),
      restaurantId: new Types.ObjectId(restaurantId),
    });

    if (!bill) {
      throw new NotFoundException('Chưa có hóa đơn cho đơn hàng này');
    }

    this.checkBranchAccess(bill.branchId, caller);

    const receiptData = this.buildReceiptData(bill);
    return { bill, receiptData };
  }

  /**
   * Ghi nhận in hóa đơn: tăng printCount nguyên tử, cập nhật lastPrintedAt, phát sự kiện Audit Log PRINT
   */
  async printBill(
    id: string,
    restaurantId: string,
    user?: JwtUser,
  ): Promise<{ bill: BillDocument; receiptData: ReceiptData; escPosBase64: string }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã hóa đơn không hợp lệ');
    }

    const bill = await this.billModel.findOne({
      _id: new Types.ObjectId(id),
      restaurantId: new Types.ObjectId(restaurantId),
    });

    if (!bill) {
      throw new NotFoundException('Không tìm thấy hóa đơn');
    }

    this.checkBranchAccess(bill.branchId, user);

    const updatedBill = await this.billModel.findOneAndUpdate(
      { _id: bill._id, restaurantId: bill.restaurantId },
      {
        $inc: { printCount: 1 },
        $set: { lastPrintedAt: new Date() },
      },
      { new: true },
    );

    const receiptData = this.buildReceiptData(updatedBill || bill);
    const escPosBytes = EscPosEncoder.encode(receiptData, {
      kickDrawer: (updatedBill || bill).paymentMethod === 'Cash',
    });
    const escPosBase64 = EscPosEncoder.toBase64(escPosBytes);

    // Ghi nhận Audit Log
    const callerId = (user as any)?._id || user?.userId || (user as any)?.id;
    this.eventEmitter.emit('activity.log', {
      userId: callerId,
      userName: user?.fullName || 'Thu ngân',
      userRole: user?.role?.name || 'CASHIER',
      restaurantId,
      branchId: (updatedBill || bill).branchId,
      module: ActivityModule.BILL,
      action: ActivityAction.PRINT,
      targetId: (updatedBill || bill)._id.toString(),
      entityType: 'Bill',
      description: `In hóa đơn ${(updatedBill || bill).billCode} (Lần ${(updatedBill || bill).printCount})`,
      metadata: {
        billCode: (updatedBill || bill).billCode,
        orderCode: (updatedBill || bill).orderCode,
        printCount: (updatedBill || bill).printCount,
      },
      status: 'SUCCESS',
    });

    return {
      bill: updatedBill || bill,
      receiptData,
      escPosBase64,
    };
  }

  /**
   * Chuyển đổi Bill Document thành ReceiptData tiêu chuẩn
   */
  public buildReceiptData(bill: any): ReceiptData {
    return {
      header: {
        restaurantName: bill.headerSnapshot?.restaurantName || 'Nhà hàng iMenu',
        branchName: bill.branchName || bill.headerSnapshot?.branchName || '',
        address: bill.headerSnapshot?.address || '',
        hotline: bill.headerSnapshot?.hotline || '',
        wifiSsid: bill.headerSnapshot?.wifiSsid,
        wifiPassword: bill.headerSnapshot?.wifiPassword,
      },
      metadata: {
        receiptType: 'FINAL_BILL',
        billCode: bill.billCode,
        orderCode: bill.orderCode,
        tableName: bill.tableName,
        cashierName: bill.cashierName || 'Thu ngân',
        createdAt: bill.createdAt || new Date(),
        paidAt: bill.paidAt || bill.createdAt,
        printCount: bill.printCount,
      },
      items: (bill.items || []).map((it: any) => ({
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.price,
        amount: it.itemTotal,
        selectedOptionsNote: it.selectedOptionsNote,
        note: it.note,
        roundNumber: it.roundNumber,
      })),
      financials: {
        subTotal: bill.subTotal,
        discountAmount: bill.discountAmount || 0,
        discountPercent: bill.discountPercent || 0,
        taxableAmount: bill.taxableBase || bill.subTotal - (bill.discountAmount || 0),
        serviceFee: bill.serviceFee || 0,
        serviceFeePercent: bill.serviceFeePercent || 0,
        vatPercent: bill.vatPercent || 0,
        vatAmount: bill.vatAmount || 0,
        totalAmount: bill.finalAmount,
        paymentMethod: bill.paymentMethod,
        cashGiven: bill.amountReceived,
        cashChange: bill.changeAmount,
      },
      paymentQr: bill.bankAccountSnapshot
        ? {
            vietQrPayloadUrl: bill.vietQrUrl || '',
            accountNo: bill.bankAccountSnapshot.accountNo || '',
            bankName: bill.bankAccountSnapshot.bankName || '',
            accountName: bill.bankAccountSnapshot.accountName || '',
            memo: generateVietQRMemo(bill.orderCode),
          }
        : undefined,
      footer: {
        thankYouMessage: 'Cảm ơn quý khách và hẹn gặp lại!',
        softwareCredit: 'Hóa đơn khởi tạo bởi iMenu POS Cloud',
      },
    };
  }

  private checkBranchAccess(branchId?: string, caller?: JwtUser) {
    if (!caller || isSuperAdminUser(caller) || caller.isMainBranch) return;
    if (branchId && caller.branchId && branchId.toString() !== caller.branchId.toString()) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên hóa đơn thuộc chi nhánh khác');
    }
  }
}
