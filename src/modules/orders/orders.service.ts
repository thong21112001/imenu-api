import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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
import { CreateOrderDto, AddItemsToOrderDto, CreateOrderItemDto } from './dto/create-order.dto';
import { UpdateItemStatusDto } from './dto/update-item-status.dto';
import {
  UpdateOrderStatusDto,
  CancelOrderDto,
  CancelOrderItemDto,
  ConfirmRoundDto,
  CancelRoundDto,
} from './dto/update-order-status.dto';
import { PayOrderDto } from './dto/pay-order.dto';
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
  ): Promise<{ order: Order; table: Table }> {
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

    const discountAmount = dto.discountAmount || order.discountAmount || 0;
    const serviceFee = dto.serviceFee || order.serviceFee || 0;
    const vatAmount = dto.vatAmount || order.vatAmount || 0;
    const totalAmount = Math.max(0, order.subTotal - discountAmount + serviceFee + vatAmount);

    const callerId = user?._id || user?.userId || user?.id;
    const validUserOid = callerId && Types.ObjectId.isValid(callerId) ? new Types.ObjectId(callerId) : undefined;

    order.discountAmount = discountAmount;
    order.serviceFee = serviceFee;
    order.vatAmount = vatAmount;
    order.totalAmount = totalAmount;
    order.paymentMethod = dto.paymentMethod || 'VietQR';
    order.isPaid = true;
    order.status = 'Paid';
    order.closedAt = new Date();
    order.paidBy = validUserOid;
    await order.save();

    // Giải phóng bàn ăn về Available
    const table = await this.tableModel.findOneAndUpdate(
      {
        _id: order.tableId,
        restaurantId: new Types.ObjectId(restaurantId),
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

    this.eventEmitter.emit('order.payment_completed', {
      order: order.toObject(),
      tableId: order.tableId.toString(),
      restaurantId,
      branchId: order.branchId,
    });

    return { order, table: table as any };
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
    const itemIds = rawItems.map((it) => new Types.ObjectId(it.menuItemId));
    const menuItems = await this.menuItemModel.find({
      _id: { $in: itemIds },
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

      // Tính phụ thu của các Selected Options / Toppings
      let toppingsDelta = 0;
      const selectedOptions: any[] = [];
      if (raw.selectedOptions && raw.selectedOptions.length > 0) {
        for (const opt of raw.selectedOptions) {
          toppingsDelta += opt.priceDelta || 0;
          selectedOptions.push({
            groupId: opt.groupId,
            groupName: opt.groupName,
            valueId: opt.valueId,
            valueName: opt.valueName,
            priceDelta: opt.priceDelta || 0,
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
