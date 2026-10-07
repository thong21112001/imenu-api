import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Table, TableDocument, TableStatus } from './entities/table.entity';
import { TableZone, TableZoneDocument } from './entities/table-zone.entity';
import { Order, OrderDocument, OrderStatus } from '../orders/entities/order.entity';
import { OrderRound } from '../orders/entities/order-round.schema';
import { OrderItem } from '../orders/entities/order-item.schema';
import { calculateOrderStatus } from '../orders/domain/order-status.reducer';
import { OrderFinancialCalculator } from '../orders/domain/order-financial.calculator';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { TransferTableDto, MergeTablesDto, MoveTableItemsDto } from './dto/transfer-table.dto';
import { JwtUser } from '../auth/interface/jwtUser';

@Injectable()
export class TablesService {
  private readonly logger = new Logger(TablesService.name);

  constructor(
    @InjectModel(Table.name) private readonly tableModel: Model<TableDocument>,
    @InjectModel(TableZone.name) private readonly zoneModel: Model<TableZoneDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(
    params: {
      restaurantId: string;
      branchId?: string;
      zoneId?: string;
      status?: string;
      search?: string;
    },
    caller?: JwtUser,
  ): Promise<Table[]> {
    const filter: any = {
      restaurantId: new Types.ObjectId(params.restaurantId),
      isDeleted: { $ne: true },
    };

    let effectiveBranchId = params.branchId;
    if (caller && !caller.isMainBranch && caller.branchId) {
      if (params.branchId && params.branchId !== caller.branchId) {
        throw new ForbiddenException('Bạn không có quyền truy cập dữ liệu bàn của chi nhánh khác');
      }
      effectiveBranchId = caller.branchId;
    }

    if (effectiveBranchId) {
      filter.branchId = effectiveBranchId;
    }

    if (params.zoneId && params.zoneId !== 'all') {
      filter.zone = new Types.ObjectId(params.zoneId);
    }

    if (params.status && params.status !== 'all') {
      filter.status = params.status;
    }

    if (params.search) {
      const q = params.search.trim();
      filter.$or = [
        { code: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } },
      ];
    }

    return this.tableModel
      .find(filter)
      .populate('zone')
      .populate('currentOrderId')
      .sort({ code: 1, createdAt: 1 })
      .exec();
  }

  async findById(id: string, restaurantId: string, caller?: JwtUser): Promise<Table> {
    const table = await this.tableModel
      .findOne({
        _id: new Types.ObjectId(id),
        restaurantId: new Types.ObjectId(restaurantId),
        isDeleted: { $ne: true },
      })
      .populate('zone')
      .populate('currentOrderId')
      .exec();

    if (!table) {
      throw new NotFoundException('Không tìm thấy bàn ăn');
    }

    if (caller && !caller.isMainBranch && caller.branchId) {
      if (table.branchId && table.branchId !== caller.branchId) {
        throw new ForbiddenException('Bạn không có quyền truy cập dữ liệu bàn của chi nhánh khác');
      }
    }

    return table;
  }

  async create(dto: CreateTableDto, restaurantId: string, caller?: JwtUser): Promise<Table> {
    let branchId = dto.branchId;
    if (caller && !caller.isMainBranch && caller.branchId) {
      if (dto.branchId && dto.branchId !== caller.branchId) {
        throw new ForbiddenException('Bạn chỉ có quyền tạo bàn cho chi nhánh của mình');
      }
      branchId = caller.branchId;
    }

    const zone = await this.zoneModel.findOne({
      _id: new Types.ObjectId(dto.zoneId),
      restaurantId: new Types.ObjectId(restaurantId),
      isDeleted: { $ne: true },
    });

    if (!zone) {
      throw new NotFoundException('Khu vực bàn (Zone) không tồn tại');
    }

    if (branchId && zone.branchId && zone.branchId !== branchId) {
      throw new BadRequestException('Khu vực được chọn không thuộc chi nhánh này');
    }

    const existingCode = await this.tableModel.findOne({
      code: { $regex: new RegExp(`^${dto.code.trim()}$`, 'i') },
      restaurantId: new Types.ObjectId(restaurantId),
      isDeleted: { $ne: true },
      ...(branchId ? { branchId } : {}),
    });

    if (existingCode) {
      throw new ConflictException(`Mã bàn "${dto.code}" đã tồn tại trong ${branchId ? 'chi nhánh' : 'nhà hàng'}`);
    }

    const table = new this.tableModel({
      code: dto.code.trim(),
      name: dto.name.trim(),
      zone: zone._id,
      capacity: dto.capacity || 4,
      status: 'Available',
      restaurantId: new Types.ObjectId(restaurantId),
      branchId,
      wifiSsid: dto.wifiSsid || '',
      wifiPassword: dto.wifiPassword || '',
      qrStatus: dto.qrStatus || 'active',
      qrToken: dto.qrToken || Math.random().toString(36).substring(2, 10),
      qrCodeUrl: dto.qrCodeUrl || '',
      isDeleted: false,
    });

    const saved = await table.save();
    return this.findById(saved._id.toString(), restaurantId);
  }

  async update(id: string, dto: UpdateTableDto, restaurantId: string, caller?: JwtUser): Promise<Table> {
    const table: any = await this.findById(id, restaurantId, caller);

    if (dto.code && dto.code.trim() !== table.code) {
      const existing = await this.tableModel.findOne({
        _id: { $ne: new Types.ObjectId(id) },
        code: { $regex: new RegExp(`^${dto.code.trim()}$`, 'i') },
        restaurantId: new Types.ObjectId(restaurantId),
        isDeleted: { $ne: true },
        ...(table.branchId ? { branchId: table.branchId } : {}),
      });
      if (existing) {
        throw new ConflictException(`Mã bàn "${dto.code}" đã được sử dụng`);
      }
      table.code = dto.code.trim();
    }

    if (dto.name) table.name = dto.name.trim();

    if (dto.zoneId) {
      const zone = await this.zoneModel.findOne({
        _id: new Types.ObjectId(dto.zoneId),
        restaurantId: new Types.ObjectId(restaurantId),
        isDeleted: { $ne: true },
      });
      if (!zone) throw new NotFoundException('Khu vực bàn không hợp lệ');
      if (table.branchId && zone.branchId && zone.branchId !== table.branchId) {
        throw new BadRequestException('Khu vực bàn không thuộc cùng chi nhánh với bàn này');
      }
      table.zone = zone._id as any;
    }

    if (dto.capacity !== undefined) table.capacity = dto.capacity;
    if (dto.wifiSsid !== undefined) table.wifiSsid = dto.wifiSsid;
    if (dto.wifiPassword !== undefined) table.wifiPassword = dto.wifiPassword;
    if (dto.qrStatus !== undefined) table.qrStatus = dto.qrStatus;
    if (dto.qrToken !== undefined) table.qrToken = dto.qrToken;
    if (dto.qrCodeUrl !== undefined) table.qrCodeUrl = dto.qrCodeUrl;

    if (dto.status && dto.status !== table.status) {
      table.status = dto.status;
      if (dto.status === 'Occupied' && !table.activeSince) {
        table.activeSince = new Date();
      } else if (dto.status === 'Available') {
        table.activeSince = undefined;
        table.currentOrderId = undefined;
        table.totalGuests = 0;
      }
    }

    if (dto.totalGuests !== undefined) {
      table.totalGuests = dto.totalGuests;
    }

    await (table as any).save();

    // Phát sự kiện realtime
    this.eventEmitter.emit('table.status_updated', {
      table,
      restaurantId,
      branchId: table.branchId,
    });

    return this.findById(id, restaurantId);
  }

  async updateStatus(
    id: string,
    status: TableStatus,
    totalGuests: number | undefined,
    restaurantId: string,
    caller?: JwtUser,
  ): Promise<Table> {
    await this.findById(id, restaurantId, caller);

    const updateQuery: any = {
      $set: { status },
    };

    if (status === 'Occupied') {
      updateQuery.$set.activeSince = new Date();
    } else if (status === 'Available') {
      updateQuery.$set.totalGuests = 0;
      updateQuery.$unset = { currentOrderId: 1, activeSince: 1 };
    }

    if (totalGuests !== undefined) {
      updateQuery.$set.totalGuests = totalGuests;
    }

    await this.tableModel.updateOne(
      {
        _id: new Types.ObjectId(id),
        restaurantId: new Types.ObjectId(restaurantId),
        isDeleted: { $ne: true },
      },
      updateQuery,
    );

    const updated = await this.findById(id, restaurantId);

    this.eventEmitter.emit('table.status_updated', {
      table: updated,
      restaurantId,
      branchId: updated.branchId,
    });

    return updated;
  }

  /**
   * Đổi bàn / Chuyển bàn: Chuyển Order từ bàn cũ sang bàn mới (Hardened Phase 6.6)
   */
  async transferTable(
    dto: TransferTableDto,
    restaurantId: string,
    caller?: JwtUser,
  ): Promise<{ success: boolean; message: string; fromTable: Table; toTable: Table; order?: Order }> {
    if (dto.fromTableId === dto.toTableId) {
      throw new BadRequestException('Bàn đích phải khác bàn hiện tại');
    }

    const fromTable: any = await this.findById(dto.fromTableId, restaurantId, caller);
    const toTable: any = await this.findById(dto.toTableId, restaurantId, caller);

    // 1. Phân lập chi nhánh nghiêm ngặt (Strict Branch Isolation)
    const fromBranch = fromTable.branchId ? fromTable.branchId.toString() : '';
    const toBranch = toTable.branchId ? toTable.branchId.toString() : '';
    if (fromBranch !== toBranch) {
      throw new BadRequestException('Không thể chuyển bàn giữa các chi nhánh khác nhau');
    }

    // 2. Kiểm tra bàn đích: chỉ cho phép chuyển sang bàn Available
    if (toTable.status === 'Occupied' || toTable.status === 'PaymentRequested') {
      throw new BadRequestException(
        `Bàn đích ${toTable.name} hiện đang có khách (trạng thái: ${toTable.status}). Nếu muốn gộp đơn vui lòng dùng chức năng Gộp bàn.`,
      );
    }
    if (toTable.status !== 'Available') {
      throw new BadRequestException(
        `Bàn đích ${toTable.name} không ở trạng thái sẵn sàng (trạng thái hiện tại: ${toTable.status})`,
      );
    }

    // 3. Kiểm tra DB: Bàn đích không được có đơn hàng hoạt động (bảo vệ Partial Unique Index)
    const activeStatuses: OrderStatus[] = [
      'WaitingConfirmation',
      'Confirmed',
      'Preparing',
      'Ready',
      'Served',
      'PaymentRequested',
    ];

    const activeOrderOnTarget = await this.orderModel.findOne({
      tableId: toTable._id,
      restaurantId: new Types.ObjectId(restaurantId),
      status: { $in: activeStatuses },
    });
    if (activeOrderOnTarget) {
      throw new ConflictException(
        `Bàn đích ${toTable.name} hiện đang có đơn hàng hoạt động (${activeOrderOnTarget.orderCode}).`,
      );
    }

    // 4. Tìm đơn hàng hoạt động của bàn nguồn (Single Source of Truth)
    const fromOrderId = fromTable.currentOrderId?._id || fromTable.currentOrderId;
    let activeOrder: any = await this.orderModel.findOne({
      tableId: fromTable._id,
      restaurantId: new Types.ObjectId(restaurantId),
      status: { $in: activeStatuses },
    });

    if (!activeOrder && fromOrderId) {
      activeOrder = await this.orderModel.findOne({
        _id: new Types.ObjectId(fromOrderId.toString()),
        restaurantId: new Types.ObjectId(restaurantId),
        status: { $in: activeStatuses },
      });
    }

    if (!activeOrder) {
      throw new BadRequestException(
        `Bàn ${fromTable.name} hiện đang trống, không có đơn hàng hoạt động để chuyển`,
      );
    }

    // 5. Cập nhật Order: Bảo toàn 100% order.rounds[], order.items[] và item snapshots
    activeOrder.tableId = toTable._id;
    activeOrder.tableName = toTable.name;
    await activeOrder.save();

    // 6. Cập nhật toTable sang Occupied
    const guestCount = fromTable.totalGuests || 2;
    const activeSinceDate = fromTable.activeSince || activeOrder.openedAt || new Date();

    await this.tableModel.updateOne(
      { _id: toTable._id },
      {
        $set: {
          status: 'Occupied',
          currentOrderId: activeOrder._id,
          activeSince: activeSinceDate,
          totalGuests: guestCount,
        },
      },
    );

    // 7. Giải phóng fromTable về Available
    await this.tableModel.updateOne(
      { _id: fromTable._id },
      {
        $set: {
          status: 'Available',
          totalGuests: 0,
        },
        $unset: {
          currentOrderId: 1,
          activeSince: 1,
        },
      },
    );

    const updatedFrom = await this.findById(fromTable._id.toString(), restaurantId);
    const updatedTo = await this.findById(toTable._id.toString(), restaurantId);

    // 8. Phát sự kiện Realtime qua EventEmitter
    this.eventEmitter.emit('table.status_updated', {
      table: updatedTo,
      previousTable: updatedFrom,
      restaurantId,
      branchId: updatedTo.branchId,
    });
    this.eventEmitter.emit('table.status_updated', {
      table: updatedFrom,
      restaurantId,
      branchId: updatedFrom.branchId,
    });
    this.eventEmitter.emit('order.updated', {
      order: activeOrder.toObject(),
      restaurantId,
      branchId: activeOrder.branchId,
    });

    return {
      success: true,
      message: `Đã chuyển đơn từ ${fromTable.name} sang ${toTable.name} thành công`,
      fromTable: updatedFrom,
      toTable: updatedTo,
      order: activeOrder,
    };
  }

  /**
   * Gộp bàn: Gộp món và bảo toàn toàn bộ rounds từ nhiều bàn nguồn sang bàn đích (Hardened Phase 6.6)
   */
  async mergeTables(
    dto: MergeTablesDto,
    restaurantId: string,
    caller?: JwtUser,
  ): Promise<{ success: boolean; message: string; targetTable?: Table; targetOrder?: Order }> {
    const targetTable: any = await this.findById(dto.targetTableId, restaurantId, caller);
    const targetBranch = targetTable.branchId ? targetTable.branchId.toString() : '';

    // 1. Lọc danh sách bàn nguồn: loại trừ trùng lặp và bàn đích
    const uniqueFromIds = Array.from(new Set(dto.fromTableIds || [])).filter(
      (id) => id && id.toString() !== dto.targetTableId.toString(),
    );

    if (uniqueFromIds.length === 0) {
      throw new BadRequestException('Danh sách bàn nguồn cần gộp không hợp lệ (không thể gộp bàn vào chính nó)');
    }

    // 2. Kiểm tra quyền và phân lập chi nhánh cho toàn bộ bàn nguồn
    const sourceTables: any[] = [];
    for (const fromId of uniqueFromIds) {
      const fromTable: any = await this.findById(fromId, restaurantId, caller);
      const fromBranch = fromTable.branchId ? fromTable.branchId.toString() : '';
      if (fromBranch !== targetBranch) {
        throw new BadRequestException(
          `Bàn ${fromTable.name} không cùng chi nhánh với bàn đích ${targetTable.name}`,
        );
      }
      sourceTables.push(fromTable);
    }

    const activeStatuses: OrderStatus[] = [
      'WaitingConfirmation',
      'Confirmed',
      'Preparing',
      'Ready',
      'Served',
      'PaymentRequested',
    ];

    // 3. Tìm đơn hàng hoạt động của bàn đích
    let targetOrder: any = await this.orderModel.findOne({
      tableId: targetTable._id,
      restaurantId: new Types.ObjectId(restaurantId),
      status: { $in: activeStatuses },
    });

    if (!targetOrder && targetTable.currentOrderId) {
      const tOrderId = targetTable.currentOrderId?._id || targetTable.currentOrderId;
      targetOrder = await this.orderModel.findOne({
        _id: new Types.ObjectId(tOrderId.toString()),
        restaurantId: new Types.ObjectId(restaurantId),
        status: { $in: activeStatuses },
      });
    }

    // 4. Tìm đơn hàng hoạt động của các bàn nguồn
    const sourceOrders: { table: any; order: any }[] = [];
    for (const fromTable of sourceTables) {
      const fromOrderId = fromTable.currentOrderId?._id || fromTable.currentOrderId;
      let fromOrder: any = await this.orderModel.findOne({
        tableId: fromTable._id,
        restaurantId: new Types.ObjectId(restaurantId),
        status: { $in: activeStatuses },
      });

      if (!fromOrder && fromOrderId) {
        fromOrder = await this.orderModel.findOne({
          _id: new Types.ObjectId(fromOrderId.toString()),
          restaurantId: new Types.ObjectId(restaurantId),
          status: { $in: activeStatuses },
        });
      }
      sourceOrders.push({ table: fromTable, order: fromOrder });
    }

    const anyOrderExists = !!targetOrder || sourceOrders.some((so) => !!so.order);
    if (!anyOrderExists) {
      throw new BadRequestException('Không tìm thấy đơn hàng hoạt động nào trên các bàn cần gộp');
    }

    // 5. Nếu bàn đích chưa có đơn hàng, lấy đơn hàng của bàn nguồn đầu tiên làm đơn đích
    if (!targetOrder) {
      const firstActiveIdx = sourceOrders.findIndex((so) => !!so.order);
      if (firstActiveIdx >= 0) {
        targetOrder = sourceOrders[firstActiveIdx].order;
        targetOrder.tableId = targetTable._id;
        targetOrder.tableName = targetTable.name;
        sourceOrders[firstActiveIdx].order = null; // Đã chuyển thành targetOrder
      }
    }

    const callerOid = caller?.userId || (caller as any)?._id || (caller as any)?.id;
    const validUserOid = callerOid && Types.ObjectId.isValid(callerOid) ? new Types.ObjectId(callerOid) : undefined;

    let currentMaxRound =
      targetOrder.rounds && targetOrder.rounds.length > 0
        ? Math.max(...targetOrder.rounds.map((r: any) => r.roundNumber || 0))
        : 0;

    let targetTotalGuests = targetTable.totalGuests || 0;

    // 6. Gộp từng đơn nguồn vào targetOrder: bảo toàn rounds[], items[], snapshots
    for (const { table: fromTable, order: fromOrder } of sourceOrders) {
      targetTotalGuests += fromTable.totalGuests || 0;

      if (fromOrder) {
        // A. Remap & Preserve rounds từ fromOrder
        const roundMapping = new Map<number, number>();
        const sortedFromRounds = [...(fromOrder.rounds || [])].sort(
          (a: any, b: any) => (a.roundNumber || 0) - (b.roundNumber || 0),
        );

        for (const r of sortedFromRounds) {
          currentMaxRound++;
          roundMapping.set(r.roundNumber, currentMaxRound);
          targetOrder.rounds.push({
            roundNumber: currentMaxRound,
            source: r.source || 'STAFF_POS',
            status: r.status || 'Confirmed',
            createdAt: r.createdAt || new Date(),
            confirmedAt: r.confirmedAt,
            confirmedBy: r.confirmedBy,
            cancelledAt: r.cancelledAt,
            cancelledBy: r.cancelledBy,
            cancelReason: r.cancelReason,
            roundSubTotal: r.roundSubTotal || 0,
          });
        }

        // B. Remap roundNumber cho items & bảo toàn 100% snapshot
        for (const item of fromOrder.items || []) {
          const mappedRound = roundMapping.get(item.roundNumber) || currentMaxRound || 1;
          targetOrder.items.push({
            _id: item._id,
            menuItemId: item.menuItemId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            selectedOptions: item.selectedOptions || [],
            note: item.note || '',
            status: item.status,
            roundNumber: mappedRound,
            itemTotal: item.itemTotal,
            cancelReason: item.cancelReason,
            cancelledBy: item.cancelledBy,
            createdAt: item.createdAt || new Date(),
            updatedAt: new Date(),
          });
        }

        // C. Hủy và lưu audit log cho fromOrder đã gộp
        fromOrder.status = 'Cancelled';
        fromOrder.cancelledAt = new Date();
        fromOrder.cancelledBy = validUserOid;
        fromOrder.cancelReason = `Đã gộp vào bàn ${targetTable.name} (${targetOrder.orderCode})`;
        fromOrder.customerNote = fromOrder.customerNote
          ? `${fromOrder.customerNote} | Đã gộp vào ${targetTable.name} (${targetOrder.orderCode})`
          : `Đã gộp vào ${targetTable.name} (${targetOrder.orderCode})`;
        await fromOrder.save();
      }

      // D. Giải phóng bàn nguồn về Available
      await this.tableModel.updateOne(
        { _id: fromTable._id },
        {
          $set: { status: 'Available', totalGuests: 0 },
          $unset: { currentOrderId: 1, activeSince: 1 },
        },
      );

      const updatedFrom = await this.findById(fromTable._id.toString(), restaurantId);
      this.eventEmitter.emit('table.status_updated', {
        table: updatedFrom,
        restaurantId,
        branchId: fromTable.branchId,
      });
    }

    // 7. Tính lại tài chính và trạng thái cho targetOrder
    if (targetOrder) {
      const activeItems = (targetOrder.items || []).filter((it: any) => it.status !== 'Cancelled');
      const subTotal = activeItems.reduce((sum: number, it: any) => sum + (it.itemTotal || 0), 0);

      const financial = OrderFinancialCalculator.calculate({
        subTotal,
        discountAmount: targetOrder.discountAmount,
        serviceFee: targetOrder.serviceFee,
        vatAmount: targetOrder.vatAmount,
      });
      targetOrder.subTotal = financial.subTotal;
      targetOrder.totalAmount = financial.totalAmount;

      targetOrder.status = calculateOrderStatus(targetOrder.items, targetOrder.status);
      await targetOrder.save();

      // 8. Cập nhật bàn đích sang Occupied
      await this.tableModel.updateOne(
        { _id: targetTable._id },
        {
          $set: {
            currentOrderId: targetOrder._id,
            status: 'Occupied',
            totalGuests: targetTotalGuests || 4,
            activeSince: targetTable.activeSince || new Date(),
          },
        },
      );

      const updatedTarget = await this.findById(targetTable._id.toString(), restaurantId);
      this.eventEmitter.emit('table.status_updated', {
        table: updatedTarget,
        restaurantId,
        branchId: targetTable.branchId,
      });
      this.eventEmitter.emit('order.updated', {
        order: targetOrder.toObject(),
        restaurantId,
        branchId: targetOrder.branchId,
      });

      return {
        success: true,
        message: `Đã gộp các bàn thành công vào ${targetTable.name}`,
        targetTable: updatedTarget,
        targetOrder,
      };
    }

    return {
      success: true,
      message: `Đã gộp các bàn thành công vào ${targetTable.name}`,
      targetTable,
    };
  }

  /**
   * Chuyển món / Tách bàn: Di chuyển danh sách món từ bàn nguồn sang bàn đích (Hardened Phase 6.6)
   */
  async moveItemsBetweenTables(
    dto: MoveTableItemsDto,
    restaurantId: string,
    caller?: JwtUser,
  ): Promise<{
    success: boolean;
    message: string;
    fromTable: Table;
    toTable: Table;
    fromOrder: Order;
    toOrder: Order;
  }> {
    if (dto.fromTableId === dto.toTableId) {
      throw new BadRequestException('Bàn đích phải khác bàn nguồn');
    }

    const fromTable: any = await this.findById(dto.fromTableId, restaurantId, caller);
    const toTable: any = await this.findById(dto.toTableId, restaurantId, caller);

    // 1. Phân lập chi nhánh
    const fromBranch = fromTable.branchId ? fromTable.branchId.toString() : '';
    const toBranch = toTable.branchId ? toTable.branchId.toString() : '';
    if (fromBranch !== toBranch) {
      throw new BadRequestException('Không thể chuyển món giữa các chi nhánh khác nhau');
    }

    const activeStatuses: OrderStatus[] = [
      'WaitingConfirmation',
      'Confirmed',
      'Preparing',
      'Ready',
      'Served',
      'PaymentRequested',
    ];

    // 2. Tìm đơn hàng hoạt động của bàn nguồn
    const fromOrderId = fromTable.currentOrderId?._id || fromTable.currentOrderId;
    let fromOrder: any = await this.orderModel.findOne({
      tableId: fromTable._id,
      restaurantId: new Types.ObjectId(restaurantId),
      status: { $in: activeStatuses },
    });

    if (!fromOrder && fromOrderId) {
      fromOrder = await this.orderModel.findOne({
        _id: new Types.ObjectId(fromOrderId.toString()),
        restaurantId: new Types.ObjectId(restaurantId),
        status: { $in: activeStatuses },
      });
    }

    if (!fromOrder) {
      throw new BadRequestException(
        `Bàn ${fromTable.name} không có đơn hàng hoạt động để chuyển món`,
      );
    }

    // 3. Kiểm tra danh sách món cần chuyển
    for (const itemDto of dto.items) {
      const sourceItem = (fromOrder.items || []).find(
        (it: any) => it._id.toString() === itemDto.itemId,
      );
      if (!sourceItem) {
        throw new NotFoundException(
          `Món với ID ${itemDto.itemId} không tồn tại trong đơn hàng bàn ${fromTable.name}`,
        );
      }
      if (sourceItem.status === 'Cancelled') {
        throw new BadRequestException(
          `Không thể chuyển món đã bị hủy (${sourceItem.name})`,
        );
      }
      if (itemDto.quantity !== undefined) {
        if (itemDto.quantity < 1 || itemDto.quantity > sourceItem.quantity) {
          throw new BadRequestException(
            `Số lượng chuyển món ${sourceItem.name} không hợp lệ (yêu cầu: ${itemDto.quantity}, hiện có: ${sourceItem.quantity})`,
          );
        }
      }
    }

    // 4. Tìm hoặc tạo mới đơn hàng cho bàn đích
    const toOrderId = toTable.currentOrderId?._id || toTable.currentOrderId;
    let toOrder: any = await this.orderModel.findOne({
      tableId: toTable._id,
      restaurantId: new Types.ObjectId(restaurantId),
      status: { $in: activeStatuses },
    });

    if (!toOrder && toOrderId) {
      toOrder = await this.orderModel.findOne({
        _id: new Types.ObjectId(toOrderId.toString()),
        restaurantId: new Types.ObjectId(restaurantId),
        status: { $in: activeStatuses },
      });
    }

    const callerOid = caller?.userId || (caller as any)?._id || (caller as any)?.id;
    const validUserOid = callerOid && Types.ObjectId.isValid(callerOid) ? new Types.ObjectId(callerOid) : undefined;

    if (!toOrder) {
      if (toTable.status === 'PaymentRequested') {
        throw new BadRequestException(
          `Bàn đích ${toTable.name} đang chờ thanh toán, không thể nhận thêm món`,
        );
      }
      const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const orderCode = `ORD-${dateStr}-${randomSuffix}`;

      toOrder = new this.orderModel({
        orderCode,
        tableId: toTable._id,
        tableName: toTable.name,
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: toTable.branchId || fromOrder.branchId,
        status: 'Preparing',
        orderSource: fromOrder.orderSource || 'STAFF_POS',
        rounds: [],
        items: [],
        subTotal: 0,
        discountAmount: 0,
        serviceFee: 0,
        vatAmount: 0,
        totalAmount: 0,
        isPaid: false,
        openedAt: new Date(),
        createdBy: validUserOid,
      });
    }

    // 5. Xác định Round trong toOrder nhận món chuyển
    const nextRoundNumber =
      toOrder.rounds && toOrder.rounds.length > 0
        ? Math.max(...toOrder.rounds.map((r: any) => r.roundNumber || 0)) + 1
        : 1;

    const moveRound: OrderRound = {
      roundNumber: nextRoundNumber,
      source: 'STAFF_POS',
      status: 'Confirmed',
      createdAt: new Date(),
      confirmedAt: new Date(),
      confirmedBy: validUserOid,
      roundSubTotal: 0,
    };
    toOrder.rounds.push(moveRound);

    // 6. Thực hiện chuyển từng món (Bảo toàn snapshots và tính toán chính xác)
    let movedSubTotal = 0;

    for (const itemDto of dto.items) {
      const sourceItemIndex = fromOrder.items.findIndex(
        (it: any) => it._id.toString() === itemDto.itemId,
      );
      const sourceItem = fromOrder.items[sourceItemIndex];
      const moveQty = itemDto.quantity !== undefined ? itemDto.quantity : sourceItem.quantity;

      const optionsDelta = (sourceItem.selectedOptions || []).reduce(
        (sum: number, opt: any) => sum + (opt.priceDelta || 0),
        0,
      );
      const unitPrice = sourceItem.price + optionsDelta;
      const moveItemTotal = unitPrice * moveQty;

      if (moveQty === sourceItem.quantity) {
        // Chuyển toàn bộ món
        fromOrder.items.splice(sourceItemIndex, 1);

        toOrder.items.push({
          _id: sourceItem._id,
          menuItemId: sourceItem.menuItemId,
          name: sourceItem.name,
          price: sourceItem.price,
          quantity: moveQty,
          selectedOptions: sourceItem.selectedOptions || [],
          note: sourceItem.note || '',
          status: sourceItem.status,
          roundNumber: nextRoundNumber,
          itemTotal: moveItemTotal,
          createdAt: sourceItem.createdAt || new Date(),
          updatedAt: new Date(),
        });
      } else {
        // Tách số lượng món
        sourceItem.quantity -= moveQty;
        sourceItem.itemTotal = unitPrice * sourceItem.quantity;
        sourceItem.updatedAt = new Date();

        toOrder.items.push({
          _id: new Types.ObjectId(),
          menuItemId: sourceItem.menuItemId,
          name: sourceItem.name,
          price: sourceItem.price,
          quantity: moveQty,
          selectedOptions: sourceItem.selectedOptions || [],
          note: sourceItem.note || '',
          status: sourceItem.status,
          roundNumber: nextRoundNumber,
          itemTotal: moveItemTotal,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      movedSubTotal += moveItemTotal;
    }

    moveRound.roundSubTotal = movedSubTotal;

    // 7. Xử lý bàn nguồn và đơn hàng nguồn
    const fromActiveItems = (fromOrder.items || []).filter((it: any) => it.status !== 'Cancelled');
    if (fromActiveItems.length === 0) {
      // Đã chuyển hết món hoạt động: Hủy đơn nguồn và giải phóng bàn nguồn
      fromOrder.status = 'Cancelled';
      fromOrder.cancelledAt = new Date();
      fromOrder.cancelledBy = validUserOid;
      fromOrder.cancelReason =
        dto.reason || `Toàn bộ món đã được chuyển sang bàn ${toTable.name} (${toOrder.orderCode})`;
      fromOrder.customerNote = fromOrder.customerNote
        ? `${fromOrder.customerNote} | Đã chuyển món sang ${toTable.name}`
        : `Đã chuyển món sang ${toTable.name}`;
      await fromOrder.save();

      await this.tableModel.updateOne(
        { _id: fromTable._id },
        {
          $set: { status: 'Available', totalGuests: 0 },
          $unset: { currentOrderId: 1, activeSince: 1 },
        },
      );
    } else {
      const fromSubTotal = fromActiveItems.reduce(
        (sum: number, it: any) => sum + (it.itemTotal || 0),
        0,
      );
      const fromFinancial = OrderFinancialCalculator.calculate({
        subTotal: fromSubTotal,
        discountAmount:
          fromOrder.discountAmount > fromSubTotal ? fromSubTotal : fromOrder.discountAmount,
        serviceFee: fromOrder.serviceFee,
        vatAmount: fromOrder.vatAmount,
      });
      fromOrder.subTotal = fromFinancial.subTotal;
      fromOrder.totalAmount = fromFinancial.totalAmount;

      for (const r of fromOrder.rounds || []) {
        const rActive = (fromOrder.items || []).filter(
          (it: any) => it.roundNumber === r.roundNumber && it.status !== 'Cancelled',
        );
        r.roundSubTotal = rActive.reduce(
          (sum: number, it: any) => sum + (it.itemTotal || 0),
          0,
        );
      }

      fromOrder.status = calculateOrderStatus(fromOrder.items, fromOrder.status);
      await fromOrder.save();
    }

    // 8. Xử lý bàn đích và đơn hàng đích
    const toActiveItems = (toOrder.items || []).filter((it: any) => it.status !== 'Cancelled');
    const toSubTotal = toActiveItems.reduce(
      (sum: number, it: any) => sum + (it.itemTotal || 0),
      0,
    );
    const toFinancial = OrderFinancialCalculator.calculate({
      subTotal: toSubTotal,
      discountAmount: toOrder.discountAmount,
      serviceFee: toOrder.serviceFee,
      vatAmount: toOrder.vatAmount,
    });
    toOrder.subTotal = toFinancial.subTotal;
    toOrder.totalAmount = toFinancial.totalAmount;
    toOrder.status = calculateOrderStatus(toOrder.items, toOrder.status);
    await toOrder.save();

    await this.tableModel.updateOne(
      { _id: toTable._id },
      {
        $set: {
          status: 'Occupied',
          currentOrderId: toOrder._id,
          activeSince: toTable.activeSince || new Date(),
          totalGuests: toTable.totalGuests || 2,
        },
      },
    );

    // 9. Cập nhật và phát sự kiện Realtime
    const updatedFrom = await this.findById(fromTable._id.toString(), restaurantId);
    const updatedTo = await this.findById(toTable._id.toString(), restaurantId);

    this.eventEmitter.emit('table.status_updated', {
      table: updatedFrom,
      restaurantId,
      branchId: fromTable.branchId,
    });
    this.eventEmitter.emit('table.status_updated', {
      table: updatedTo,
      restaurantId,
      branchId: toTable.branchId,
    });
    this.eventEmitter.emit('order.updated', {
      order: fromOrder.toObject(),
      restaurantId,
      branchId: fromOrder.branchId,
    });
    this.eventEmitter.emit('order.updated', {
      order: toOrder.toObject(),
      restaurantId,
      branchId: toOrder.branchId,
    });

    return {
      success: true,
      message: `Đã chuyển ${dto.items.length} món từ ${fromTable.name} sang ${toTable.name} thành công`,
      fromTable: updatedFrom,
      toTable: updatedTo,
      fromOrder,
      toOrder,
    };
  }


  async delete(
    id: string,
    restaurantId: string,
    user?: any,
    caller?: JwtUser,
  ): Promise<{ success: boolean; message: string }> {
    const table: any = await this.findById(id, restaurantId, caller);

    if (table.status === 'Occupied' || table.status === 'PaymentRequested') {
      throw new BadRequestException(
        `Không thể xóa bàn "${table.name}" khi đang có khách hoặc đang chờ thanh toán`,
      );
    }

    table.isDeleted = true;
    table.deletedAt = new Date();
    if (user?._id) table.deletedBy = user._id;

    // Đổi code để tránh trùng unique index nếu tạo lại sau này
    table.code = `${table.code}_deleted_${Date.now()}`;
    await table.save();

    return {
      success: true,
      message: `Đã xóa bàn "${table.name}" thành công`,
    };
  }

  /**
   * Tự động khởi tạo sơ đồ bàn mẫu (12 bàn chia 4 khu vực)
   */
  async seedDefaultTables(
    restaurantId: string,
    branchId?: string,
    caller?: JwtUser,
  ): Promise<{ zones: number; tables: number }> {
    let targetBranchId = branchId;
    if (caller && !caller.isMainBranch && caller.branchId) {
      if (branchId && branchId !== caller.branchId) {
        throw new ForbiddenException('Bạn chỉ có quyền khởi tạo bàn cho chi nhánh của mình');
      }
      targetBranchId = caller.branchId;
    }

    const countFilter: any = {
      restaurantId: new Types.ObjectId(restaurantId),
      isDeleted: { $ne: true },
    };
    if (targetBranchId) {
      countFilter.branchId = targetBranchId;
    }

    const existingCount = await this.tableModel.countDocuments(countFilter);

    if (existingCount > 0) {
      return { zones: 0, tables: existingCount };
    }

    // 1. Tạo 4 Khu vực mẫu
    const sampleZones = [
      { name: 'Tầng 1 (Khu Vực Chung)', description: 'Không gian mở, thoáng mát gần quầy thanh toán' },
      { name: 'Tầng 2 (Phòng Lạnh)', description: 'Máy lạnh 24/7, phù hợp nhóm đông người' },
      { name: 'Sân Vườn (Ngoài Trời)', description: 'View cây xanh, không khí trong lành' },
      { name: 'Phòng VIP', description: 'Không gian riêng tư, trang trọng' },
    ];

    const createdZones: any[] = [];
    for (const z of sampleZones) {
      const zoneFilter: any = {
        name: z.name,
        restaurantId: new Types.ObjectId(restaurantId),
        isDeleted: { $ne: true },
        ...(targetBranchId ? { branchId: targetBranchId } : {}),
      };
      let zone = await this.zoneModel.findOne(zoneFilter);
      if (!zone) {
        zone = new this.zoneModel({
          name: z.name,
          description: z.description,
          restaurantId: new Types.ObjectId(restaurantId),
          branchId: targetBranchId,
          isDeleted: false,
        });
        await zone.save();
      }
      createdZones.push(zone);
    }

    // 2. Tạo 12 bàn mẫu
    const sampleTables = [
      // Tầng 1: B01 -> B04
      { code: 'B01', name: 'Bàn 01', zoneIdx: 0, capacity: 4 },
      { code: 'B02', name: 'Bàn 02', zoneIdx: 0, capacity: 4 },
      { code: 'B03', name: 'Bàn 03', zoneIdx: 0, capacity: 2 },
      { code: 'B04', name: 'Bàn 04', zoneIdx: 0, capacity: 6 },
      // Tầng 2: B05 -> B08
      { code: 'B05', name: 'Bàn 05', zoneIdx: 1, capacity: 4 },
      { code: 'B06', name: 'Bàn 06', zoneIdx: 1, capacity: 4 },
      { code: 'B07', name: 'Bàn 07', zoneIdx: 1, capacity: 6 },
      { code: 'B08', name: 'Bàn 08', zoneIdx: 1, capacity: 8 },
      // Sân vườn: SV01 -> SV02
      { code: 'SV01', name: 'Sân Vườn 01', zoneIdx: 2, capacity: 4 },
      { code: 'SV02', name: 'Sân Vườn 02', zoneIdx: 2, capacity: 6 },
      // VIP: VIP01 -> VIP02
      { code: 'VIP01', name: 'Phòng VIP 1', zoneIdx: 3, capacity: 10 },
      { code: 'VIP02', name: 'Phòng VIP 2', zoneIdx: 3, capacity: 12 },
    ];

    let createdTablesCount = 0;
    for (const t of sampleTables) {
      const zone = createdZones[t.zoneIdx];
      const table = new this.tableModel({
        code: t.code,
        name: t.name,
        zone: zone._id,
        capacity: t.capacity,
        status: 'Available',
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: targetBranchId,
        qrStatus: 'active',
        qrToken: Math.random().toString(36).substring(2, 10),
        isDeleted: false,
      });
      await table.save();
      createdTablesCount++;
    }

    return { zones: createdZones.length, tables: createdTablesCount };
  }
}
