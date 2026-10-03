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
import { Order, OrderDocument, OrderStatus } from './entities/order.entity';
import { Table, TableDocument } from '../tables/entities/table.entity';
import { MenuItem, MenuItemDocument } from '../menu/entities/menu-item.entity';
import { Restaurant, RestaurantDocument } from '../restaurants/entities/restaurant.entity';
import { OrderItem, OrderItemStatus } from './entities/order-item.schema';
import { OrderRound, RoundStatus } from './entities/order-round.schema';
import { OrderStateValidator } from './domain/order-state.validator';
import { calculateOrderStatus } from './domain/order-status.reducer';
import { OrderFinancialCalculator } from './domain/order-financial.calculator';
import { CreateOrderDto, AddItemsToOrderDto, CreateOrderItemDto } from './dto/create-order.dto';
import {
  CustomerCreateOrderDto,
  CustomerAddItemsDto,
  CustomerGetActiveOrderDto,
} from './dto/customer-order.dto';
import { UpdateItemStatusDto } from './dto/update-item-status.dto';
import {
  UpdateOrderStatusDto,
  CancelOrderDto,
  CancelOrderItemDto,
  ConfirmRoundDto,
  CancelRoundDto,
} from './dto/update-order-status.dto';
import { PayOrderDto } from './dto/pay-order.dto';
import { BillPreviewDto } from './dto/bill-preview.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { isSuperAdminUser, JwtUser } from '../auth/interface/jwtUser';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Table.name) private readonly tableModel: Model<TableDocument>,
    @InjectModel(MenuItem.name) private readonly menuItemModel: Model<MenuItemDocument>,
    @InjectModel(Restaurant.name) private readonly restaurantModel: Model<RestaurantDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Tạo đơn hàng mới từ POS hoặc QR bàn
   */
  async create(dto: CreateOrderDto, restaurantId: string, user?: any): Promise<Order> {
    const table = await this.tableModel.findOne({
      _id: new Types.ObjectId(dto.tableId),
      restaurantId: new Types.ObjectId(restaurantId),
      isDeleted: { $ne: true },
    });

    if (!table) {
      throw new NotFoundException('Không tìm thấy bàn ăn');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Đơn hàng phải chứa ít nhất 1 món ăn');
    }

    // Kiểm tra bàn đang có đơn hàng hoạt động tại quầy POS (409 Conflict)
    if (dto.orderSource !== 'QR_CUSTOMER' && table.status === 'Occupied' && table.currentOrderId) {
      throw new ConflictException(
        `Bàn "${table.name}" hiện đang có khách với đơn hàng chưa thanh toán`,
      );
    }

    // Xác định branchId: bắt buộc string (Architecture Decision đã khóa)
    let resolvedBranchId = dto.branchId || table.branchId;
    if (!resolvedBranchId) {
      const restaurant = await this.restaurantModel.findById(restaurantId);
      const mainBranch = restaurant?.branches?.find((b: any) => b.isMainBranch && !b.isDeleted);
      resolvedBranchId = (mainBranch as any)?._id
        ? (mainBranch as any)._id.toString()
        : (restaurant?.branches?.[0] as any)?._id?.toString() || 'default';
    }

    const isQR = dto.orderSource === 'QR_CUSTOMER';
    const initialItemStatus: OrderItemStatus = isQR ? 'WaitingConfirmation' : 'Waiting';
    const initialRoundStatus: RoundStatus = isQR ? 'WaitingConfirmation' : 'Confirmed';
    const initialOrderStatus: OrderStatus = isQR ? 'WaitingConfirmation' : 'Preparing';

    // 1. Snapshot giá và danh sách món từ DB thực đơn
    const processedItems = await this.processOrderItems(
      dto.items,
      restaurantId,
      resolvedBranchId,
      1,
      initialItemStatus,
    );

    const subTotal = processedItems.reduce((sum, it) => sum + it.itemTotal, 0);
    const totalAmount = subTotal;

    // 2. Tự động sinh mã đơn hàng chuẩn quy cách ORD-YYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderCode = `ORD-${dateStr}-${randomSuffix}`;

    const userOid = user?._id || user?.userId || user?.id;
    const validUserOid = userOid && Types.ObjectId.isValid(userOid) ? new Types.ObjectId(userOid) : undefined;

    // Khởi tạo Round 1
    const round1: OrderRound = {
      roundNumber: 1,
      source: isQR ? 'QR_CUSTOMER' : 'STAFF_POS',
      status: initialRoundStatus,
      createdAt: new Date(),
      confirmedAt: isQR ? undefined : new Date(),
      confirmedBy: isQR ? undefined : validUserOid,
      roundSubTotal: subTotal,
    };

    const order = new this.orderModel({
      orderCode,
      tableId: table._id,
      tableName: table.name,
      restaurantId: new Types.ObjectId(restaurantId),
      branchId: resolvedBranchId,
      rounds: [round1],
      items: processedItems,
      subTotal,
      discountAmount: 0,
      serviceFee: 0,
      vatAmount: 0,
      totalAmount,
      status: initialOrderStatus,
      isPaid: false,
      orderSource: isQR ? 'QR_CUSTOMER' : 'STAFF_POS',
      customerNote: dto.customerNote || '',
      openedAt: new Date(),
      createdBy: validUserOid,
    });

    const savedOrder = await order.save();

    // 3. Cập nhật trạng thái bàn sang Occupied
    table.status = 'Occupied';
    table.currentOrderId = savedOrder._id as any;
    if (!table.activeSince) {
      table.activeSince = new Date();
    }
    await table.save();

    // 4. Phát sóng sự kiện Realtime qua WebSocket
    this.eventEmitter.emit('order.created', {
      order: savedOrder.toObject(),
      restaurantId,
      branchId: savedOrder.branchId,
    });

    this.eventEmitter.emit('table.status_updated', {
      table: table.toObject(),
      restaurantId,
      branchId: table.branchId,
    });

    return savedOrder;
  }

  /**
   * SUB-PHASE 6.4: Xác thực danh tính phiên quét mã QR của bàn:
   * 1. restaurantSlug -> Tìm nhà hàng hợp lệ
   * 2. tableCode -> Tìm bàn ăn thuộc nhà hàng đó (Bảo đảm Tenant Isolation & chặn Cross-restaurant)
   * 3. qrToken -> Khớp mã bí mật của bàn
   * 4. qrStatus -> Bắt buộc phải là ACTIVE
   */
  async validateQrSession(
    restaurantSlug: string,
    tableCode: string,
    qrToken: string,
  ): Promise<{ restaurant: RestaurantDocument; table: TableDocument }> {
    if (!restaurantSlug || typeof restaurantSlug !== 'string' || !restaurantSlug.trim()) {
      throw new BadRequestException('restaurantSlug không được để trống');
    }
    if (!tableCode || typeof tableCode !== 'string' || !tableCode.trim()) {
      throw new BadRequestException('tableCode không được để trống');
    }
    if (!qrToken || typeof qrToken !== 'string' || !qrToken.trim()) {
      throw new BadRequestException('qrToken không được để trống');
    }

    // 1. Tìm nhà hàng theo slug
    const normalizedSlug = restaurantSlug.toLowerCase().trim();
    const restaurant = await this.restaurantModel.findOne({ slug: normalizedSlug });
    if (!restaurant) {
      throw new NotFoundException(`Không tìm thấy nhà hàng với mã: ${restaurantSlug}`);
    }

    // 2. Tìm bàn ăn theo mã bàn thuộc nhà hàng (Cưỡng chế Restaurant Isolation)
    const normalizedCode = tableCode.trim();
    const table = await this.tableModel.findOne({
      code: normalizedCode,
      restaurantId: restaurant._id,
      isDeleted: { $ne: true },
    });
    if (!table) {
      throw new NotFoundException(
        `Không tìm thấy bàn ăn "${tableCode}" thuộc nhà hàng "${restaurant.name}"`,
      );
    }

    // 3. Khớp mã bí mật qrToken
    if (!table.qrToken || table.qrToken.trim() !== qrToken.trim()) {
      throw new BadRequestException('Mã xác thực QR bàn không hợp lệ (Invalid QR Token)');
    }

    // 4. Bắt buộc trạng thái mã QR phải là ACTIVE
    if (!table.qrStatus || table.qrStatus.toLowerCase() !== 'active') {
      throw new BadRequestException(
        `Mã QR của bàn "${table.name}" hiện không hoạt động hoặc đã bị vô hiệu hóa (${table.qrStatus || 'inactive'})`,
      );
    }

    return { restaurant, table };
  }

  /**
   * SUB-PHASE 6.4: Khách hàng tạo đơn qua mã QR công khai (Mobile-First Self-Service)
   * Yêu cầu:
   * - Không cần JWT token nhân viên
   * - Xác thực bộ ba (restaurantSlug, tableCode, qrToken)
   * - qrStatus phải là ACTIVE
   * - Round 1 khởi tạo ở trạng thái WaitingConfirmation
   * - Toàn bộ OrderItems khởi tạo ở trạng thái WaitingConfirmation
   * - Order khởi tạo ở trạng thái WaitingConfirmation
   * - Bàn chuyển sang Occupied và gắn currentOrderId
   */
  async createCustomerOrder(dto: CustomerCreateOrderDto): Promise<Order> {
    // 1. Xác thực bộ ba bảo mật QR
    const { restaurant, table } = await this.validateQrSession(
      dto.restaurantSlug,
      dto.tableCode,
      dto.qrToken,
    );

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Đơn hàng phải chứa ít nhất 1 món ăn');
    }

    // 2. Kiểm tra bàn đã có đơn hàng hoạt động chưa (bảo vệ Partial Unique Index)
    const activeOrder = await this.orderModel.findOne({
      tableId: table._id,
      restaurantId: restaurant._id,
      status: {
        $in: [
          'WaitingConfirmation',
          'Confirmed',
          'Preparing',
          'Ready',
          'Served',
          'PaymentRequested',
        ],
      },
    });

    if (activeOrder) {
      throw new ConflictException(
        `Bàn "${table.name}" hiện đang có đơn hàng hoạt động (${activeOrder.orderCode}). Vui lòng chọn tính năng gọi thêm món.`,
      );
    }

    // 3. Xác định branchId: bắt buộc string
    let resolvedBranchId = table.branchId;
    if (!resolvedBranchId) {
      const mainBranch = restaurant.branches?.find((b: any) => b.isMainBranch && !b.isDeleted);
      resolvedBranchId = (mainBranch as any)?._id
        ? (mainBranch as any)._id.toString()
        : (restaurant.branches?.[0] as any)?._id?.toString() || 'default';
    }

    // 4. Snapshot giá và danh sách món từ DB thực đơn
    // TẤT CẢ OrderItems tạo qua QR Customer khởi tạo ở trạng thái WaitingConfirmation
    const processedItems = await this.processOrderItems(
      dto.items,
      restaurant._id.toString(),
      resolvedBranchId,
      1,
      'WaitingConfirmation',
    );

    const subTotal = processedItems.reduce((sum, it) => sum + it.itemTotal, 0);
    const totalAmount = subTotal;

    // 5. Tự động sinh mã đơn hàng chuẩn quy cách ORD-YYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderCode = `ORD-${dateStr}-${randomSuffix}`;

    // Khởi tạo Round 1 ở trạng thái WaitingConfirmation
    const round1: OrderRound = {
      roundNumber: 1,
      source: 'QR_CUSTOMER',
      status: 'WaitingConfirmation',
      createdAt: new Date(),
      roundSubTotal: subTotal,
    };

    // Khởi tạo Order ở trạng thái WaitingConfirmation
    const order = new this.orderModel({
      orderCode,
      tableId: table._id,
      tableName: table.name,
      restaurantId: restaurant._id,
      branchId: resolvedBranchId,
      rounds: [round1],
      items: processedItems,
      subTotal,
      discountAmount: 0,
      serviceFee: 0,
      vatAmount: 0,
      totalAmount,
      status: 'WaitingConfirmation',
      isPaid: false,
      orderSource: 'QR_CUSTOMER',
      customerNote: dto.customerNote || '',
      openedAt: new Date(),
    });

    const savedOrder = await order.save();

    // 6. Cập nhật trạng thái bàn sang Occupied
    table.status = 'Occupied';
    table.currentOrderId = savedOrder._id as any;
    if (!table.activeSince) {
      table.activeSince = new Date();
    }
    await table.save();

    // 7. Phát sóng sự kiện Realtime qua WebSocket
    this.eventEmitter.emit('order.created', {
      order: savedOrder.toObject(),
      restaurantId: restaurant._id.toString(),
      branchId: savedOrder.branchId,
      isCustomerOrder: true,
    });

    this.eventEmitter.emit('table.status_updated', {
      table: table.toObject(),
      restaurantId: restaurant._id.toString(),
      branchId: table.branchId,
    });

    return savedOrder;
  }

  /**
   * SUB-PHASE 6.4: Khách hàng gọi thêm món qua mã QR công khai (Mobile-First Self-Service)
   * Yêu cầu:
   * - Tạo OrderRound tiếp theo ở trạng thái WaitingConfirmation
   * - Các OrderItems mới khởi tạo ở trạng thái WaitingConfirmation
   * - Giữ nguyên các bất biến tài chính và snapshot giá
   */
  async addItemsByCustomer(
    dto: CustomerAddItemsDto,
    orderIdParam?: string,
  ): Promise<Order> {
    // 1. Xác thực bộ ba bảo mật QR
    const { restaurant, table } = await this.validateQrSession(
      dto.restaurantSlug,
      dto.tableCode,
      dto.qrToken,
    );

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Danh sách món gọi thêm phải chứa ít nhất 1 món');
    }

    // 2. Xác định đơn hàng mục tiêu
    const targetOrderId = orderIdParam || dto.orderId;
    let order: any;

    if (targetOrderId) {
      if (!Types.ObjectId.isValid(targetOrderId)) {
        throw new BadRequestException('Mã đơn hàng không hợp lệ');
      }
      order = await this.orderModel.findOne({
        _id: new Types.ObjectId(targetOrderId),
        restaurantId: restaurant._id,
        tableId: table._id,
      });
      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng');
      }
    } else {
      // Tự động tìm đơn hàng đang hoạt động của bàn
      order = await this.orderModel.findOne({
        tableId: table._id,
        restaurantId: restaurant._id,
        status: {
          $in: [
            'WaitingConfirmation',
            'Confirmed',
            'Preparing',
            'Ready',
            'Served',
            'PaymentRequested',
          ],
        },
      });

      if (!order) {
        throw new NotFoundException(
          `Bàn "${table.name}" hiện không có đơn hàng hoạt động nào để gọi thêm món`,
        );
      }
    }

    // 3. Chặn thêm món vào đơn đã kết thúc (Terminal States)
    if (order.isPaid || order.status === 'Paid' || order.status === 'Cancelled') {
      throw new BadRequestException('Không thể thêm món vào đơn hàng đã thanh toán hoặc đã hủy');
    }

    // 4. Xác định roundNumber tiếp theo
    const nextRoundNumber =
      order.rounds && order.rounds.length > 0
        ? Math.max(...order.rounds.map((r: any) => r.roundNumber)) + 1
        : 2;

    // 5. Snapshot giá DB cho các món gọi thêm, khởi tạo trạng thái WaitingConfirmation
    const processedItems = await this.processOrderItems(
      dto.items,
      restaurant._id.toString(),
      order.branchId,
      nextRoundNumber,
      'WaitingConfirmation',
    );

    const roundSubTotal = processedItems.reduce((sum, it) => sum + it.itemTotal, 0);

    // 6. Tạo OrderRound mới ở trạng thái WaitingConfirmation (Chờ thu ngân duyệt)
    const newRound: OrderRound = {
      roundNumber: nextRoundNumber,
      source: 'QR_CUSTOMER',
      status: 'WaitingConfirmation',
      roundSubTotal,
      createdAt: new Date(),
    };

    order.rounds.push(newRound);
    order.items.push(...processedItems);

    // 7. Tính lại tài chính hóa đơn
    order.subTotal = order.items
      .filter((it: any) => it.status !== 'Cancelled')
      .reduce((sum: number, it: any) => sum + it.itemTotal, 0);

    order.totalAmount = Math.max(
      0,
      order.subTotal - (order.discountAmount || 0) + (order.serviceFee || 0) + (order.vatAmount || 0),
    );

    // 8. Đánh giá trạng thái tổng thể qua Reducer
    const nextStatus = calculateOrderStatus(order.items, order.status);
    if (nextStatus !== order.status) {
      OrderStateValidator.validateOrderTransition(order.status, nextStatus);
      order.status = nextStatus;
    }

    if (dto.note) {
      order.customerNote = order.customerNote ? `${order.customerNote} | ${dto.note}` : dto.note;
    }

    const saved = await order.save();

    // 9. Phát sự kiện WebSocket thông báo có đợt gọi món mới chờ duyệt
    this.eventEmitter.emit('order.round_added', {
      order: saved.toObject(),
      restaurantId: restaurant._id.toString(),
      branchId: saved.branchId,
      roundNumber: nextRoundNumber,
      isCustomer: true,
    });

    return saved;
  }

  /**
   * SUB-PHASE 6.4: Khách hàng xem đơn hàng đang hoạt động của bàn qua mã QR công khai
   */
  async getActiveOrderByQr(dto: CustomerGetActiveOrderDto): Promise<Order | null> {
    const { restaurant, table } = await this.validateQrSession(
      dto.restaurantSlug,
      dto.tableCode,
      dto.qrToken,
    );

    const activeOrder = await this.orderModel.findOne({
      tableId: table._id,
      restaurantId: restaurant._id,
      status: {
        $in: [
          'WaitingConfirmation',
          'Confirmed',
          'Preparing',
          'Ready',
          'Served',
          'PaymentRequested',
        ],
      },
    });

    return activeOrder;
  }

  /**
   * Lấy danh sách đơn hàng có bộ lọc và phân trang
   */
  async findAll(
    query: QueryOrderDto,
    restaurantId: string,
    caller?: JwtUser,
  ): Promise<{ data: Order[]; total: number; page: number; limit: number }> {
    const filter: any = {
      restaurantId: new Types.ObjectId(restaurantId),
    };

    let targetBranchId = query.branchId;
    if (caller && !caller.isMainBranch && caller.branchId && !isSuperAdminUser(caller)) {
      targetBranchId = caller.branchId;
    }

    if (targetBranchId) {
      filter.$or = [
        { branchId: targetBranchId },
        { branchId: { $exists: false } },
        { branchId: '' },
        { branchId: null },
      ];
    }

    if (query.tableId) {
      filter.tableId = new Types.ObjectId(query.tableId);
    }

    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }

    if (query.isPaid !== undefined) {
      filter.isPaid = query.isPaid;
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.orderModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Lấy chi tiết đơn hàng (có kiểm tra Multi-Branch Isolation & Super Admin Scope)
   */
  async findById(id: string, restaurantId?: string, caller?: JwtUser): Promise<Order> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Mã đơn hàng không hợp lệ');
    }

    const filter: any = { _id: new Types.ObjectId(id) };
    if (!isSuperAdminUser(caller)) {
      if (restaurantId && Types.ObjectId.isValid(restaurantId)) {
        filter.restaurantId = new Types.ObjectId(restaurantId);
      }
    }

    const order = await this.orderModel.findOne(filter);

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    // Branch Isolation
    if (caller && !caller.isMainBranch && caller.branchId && !isSuperAdminUser(caller)) {
      if (order.branchId && order.branchId !== caller.branchId) {
        throw new ForbiddenException(
          'Bạn không có quyền thao tác trên đơn hàng thuộc chi nhánh khác',
        );
      }
    }

    return order;
  }

  /**
   * Lấy đơn hàng đang hoạt động của một bàn cụ thể (dành cho màn hình POS)
   */
  async getActiveOrderByTable(
    tableId: string,
    restaurantId: string,
    caller?: JwtUser,
  ): Promise<Order | null> {
    if (!Types.ObjectId.isValid(tableId)) {
      throw new BadRequestException('Mã bàn ăn không hợp lệ');
    }

    const table = await this.tableModel.findOne({
      _id: new Types.ObjectId(tableId),
      restaurantId: new Types.ObjectId(restaurantId),
      isDeleted: { $ne: true },
    });

    if (!table) {
      throw new NotFoundException('Không tìm thấy bàn ăn');
    }

    // Branch Isolation
    if (caller && !caller.isMainBranch && caller.branchId && !isSuperAdminUser(caller)) {
      if (table.branchId && table.branchId !== caller.branchId) {
        throw new ForbiddenException('Bạn không có quyền truy cập dữ liệu bàn của chi nhánh khác');
      }
    }

    const activeOrder = await this.orderModel.findOne({
      tableId: table._id,
      restaurantId: new Types.ObjectId(restaurantId),
      status: {
        $in: [
          'WaitingConfirmation',
          'Confirmed',
          'Preparing',
          'Ready',
          'Served',
          'PaymentRequested',
        ],
      },
    });

    return activeOrder;
  }

  /**
   * Xem trước phiếu tạm tính (Pre-bill) không làm thay đổi trạng thái trong DB
   */
  async previewBill(
    orderId: string,
    dto: BillPreviewDto,
    restaurantId: string,
    caller?: JwtUser,
  ): Promise<any> {
    const order: any = await this.findById(orderId, restaurantId, caller);

    if (order.status === 'Cancelled') {
      throw new BadRequestException('Không thể xem trước hóa đơn của đơn hàng đã hủy (Cancelled)');
    }

    const activeItems = (order.items || []).filter((it: any) => it.status !== 'Cancelled');
    const subTotal = activeItems.reduce((sum: number, it: any) => sum + it.itemTotal, 0);

    const financial = OrderFinancialCalculator.calculate({
      subTotal,
      discountAmount: dto.discountAmount,
      discountPercent: dto.discountPercent,
      serviceFee: dto.serviceFee,
      serviceFeePercent: dto.serviceFeePercent,
      vatAmount: dto.vatAmount,
      vatPercent: dto.vatPercent,
    });

    return {
      orderId: order._id,
      orderCode: order.orderCode,
      tableId: order.tableId,
      tableName: order.tableName,
      status: order.status,
      isPaid: order.isPaid,
      itemsCount: activeItems.length,
      ...financial,
    };
  }

  /**
   * Gọi thêm món vào đơn hàng hiện có (Tạo Round tiếp theo)
   */
  async addItems(
    orderId: string,
    dto: AddItemsToOrderDto,
    restaurantId: string,
    caller?: JwtUser,
  ): Promise<Order> {
    const order: any = await this.findById(orderId, restaurantId, caller);

    if (order.isPaid || order.status === 'Paid' || order.status === 'Cancelled') {
      throw new BadRequestException('Không thể thêm món vào đơn hàng đã thanh toán hoặc đã hủy');
    }

    const nextRoundNumber =
      order.rounds && order.rounds.length > 0
        ? Math.max(...order.rounds.map((r: any) => r.roundNumber)) + 1
        : 2;

    const callerId = caller?.userId || (caller as any)?._id || (caller as any)?.id;
    const validUserOid = callerId && Types.ObjectId.isValid(callerId) ? new Types.ObjectId(callerId) : undefined;

    const processedItems = await this.processOrderItems(
      dto.items,
      restaurantId,
      order.branchId,
      nextRoundNumber,
      'Waiting',
    );

    const roundSubTotal = processedItems.reduce((sum, it) => sum + it.itemTotal, 0);

    const newRound: OrderRound = {
      roundNumber: nextRoundNumber,
      source: 'STAFF_POS',
      status: 'Confirmed',
      roundSubTotal,
      createdAt: new Date(),
      confirmedAt: new Date(),
      confirmedBy: validUserOid,
    };

    order.rounds.push(newRound);
    order.items.push(...processedItems);

    // Tính lại tổng tiền
    order.subTotal = order.items
      .filter((it: any) => it.status !== 'Cancelled')
      .reduce((sum: number, it: any) => sum + it.itemTotal, 0);

    order.totalAmount = Math.max(
      0,
      order.subTotal - (order.discountAmount || 0) + (order.serviceFee || 0) + (order.vatAmount || 0),
    );

    // Single source of truth: Reducer suy luận Order.status
    const nextStatus = calculateOrderStatus(order.items, order.status);
    if (nextStatus !== order.status) {
      OrderStateValidator.validateOrderTransition(order.status, nextStatus);
      order.status = nextStatus;
    }

    if (dto.note) {
      order.customerNote = order.customerNote ? `${order.customerNote} | ${dto.note}` : dto.note;
    }

    const saved = await order.save();

    // Phát sự kiện KDS có thêm món cần nấu
    this.eventEmitter.emit('order.created', {
      order: saved.toObject(),
      restaurantId,
      branchId: saved.branchId,
      isAddedItems: true,
      roundNumber: nextRoundNumber,
    });

    return saved;
  }

  /**
   * DOMAIN ACTION: Duyệt đợt gọi món (Confirm Round)
   */
  async confirmRound(
    orderId: string,
    roundNumber: number,
    restaurantId: string,
    caller: any,
  ): Promise<Order> {
    const order: any = await this.findById(orderId, restaurantId, caller);

    if (order.isPaid || order.status === 'Paid') {
      throw new BadRequestException('Không thể duyệt đợt gọi món của đơn hàng đã thanh toán (Paid)');
    }
    if (order.status === 'Cancelled') {
      throw new BadRequestException('Không thể duyệt đợt gọi món của đơn hàng đã hủy (Cancelled)');
    }

    const round = order.rounds?.find((r: any) => r.roundNumber === Number(roundNumber));
    if (!round) {
      throw new NotFoundException(`Không tìm thấy đợt gọi món số ${roundNumber}`);
    }

    // State machine check cho Round
    OrderStateValidator.validateRoundTransition(round.status, 'Confirmed');

    const callerId = caller?._id || caller?.userId || caller?.id;
    const validUserOid = callerId && Types.ObjectId.isValid(callerId) ? new Types.ObjectId(callerId) : undefined;

    round.status = 'Confirmed';
    round.confirmedAt = new Date();
    round.confirmedBy = validUserOid;

    // Chuyển toàn bộ món thuộc round này từ WaitingConfirmation -> Waiting
    for (const item of order.items) {
      if (item.roundNumber === Number(roundNumber) && item.status === 'WaitingConfirmation') {
        OrderStateValidator.validateItemTransition(item.status, 'Waiting', order.isPaid);
        item.status = 'Waiting';
      }
    }

    // Reducer suy luận lại Order status
    const derivedStatus = calculateOrderStatus(order.items, order.status);
    if (derivedStatus !== order.status) {
      OrderStateValidator.validateOrderTransition(order.status, derivedStatus);
      order.status = derivedStatus;
    }

    if (!order.confirmedBy && validUserOid) {
      order.confirmedBy = validUserOid;
    }

    await order.save();

    this.eventEmitter.emit('order.round_confirmed', {
      order: order.toObject(),
      roundNumber,
      restaurantId,
      branchId: order.branchId,
    });

    return order;
  }

  /**
   * DOMAIN ACTION: Hủy/Từ chối đợt gọi món (Cancel Round)
   */
  async cancelRound(
    orderId: string,
    roundNumber: number,
    reason: string,
    restaurantId: string,
    caller: any,
  ): Promise<Order> {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Lý do từ chối đợt gọi món không được để trống');
    }

    const order: any = await this.findById(orderId, restaurantId, caller);

    if (order.isPaid || order.status === 'Paid') {
      throw new BadRequestException('Không thể hủy đợt gọi món của đơn hàng đã thanh toán (Paid)');
    }
    if (order.status === 'Cancelled') {
      throw new BadRequestException('Không thể hủy đợt gọi món của đơn hàng đã hủy (Cancelled)');
    }

    const round = order.rounds?.find((r: any) => r.roundNumber === Number(roundNumber));
    if (!round) {
      throw new NotFoundException(`Không tìm thấy đợt gọi món số ${roundNumber}`);
    }

    OrderStateValidator.validateRoundTransition(round.status, 'Cancelled');

    const callerId = caller?._id || caller?.userId || caller?.id;
    const validUserOid = callerId && Types.ObjectId.isValid(callerId) ? new Types.ObjectId(callerId) : undefined;

    round.status = 'Cancelled';
    round.cancelledAt = new Date();
    round.cancelledBy = validUserOid;
    round.cancelReason = reason.trim();

    // Hủy toàn bộ món thuộc round này
    for (const item of order.items) {
      if (item.roundNumber === Number(roundNumber) && item.status === 'WaitingConfirmation') {
        OrderStateValidator.validateItemTransition(item.status, 'Cancelled', order.isPaid);
        item.status = 'Cancelled';
        item.cancelReason = reason.trim();
        item.cancelledBy = validUserOid;
      }
    }

    // Recalculate totals
    order.subTotal = order.items
      .filter((it: any) => it.status !== 'Cancelled')
      .reduce((sum: number, it: any) => sum + it.itemTotal, 0);
    order.totalAmount = Math.max(
      0,
      order.subTotal - (order.discountAmount || 0) + (order.serviceFee || 0) + (order.vatAmount || 0),
    );

    // Recalculate Order status qua Reducer
    const derivedStatus = calculateOrderStatus(order.items, order.status);
    if (derivedStatus !== order.status) {
      OrderStateValidator.validateOrderTransition(order.status, derivedStatus);
      order.status = derivedStatus;
    }

    // Nếu toàn bộ đơn hàng bị Cancelled -> Giải phóng bàn ăn
    if (order.status === 'Cancelled') {
      order.closedAt = new Date();
      order.cancelledAt = new Date();
      order.cancelledBy = validUserOid;
      order.cancelReason = reason.trim();

      const table = await this.tableModel.findOneAndUpdate(
        {
          _id: order.tableId,
          restaurantId: order.restaurantId,
          currentOrderId: order._id,
        },
        {
          $set: { status: 'Available', totalGuests: 0 },
          $unset: { currentOrderId: 1, activeSince: 1 },
        },
        { new: true },
      );

      if (table) {
        this.eventEmitter.emit('table.status_updated', {
          table: table.toObject(),
          restaurantId,
          branchId: table.branchId,
        });
      }
    }

    await order.save();

    this.eventEmitter.emit('order.round_cancelled', {
      order: order.toObject(),
      roundNumber,
      restaurantId,
      branchId: order.branchId,
    });

    return order;
  }

  /**
   * DOMAIN ACTION: Hủy toàn bộ đơn hàng (Cancel Order)
   */
  async cancelOrder(
    orderId: string,
    reason: string,
    restaurantId: string,
    caller: any,
  ): Promise<Order> {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Lý do hủy đơn hàng không được để trống');
    }

    const order: any = await this.findById(orderId, restaurantId, caller);

    if (order.isPaid || order.status === 'Paid') {
      throw new BadRequestException('Không thể hủy đơn hàng đã thanh toán (Paid)');
    }
    if (order.status === 'Cancelled') {
      throw new BadRequestException('Đơn hàng đã ở trạng thái hủy (Cancelled)');
    }

    OrderStateValidator.validateOrderTransition(order.status, 'Cancelled');

    const callerId = caller?._id || caller?.userId || caller?.id;
    const validUserOid = callerId && Types.ObjectId.isValid(callerId) ? new Types.ObjectId(callerId) : undefined;
    const now = new Date();

    order.status = 'Cancelled';
    order.cancelledAt = now;
    order.closedAt = now;
    order.cancelledBy = validUserOid;
    order.cancelReason = reason.trim();
    order.isPaid = false; // Bắt buộc isPaid vẫn false

    // Hủy các món chưa huỷ
    for (const item of order.items || []) {
      if (item.status !== 'Cancelled') {
        item.status = 'Cancelled';
        item.cancelReason = item.cancelReason || reason.trim();
        item.cancelledBy = item.cancelledBy || validUserOid;
      }
    }

    // Hủy các rounds chưa huỷ
    for (const round of order.rounds || []) {
      if (round.status !== 'Cancelled') {
        round.status = 'Cancelled';
        round.cancelledAt = now;
        round.cancelledBy = validUserOid;
        round.cancelReason = round.cancelReason || reason.trim();
      }
    }

    await order.save();

    // Giải phóng bàn ăn
    const table = await this.tableModel.findOneAndUpdate(
      {
        _id: order.tableId,
        restaurantId: order.restaurantId,
        currentOrderId: order._id,
      },
      {
        $set: { status: 'Available', totalGuests: 0 },
        $unset: { currentOrderId: 1, activeSince: 1 },
      },
      { new: true },
    );

    if (table) {
      this.eventEmitter.emit('table.status_updated', {
        table: table.toObject(),
        restaurantId,
        branchId: table.branchId,
      });
    }

    this.eventEmitter.emit('order.cancelled', {
      order: order.toObject(),
      restaurantId,
      branchId: order.branchId,
    });

    return order;
  }

  /**
   * DOMAIN ACTION: Hủy từng món ăn trong đơn (Cancel Item)
   */
  async cancelItem(
    orderId: string,
    itemId: string,
    reason: string,
    restaurantId: string,
    caller: any,
  ): Promise<Order> {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Lý do hủy món không được để trống');
    }

    const order: any = await this.findById(orderId, restaurantId, caller);

    if (order.isPaid || order.status === 'Paid') {
      throw new BadRequestException('Không thể hủy món của đơn hàng đã thanh toán (Paid)');
    }
    if (order.status === 'Cancelled') {
      throw new BadRequestException('Không thể hủy món của đơn hàng đã hủy (Cancelled)');
    }

    const item = order.items.find(
      (it: any) => it._id?.toString() === itemId || it.id === itemId,
    );
    if (!item) {
      throw new NotFoundException('Không tìm thấy món ăn trong đơn hàng');
    }

    OrderStateValidator.validateItemTransition(item.status, 'Cancelled', order.isPaid);

    const callerId = caller?._id || caller?.userId || caller?.id;
    const validUserOid = callerId && Types.ObjectId.isValid(callerId) ? new Types.ObjectId(callerId) : undefined;

    item.status = 'Cancelled';
    item.cancelReason = reason.trim();
    item.cancelledBy = validUserOid;

    // Recalculate totals (giữ nguyên snapshot price của item)
    order.subTotal = order.items
      .filter((it: any) => it.status !== 'Cancelled')
      .reduce((sum: number, it: any) => sum + it.itemTotal, 0);
    order.totalAmount = Math.max(
      0,
      order.subTotal - (order.discountAmount || 0) + (order.serviceFee || 0) + (order.vatAmount || 0),
    );

    // Recalculate Order status qua Reducer
    const derivedStatus = calculateOrderStatus(order.items, order.status);
    if (derivedStatus !== order.status) {
      OrderStateValidator.validateOrderTransition(order.status, derivedStatus);
      order.status = derivedStatus;
    }

    // Nếu toàn bộ món bị hủy -> Order bị hủy và giải phóng bàn
    if (order.status === 'Cancelled') {
      order.closedAt = new Date();
      order.cancelledAt = new Date();
      order.cancelledBy = validUserOid;
      order.cancelReason = 'Tất cả món trong đơn đã bị hủy';

      const table = await this.tableModel.findOneAndUpdate(
        {
          _id: order.tableId,
          restaurantId: order.restaurantId,
          currentOrderId: order._id,
        },
        {
          $set: { status: 'Available', totalGuests: 0 },
          $unset: { currentOrderId: 1, activeSince: 1 },
        },
        { new: true },
      );

      if (table) {
        this.eventEmitter.emit('table.status_updated', {
          table: table.toObject(),
          restaurantId,
          branchId: table.branchId,
        });
      }
    }

    await order.save();

    this.eventEmitter.emit('order.item_cancelled', {
      orderId,
      itemId,
      reason,
      order: order.toObject(),
      restaurantId,
      branchId: order.branchId,
    });

    return order;
  }

  /**
   * DOMAIN ACTION: Bếp / Phục vụ cập nhật trạng thái món ăn (Waiting -> Cooking -> Ready -> Served)
   */
  async updateItemStatus(
    orderId: string,
    itemId: string,
    status: OrderItemStatus,
    restaurantId: string,
    caller?: any,
  ): Promise<Order> {
    const order: any = await this.findById(orderId, restaurantId, caller);

    const item = order.items.find(
      (it: any) => it._id?.toString() === itemId || it.id === itemId,
    );

    if (!item) {
      throw new NotFoundException('Không tìm thấy món ăn trong đơn hàng');
    }

    // Kiểm tra state transition hợp lệ cho item
    OrderStateValidator.validateItemTransition(item.status, status, order.isPaid);

    item.status = status;

    // Single Source of Truth: Dùng Reducer tính Order.status
    const derivedStatus = calculateOrderStatus(order.items, order.status);
    if (derivedStatus !== order.status) {
      OrderStateValidator.validateOrderTransition(order.status, derivedStatus);
      order.status = derivedStatus;
    }

    await order.save();

    // Phát sự kiện realtime
    this.eventEmitter.emit('order.item_status_updated', {
      orderId,
      itemId,
      status,
      order: order.toObject(),
      restaurantId,
      branchId: order.branchId,
    });

    return order;
  }

  /**
   * DOMAIN ACTION: Yêu cầu thanh toán (Served -> PaymentRequested)
   */
  async requestPayment(
    orderId: string,
    restaurantId: string,
    caller?: any,
  ): Promise<Order> {
    const order: any = await this.findById(orderId, restaurantId, caller);

    OrderStateValidator.validateOrderTransition(order.status, 'PaymentRequested');
    order.status = 'PaymentRequested';
    await order.save();

    this.eventEmitter.emit('order.payment_requested', {
      order: order.toObject(),
      restaurantId,
      branchId: order.branchId,
    });

    return order;
  }

  /**
   * DOMAIN ACTION: Quay lại trạng thái Served từ PaymentRequested
   */
  async revertPaymentRequest(
    orderId: string,
    restaurantId: string,
    caller?: any,
  ): Promise<Order> {
    const order: any = await this.findById(orderId, restaurantId, caller);

    OrderStateValidator.validateOrderTransition(order.status, 'Served');
    order.status = 'Served';
    await order.save();

    return order;
  }

  /**
   * DOMAIN ACTION: Duyệt đơn hàng QR (WaitingConfirmation -> Preparing)
   */
  async confirmOrder(
    orderId: string,
    restaurantId: string,
    caller: any,
  ): Promise<Order> {
    const order: any = await this.findById(orderId, restaurantId, caller);

    if (order.status !== 'WaitingConfirmation') {
      throw new BadRequestException(
        `Chỉ có thể xác nhận đơn hàng đang ở trạng thái WaitingConfirmation (hiện tại: ${order.status})`,
      );
    }

    OrderStateValidator.validateOrderTransition(order.status, 'Preparing');

    const callerId = caller?._id || caller?.userId || caller?.id;
    const validUserOid = callerId && Types.ObjectId.isValid(callerId) ? new Types.ObjectId(callerId) : undefined;

    // Duyệt các round WaitingConfirmation
    for (const round of order.rounds || []) {
      if (round.status === 'WaitingConfirmation') {
        round.status = 'Confirmed';
        round.confirmedAt = new Date();
        round.confirmedBy = validUserOid;
      }
    }

    // Chuyển toàn bộ món từ WaitingConfirmation sang Waiting
    for (const item of order.items || []) {
      if (item.status === 'WaitingConfirmation') {
        item.status = 'Waiting';
      }
    }

    const derivedStatus = calculateOrderStatus(order.items, order.status);
    order.status = derivedStatus; // Preparing
    order.confirmedBy = validUserOid;

    await order.save();

    this.eventEmitter.emit('order.confirmed', {
      order: order.toObject(),
      restaurantId,
      branchId: order.branchId,
    });

    return order;
  }

  /**
   * Cập nhật trạng thái đơn hàng (Có validate qua State Machine)
   */
  async updateOrderStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
    restaurantId: string,
    caller?: any,
  ): Promise<Order> {
    if (dto.status === 'Cancelled') {
      return this.cancelOrder(orderId, dto.reason || 'Hủy đơn hàng', restaurantId, caller);
    }

    if (dto.status === 'Paid') {
      throw new BadRequestException(
        'Vui lòng sử dụng endpoint thanh toán chuyên biệt (/pay) để xử lý thanh toán đơn hàng',
      );
    }

    const order: any = await this.findById(orderId, restaurantId, caller);

    OrderStateValidator.validateOrderTransition(order.status, dto.status);
    order.status = dto.status;

    if (dto.reason) {
      order.customerNote = order.customerNote
        ? `${order.customerNote} (${dto.reason})`
        : dto.reason;
    }

    await order.save();
    return order;
  }

  /**
   * Thanh toán đơn hàng & Giải phóng bàn ăn
   */
  async pay(
    orderId: string,
    dto: PayOrderDto,
    restaurantId: string,
    user?: any,
  ): Promise<{ order: Order; table: Table; changeAmount?: number }> {
    const order: any = await this.findById(orderId, restaurantId, user);

    if (order.isPaid || order.status === 'Paid') {
      throw new BadRequestException('Đơn hàng này đã được thanh toán trước đó');
    }

    if (order.status === 'WaitingConfirmation') {
      // WaitingConfirmation -> Paid = FORBIDDEN
      OrderStateValidator.validateOrderTransition(order.status, 'Paid');
    }

    if (order.status === 'Cancelled') {
      OrderStateValidator.validateOrderTransition(order.status, 'Paid');
    }

    // Hỗ trợ luồng POS quick-pay: chuyển bước qua PaymentRequested nếu chưa chuyển
    if (order.status !== 'PaymentRequested') {
      order.status = 'PaymentRequested';
    }
    OrderStateValidator.validateOrderTransition(order.status, 'Paid');

    // 1. Tính toán tài chính theo công thức chuẩn hóa F&B (subTotal -> discount -> taxableBase -> serviceFee -> VAT -> total)
    const activeItems = (order.items || []).filter((it: any) => it.status !== 'Cancelled');
    const subTotal = activeItems.reduce((sum: number, it: any) => sum + it.itemTotal, 0);

    const financial = OrderFinancialCalculator.calculate({
      subTotal,
      discountAmount: dto.discountAmount,
      discountPercent: dto.discountPercent,
      serviceFee: dto.serviceFee,
      serviceFeePercent: dto.serviceFeePercent,
      vatAmount: dto.vatAmount,
      vatPercent: dto.vatPercent,
    });

    // 2. Xử lý phương thức thanh toán tiền mặt Cash & tính tiền thừa
    const paymentMethod = dto.paymentMethod || 'VietQR';
    let changeAmount: number | undefined = undefined;

    if (paymentMethod === 'Cash' && dto.amountReceived !== undefined) {
      if (dto.amountReceived < financial.totalAmount) {
        throw new BadRequestException(
          `Số tiền khách đưa (${dto.amountReceived} đ) không đủ để thanh toán tổng tiền (${financial.totalAmount} đ)`,
        );
      }
      changeAmount = dto.amountReceived - financial.totalAmount;
    }

    const callerId = user?._id || user?.userId || user?.id;
    const validUserOid = callerId && Types.ObjectId.isValid(callerId) ? new Types.ObjectId(callerId) : undefined;
    const closedAt = new Date();

    // 4. ATOMIC PAYMENT CLAIM TẠI MONGODB:
    // Thay thế mô hình read-modify-write order.save() bằng atomic conditional update.
    // Đảm bảo: đúng _id, đúng restaurantId, đúng branchId, isPaid != true,
    // status thuộc tập payment-eligible (Preparing | Ready | Served | PaymentRequested),
    // và subTotal/updatedAt không bị thay đổi ngầm giữa lúc đọc/tính toán và lúc claim.
    const claimFilter: any = {
      _id: order._id,
      restaurantId: order.restaurantId,
      branchId: order.branchId,
      isPaid: { $ne: true },
      status: { $in: ['Preparing', 'Ready', 'Served', 'PaymentRequested'] },
      subTotal: financial.subTotal,
    };
    if (order.updatedAt) {
      claimFilter.updatedAt = order.updatedAt;
    }

    const claimedOrder = await this.orderModel.findOneAndUpdate(
      claimFilter,
      {
        $set: {
          subTotal: financial.subTotal,
          discountAmount: financial.discountAmount,
          serviceFee: financial.serviceFee,
          vatAmount: financial.vatAmount,
          totalAmount: financial.totalAmount,
          paymentMethod,
          isPaid: true,
          status: 'Paid',
          closedAt,
          paidBy: validUserOid,
        },
      },
      { new: true },
    );

    // Nếu atomic claim trả về null: request khác đã thanh toán hoặc dữ liệu bị thay đổi đồng thời
    if (!claimedOrder) {
      throw new BadRequestException(
        'Đơn hàng này đã được thanh toán hoặc trạng thái đã bị thay đổi bởi thao tác khác',
      );
    }

    // 5. CHỈ KHI CLAIM THÀNH CÔNG MỚI GIẢI PHÓNG BÀN VÀ PHÁT SỰ KIỆN:
    // Giải phóng bàn ăn về Available với ownership protection (bảo vệ tableId, restaurantId, currentOrderId)
    const table = await this.tableModel.findOneAndUpdate(
      {
        _id: claimedOrder.tableId,
        restaurantId: claimedOrder.restaurantId,
        $or: [
          { currentOrderId: claimedOrder._id },
          { currentOrderId: { $exists: false } },
          { currentOrderId: null },
        ],
      },
      {
        $set: { status: 'Available', totalGuests: 0 },
        $unset: { currentOrderId: 1, activeSince: 1 },
      },
      { new: true },
    );

    if (table) {
      this.eventEmitter.emit('table.status_updated', {
        table: table.toObject(),
        restaurantId,
        branchId: table.branchId,
      });
    }

    // Sử dụng claimedOrder mới nhất từ DB làm nguồn sự kiện duy nhất
    this.eventEmitter.emit('order.payment_completed', {
      order: claimedOrder.toObject(),
      tableId: claimedOrder.tableId.toString(),
      restaurantId,
      branchId: claimedOrder.branchId,
      changeAmount,
    });

    return {
      order: claimedOrder,
      table: table as any,
      ...(changeAmount !== undefined ? { changeAmount } : {}),
    };
  }

  /**
   * Hàm trợ giúp: Snapshot giá và danh sách món từ DB
   */
  private async processOrderItems(
    rawItems: CreateOrderItemDto[],
    restaurantId: string,
    branchId?: string,
    roundNumber = 1,
    defaultStatus: OrderItemStatus = 'Waiting',
  ): Promise<any[]> {
    const validItemIds: Types.ObjectId[] = [];
    for (const it of rawItems) {
      if (it.menuItemId && Types.ObjectId.isValid(it.menuItemId)) {
        validItemIds.push(new Types.ObjectId(it.menuItemId));
      }
    }
    const menuItems = await this.menuItemModel.find({
      _id: { $in: validItemIds },
      restaurantId: new Types.ObjectId(restaurantId),
      isDeleted: { $ne: true },
    });

    const menuMap = new Map<string, MenuItemDocument>();
    menuItems.forEach((m) => menuMap.set(m._id.toString(), m));

    const processed: any[] = [];

    for (const raw of rawItems) {
      const menuItem = menuMap.get(raw.menuItemId);
      if (!menuItem) {
        throw new NotFoundException(`Không tìm thấy món ăn với ID: ${raw.menuItemId}`);
      }

      // Tính giá hiệu lực (Effective Price) theo chi nhánh nếu có branchOverrides
      let unitPrice = menuItem.price;
      if (branchId && menuItem.branchOverrides && menuItem.branchOverrides.length > 0) {
        const override = menuItem.branchOverrides.find((o) => o.branchId === branchId);
        if (override && override.price !== undefined) {
          unitPrice = override.price;
        }
      }

      // Tính phụ thu của các Selected Options / Toppings từ authoritative menuItem.options
      let toppingsDelta = 0;
      const selectedOptions: any[] = [];
      if (raw.selectedOptions && raw.selectedOptions.length > 0) {
        const availableOptions = menuItem.options || [];

        for (const opt of raw.selectedOptions) {
          // 1. Kiểm tra món ăn có hỗ trợ tùy chọn không
          if (availableOptions.length === 0) {
            throw new BadRequestException(
              `Món ăn "${menuItem.name}" không hỗ trợ tùy chọn hoặc topping`,
            );
          }

          // 2. Tìm nhóm tùy chọn trong DB
          const group = availableOptions.find((g) => g.id === opt.groupId);
          if (!group) {
            throw new BadRequestException(
              `Nhóm tùy chọn "${opt.groupId}" không tồn tại cho món "${menuItem.name}"`,
            );
          }

          // 3. Tìm giá trị tùy chọn trong nhóm
          const val = group.values?.find((v) => v.id === opt.valueId);
          if (!val) {
            throw new BadRequestException(
              `Tùy chọn "${opt.valueId}" không tồn tại trong nhóm "${group.name}"`,
            );
          }

          // 4. Xác định giá phụ thu chuẩn từ authoritative DB data (chống client tự ý sửa giá)
          const authoritativeDelta = Math.max(0, Number(val.priceDelta) || 0);

          // Kiểm tra nếu client gửi priceDelta khác với DB
          if (opt.priceDelta !== undefined && Number(opt.priceDelta) !== authoritativeDelta) {
            throw new BadRequestException(
              `Giá phụ thu tùy chọn "${val.name}" không hợp lệ (hệ thống: ${authoritativeDelta} đ, gửi lên: ${opt.priceDelta} đ)`,
            );
          }

          toppingsDelta += authoritativeDelta;
          selectedOptions.push({
            groupId: group.id,
            groupName: group.name,
            valueId: val.id,
            valueName: val.name,
            priceDelta: authoritativeDelta,
          });
        }
      }

      const totalItemUnit = unitPrice + toppingsDelta;
      const itemTotal = totalItemUnit * raw.quantity;

      processed.push({
        menuItemId: menuItem._id,
        name: menuItem.name,
        price: unitPrice,
        quantity: raw.quantity,
        selectedOptions,
        note: raw.note || '',
        status: defaultStatus,
        roundNumber,
        itemTotal,
      });
    }

    return processed;
  }
}
