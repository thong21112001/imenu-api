import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Order, OrderDocument, OrderStatus } from './entities/order.entity';
import { Table, TableDocument } from '../tables/entities/table.entity';
import { MenuItem, MenuItemDocument } from '../menu/entities/menu-item.entity';
import { Restaurant, RestaurantDocument } from '../restaurants/entities/restaurant.entity';
import { IdempotencyKey, IdempotencyKeyDocument } from './entities/idempotency-key.entity';
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
    @InjectModel(IdempotencyKey.name) private readonly idempotencyKeyModel: Model<IdempotencyKeyDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Tạo đơn hàng mới từ POS hoặc QR bàn
   */
  async create(
    dto: CreateOrderDto,
    restaurantId: string,
    user?: any,
    idempotencyKey?: string,
  ): Promise<Order & { isReplay?: boolean }> {
    const restaurantOid = new Types.ObjectId(restaurantId);
    const endpoint = 'POST /orders';

    const executeBusinessLogic = async (): Promise<Order> => {
      const table = await this.tableModel.findOne({
        _id: new Types.ObjectId(dto.tableId),
        restaurantId: restaurantOid,
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
        restaurantId: restaurantOid,
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

      let savedOrder: OrderDocument;
      try {
        savedOrder = await order.save();
      } catch (err: any) {
        if (err?.code === 11000) {
          throw new ConflictException(
            `Bàn "${table.name}" hiện đang có đơn hàng hoạt động vừa được khởi tạo bởi khách khác hoặc yêu cầu tạo đơn bị trùng lặp.`,
          );
        }
        throw err;
      }

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
    };

    return this.executeWithIdempotency(
      restaurantOid,
      idempotencyKey,
      endpoint,
      dto,
      HttpStatus.CREATED,
      executeBusinessLogic,
    );
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
   * Sinh mã băm SHA-256 chuẩn hóa xác định (deterministic request fingerprint)
   * cho payload và endpoint nhằm nhận diện idempotency request.
   */
  public generateRequestFingerprint(endpoint: string, payload: any): string {
    const canonicalJson = (obj: any): string => {
      if (obj === null || typeof obj !== 'object') {
        return JSON.stringify(obj);
      }
      if (obj instanceof Date) {
        return JSON.stringify(obj.toISOString());
      }
      if (typeof obj.toJSON === 'function') {
        return JSON.stringify(obj.toJSON());
      }
      if (Array.isArray(obj)) {
        return '[' + obj.map((item) => canonicalJson(item)).join(',') + ']';
      }
      const sortedKeys = Object.keys(obj).sort();
      const parts = sortedKeys
        .filter((k) => obj[k] !== undefined)
        .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
      return '{' + parts.join(',') + '}';
    };

    const normalizedPayloadStr = canonicalJson(payload);
    return crypto
      .createHash('sha256')
      .update(`${endpoint}:${normalizedPayloadStr}`)
      .digest('hex');
  }

  /**
   * Khung điều phối Idempotency Key Engine:
   * - Hỗ trợ Key tùy chọn (Optional)
   * - Claim atomic tại database thông qua unique index { restaurantId: 1, key: 1 }
   * - Xử lý xung đột in-flight (PROCESSING -> 409 Conflict)
   * - Xử lý sai lệch payload (mismatch hash -> 422 Unprocessable Entity)
   * - Replay kết quả đã hoàn thành (COMPLETED -> cached replay)
   * - Cập nhật FAILED khi lỗi xảy ra để không treo PROCESSING vĩnh viễn
   * - Lease timeout recovery: Khôi phục atomic cho các request bị crash/treo > 60s
   */
  public async executeWithIdempotency<T>(
    restaurantId: Types.ObjectId,
    rawKey: string | undefined,
    endpoint: string,
    payload: any,
    statusCode: number,
    operation: () => Promise<T>,
  ): Promise<T & { isReplay?: boolean }> {
    if (rawKey === undefined || rawKey === null) {
      const result: any = await operation();
      if (result && typeof result === 'object') {
        result.isReplay = false;
      }
      return result;
    }

    const key = rawKey.trim();
    if (key.length === 0) {
      throw new BadRequestException('Idempotency-Key không được để trống khi được truyền lên');
    }
    if (key.length > 255) {
      throw new BadRequestException('Idempotency-Key không được vượt quá 255 ký tự');
    }

    const requestHash = this.generateRequestFingerprint(endpoint, payload);

    try {
      await this.idempotencyKeyModel.create({
        restaurantId,
        key,
        endpoint,
        requestHash,
        status: 'PROCESSING',
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        // Bản ghi Idempotency-Key đã tồn tại cho nhà hàng này
        const existing = await this.idempotencyKeyModel.findOne({ restaurantId, key });
        if (!existing) {
          throw new ConflictException('Xung đột Idempotency-Key, vui lòng thử lại');
        }

        // Cùng Key nhưng khác endpoint hoặc khác payload fingerprint -> HTTP 422
        if (existing.requestHash !== requestHash || existing.endpoint !== endpoint) {
          throw new UnprocessableEntityException(
            'Idempotency-Key đã được sử dụng cho một yêu cầu khác với nội dung khác nhau',
          );
        }

        // Cùng Key đang trong trạng thái PROCESSING
        if (existing.status === 'PROCESSING') {
          // DEF-6.5-HARDENING (AUD-6.5-01): Lease timeout bảo vệ request bị crash/treo
          const PROCESSING_LOCK_TIMEOUT_MS = 60 * 1000; // 60 giây
          const lastActivityTime = existing.updatedAt?.getTime() || existing.createdAt?.getTime() || 0;
          const isStalled = Date.now() - lastActivityTime > PROCESSING_LOCK_TIMEOUT_MS;

          if (!isStalled) {
            throw new ConflictException(
              'Yêu cầu với Idempotency-Key này đang được xử lý, vui lòng không gửi trùng lặp',
            );
          }

          // Request trước đó bị treo/crash > 60s -> Cố gắng claim atomic lease để khôi phục
          const reclaimed = await this.idempotencyKeyModel.findOneAndUpdate(
            {
              _id: existing._id,
              status: 'PROCESSING',
              updatedAt: existing.updatedAt,
            },
            {
              $set: { updatedAt: new Date() },
            },
            { new: true },
          );

          if (!reclaimed) {
            // Luồng khác vừa claim hoặc đã chuyển trạng thái
            throw new ConflictException(
              'Yêu cầu với Idempotency-Key này đang được xử lý, vui lòng không gửi trùng lặp',
            );
          }

          // Claim lease thành công, cho phép tiếp tục thực thi nghiệp vụ bên dưới
        } else if (existing.status === 'COMPLETED') {
          // Cùng Key đã COMPLETED -> Replay kết quả đã lưu trữ
          const replayed: any = existing.responseBody;
          if (replayed && typeof replayed === 'object') {
            replayed.isReplay = true;
          }
          return replayed;
        } else if (existing.status === 'FAILED') {
          // Cùng Key nhưng trước đó FAILED
          throw new ConflictException(
            'Yêu cầu trước đó với Idempotency-Key này đã thất bại, vui lòng sử dụng Idempotency-Key mới',
          );
        }
      } else {
        throw err;
      }
    }

    // Nếu đã claim PROCESSING thành công: thực thi nghiệp vụ chính
    try {
      const result: any = await operation();

      const sanitizeResponseBody = (val: any): any => {
        if (val === null || val === undefined) return val;
        if (typeof val.toObject === 'function') {
          return val.toObject();
        }
        if (Array.isArray(val)) {
          return val.map(sanitizeResponseBody);
        }
        if (typeof val === 'object') {
          const plain: any = {};
          for (const k of Object.keys(val)) {
            if (k === 'isReplay') continue;
            plain[k] = sanitizeResponseBody(val[k]);
          }
          return plain;
        }
        return val;
      };

      const responseBody = sanitizeResponseBody(result);

      await this.idempotencyKeyModel.updateOne(
        { restaurantId, key, status: 'PROCESSING' },
        {
          $set: {
            status: 'COMPLETED',
            responseCode: statusCode,
            responseBody,
          },
        },
      );

      if (result && typeof result === 'object') {
        result.isReplay = false;
      }
      return result;
    } catch (error: any) {
      // Cập nhật trạng thái FAILED để không treo vĩnh viễn ở PROCESSING
      await this.idempotencyKeyModel.updateOne(
        { restaurantId, key, status: 'PROCESSING' },
        {
          $set: {
            status: 'FAILED',
            responseCode: error instanceof HttpException ? error.getStatus() : 500,
            responseBody: { message: error.message },
          },
        },
      );
      throw error;
    }
  }

  /**
   * SUB-PHASE 6.4 + 6.5: Khách hàng tạo đơn qua mã QR công khai (Mobile-First Self-Service)
   * Yêu cầu:
   * - Không cần JWT token nhân viên
   * - Xác thực bộ ba (restaurantSlug, tableCode, qrToken)
   * - qrStatus phải là ACTIVE
   * - Round 1 khởi tạo ở trạng thái WaitingConfirmation
   * - Toàn bộ OrderItems khởi tạo ở trạng thái WaitingConfirmation
   * - Order khởi tạo ở trạng thái WaitingConfirmation
   * - Bàn chuyển sang Occupied và gắn currentOrderId
   * - Hỗ trợ Idempotency-Key (Optional, Fingerprint SHA-256, Replay, PROCESSING 409, Mismatch 422)
   * - Xử lý MongoDB E11000 active order duplicate key thành HTTP 409 Conflict
   */
  async createCustomerOrder(
    dto: CustomerCreateOrderDto,
    idempotencyKey?: string,
  ): Promise<Order & { isReplay?: boolean }> {
    // 1. Xác thực bộ ba bảo mật QR
    const { restaurant, table } = await this.validateQrSession(
      dto.restaurantSlug,
      dto.tableCode,
      dto.qrToken,
    );

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Đơn hàng phải chứa ít nhất 1 món ăn');
    }

    const endpoint = 'POST /orders/customer';

    const executeBusinessLogic = async (): Promise<Order> => {
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

      let savedOrder: OrderDocument;
      try {
        savedOrder = await order.save();
      } catch (err: any) {
        // DEF-6.5-002: Bắt lỗi E11000 từ MongoDB partial unique index (active order per table)
        if (err?.code === 11000) {
          throw new ConflictException(
            `Bàn "${table.name}" hiện đang có đơn hàng hoạt động vừa được khởi tạo bởi khách khác hoặc yêu cầu tạo đơn bị trùng lặp.`,
          );
        }
        throw err;
      }

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
    };

    return this.executeWithIdempotency(
      restaurant._id,
      idempotencyKey,
      endpoint,
      dto,
      HttpStatus.CREATED,
      executeBusinessLogic,
    );
  }

  /**
   * SUB-PHASE 6.4 + 6.5: Khách hàng gọi thêm món qua mã QR công khai (Mobile-First Self-Service)
   * Yêu cầu:
   * - Hỗ trợ Idempotency-Key (Optional, Fingerprint SHA-256, Replay, PROCESSING 409, Mismatch 422)
   * - Concurrency: DEF-6.5-001 OCC Atomic Conditional Update dựa trên updatedAt với tối đa 3 lần retry
   * - Tạo OrderRound tiếp theo ở trạng thái WaitingConfirmation
   * - Các OrderItems mới khởi tạo ở trạng thái WaitingConfirmation
   * - Giữ nguyên các bất biến tài chính và snapshot giá
   */
  async addItemsByCustomer(
    dto: CustomerAddItemsDto,
    orderIdParam?: string,
    idempotencyKey?: string,
  ): Promise<Order & { isReplay?: boolean }> {
    // 1. Xác thực bộ ba bảo mật QR
    const { restaurant, table } = await this.validateQrSession(
      dto.restaurantSlug,
      dto.tableCode,
      dto.qrToken,
    );

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Danh sách món gọi thêm phải chứa ít nhất 1 món');
    }

    const targetOrderId = orderIdParam || dto.orderId;
    if (targetOrderId && !Types.ObjectId.isValid(targetOrderId)) {
      throw new BadRequestException('Mã đơn hàng không hợp lệ');
    }

    const endpoint = targetOrderId
      ? `POST /orders/customer/${targetOrderId}/items`
      : 'POST /orders/customer/items';

    const executeBusinessLogic = async (): Promise<Order> => {
      // DEF-6.5-001: OCC ATOMIC CONDITIONAL UPDATE VỚI RETRY
      const MAX_OCC_RETRIES = 3;

      for (let attempt = 1; attempt <= MAX_OCC_RETRIES; attempt++) {
        // A. Tìm đơn hàng mục tiêu từ snapshot DB mới nhất
        let order: any;
        if (targetOrderId) {
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

        // B. Chặn thêm món vào đơn đã kết thúc (Terminal States)
        if (order.isPaid || order.status === 'Paid' || order.status === 'Cancelled') {
          throw new BadRequestException('Không thể thêm món vào đơn hàng đã thanh toán hoặc đã hủy');
        }

        // Ghi nhận updatedAt hiện tại để làm điều kiện OCC
        const currentUpdatedAt = order.updatedAt;

        // C. Xác định roundNumber tiếp theo từ snapshot mới nhất
        const nextRoundNumber =
          order.rounds && order.rounds.length > 0
            ? Math.max(...order.rounds.map((r: any) => r.roundNumber)) + 1
            : 2;

        // D. Snapshot giá DB cho các món gọi thêm, khởi tạo trạng thái WaitingConfirmation
        const processedItems = await this.processOrderItems(
          dto.items,
          restaurant._id.toString(),
          order.branchId,
          nextRoundNumber,
          'WaitingConfirmation',
        );

        const roundSubTotal = processedItems.reduce((sum, it) => sum + it.itemTotal, 0);

        // E. Tạo OrderRound mới ở trạng thái WaitingConfirmation
        const newRound: OrderRound = {
          roundNumber: nextRoundNumber,
          source: 'QR_CUSTOMER',
          status: 'WaitingConfirmation',
          roundSubTotal,
          createdAt: new Date(),
        };

        // F. Tính lại toàn bộ tài chính hóa đơn dựa trên danh sách món mới nhất + món vừa thêm
        const simulatedActiveItems = [
          ...(order.items || []).filter((it: any) => it.status !== 'Cancelled'),
          ...processedItems,
        ];
        const derivedSubTotal = simulatedActiveItems.reduce(
          (sum: number, it: any) => sum + it.itemTotal,
          0,
        );
        const derivedTotal = Math.max(
          0,
          derivedSubTotal -
            (order.discountAmount || 0) +
            (order.serviceFee || 0) +
            (order.vatAmount || 0),
        );

        // G. Đánh giá trạng thái tổng thể qua Reducer
        const nextStatus = calculateOrderStatus(
          [...(order.items || []), ...processedItems],
          order.status,
        );
        if (nextStatus !== order.status) {
          OrderStateValidator.validateOrderTransition(order.status, nextStatus);
        }

        let updatedNote = order.customerNote || '';
        if (dto.note) {
          updatedNote = updatedNote ? `${updatedNote} | ${dto.note}` : dto.note;
        }

        // H. THỰC HIỆN ATOMIC CONDITIONAL UPDATE QUA findOneAndUpdate
        const occFilter: any = {
          _id: order._id,
          restaurantId: restaurant._id,
          tableId: table._id,
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
          updatedAt: currentUpdatedAt,
        };

        const updatedOrder = await this.orderModel.findOneAndUpdate(
          occFilter,
          {
            $push: {
              rounds: newRound,
              items: { $each: processedItems },
            },
            $set: {
              subTotal: derivedSubTotal,
              totalAmount: derivedTotal,
              status: nextStatus,
              customerNote: updatedNote,
            },
          },
          { new: true },
        );

        if (updatedOrder) {
          // THÀNH CÔNG! Phát sự kiện WebSocket
          this.eventEmitter.emit('order.round_added', {
            order: updatedOrder.toObject(),
            restaurantId: restaurant._id.toString(),
            branchId: updatedOrder.branchId,
            roundNumber: nextRoundNumber,
            isCustomer: true,
          });

          return updatedOrder;
        }

        // NẾU update trả về null: Đã xảy ra OCC Conflict (document bị sửa bởi concurrent request)
        this.logger.warn(
          `[OCC CONFLICT] addItemsByCustomer attempt ${attempt}/${MAX_OCC_RETRIES} conflicted on order ${order._id}. Đọc lại snapshot mới nhất để retry...`,
        );

        if (attempt < MAX_OCC_RETRIES) {
          // Jitter delay ngắn trước khi retry để giảm xung đột lặp lại
          await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 30));
        }
      }

      // Đã vượt quá số lần retry tối đa mà vẫn xung đột
      throw new ConflictException(
        'Đã xảy ra xung đột khi gửi thêm món do bàn có nhiều thao tác đồng thời. Vui lòng thử lại.',
      );
    };

    return this.executeWithIdempotency(
      restaurant._id,
      idempotencyKey,
      endpoint,
      dto,
      HttpStatus.OK,
      executeBusinessLogic,
    );
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
    idempotencyKey?: string,
  ): Promise<Order & { isReplay?: boolean }> {
    const restaurantOid = new Types.ObjectId(restaurantId);
    const endpoint = `POST /orders/${orderId}/items`;

    const executeBusinessLogic = async (): Promise<Order> => {
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
    };

    return this.executeWithIdempotency(
      restaurantOid,
      idempotencyKey,
      endpoint,
      dto,
      HttpStatus.OK,
      executeBusinessLogic,
    );
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
    idempotencyKey?: string,
  ): Promise<{ order: Order; table: Table; changeAmount?: number } & { isReplay?: boolean }> {
    const restaurantOid = new Types.ObjectId(restaurantId);
    const endpoint = `POST /orders/${orderId}/pay`;

    const executeBusinessLogic = async (): Promise<{ order: Order; table: Table; changeAmount?: number }> => {
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
    };

    return this.executeWithIdempotency(
      restaurantOid,
      idempotencyKey,
      endpoint,
      dto,
      HttpStatus.OK,
      executeBusinessLogic,
    );
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
