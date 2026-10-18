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
  RequestPaymentDto,
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
import { QueryKitchenOrdersDto } from './dto/query-kitchen-orders.dto';
import { BatchKitchenItemsDto } from './dto/batch-kitchen-items.dto';
import { isSuperAdminUser, JwtUser } from '../auth/interface/jwtUser';
import { BillsService } from '../bills/bills.service';
import { ReceiptData } from '../bills/interfaces/receipt-data.interface';
import {
  resolveEffectiveBankAccount,
  generateVietQRMemo,
  generateVietQRUrl,
} from '../bills/helpers/vietqr.helper';
import { ActivityAction, ActivityModule } from '../activity-log/constants/audit-log.const';

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
    private readonly billsService: BillsService,
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
        receiptAccessToken: crypto.randomBytes(24).toString('hex'),
      });

      let savedOrder: OrderDocument;
      let saveAttempts = 0;
      while (true) {
        try {
          savedOrder = await order.save();
          break;
        } catch (err: any) {
          if (err?.code === 11000) {
            const isOrderCodeDup = err?.keyPattern?.orderCode || err?.message?.includes('orderCode');
            if (isOrderCodeDup && saveAttempts < 5) {
              saveAttempts++;
              const newSuffix = Math.floor(1000 + Math.random() * 9000);
              order.orderCode = `ORD-${dateStr}-${newSuffix}`;
              continue;
            }
            throw new ConflictException(
              `Bàn "${table.name}" hiện đang có đơn hàng hoạt động vừa được khởi tạo bởi khách khác hoặc yêu cầu tạo đơn bị trùng lặp.`,
            );
          }
          throw err;
        }
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

    // 1. Tìm nhà hàng theo slug không phân biệt hoa thường
    const escapedSlug = restaurantSlug.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const restaurant = await this.restaurantModel.findOne({
      slug: { $regex: new RegExp('^' + escapedSlug + '$', 'i') },
    });
    if (!restaurant) {
      throw new NotFoundException(`Không tìm thấy nhà hàng với mã: ${restaurantSlug}`);
    }

    // 2. Tìm danh sách bàn thuộc nhà hàng có code khớp không phân biệt chữ hoa/thường (case-insensitive)
    const normalizedCode = tableCode.trim();
    const escapedCode = normalizedCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const candidateTables = await this.tableModel.find({
      code: { $regex: new RegExp(`^${escapedCode}$`, 'i') },
      restaurantId: restaurant._id,
      isDeleted: { $ne: true },
    });
    if (!candidateTables || candidateTables.length === 0) {
      throw new NotFoundException(
        `Không tìm thấy bàn ăn "${tableCode}" thuộc nhà hàng "${restaurant.name}"`,
      );
    }
    // Nếu nhà hàng có nhiều chi nhánh cùng có mã bàn B03, ưu tiên chọn đúng bàn khớp qrToken
    const table =
      candidateTables.find(
        (t) => t.qrToken && t.qrToken.trim() === qrToken.trim(),
      ) || candidateTables[0];

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

    // AUD-13.2: Chặn tạo đơn khi nhà hàng bị tạm ngưng / khóa
    if (restaurant.isSuspended || restaurant.subscriptionStatus === 'SUSPENDED') {
      throw new ForbiddenException('Nhà hàng đang tạm ngưng hoạt động. Vui lòng liên hệ nhân viên.');
    }

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
        if (dto.autoMergeRound2) {
          return (await this.addItemsByCustomer(
            {
              restaurantSlug: dto.restaurantSlug,
              tableCode: dto.tableCode,
              qrToken: dto.qrToken,
              orderId: activeOrder._id.toString(),
              items: dto.items,
              note: dto.customerNote,
            },
            activeOrder._id.toString(),
            idempotencyKey,
          )) as any;
        }

        throw new ConflictException(
          `Bàn "${table.name}" hiện đang có đơn hàng hoạt động với mã ${activeOrder.orderCode}. Vui lòng sử dụng tính năng gọi thêm món.`,
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
        receiptAccessToken: crypto.randomBytes(24).toString('hex'),
      });

      let savedOrder: OrderDocument;
      let saveAttempts = 0;
      while (true) {
        try {
          savedOrder = await order.save();
          break;
        } catch (err: any) {
          // DEF-6.5-002 & AUD-13.4: Bắt lỗi E11000 từ MongoDB partial unique index (active order per table)
          // khi 2 khách cùng bàn bấm gửi đơn Đợt 1 đồng thời ở cùng một mili-giây
          if (err?.code === 11000) {
            const isOrderCodeDup = err?.keyPattern?.orderCode || err?.message?.includes('orderCode');
            if (isOrderCodeDup && saveAttempts < 5) {
              saveAttempts++;
              const newSuffix = Math.floor(1000 + Math.random() * 9000);
              order.orderCode = `ORD-${dateStr}-${newSuffix}`;
              continue;
            }

            const concurrentActiveOrder = await this.orderModel.findOne({
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
            if (concurrentActiveOrder && dto.autoMergeRound2) {
              return (await this.addItemsByCustomer(
                {
                  restaurantSlug: dto.restaurantSlug,
                  tableCode: dto.tableCode,
                  qrToken: dto.qrToken,
                  orderId: concurrentActiveOrder._id.toString(),
                  items: dto.items,
                  note: dto.customerNote,
                },
                concurrentActiveOrder._id.toString(),
                idempotencyKey,
              )) as any;
            }
            throw new ConflictException(
              `Bàn "${table.name}" hiện đang có đơn hàng hoạt động vừa được khởi tạo bởi khách khác hoặc yêu cầu tạo đơn bị trùng lặp.`,
            );
          }
          throw err;
        }
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
          if (table.status === 'PaymentRequested' && nextStatus !== 'PaymentRequested') {
            const updatedTable = await this.tableModel.findOneAndUpdate(
              { _id: table._id, status: 'PaymentRequested' },
              { $set: { status: 'Occupied' } },
              { new: true },
            );
            if (updatedTable) {
              this.eventEmitter.emit('table.status_updated', {
                table: updatedTable.toObject(),
                restaurantId: restaurant._id.toString(),
                branchId: updatedTable.branchId,
              });
            }
          }

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
   * SUB-PHASE 6.8: Phân giải ngữ cảnh nhà hàng, chi nhánh, bàn ăn và đơn hàng qua mã QR (Public)
   */
  async getTableContextByQr(dto: CustomerGetActiveOrderDto): Promise<{
    restaurant: {
      id: string;
      name: string;
      slug: string;
      phone?: string;
      address?: string;
      logoUrl?: string;
      bankAccount?: any;
    };
    bankAccount?: any;
    table: {
      id: string;
      code: string;
      name: string;
      branchId?: string;
      zoneId?: string;
      capacity?: number;
      qrStatus?: string;
      wifiSsid?: string;
      wifiPassword?: string;
    };
    activeOrder: Order | null;
  }> {
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

    const effectiveBank = resolveEffectiveBankAccount(restaurant, table.branchId?.toString());

    return {
      restaurant: {
        id: restaurant._id.toString(),
        name: restaurant.name,
        slug: restaurant.slug,
        phone: restaurant.phone,
        address: restaurant.address,
        logoUrl: (restaurant as any).logoUrl,
        bankAccount: effectiveBank,
      },
      bankAccount: effectiveBank,
      table: {
        id: table._id.toString(),
        code: table.code,
        name: table.name,
        branchId: table.branchId ? table.branchId.toString() : undefined,
        zoneId: (table as any).zoneId ? (table as any).zoneId.toString() : undefined,
        capacity: table.capacity,
        qrStatus: table.qrStatus,
        wifiSsid: table.wifiSsid || '',
        wifiPassword: table.wifiPassword || '',
      },
      activeOrder,
    };
  }

  /**
   * Lấy danh sách đơn hàng có bộ lọc nâng cao, tìm kiếm, sắp xếp và phân trang (Sub-phase 6.7)
   */
  async findAll(
    query: QueryOrderDto,
    restaurantId: string,
    caller?: JwtUser,
  ): Promise<{ data: Order[]; total: number; page: number; limit: number; totalPages: number }> {
    if (!restaurantId || !Types.ObjectId.isValid(restaurantId)) {
      throw new BadRequestException('Mã nhà hàng không hợp lệ');
    }

    const filter: any = {
      restaurantId: new Types.ObjectId(restaurantId),
    };

    // 1. Cưỡng chế phân lập Đa chi nhánh nghiêm ngặt (Strict Multi-Branch Isolation)
    const isSuperAdmin = isSuperAdminUser(caller);
    const isMainBranch = caller?.isMainBranch === true;

    if (!isSuperAdmin && !isMainBranch) {
      if (!caller?.branchId) {
        throw new ForbiddenException('Tài khoản chưa được gán chi nhánh hợp lệ');
      }
      // Nhân viên chi nhánh con: Bắt buộc chỉ xem đơn của chi nhánh mình
      if (query.branchId && query.branchId !== caller.branchId) {
        throw new ForbiddenException('Bạn không có quyền truy cập dữ liệu của chi nhánh khác');
      }
      filter.branchId = caller.branchId;
    } else {
      // Trụ sở chính (Main Branch) hoặc Super Admin: Có quyền lọc theo branchId hoặc xem toàn chuỗi
      if (query.branchId && query.branchId.trim() !== '') {
        filter.branchId = query.branchId.trim();
      }
    }

    // 2. Lọc theo bàn ăn
    if (query.tableId) {
      if (!Types.ObjectId.isValid(query.tableId)) {
        throw new BadRequestException('Mã bàn ăn không hợp lệ');
      }
      filter.tableId = new Types.ObjectId(query.tableId);
    }

    // 3. Lọc theo trạng thái (đơn trạng thái, đa trạng thái phân tách bằng dấu phẩy, hoặc 'all')
    const VALID_STATUSES: OrderStatus[] = [
      'WaitingConfirmation',
      'Confirmed',
      'Preparing',
      'Ready',
      'Served',
      'PaymentRequested',
      'Paid',
      'Cancelled',
    ];

    if (query.status && query.status.trim() !== '' && query.status !== 'all') {
      const statuses = query.status.split(',').map((s) => s.trim()).filter(Boolean);
      for (const s of statuses) {
        if (!VALID_STATUSES.includes(s as OrderStatus)) {
          throw new BadRequestException(`Trạng thái đơn hàng không hợp lệ: ${s}`);
        }
      }
      if (statuses.length === 1) {
        filter.status = statuses[0];
      } else if (statuses.length > 1) {
        filter.status = { $in: statuses };
      }
    }

    // 4. Lọc trạng thái thanh toán (isPaid)
    if (query.isPaid !== undefined) {
      filter.isPaid = query.isPaid;
    }

    // 5. Lọc theo khoảng thời gian (Date/Time Range)
    const targetField = query.dateField || 'createdAt';
    if (!['createdAt', 'openedAt', 'closedAt'].includes(targetField)) {
      throw new BadRequestException('dateField phải là createdAt, openedAt hoặc closedAt');
    }

    if (query.fromDate || query.toDate) {
      const dateCondition: any = {};
      let from: Date | undefined;
      let to: Date | undefined;

      if (query.fromDate) {
        const fromStr = /^\d{4}-\d{2}-\d{2}$/.test(query.fromDate.trim())
          ? `${query.fromDate.trim()}T00:00:00.000Z`
          : query.fromDate.trim();
        from = new Date(fromStr);
        if (isNaN(from.getTime())) {
          throw new BadRequestException('fromDate không đúng định dạng ngày tháng hợp lệ');
        }
        dateCondition.$gte = from;
      }
      if (query.toDate) {
        const toStr = /^\d{4}-\d{2}-\d{2}$/.test(query.toDate.trim())
          ? `${query.toDate.trim()}T23:59:59.999Z`
          : query.toDate.trim();
        to = new Date(toStr);
        if (isNaN(to.getTime())) {
          throw new BadRequestException('toDate không đúng định dạng ngày tháng hợp lệ');
        }
        dateCondition.$lte = to;
      }
      if (from && to && from > to) {
        throw new BadRequestException('fromDate không được lớn hơn toDate');
      }
      filter[targetField] = dateCondition;
    }

    // 6. Lọc phương thức thanh toán
    if (query.paymentMethod) {
      if (!['VietQR', 'Cash', 'Card', 'Transfer'].includes(query.paymentMethod)) {
        throw new BadRequestException('Phương thức thanh toán không hợp lệ');
      }
      filter.paymentMethod = query.paymentMethod;
    }

    // 7. Lọc nhân sự và tìm kiếm (Kết hợp an toàn qua andClauses)
    const andClauses: any[] = [];

    // 7a. Lọc người tạo (createdBy) và người thu tiền (paidBy)
    if (query.createdBy) {
      if (!Types.ObjectId.isValid(query.createdBy)) {
        throw new BadRequestException('createdBy không phải ObjectId hợp lệ');
      }
      filter.createdBy = new Types.ObjectId(query.createdBy);
    }
    if (query.paidBy) {
      if (!Types.ObjectId.isValid(query.paidBy)) {
        throw new BadRequestException('paidBy không phải ObjectId hợp lệ');
      }
      filter.paidBy = new Types.ObjectId(query.paidBy);
    }
    // Nếu truyền staffId: khớp với createdBy HOẶC paidBy
    if (query.staffId) {
      if (!Types.ObjectId.isValid(query.staffId)) {
        throw new BadRequestException('staffId không phải ObjectId hợp lệ');
      }
      const staffObjectId = new Types.ObjectId(query.staffId);
      andClauses.push({
        $or: [{ createdBy: staffObjectId }, { paidBy: staffObjectId }],
      });
    }

    // 7b. Tìm kiếm an toàn theo mã đơn hoặc tên bàn
    if (query.search && query.search.trim() !== '') {
      const rawSearch = query.search.trim();
      if (rawSearch.length > 100) {
        throw new BadRequestException('Từ khóa tìm kiếm không được vượt quá 100 ký tự');
      }
      const escaped = rawSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      andClauses.push({
        $or: [
          { orderCode: { $regex: escaped, $options: 'i' } },
          { tableName: { $regex: escaped, $options: 'i' } },
        ],
      });
    }

    if (andClauses.length > 0) {
      filter.$and = andClauses;
    }

    // 8. Sắp xếp xác định (Deterministic Sorting) & Phân trang
    const sortBy = query.sortBy || 'createdAt';
    if (!['createdAt', 'totalAmount', 'openedAt', 'closedAt'].includes(sortBy)) {
      throw new BadRequestException('Trường sortBy không hợp lệ');
    }
    const sortDirection: 1 | -1 = query.sortOrder === 'asc' ? 1 : -1;
    const sort: any = { [sortBy]: sortDirection, _id: -1 };

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const startTime = Date.now();
    const [data, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.orderModel.countDocuments(filter),
    ]);
    const duration = Date.now() - startTime;
    this.logger.debug(
      `findAll orders executed in ${duration}ms (restaurantId=${restaurantId}, total=${total}, page=${page}/${Math.ceil(total / limit) || 1})`,
    );

    const totalPages = Math.ceil(total / limit) || 1;

    return { data, total, page, limit, totalPages };
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

    // Nếu đơn hàng trước đó ở trạng thái PaymentRequested và nay có món mới được duyệt chuyển về Preparing/Waiting,
    // giải phóng trạng thái bàn từ PaymentRequested về Occupied
    if (order.tableId) {
      const table = await this.tableModel.findOneAndUpdate(
        {
          _id: order.tableId,
          restaurantId: order.restaurantId,
          status: 'PaymentRequested',
        },
        { $set: { status: 'Occupied' } },
        { new: true },
      );
      if (table) {
        this.eventEmitter.emit('table.status_updated', {
          table: table.toObject(),
          restaurantId: order.restaurantId.toString(),
          branchId: table.branchId,
        });
      }
    }

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

    const previousSubTotal = order.subTotal || 0;
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

    this.eventEmitter.emit('activity.log', {
      action: ActivityAction.CANCEL || 'cancel',
      module: ActivityModule.ORDER || 'order',
      entityType: 'Order',
      restaurantId: order.restaurantId.toString(),
      branchId: order.branchId ? order.branchId.toString() : undefined,
      targetId: order._id.toString(),
      userId: validUserOid ? validUserOid.toString() : undefined,
      userName: caller?.fullName || caller?.name || 'Hệ thống',
      userRole: caller?.role,
      previousData: { subTotal: previousSubTotal, totalAmount: order.totalAmount, status: order.status },
      newData: { status: 'Cancelled', cancelReason: reason.trim() },
      metadata: {
        orderCode: order.orderCode,
        reason: reason.trim(),
        cancelledBy: validUserOid ? validUserOid.toString() : undefined,
        previousSubTotal,
        newSubTotal: 0,
        lostRevenue: order.totalAmount,
      },
      description: `Hủy toàn bộ đơn hàng ${order.orderCode} (Bàn ${order.tableName}): ${reason.trim()}`,
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

    const previousSubTotal = order.subTotal || 0;
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

    this.eventEmitter.emit('activity.log', {
      action: ActivityAction.CANCEL || 'cancel',
      module: ActivityModule.ORDER || 'order',
      entityType: 'Order',
      restaurantId: order.restaurantId.toString(),
      branchId: order.branchId ? order.branchId.toString() : undefined,
      targetId: order._id.toString(),
      userId: validUserOid ? validUserOid.toString() : undefined,
      userName: caller?.fullName || caller?.name || 'Hệ thống',
      userRole: caller?.role,
      previousData: { subTotal: previousSubTotal, itemId, itemName: item.name, itemPrice: item.price, quantity: item.quantity },
      newData: { subTotal: order.subTotal, totalAmount: order.totalAmount, itemStatus: 'Cancelled' },
      metadata: {
        orderCode: order.orderCode,
        itemId,
        itemName: item.name,
        reason: reason.trim(),
        cancelledBy: validUserOid ? validUserOid.toString() : undefined,
        previousSubTotal,
        newSubTotal: order.subTotal,
        lostRevenue: previousSubTotal - order.subTotal,
      },
      description: `Hủy món ${item.name} (SL: ${item.quantity}) trong đơn ${order.orderCode}: ${reason.trim()}`,
    });

    return order;
  }

  /**
   * Helper function thực thi thao tác với cơ chế OCC Retry & Jitter chống Lost Update
   */
  private async executeWithOccRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 10,
    minJitterMs = 25,
    maxJitterMs = 75,
  ): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err: any) {
        lastError = err;
        const isConflict =
          err?.name === 'VersionError' ||
          err?.code === 11000 ||
          err?.message?.includes('OCC_CONFLICT') ||
          err?.status === HttpStatus.CONFLICT;

        if (isConflict && attempt < maxRetries) {
          const jitter = Math.floor(Math.random() * (maxJitterMs - minJitterMs + 1)) + minJitterMs + attempt * 10;
          this.logger.warn(
            `[OCC] Xung đột tương tranh tài liệu (lần thử ${attempt}/${maxRetries}), thử lại sau ${jitter}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, jitter));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  /**
   * CORE OCC & IDEMPOTENCY ENGINE: Chuyển đổi trạng thái OrderItem
   */
  async transitionOrderItemStatus(params: {
    itemId: string;
    targetStatus: OrderItemStatus;
    restaurantId: string;
    caller?: any;
    orderId?: string;
    expectedCurrentStatus?: OrderItemStatus;
  }): Promise<{ order: any; isIdempotent: boolean; previousStatus: OrderItemStatus }> {
    const { itemId, targetStatus, restaurantId, caller, orderId, expectedCurrentStatus } = params;

    const result = await this.executeWithOccRetry(async () => {
      let order: any;

      if (orderId) {
        if (!Types.ObjectId.isValid(orderId)) {
          throw new BadRequestException('Mã đơn hàng không hợp lệ');
        }
        order = await this.orderModel.findOne({
          _id: new Types.ObjectId(orderId),
          restaurantId: new Types.ObjectId(restaurantId),
        });
      } else {
        if (!Types.ObjectId.isValid(itemId)) {
          throw new BadRequestException('Mã món ăn không hợp lệ');
        }
        // Ưu tiên tìm trong đơn active (status NOT IN ['Paid', 'Cancelled'])
        order = await this.orderModel.findOne({
          'items._id': new Types.ObjectId(itemId),
          restaurantId: new Types.ObjectId(restaurantId),
          status: { $nin: ['Paid', 'Cancelled'] },
        });
        if (!order) {
          order = await this.orderModel.findOne({
            'items._id': new Types.ObjectId(itemId),
            restaurantId: new Types.ObjectId(restaurantId),
          });
        }
      }

      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng chứa món ăn này');
      }

      // Phân lập chi nhánh chặt chẽ (AUD-7.1)
      const isSuperAdmin = isSuperAdminUser(caller);
      const roleSlug = (typeof caller?.role === 'string' ? caller.role : caller?.role?.slug || '').toLowerCase();
      const isManagerOrAdmin = ['restaurant_admin', 'restaurant_manager', 'system_admin', 'super_admin'].includes(roleSlug);
      const canOperateAllBranches = isSuperAdmin || (caller?.isMainBranch === true && isManagerOrAdmin);

      if (!canOperateAllBranches && caller?.branchId) {
        if (order.branchId && order.branchId !== caller.branchId) {
          throw new ForbiddenException('Bạn không có quyền thao tác trên đơn hàng của chi nhánh khác');
        }
      }

      // Tìm item trong mảng items
      const item = (order.items || []).find(
        (it: any) => it._id?.toString() === itemId || it.id === itemId,
      );
      if (!item) {
        throw new NotFoundException('Không tìm thấy món ăn trong đơn hàng');
      }

      // 1. Kiểm tra Idempotency: nếu trạng thái hiện tại đã bằng targetStatus
      if (item.status === targetStatus) {
        const ordObj = order.toObject ? order.toObject() : order;
        return {
          order: { ...ordObj, isIdempotent: true },
          isIdempotent: true,
          previousStatus: item.status,
        };
      }

      // 2. Chặn các trạng thái đóng băng
      if (order.isPaid || order.status === 'Paid') {
        throw new BadRequestException('Không thể thay đổi trạng thái món ăn của đơn hàng đã thanh toán (Paid)');
      }
      if (order.status === 'Cancelled') {
        throw new BadRequestException('Không thể thay đổi trạng thái món ăn của đơn hàng đã hủy (Cancelled)');
      }
      if (item.status === 'Cancelled') {
        throw new BadRequestException('Không thể thay đổi trạng thái của món ăn đã bị hủy (Cancelled)');
      }
      if (item.status === 'WaitingConfirmation') {
        throw new BadRequestException('Món ăn đang ở trạng thái chờ duyệt (WaitingConfirmation), chưa thể chế biến');
      }

      // 3. Kiểm tra bước nhảy theo expectedCurrentStatus nếu có yêu cầu
      if (expectedCurrentStatus && item.status !== expectedCurrentStatus) {
        if (expectedCurrentStatus === 'Waiting' && targetStatus === 'Cooking') {
          if (item.status === 'Ready' || item.status === 'Served') {
            throw new BadRequestException(
              `Món ăn đã ở trạng thái ${item.status}, không thể chuyển lại Đang nấu (Cooking)`,
            );
          }
        }
        if (expectedCurrentStatus === 'Cooking' && targetStatus === 'Ready') {
          if (item.status === 'Waiting') {
            throw new BadRequestException(
              'Món ăn cần chuyển sang Đang nấu (Cooking) trước khi Hoàn tất (Ready)',
            );
          }
          if (item.status === 'Served') {
            throw new BadRequestException(
              'Món ăn đã phục vụ (Served), không thể quay lại trạng thái Hoàn tất (Ready)',
            );
          }
        }
        if (expectedCurrentStatus === 'Ready' && targetStatus === 'Served') {
          if (item.status === 'Waiting' || item.status === 'Cooking') {
            throw new BadRequestException(
              'Món ăn chưa hoàn thành chế biến, không thể báo Đã phục vụ (Served)',
            );
          }
        }
      }

      // Kiểm tra State Validator chung
      OrderStateValidator.validateItemTransition(item.status, targetStatus, order.isPaid);

      const previousStatus = item.status;
      item.status = targetStatus;

      // Tính lại Order.status từ Reducer
      const derivedStatus = calculateOrderStatus(order.items, order.status);
      if (derivedStatus !== order.status) {
        OrderStateValidator.validateOrderTransition(order.status, derivedStatus);
        order.status = derivedStatus;
      }

      // Cập nhật OCC nguyên tử với updatedAt và chốt chặn trạng thái bất biến (AUD-7.3)
      const updateFilter: any = {
        _id: order._id,
        restaurantId: order.restaurantId,
        isPaid: { $ne: true },
        status: { $nin: ['Paid', 'Cancelled'] },
      };
      if (!canOperateAllBranches && caller?.branchId) {
        updateFilter.branchId = caller.branchId;
      }
      if (order.updatedAt) {
        updateFilter.updatedAt = order.updatedAt;
      }

      const updated = await this.orderModel.findOneAndUpdate(
        updateFilter,
        {
          $set: {
            items: order.items,
            status: order.status,
            updatedAt: new Date(),
          },
        },
        { new: true },
      );

      if (!updated) {
        throw new Error('OCC_CONFLICT');
      }

      const resObj = updated.toObject ? updated.toObject() : updated;
      return {
        order: { ...resObj, isIdempotent: false },
        isIdempotent: false,
        previousStatus,
      };
    });

    // Chỉ phát sự kiện WebSocket khi có thay đổi thực sự (không phát nếu idempotent)
    if (!result.isIdempotent) {
      this.eventEmitter.emit('order.item_status_updated', {
        orderId: (result.order._id || result.order.id).toString(),
        itemId,
        status: targetStatus,
        previousStatus: result.previousStatus,
        order: result.order,
        restaurantId: restaurantId.toString(),
        branchId: result.order.branchId,
        tableId: (result.order.tableId?._id || result.order.tableId)?.toString(),
        tableName: result.order.tableName,
      });
    }

    return result;
  }

  /**
   * KDS ACTION: Bắt đầu nấu món (Waiting -> Cooking)
   */
  async startCookingItem(
    itemId: string,
    restaurantId: string,
    caller: JwtUser,
    orderId?: string,
  ): Promise<any> {
    const res = await this.transitionOrderItemStatus({
      itemId,
      targetStatus: 'Cooking',
      expectedCurrentStatus: 'Waiting',
      restaurantId,
      caller,
      orderId,
    });
    return res.order;
  }

  /**
   * KDS ACTION: Báo hoàn tất món (Cooking -> Ready)
   */
  async markItemReady(
    itemId: string,
    restaurantId: string,
    caller: JwtUser,
    orderId?: string,
  ): Promise<any> {
    const res = await this.transitionOrderItemStatus({
      itemId,
      targetStatus: 'Ready',
      expectedCurrentStatus: 'Cooking',
      restaurantId,
      caller,
      orderId,
    });
    return res.order;
  }

  /**
   * KDS ACTION: Báo đã phục vụ món ra bàn (Ready -> Served)
   */
  async markItemServed(
    itemId: string,
    restaurantId: string,
    caller: JwtUser,
    orderId?: string,
  ): Promise<any> {
    const res = await this.transitionOrderItemStatus({
      itemId,
      targetStatus: 'Served',
      expectedCurrentStatus: 'Ready',
      restaurantId,
      caller,
      orderId,
    });
    return res.order;
  }

  /**
   * Cập nhật trạng thái món ăn (Tương thích ngược với PATCH /orders/:id/items/:itemId/status)
   */
  async updateItemStatus(
    orderId: string,
    itemId: string,
    status: OrderItemStatus,
    restaurantId: string,
    caller?: any,
  ): Promise<any> {
    const res = await this.transitionOrderItemStatus({
      itemId,
      targetStatus: status,
      restaurantId,
      caller,
      orderId,
    });
    return res.order;
  }

  /**
   * KDS BATCH ACTION: Nấu / Hoàn tất hàng loạt món trong vé bếp hoặc đợt gọi món
   */
  async batchUpdateKitchenItems(
    orderId: string,
    targetStatus: 'Cooking' | 'Ready' | 'Served',
    restaurantId: string,
    caller: JwtUser,
    roundNumber?: number,
  ): Promise<any> {
    return this.executeWithOccRetry(async () => {
      const order: any = await this.findById(orderId, restaurantId, caller);
      if (order.isPaid || order.status === 'Paid') {
        throw new BadRequestException('Không thể thay đổi món của đơn hàng đã thanh toán (Paid)');
      }
      if (order.status === 'Cancelled') {
        throw new BadRequestException('Không thể thay đổi món của đơn hàng đã hủy (Cancelled)');
      }

      // Phân lập chi nhánh chặt chẽ (AUD-7.1)
      const isSuperAdmin = isSuperAdminUser(caller);
      const roleSlug = (typeof caller?.role === 'string' ? caller.role : caller?.role?.slug || '').toLowerCase();
      const isManagerOrAdmin = ['restaurant_admin', 'restaurant_manager', 'system_admin', 'super_admin'].includes(roleSlug);
      const canOperateAllBranches = isSuperAdmin || (caller?.isMainBranch === true && isManagerOrAdmin);

      if (!canOperateAllBranches && caller?.branchId) {
        if (order.branchId && order.branchId !== caller.branchId) {
          throw new ForbiddenException('Bạn không có quyền thao tác trên đơn hàng của chi nhánh khác');
        }
      }

      let eligibleItems = (order.items || []).filter(
        (it: any) => it.status !== 'Cancelled' && it.status !== 'WaitingConfirmation',
      );
      if (roundNumber !== undefined && roundNumber !== null) {
        eligibleItems = eligibleItems.filter((it: any) => it.roundNumber === Number(roundNumber));
      }

      let itemsToUpdate: any[] = [];
      if (targetStatus === 'Cooking') {
        itemsToUpdate = eligibleItems.filter((it: any) => it.status === 'Waiting');
      } else if (targetStatus === 'Ready') {
        itemsToUpdate = eligibleItems.filter((it: any) => it.status === 'Cooking');
      } else if (targetStatus === 'Served') {
        itemsToUpdate = eligibleItems.filter((it: any) => it.status === 'Ready');
      }

      // Nếu không có item nào cần update, kiểm tra idempotency
      if (itemsToUpdate.length === 0) {
        const alreadyTarget = eligibleItems.filter((it: any) => it.status === targetStatus);
        if (alreadyTarget.length > 0) {
          const ordObj = order.toObject ? order.toObject() : order;
          return { ...ordObj, isIdempotent: true, updatedCount: 0 };
        }
        throw new BadRequestException(
          `Không có món nào hợp lệ để chuyển sang trạng thái ${targetStatus}`,
        );
      }

      for (const it of itemsToUpdate) {
        it.status = targetStatus;
      }

      const derivedStatus = calculateOrderStatus(order.items, order.status);
      if (derivedStatus !== order.status) {
        OrderStateValidator.validateOrderTransition(order.status, derivedStatus);
        order.status = derivedStatus;
      }

      // Cập nhật OCC nguyên tử với updatedAt và chốt chặn trạng thái bất biến (AUD-7.3)
      const updateFilter: any = {
        _id: order._id,
        restaurantId: order.restaurantId,
        isPaid: { $ne: true },
        status: { $nin: ['Paid', 'Cancelled'] },
      };
      if (!canOperateAllBranches && caller?.branchId) {
        updateFilter.branchId = caller.branchId;
      }
      if (order.updatedAt) {
        updateFilter.updatedAt = order.updatedAt;
      }

      const updated = await this.orderModel.findOneAndUpdate(
        updateFilter,
        {
          $set: {
            items: order.items,
            status: order.status,
            updatedAt: new Date(),
          },
        },
        { new: true },
      );

      if (!updated) {
        throw new Error('OCC_CONFLICT');
      }

      const resObj = updated.toObject ? updated.toObject() : updated;

      // Broadcast realtime event
      this.eventEmitter.emit('order.item_status_updated', {
        orderId: (updated._id || (updated as any).id).toString(),
        itemId: 'batch',
        status: targetStatus,
        order: resObj,
        restaurantId: restaurantId.toString(),
        branchId: updated.branchId,
        tableId: (updated.tableId?._id || updated.tableId)?.toString(),
        tableName: updated.tableName,
      });

      return { ...resObj, isIdempotent: false, updatedCount: itemsToUpdate.length };
    });
  }

  /**
   * KDS QUERY: Lấy danh sách đơn hàng active cho Màn hình Bếp
   */
  async getKitchenOrders(
    query: QueryKitchenOrdersDto,
    restaurantId: string,
    caller: JwtUser,
  ): Promise<any[]> {
    if (!restaurantId || !Types.ObjectId.isValid(restaurantId)) {
      throw new BadRequestException('Mã nhà hàng không hợp lệ');
    }
    const restObjId = new Types.ObjectId(restaurantId);

    const filter: any = {
      restaurantId: restObjId,
      status: { $nin: ['Paid', 'Cancelled'] },
    };

    // 1. Cưỡng chế phân lập chi nhánh: Chỉ Quản lý/Chủ quán tại Chi nhánh chính mới được xem toàn bộ các chi nhánh
    const isSuperAdmin = isSuperAdminUser(caller);
    const roleSlug = (typeof caller?.role === 'string' ? caller.role : caller?.role?.slug || '').toLowerCase();
    const isManagerOrAdmin = ['restaurant_admin', 'restaurant_manager', 'system_admin', 'super_admin'].includes(roleSlug);
    const canSeeAllBranches = isSuperAdmin || (caller?.isMainBranch === true && isManagerOrAdmin);

    if (!canSeeAllBranches) {
      if (!caller?.branchId) {
        throw new ForbiddenException('Tài khoản chưa được gán chi nhánh hợp lệ');
      }
      if (query.branchId && query.branchId !== caller.branchId) {
        throw new ForbiddenException('Bạn không có quyền truy cập dữ liệu của chi nhánh khác');
      }
      filter.branchId = caller.branchId;
    } else {
      if (query.branchId && query.branchId.trim() !== '' && query.branchId !== 'all') {
        filter.branchId = query.branchId.trim();
      }
    }

    // 2. Xử lý includeUnconfirmed
    if (query.includeUnconfirmed === false) {
      filter.status.$nin.push('WaitingConfirmation');
    }

    // 3. Lọc theo khu vực bàn ăn (zoneId) (AUD-7.5: validate ObjectId)
    if (query.zoneId) {
      if (!Types.ObjectId.isValid(query.zoneId)) {
        throw new BadRequestException('Mã khu vực không hợp lệ');
      }
      const zoneTables = await this.tableModel
        .find({
          zoneId: new Types.ObjectId(query.zoneId),
          restaurantId: restObjId,
        })
        .select('_id');
      const tableIds = zoneTables.map((t) => t._id);
      filter.tableId = { $in: tableIds };
    }

    // 4. Lọc theo bàn (tableId)
    if (query.tableId) {
      if (!Types.ObjectId.isValid(query.tableId)) {
        throw new BadRequestException('Mã bàn ăn không hợp lệ');
      }
      filter.tableId = new Types.ObjectId(query.tableId);
    }

    // 5. Lọc theo trạng thái (AUD-7.5: Chống override $nin Paid / Cancelled)
    if (query.status && query.status.trim() !== '' && query.status !== 'all') {
      const rawStatuses = query.status.split(',').map((s) => s.trim()).filter(Boolean);
      const allowedStatuses = rawStatuses.filter((s) => s !== 'Paid' && s !== 'Cancelled');
      if (allowedStatuses.length === 1) {
        filter.status = allowedStatuses[0];
      } else if (allowedStatuses.length > 1) {
        filter.status = { $in: allowedStatuses };
      } else {
        filter.status = { $in: [] };
      }
    }

    // 6. Tìm kiếm theo mã đơn hoặc tên bàn
    if (query.search && query.search.trim()) {
      const sRegex = new RegExp(query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ orderCode: sRegex }, { tableName: sRegex }];
    }

    // 7. Sắp xếp FIFO: createdAt ASC
    const orders = await this.orderModel
      .find(filter)
      .sort({ createdAt: 1 })
      .populate('tableId', 'name code capacity zoneId qrStatus')
      .lean();

    const now = Date.now();
    return orders.map((o: any) => ({
      ...o,
      id: (o._id || o.id).toString(),
      elapsedMinutes: Math.floor((now - new Date(o.createdAt).getTime()) / 60000),
      items: (o.items || []).map((it: any) => ({
        ...it,
        id: (it._id || it.id).toString(),
      })),
    }));
  }

  /**
   * KDS AGGREGATION: Gom nhóm các món đang Waiting và Cooking trên toàn chi nhánh
   */
  async getKitchenItemsSummary(
    branchId: string | undefined,
    restaurantId: string,
    caller: JwtUser,
  ): Promise<{
    totalWaitingItems: number;
    totalCookingItems: number;
    summary: Array<{
      menuItemId: string;
      name: string;
      waitingQty: number;
      cookingQty: number;
      totalActiveQty: number;
      notes: string[];
      tables: string[];
    }>;
  }> {
    if (!restaurantId || !Types.ObjectId.isValid(restaurantId)) {
      throw new BadRequestException('Mã nhà hàng không hợp lệ');
    }
    const restObjId = new Types.ObjectId(restaurantId);

    const filter: any = {
      restaurantId: restObjId,
      status: { $nin: ['Paid', 'Cancelled'] },
    };

    // Phân lập chi nhánh
    const isSuperAdmin = isSuperAdminUser(caller);
    const roleSlug = (typeof caller?.role === 'string' ? caller.role : caller?.role?.slug || '').toLowerCase();
    const isManagerOrAdmin = ['restaurant_admin', 'restaurant_manager', 'system_admin', 'super_admin'].includes(roleSlug);
    const canSeeAllBranches = isSuperAdmin || (caller?.isMainBranch === true && isManagerOrAdmin);
    let effectiveBranchId = branchId;
    if (!canSeeAllBranches) {
      if (!caller?.branchId) {
        throw new ForbiddenException('Tài khoản chưa được gán chi nhánh hợp lệ');
      }
      if (branchId && branchId !== caller.branchId) {
        throw new ForbiddenException('Bạn không có quyền truy cập dữ liệu của chi nhánh khác');
      }
      effectiveBranchId = caller.branchId;
    }

    if (effectiveBranchId && effectiveBranchId !== 'all') {
      filter.branchId = effectiveBranchId;
    }

    const orders = await this.orderModel.find(filter).lean();

    let totalWaitingItems = 0;
    let totalCookingItems = 0;
    const summaryMap = new Map<
      string,
      {
        menuItemId: string;
        name: string;
        waitingQty: number;
        cookingQty: number;
        totalActiveQty: number;
        notes: string[];
        tables: string[];
      }
    >();

    for (const ord of orders) {
      for (const it of ord.items || []) {
        if (it.status === 'Waiting' || it.status === 'Cooking') {
          const key = (it.menuItemId ? it.menuItemId.toString() : '') || it.name;
          if (!summaryMap.has(key)) {
            summaryMap.set(key, {
              menuItemId: it.menuItemId ? it.menuItemId.toString() : '',
              name: it.name,
              waitingQty: 0,
              cookingQty: 0,
              totalActiveQty: 0,
              notes: [],
              tables: [],
            });
          }
          const entry = summaryMap.get(key)!;
          if (it.status === 'Waiting') {
            entry.waitingQty += it.quantity;
            totalWaitingItems += it.quantity;
          } else if (it.status === 'Cooking') {
            entry.cookingQty += it.quantity;
            totalCookingItems += it.quantity;
          }
          entry.totalActiveQty += it.quantity;

          if (it.note && it.note.trim() && !entry.notes.includes(it.note.trim())) {
            entry.notes.push(it.note.trim());
          }
          const tableLabel = `${ord.tableName} (x${it.quantity})`;
          if (!entry.tables.includes(tableLabel)) {
            entry.tables.push(tableLabel);
          }
        }
      }
    }

    const summary = Array.from(summaryMap.values()).sort(
      (a, b) => b.totalActiveQty - a.totalActiveQty,
    );

    return {
      totalWaitingItems,
      totalCookingItems,
      summary,
    };
  }

  /**
   * DOMAIN ACTION: Yêu cầu thanh toán (Preparing / Ready / Served -> PaymentRequested)
   * Hỗ trợ xác thực bằng Staff JWT HOẶC bộ 3 QR (restaurantSlug, tableCode, qrToken)
   */
  async requestPayment(
    orderId: string,
    dto?: RequestPaymentDto,
    restaurantId?: string,
    caller?: any,
    qrAuth?: { restaurantSlug?: string; tableCode?: string; qrToken?: string },
  ): Promise<Order> {
    const qrSlug = qrAuth?.restaurantSlug || dto?.restaurantSlug;
    const qrTable = qrAuth?.tableCode || dto?.tableCode;
    const qrTok = qrAuth?.qrToken || dto?.qrToken;

    let order: any;
    if (qrSlug && qrTable && qrTok) {
      const { restaurant, table } = await this.validateQrSession(qrSlug, qrTable, qrTok);
      order = await this.orderModel.findOne({
        _id: new Types.ObjectId(orderId),
        restaurantId: restaurant._id,
        tableId: table._id,
      });
      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng tương ứng với bàn ăn này');
      }
    } else if (restaurantId) {
      order = await this.findById(orderId, restaurantId, caller);
    } else {
      throw new BadRequestException(
        'Yêu cầu thông tin phiên QR hợp lệ (restaurantSlug, tableCode, qrToken) hoặc quyền truy cập của nhân viên',
      );
    }

    if (order.status === 'WaitingConfirmation') {
      throw new BadRequestException('Không thể yêu cầu thanh toán cho đơn hàng chưa được xác nhận');
    }
    if (order.isPaid || order.status === 'Paid') {
      throw new BadRequestException('Đơn hàng này đã được thanh toán trước đó');
    }
    if (order.status === 'Cancelled') {
      throw new BadRequestException('Không thể yêu cầu thanh toán cho đơn hàng đã bị hủy');
    }

    const targetPaymentMethod = dto?.paymentMethod || order.paymentMethod || 'VietQR';
    if (!order.receiptAccessToken) {
      order.receiptAccessToken = crypto.randomBytes(24).toString('hex');
    }

    // Idempotent: nếu đơn đã ở PaymentRequested, cập nhật paymentMethod nếu có và trả về
    if (order.status === 'PaymentRequested') {
      let needsSave = false;
      if (dto?.paymentMethod && order.paymentMethod !== dto.paymentMethod) {
        order.paymentMethod = dto.paymentMethod;
        needsSave = true;
      }
      if (order.isModified && (order.isModified('receiptAccessToken') || needsSave)) {
        await order.save();
      }

      const updatedTable = await this.tableModel.findByIdAndUpdate(
        order.tableId,
        { status: 'PaymentRequested' },
        { new: true },
      );

      this.eventEmitter.emit('order.payment_requested', {
        order: order.toObject(),
        restaurantId: order.restaurantId.toString(),
        branchId: order.branchId,
        receiptAccessToken: order.receiptAccessToken,
      });

      if (updatedTable) {
        this.eventEmitter.emit('table.status_updated', {
          table: updatedTable.toObject(),
          restaurantId: order.restaurantId.toString(),
          branchId: updatedTable.branchId,
        });
      }

      return order;
    }

    OrderStateValidator.validateOrderTransition(order.status, 'PaymentRequested');
    order.status = 'PaymentRequested';
    order.paymentMethod = targetPaymentMethod;
    await order.save();

    // Cập nhật nguyên tử table.status = 'PaymentRequested'
    const updatedTable = await this.tableModel.findByIdAndUpdate(
      order.tableId,
      { status: 'PaymentRequested' },
      { new: true },
    );

    this.eventEmitter.emit('order.payment_requested', {
      order: order.toObject(),
      restaurantId: order.restaurantId.toString(),
      branchId: order.branchId,
    });

    if (updatedTable) {
      this.eventEmitter.emit('table.status_updated', {
        table: updatedTable.toObject(),
        restaurantId: order.restaurantId.toString(),
        branchId: updatedTable.branchId,
      });
    }

    return order;
  }

  /**
   * DOMAIN ACTION: Hoàn tác yêu cầu thanh toán (PaymentRequested -> Served / Ready / Preparing)
   */
  async revertPaymentRequest(
    orderId: string,
    restaurantId: string,
    caller?: any,
  ): Promise<Order> {
    const order: any = await this.findById(orderId, restaurantId, caller);

    if (order.status !== 'PaymentRequested') {
      throw new BadRequestException(
        `Chỉ có thể hoàn tác yêu cầu thanh toán khi đơn ở trạng thái PaymentRequested (hiện tại: ${order.status})`,
      );
    }

    const nextStatus = calculateOrderStatus(order.items || [], 'Served');
    OrderStateValidator.validateOrderTransition(order.status, nextStatus);
    order.status = nextStatus;
    await order.save();

    const updatedTable = await this.tableModel.findByIdAndUpdate(
      order.tableId,
      { status: 'Occupied' },
      { new: true },
    );

    this.eventEmitter.emit('order.updated', {
      order: order.toObject(),
      restaurantId,
      branchId: order.branchId,
    });

    if (updatedTable) {
      this.eventEmitter.emit('table.status_updated', {
        table: updatedTable.toObject(),
        restaurantId,
        branchId: updatedTable.branchId,
      });
    }

    return order;
  }

  /**
   * Lấy thông tin VietQR động cho đơn hàng
   */
  async getVietQRForOrder(
    orderId: string,
    restaurantId?: string,
    caller?: any,
    qrAuth?: { restaurantSlug?: string; tableCode?: string; qrToken?: string },
  ) {
    let order: any;
    let restaurant: any;

    if (qrAuth?.restaurantSlug && qrAuth?.tableCode && qrAuth?.qrToken) {
      const session = await this.validateQrSession(
        qrAuth.restaurantSlug,
        qrAuth.tableCode,
        qrAuth.qrToken,
      );
      restaurant = session.restaurant;
      order = await this.orderModel.findOne({
        _id: new Types.ObjectId(orderId),
        restaurantId: restaurant._id,
        tableId: session.table._id,
      });
    } else if (restaurantId) {
      order = await this.findById(orderId, restaurantId, caller);
      restaurant = await this.restaurantModel.findById(order.restaurantId);
    } else {
      throw new BadRequestException(
        'Yêu cầu thông tin phiên QR hợp lệ (restaurantSlug, tableCode, qrToken) hoặc quyền truy cập của nhân viên',
      );
    }

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    const effectiveBank = resolveEffectiveBankAccount(restaurant, order.branchId?.toString());
    if (!effectiveBank) {
      throw new BadRequestException(
        'Nhà hàng hoặc chi nhánh chưa cấu hình tài khoản ngân hàng nhận thanh toán VietQR',
      );
    }

    const memo = generateVietQRMemo(order.orderCode);

    // AUD-8.4: Luôn tính toán lại số tiền từ danh sách món hợp lệ (status !== 'Cancelled') trên server
    const activeItems = (order.items || []).filter((it: any) => it.status !== 'Cancelled');
    const calculatedSubTotal = activeItems.reduce(
      (sum: number, it: any) => sum + (it.itemTotal || it.price * it.quantity),
      0,
    );
    const serverFinancial = OrderFinancialCalculator.calculate({
      subTotal: calculatedSubTotal,
      discountAmount: order.discountAmount,
      discountPercent: order.discountPercent,
      serviceFee: order.serviceFee,
      serviceFeePercent: order.serviceFeePercent,
      vatAmount: order.vatAmount,
      vatPercent: order.vatPercent,
    });
    const amount = serverFinancial.totalAmount;
    const vietQrUrl = generateVietQRUrl({
      bankId: effectiveBank.bankId,
      accountNo: effectiveBank.accountNo,
      template: effectiveBank.template,
      amount,
      memo,
      accountName: effectiveBank.accountName,
    });

    return {
      orderId: order._id.toString(),
      orderCode: order.orderCode,
      amount,
      memo,
      bankId: effectiveBank.bankId,
      bankName: effectiveBank.bankName,
      accountNo: effectiveBank.accountNo,
      accountName: effectiveBank.accountName,
      template: effectiveBank.template,
      vietQrUrl,
      resolvedFrom: effectiveBank.resolvedFrom,
    };
  }

  /**
   * Lấy ReceiptData hóa đơn nhiệt 80mm cho đơn hàng (PRE_BILL hoặc FINAL_BILL)
   */
  async getReceiptForOrder(
    orderId: string,
    restaurantId?: string,
    caller?: any,
    qrAuth?: { restaurantSlug?: string; tableCode?: string; qrToken?: string },
    receiptAccessToken?: string,
  ): Promise<ReceiptData> {
    let order: any;
    let restaurant: any;

    if (receiptAccessToken) {
      if (!Types.ObjectId.isValid(orderId)) {
        throw new NotFoundException('Không tìm thấy đơn hàng');
      }
      order = await this.orderModel.findOne({
        _id: new Types.ObjectId(orderId),
        receiptAccessToken,
      });
      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng hoặc mã truy cập hóa đơn không hợp lệ');
      }
      const referenceTime = order.closedAt || order.updatedAt || order.createdAt;
      const ageMs = Date.now() - new Date(referenceTime).getTime();
      const MAX_AGE_MS = 24 * 60 * 60 * 1000;
      if (ageMs > MAX_AGE_MS) {
        throw new BadRequestException('Mã truy cập hóa đơn điện tử đã hết hạn (chỉ khả dụng trong vòng 24 giờ sau thanh toán)');
      }
      restaurant = await this.restaurantModel.findById(order.restaurantId);
    } else if (qrAuth?.restaurantSlug && qrAuth?.tableCode && qrAuth?.qrToken) {
      const session = await this.validateQrSession(
        qrAuth.restaurantSlug,
        qrAuth.tableCode,
        qrAuth.qrToken,
      );
      restaurant = session.restaurant;
      order = await this.orderModel.findOne({
        _id: new Types.ObjectId(orderId),
        restaurantId: restaurant._id,
        tableId: session.table._id,
      });
    } else if (restaurantId) {
      order = await this.findById(orderId, restaurantId, caller);
      restaurant = await this.restaurantModel.findById(order.restaurantId);
    } else {
      throw new BadRequestException(
        'Yêu cầu thông tin phiên QR hợp lệ (restaurantSlug, tableCode, qrToken), receiptAccessToken hoặc quyền truy cập của nhân viên',
      );
    }

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    const existingBillData = await this.billsService
      .findByOrderId(order._id.toString(), order.restaurantId.toString(), caller)
      .catch(() => null);
    if (existingBillData?.receiptData) {
      return existingBillData.receiptData;
    }

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

    if (order.tableId) {
      const table = await this.tableModel.findById(order.tableId);
      if (table) {
        wifiSsid = table.wifiSsid || '';
        wifiPassword = table.wifiPassword || '';
      }
    }

    const effectiveBank = resolveEffectiveBankAccount(restaurant, order.branchId?.toString());
    const memo = generateVietQRMemo(order.orderCode);
    let vietQrPayloadUrl = '';
    if (effectiveBank) {
      vietQrPayloadUrl = generateVietQRUrl({
        bankId: effectiveBank.bankId,
        accountNo: effectiveBank.accountNo,
        template: effectiveBank.template,
        amount: order.totalAmount,
        memo,
        accountName: effectiveBank.accountName,
      });
    }

    const activeItems = (order.items || []).filter((it: any) => it.status !== 'Cancelled');
    const receiptItems = activeItems.map((it: any) => {
      const optionsNote = Array.isArray(it.selectedOptions)
        ? it.selectedOptions.map((o: any) => o.valueName || o.name).filter(Boolean).join(', ')
        : '';
      return {
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.price,
        amount: it.itemTotal || it.price * it.quantity,
        selectedOptionsNote: optionsNote || undefined,
        note: it.note || undefined,
        roundNumber: it.roundNumber,
      };
    });

    const receiptType = order.isPaid || order.status === 'Paid' ? 'FINAL_BILL' : 'PRE_BILL';

    return {
      header: {
        restaurantName: restaurant?.name || 'Nhà hàng iMenu',
        branchName,
        address,
        hotline,
        wifiSsid: wifiSsid || undefined,
        wifiPassword: wifiPassword || undefined,
      },
      metadata: {
        receiptType,
        orderCode: order.orderCode,
        tableName: order.tableName,
        cashierName: caller?.fullName || caller?.name || 'Thu ngân',
        createdAt: order.createdAt,
        paidAt: order.closedAt,
      },
      items: receiptItems,
      financials: {
        subTotal: order.subTotal,
        discountAmount: order.discountAmount || 0,
        taxableAmount: Math.max(0, order.subTotal - (order.discountAmount || 0)),
        serviceFee: order.serviceFee || 0,
        vatPercent: 0,
        vatAmount: order.vatAmount || 0,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
      },
      paymentQr: effectiveBank
        ? {
            vietQrPayloadUrl,
            accountNo: effectiveBank.accountNo,
            bankName: effectiveBank.bankName,
            accountName: effectiveBank.accountName,
            memo,
          }
        : undefined,
      footer: {
        thankYouMessage: 'Cảm ơn quý khách và hẹn gặp lại!',
        softwareCredit: 'Hóa đơn khởi tạo bởi iMenu POS Cloud',
      },
    };
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
  ): Promise<{ order: Order; table: Table; bill?: any; changeAmount?: number } & { isReplay?: boolean }> {
    const restaurantOid = new Types.ObjectId(restaurantId);
    const endpoint = `POST /orders/${orderId}/pay`;

    const executeBusinessLogic = async (): Promise<{ order: Order; table: Table; bill?: any; changeAmount?: number }> => {
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

      const effectiveAmountReceived =
        dto.amountReceived !== undefined ? dto.amountReceived : dto.cashGiven;

      if (paymentMethod === 'Cash' && effectiveAmountReceived !== undefined) {
        if (effectiveAmountReceived < financial.totalAmount) {
          throw new BadRequestException(
            `Số tiền khách đưa (${effectiveAmountReceived} đ) không đủ để thanh toán tổng tiền (${financial.totalAmount} đ)`,
          );
        }
        changeAmount = effectiveAmountReceived - financial.totalAmount;
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
        isPaid: { $ne: true },
        status: { $in: ['Preparing', 'Ready', 'Served', 'PaymentRequested'] },
        items: { $size: (order.items || []).length },
      };
      if (order.subTotal !== undefined && order.subTotal !== null) {
        claimFilter.subTotal = order.subTotal;
      }
      if (order.branchId) {
        claimFilter.branchId = order.branchId;
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
            receiptAccessToken: order.receiptAccessToken || crypto.randomBytes(24).toString('hex'),
          },
        },
        { new: true },
      );

      // Nếu atomic claim trả về null: request khác đã thanh toán hoặc dữ liệu bị thay đổi đồng thời
      if (!claimedOrder) {
        throw new BadRequestException(
          'Đơn hàng đã có thay đổi (gọi thêm món hoặc hủy món) trong lúc thanh toán hoặc đã được thanh toán bởi thao tác khác. Vui lòng tải lại đơn trước khi thu tiền.',
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
        receiptAccessToken: claimedOrder.receiptAccessToken,
      });

      // 6. TẠO HOẶC LẤY CHỨNG TỪ BILL BẤT BIẾN
      let bill: any = null;
      try {
        bill = await this.billsService.createOrGetFromPaidOrder(
          claimedOrder,
          financial,
          user,
          {
            amountReceived: effectiveAmountReceived,
            changeAmount,
            note: dto.note,
            paymentMethod,
          },
        );
      } catch (err: any) {
        this.logger.error(
          `Lỗi tạo chứng từ Bill cho đơn hàng ${claimedOrder.orderCode}: ${err.message}`,
          err.stack,
        );
      }

      // 7. GHI NHẬT KÝ KIỂM TOÁN TÀI CHÍNH
      this.eventEmitter.emit('activity.log', {
        action: ActivityAction.PAY || 'pay',
        module: ActivityModule.ORDER || 'order',
        entityType: 'Order',
        restaurantId: claimedOrder.restaurantId.toString(),
        branchId: claimedOrder.branchId ? claimedOrder.branchId.toString() : undefined,
        targetId: claimedOrder._id.toString(),
        userId: validUserOid ? validUserOid.toString() : undefined,
        userName: user?.fullName || user?.name || 'Thu ngân',
        userRole: user?.role,
        newData: {
          orderCode: claimedOrder.orderCode,
          billCode: bill?.billCode,
          subTotal: financial.subTotal,
          discountAmount: financial.discountAmount,
          serviceFee: financial.serviceFee,
          vatAmount: financial.vatAmount,
          totalAmount: financial.totalAmount,
          paymentMethod,
          cashierId: validUserOid ? validUserOid.toString() : undefined,
        },
        metadata: {
          changeAmount,
          amountReceived: effectiveAmountReceived,
        },
        description: `Thanh toán thành công đơn hàng ${claimedOrder.orderCode} - Tổng tiền: ${financial.totalAmount.toLocaleString('vi-VN')} đ (${paymentMethod})`,
      });

      return {
        order: claimedOrder,
        table: table as any,
        bill,
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
   * Hoàn tất thanh toán với Idempotency tự nhiên (Blueprint p. 27).
   * Nếu đơn chưa Paid: thực thi pay(orderId, dto, restaurantId, user, idempotencyKey).
   * Nếu đơn đã Paid (thuộc đúng restaurantId và branchId nếu caller bị giới hạn chi nhánh):
   * trả về 200 OK kèm { order, table, bill, changeAmount: bill?.changeAmount || 0, isIdempotentReplay: true }.
   */
  async completePayment(
    orderId: string,
    dto: PayOrderDto,
    restaurantId: string,
    user?: any,
    idempotencyKey?: string,
  ): Promise<{ order: Order; table: Table; bill?: any; changeAmount?: number; isIdempotentReplay?: boolean }> {
    const order: any = await this.orderModel.findById(orderId);
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    if (order.restaurantId.toString() !== restaurantId.toString()) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên đơn hàng này');
    }

    // Branch isolation check
    if (user?.branchId && order.branchId && order.branchId.toString() !== user.branchId.toString()) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên đơn hàng của chi nhánh khác');
    }

    if (order.isPaid || order.status === 'Paid') {
      const existingBillData = await this.billsService
        .findByOrderId(order._id.toString(), restaurantId, user)
        .catch(() => null);
      const table = await this.tableModel.findById(order.tableId);
      const bill = existingBillData?.bill || existingBillData;
      return {
        order,
        table: table as any,
        bill,
        changeAmount: bill?.changeAmount ?? 0,
        isIdempotentReplay: true,
      };
    }

    try {
      return await this.pay(orderId, dto, restaurantId, user, idempotencyKey);
    } catch (err: any) {
      if (
        err instanceof BadRequestException &&
        (err.message.includes('đã được thanh toán') || err.message.includes('thao tác khác'))
      ) {
        const freshOrder: any = await this.orderModel.findById(orderId);
        if (freshOrder && (freshOrder.isPaid || freshOrder.status === 'Paid')) {
          const existingBillData = await this.billsService
            .findByOrderId(freshOrder._id.toString(), restaurantId, user)
            .catch(() => null);
          const table = await this.tableModel.findById(freshOrder.tableId);
          const bill = existingBillData?.bill || existingBillData;
          return {
            order: freshOrder,
            table: table as any,
            bill,
            changeAmount: bill?.changeAmount ?? 0,
            isIdempotentReplay: true,
          };
        }
      }
      throw err;
    }
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

      // Kiểm tra tính sẵn sàng phục vụ (Availability) của món ăn (kèm chi nhánh override)
      let isAvailable = menuItem.isAvailable ?? true;
      if (branchId && menuItem.branchOverrides && menuItem.branchOverrides.length > 0) {
        const override = menuItem.branchOverrides.find((o) => o.branchId === branchId);
        if (override && override.isAvailable !== undefined) {
          isAvailable = override.isAvailable;
        }
      }

      if (!isAvailable) {
        throw new BadRequestException(
          `Món ăn "${menuItem.name}" hiện đã tạm ngưng phục vụ hoặc hết món`,
        );
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
