import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Order, OrderDocument, OrderStatus } from './entities/order.entity';
import { Table, TableDocument } from '../tables/entities/table.entity';
import { MenuItem, MenuItemDocument } from '../menu/entities/menu-item.entity';
import { CreateOrderDto, AddItemsToOrderDto, CreateOrderItemDto } from './dto/create-order.dto';
import { UpdateItemStatusDto } from './dto/update-item-status.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { PayOrderDto } from './dto/pay-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Table.name) private readonly tableModel: Model<TableDocument>,
    @InjectModel(MenuItem.name) private readonly menuItemModel: Model<MenuItemDocument>,
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

    // 1. Snapshot giá và danh sách món từ DB thực đơn
    const processedItems = await this.processOrderItems(
      dto.items,
      restaurantId,
      dto.branchId || table.branchId,
    );

    const subTotal = processedItems.reduce((sum, it) => sum + it.itemTotal, 0);
    const totalAmount = subTotal;

    // 2. Tự động sinh mã đơn hàng chuẩn quy cách
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderCode = `ORD-${dateStr}-${randomSuffix}`;

    const order = new this.orderModel({
      orderCode,
      tableId: table._id,
      tableName: table.name,
      restaurantId: new Types.ObjectId(restaurantId),
      branchId: dto.branchId || table.branchId,
      items: processedItems,
      subTotal,
      discountAmount: 0,
      serviceFee: 0,
      vatAmount: 0,
      totalAmount,
      status: 'Preparing',
      isPaid: false,
      orderSource: dto.orderSource || 'STAFF_POS',
      customerNote: dto.customerNote || '',
      createdBy: user?._id || user?.id,
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
  async findAll(query: QueryOrderDto, restaurantId: string): Promise<{ data: Order[]; total: number; page: number; limit: number }> {
    const filter: any = {
      restaurantId: new Types.ObjectId(restaurantId),
    };

    if (query.branchId) {
      filter.$or = [
        { branchId: query.branchId },
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

  async findById(id: string, restaurantId: string): Promise<Order> {
    const order = await this.orderModel.findOne({
      _id: new Types.ObjectId(id),
      restaurantId: new Types.ObjectId(restaurantId),
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    return order;
  }

  /**
   * Gọi thêm món vào đơn hàng hiện có
   */
  async addItems(orderId: string, dto: AddItemsToOrderDto, restaurantId: string): Promise<Order> {
    const order = await this.findById(orderId, restaurantId);

    if (order.isPaid || order.status === 'Paid' || order.status === 'Cancelled') {
      throw new BadRequestException('Không thể thêm món vào đơn hàng đã thanh toán hoặc đã hủy');
    }

    const processedItems = await this.processOrderItems(
      dto.items,
      restaurantId,
      order.branchId,
    );

    order.items.push(...processedItems);
    order.subTotal = order.items.reduce((sum, it) => sum + it.itemTotal, 0);
    order.totalAmount = Math.max(
      0,
      order.subTotal - (order.discountAmount || 0) + (order.serviceFee || 0) + (order.vatAmount || 0),
    );

    if (order.status === 'Ready' || order.status === 'Served') {
      order.status = 'Preparing';
    }

    if (dto.note) {
      order.customerNote = order.customerNote ? `${order.customerNote} | ${dto.note}` : dto.note;
    }

    const saved = await (order as any).save();

    // Phát sự kiện KDS có thêm món cần nấu
    this.eventEmitter.emit('order.created', {
      order: saved.toObject(),
      restaurantId,
      branchId: saved.branchId,
      isAddedItems: true,
    });

    return saved;
  }

  /**
   * Bếp cập nhật trạng thái của món ăn (Cooking -> Ready -> Served)
   */
  async updateItemStatus(
    orderId: string,
    itemId: string,
    status: 'Waiting' | 'Cooking' | 'Ready' | 'Served' | 'Cancelled',
    restaurantId: string,
  ): Promise<Order> {
    const order: any = await this.findById(orderId, restaurantId);

    const item = order.items.find(
      (it: any) => it._id?.toString() === itemId || it.id === itemId,
    );

    if (!item) {
      throw new NotFoundException(`Không tìm thấy món ăn trong đơn hàng`);
    }

    item.status = status;

    // Tự động suy luận trạng thái tổng thể của Order
    const nonCancelledItems = order.items.filter((it: any) => it.status !== 'Cancelled');
    if (nonCancelledItems.length > 0) {
      const allReady = nonCancelledItems.every((it: any) => it.status === 'Ready');
      const allServed = nonCancelledItems.every((it: any) => it.status === 'Served');

      if (allServed) {
        order.status = 'Served';
      } else if (allReady) {
        order.status = 'Ready';
      } else if (status === 'Cooking' && order.status === 'WaitingConfirmation') {
        order.status = 'Preparing';
      }
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
   * Cập nhật trạng thái toàn bộ đơn hàng
   */
  async updateOrderStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
    restaurantId: string,
  ): Promise<Order> {
    const order: any = await this.findById(orderId, restaurantId);
    order.status = dto.status;

    if (dto.reason) {
      order.customerNote = order.customerNote ? `${order.customerNote} (${dto.reason})` : dto.reason;
    }

    // Nếu hủy đơn hàng -> giải phóng bàn ăn nếu bàn đang gắn đơn này
    if (dto.status === 'Cancelled') {
      const table = await this.tableModel.findOneAndUpdate(
        {
          _id: order.tableId,
          restaurantId: new Types.ObjectId(restaurantId),
          currentOrderId: new Types.ObjectId(orderId),
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
    return order;
  }

  /**
   * Thanh toán đơn hàng & Giải phóng bàn ăn
   */
  async pay(orderId: string, dto: PayOrderDto, restaurantId: string, user?: any): Promise<{ order: Order; table: Table }> {
    const order: any = await this.findById(orderId, restaurantId);

    if (order.isPaid) {
      throw new BadRequestException('Đơn hàng này đã được thanh toán trước đó');
    }

    const discountAmount = dto.discountAmount || order.discountAmount || 0;
    const serviceFee = dto.serviceFee || order.serviceFee || 0;
    const vatAmount = dto.vatAmount || order.vatAmount || 0;
    const totalAmount = Math.max(0, order.subTotal - discountAmount + serviceFee + vatAmount);

    order.discountAmount = discountAmount;
    order.serviceFee = serviceFee;
    order.vatAmount = vatAmount;
    order.totalAmount = totalAmount;
    order.paymentMethod = dto.paymentMethod || 'VietQR';
    order.isPaid = true;
    order.status = 'Paid';
    await order.save();

    // Giải phóng bàn ăn về Available (hoặc Cleaning)
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
      // Phát sự kiện realtime
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
        status: 'Waiting',
        itemTotal,
      });
    }

    return processed;
  }
}
