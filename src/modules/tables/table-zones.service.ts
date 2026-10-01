import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TableZone, TableZoneDocument } from './entities/table-zone.entity';
import { Table, TableDocument } from './entities/table.entity';
import { CreateTableZoneDto, UpdateTableZoneDto } from './dto/create-zone.dto';

@Injectable()
export class TableZonesService {
  private readonly logger = new Logger(TableZonesService.name);

  constructor(
    @InjectModel(TableZone.name) private readonly zoneModel: Model<TableZoneDocument>,
    @InjectModel(Table.name) private readonly tableModel: Model<TableDocument>,
  ) {}

  async findAll(restaurantId: string, branchId?: string): Promise<TableZone[]> {
    const filter: any = {
      restaurantId: new Types.ObjectId(restaurantId),
      isDeleted: { $ne: true },
    };

    if (branchId) {
      filter.$or = [{ branchId }, { branchId: { $exists: false } }, { branchId: '' }, { branchId: null }];
    }

    return this.zoneModel.find(filter).sort({ createdAt: 1 }).exec();
  }

  async findById(id: string, restaurantId: string): Promise<TableZone> {
    const zone = await this.zoneModel.findOne({
      _id: new Types.ObjectId(id),
      restaurantId: new Types.ObjectId(restaurantId),
      isDeleted: { $ne: true },
    });

    if (!zone) {
      throw new NotFoundException('Không tìm thấy khu vực bàn');
    }

    return zone;
  }

  async create(dto: CreateTableZoneDto, restaurantId: string): Promise<TableZone> {
    const existing = await this.zoneModel.findOne({
      name: { $regex: new RegExp(`^${dto.name.trim()}$`, 'i') },
      restaurantId: new Types.ObjectId(restaurantId),
      isDeleted: { $ne: true },
      ...(dto.branchId ? { branchId: dto.branchId } : {}),
    });

    if (existing) {
      throw new ConflictException(`Khu vực "${dto.name}" đã tồn tại trong nhà hàng`);
    }

    const zone = new this.zoneModel({
      ...dto,
      restaurantId: new Types.ObjectId(restaurantId),
      isDeleted: false,
    });

    return zone.save();
  }

  async update(id: string, dto: UpdateTableZoneDto, restaurantId: string): Promise<TableZone> {
    const zone = await this.findById(id, restaurantId);

    if (dto.name && dto.name.trim() !== zone.name) {
      const existing = await this.zoneModel.findOne({
        _id: { $ne: new Types.ObjectId(id) },
        name: { $regex: new RegExp(`^${dto.name.trim()}$`, 'i') },
        restaurantId: new Types.ObjectId(restaurantId),
        isDeleted: { $ne: true },
      });
      if (existing) {
        throw new ConflictException(`Khu vực "${dto.name}" đã tồn tại`);
      }
      zone.name = dto.name.trim();
    }

    if (dto.description !== undefined) {
      zone.description = dto.description;
    }

    return (zone as any).save();
  }

  async delete(id: string, restaurantId: string): Promise<{ success: boolean; message: string }> {
    const zone = await this.findById(id, restaurantId);

    // Kiểm tra xem có bàn nào đang thuộc khu vực này không
    const tableCount = await this.tableModel.countDocuments({
      zone: new Types.ObjectId(id),
      restaurantId: new Types.ObjectId(restaurantId),
      isDeleted: { $ne: true },
    });

    if (tableCount > 0) {
      throw new BadRequestException(
        `Không thể xóa khu vực "${zone.name}" vì đang chứa ${tableCount} bàn ăn. Vui lòng chuyển hoặc xóa các bàn trước.`,
      );
    }

    zone.isDeleted = true;
    zone.deletedAt = new Date();
    await (zone as any).save();

    return {
      success: true,
      message: `Đã xóa khu vực "${zone.name}" thành công`,
    };
  }
}
