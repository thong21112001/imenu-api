import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Table, TableDocument, TableStatus } from './entities/table.entity';
import { TableZone, TableZoneDocument } from './entities/table-zone.entity';
import { Order, OrderDocument } from '../orders/entities/order.entity';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { TransferTableDto, MergeTablesDto } from './dto/transfer-table.dto';

@Injectable()
export class TablesService {
  private readonly logger = new Logger(TablesService.name);

  constructor(
    @InjectModel(Table.name) private readonly tableModel: Model<TableDocument>,
    @InjectModel(TableZone.name) private readonly zoneModel: Model<TableZoneDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(params: {
    restaurantId: string;
    branchId?: string;
    zoneId?: string;
    status?: string;
    search?: string;
  }): Promise<Table[]> {
    const filter: any = {
      restaurantId: new Types.ObjectId(params.restaurantId),
      isDeleted: { $ne: true },
    };

    if (params.branchId) {
      filter.$or = [
        { branchId: params.branchId },
        { branchId: { $exists: false } },
        { branchId: '' },
        { branchId: null },
      ];
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

  async findById(id: string, restaurantId: string): Promise<Table> {
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

    return table;
  }

  async create(dto: CreateTableDto, restaurantId: string): Promise<Table> {
    const zone = await this.zoneModel.findOne({
      _id: new Types.ObjectId(dto.zoneId),
      restaurantId: new Types.ObjectId(restaurantId),
      isDeleted: { $ne: true },
    });

    if (!zone) {
      throw new NotFoundException('Khu vực bàn (Zone) không tồn tại');
    }

    const existingCode = await this.tableModel.findOne({
      code: { $regex: new RegExp(`^${dto.code.trim()}$`, 'i') },
      restaurantId: new Types.ObjectId(restaurantId),
      isDeleted: { $ne: true },
      ...(dto.branchId ? { branchId: dto.branchId } : {}),
    });

    if (existingCode) {
      throw new ConflictException(`Mã bàn "${dto.code}" đã tồn tại trong nhà hàng`);
    }

    const table = new this.tableModel({
      code: dto.code.trim(),
      name: dto.name.trim(),
      zone: zone._id,
      capacity: dto.capacity || 4,
      status: 'Available',
      restaurantId: new Types.ObjectId(restaurantId),
      branchId: dto.branchId,
      wifiSsid: dto.wifiSsid || '',
      wifiPassword: dto.wifiPassword || '',
      isDeleted: false,
    });

    const saved = await table.save();
    return this.findById(saved._id.toString(), restaurantId);
  }

  async update(id: string, dto: UpdateTableDto, restaurantId: string): Promise<Table> {
    const table = await this.findById(id, restaurantId);

    if (dto.code && dto.code.trim() !== table.code) {
      const existing = await this.tableModel.findOne({
        _id: { $ne: new Types.ObjectId(id) },
        code: { $regex: new RegExp(`^${dto.code.trim()}$`, 'i') },
        restaurantId: new Types.ObjectId(restaurantId),
        isDeleted: { $ne: true },
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
      table.zone = zone._id as any;
    }

    if (dto.capacity !== undefined) table.capacity = dto.capacity;
    if (dto.wifiSsid !== undefined) table.wifiSsid = dto.wifiSsid;
    if (dto.wifiPassword !== undefined) table.wifiPassword = dto.wifiPassword;

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
  ): Promise<Table> {
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
   * Đổi bàn / Chuyển bàn: Chuyển Order từ bàn cũ sang bàn mới
   */
  async transferTable(dto: TransferTableDto, restaurantId: string): Promise<{ success: boolean; message: string; fromTable: Table; toTable: Table }> {
    const fromTable: any = await this.findById(dto.fromTableId, restaurantId);
    const toTable: any = await this.findById(dto.toTableId, restaurantId);

    if (dto.fromTableId === dto.toTableId) {
      throw new BadRequestException('Bàn đích phải khác bàn hiện tại');
    }

    if (!fromTable.currentOrderId && fromTable.status === 'Available') {
      throw new BadRequestException(`Bàn ${fromTable.name} hiện đang trống, không có đơn hàng để chuyển`);
    }

    if (toTable.status === 'Occupied' && toTable.currentOrderId) {
      throw new BadRequestException(
        `Bàn đích ${toTable.name} hiện đang có khách. Nếu muốn gộp đơn vui lòng dùng chức năng Gộp bàn.`,
      );
    }

    const orderId = fromTable.currentOrderId?._id || fromTable.currentOrderId;
    if (orderId) {
      // Cập nhật tên bàn và tableId trong Order
      await this.orderModel.updateOne(
        { _id: new Types.ObjectId(orderId.toString()), restaurantId: new Types.ObjectId(restaurantId) },
        { $set: { tableId: toTable._id, tableName: toTable.name } },
      );
    }

    // Chuyển dữ liệu sang toTable
    await this.tableModel.updateOne(
      { _id: toTable._id },
      {
        $set: {
          status: 'Occupied',
          currentOrderId: orderId ? new Types.ObjectId(orderId.toString()) : undefined,
          activeSince: fromTable.activeSince || new Date(),
          totalGuests: fromTable.totalGuests || 2,
        },
      },
    );

    // Giải phóng fromTable về Available
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

    // Phát sự kiện realtime cho cả 2 bàn
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

    return {
      success: true,
      message: `Đã chuyển đơn từ ${fromTable.name} sang ${toTable.name} thành công`,
      fromTable: updatedFrom,
      toTable: updatedTo,
    };
  }

  /**
   * Gộp bàn: Gộp món từ nhiều bàn nguồn sang bàn đích
   */
  async mergeTables(dto: MergeTablesDto, restaurantId: string): Promise<{ success: boolean; message: string }> {
    const targetTable: any = await this.findById(dto.targetTableId, restaurantId);
    const targetOrderId = targetTable.currentOrderId?._id || targetTable.currentOrderId;
    let targetOrder: any = targetOrderId
      ? await this.orderModel.findById(targetOrderId)
      : null;

    let targetTotalGuests = targetTable.totalGuests || 0;

    for (const fromId of dto.fromTableIds) {
      if (fromId === dto.targetTableId) continue;

      const fromTable: any = await this.findById(fromId, restaurantId);
      const fromOrderId = fromTable.currentOrderId?._id || fromTable.currentOrderId;
      if (fromOrderId) {
        const fromOrder: any = await this.orderModel.findById(fromOrderId);
        if (fromOrder) {
          if (!targetOrder) {
            // Nếu bàn đích chưa có order, gán trực tiếp order này làm order bàn đích
            targetOrder = fromOrder;
            targetOrder.tableId = targetTable._id;
            targetOrder.tableName = targetTable.name;
            await targetOrder.save();
          } else {
            // Gộp danh sách items từ fromOrder sang targetOrder
            targetOrder.items.push(...fromOrder.items);
            targetOrder.subTotal += fromOrder.subTotal;
            targetOrder.totalAmount += fromOrder.totalAmount;
            await targetOrder.save();

            // Đánh dấu order cũ đã gộp/hủy
            fromOrder.status = 'Cancelled';
            fromOrder.customerNote = `Đã gộp vào ${targetTable.name} (${targetOrder.orderCode})`;
            await fromOrder.save();
          }
        }
      }

      targetTotalGuests += fromTable.totalGuests || 0;

      // Giải phóng bàn nguồn
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

    if (targetOrder) {
      await this.tableModel.updateOne(
        { _id: targetTable._id },
        {
          $set: {
            currentOrderId: targetOrder._id,
            status: 'Occupied',
            totalGuests: targetTotalGuests || 4,
          },
        },
      );

      const updatedTarget = await this.findById(targetTable._id.toString(), restaurantId);
      this.eventEmitter.emit('table.status_updated', {
        table: updatedTarget,
        restaurantId,
        branchId: targetTable.branchId,
      });
    }

    return {
      success: true,
      message: `Đã gộp các bàn thành công vào ${targetTable.name}`,
    };
  }

  async delete(id: string, restaurantId: string, user?: any): Promise<{ success: boolean; message: string }> {
    const table: any = await this.findById(id, restaurantId);

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
  async seedDefaultTables(restaurantId: string, branchId?: string): Promise<{ zones: number; tables: number }> {
    const existingCount = await this.tableModel.countDocuments({
      restaurantId: new Types.ObjectId(restaurantId),
      isDeleted: { $ne: true },
    });

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
      let zone = await this.zoneModel.findOne({
        name: z.name,
        restaurantId: new Types.ObjectId(restaurantId),
        isDeleted: { $ne: true },
      });
      if (!zone) {
        zone = new this.zoneModel({
          name: z.name,
          description: z.description,
          restaurantId: new Types.ObjectId(restaurantId),
          branchId,
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
        branchId,
        isDeleted: false,
      });
      await table.save();
      createdTablesCount++;
    }

    return { zones: createdZones.length, tables: createdTablesCount };
  }
}
