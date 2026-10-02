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
import { TableZone, TableZoneDocument } from './entities/table-zone.entity';
import { Table, TableDocument } from './entities/table.entity';
import { CreateTableZoneDto, UpdateTableZoneDto } from './dto/create-zone.dto';
import { JwtUser } from '../auth/interface/jwtUser';

@Injectable()
export class TableZonesService {
  private readonly logger = new Logger(TableZonesService.name);

  constructor(
    @InjectModel(TableZone.name) private readonly zoneModel: Model<TableZoneDocument>,
    @InjectModel(Table.name) private readonly tableModel: Model<TableDocument>,
  ) {}

  async findAll(restaurantId: string, branchId?: string, caller?: JwtUser): Promise<TableZone[]> {
    const filter: any = {
      restaurantId: new Types.ObjectId(restaurantId),
      isDeleted: { $ne: true },
    };

    let effectiveBranchId = branchId;
    if (caller && !caller.isMainBranch && caller.branchId) {
      if (branchId && branchId !== caller.branchId) {
        throw new ForbiddenException('Bạn không có quyền truy cập khu vực bàn của chi nhánh khác');
      }
      effectiveBranchId = caller.branchId;
    }

    if (effectiveBranchId) {
      filter.branchId = effectiveBranchId;
    }

    return this.zoneModel.find(filter).sort({ createdAt: 1 }).exec();
  }

  async findById(id: string, restaurantId: string, caller?: JwtUser): Promise<TableZone> {
    const zone = await this.zoneModel.findOne({
      _id: new Types.ObjectId(id),
      restaurantId: new Types.ObjectId(restaurantId),
      isDeleted: { $ne: true },
    });

    if (!zone) {
      throw new NotFoundException('Không tìm thấy khu vực bàn');
    }

    if (caller && !caller.isMainBranch && caller.branchId) {
      if (zone.branchId && zone.branchId !== caller.branchId) {
        throw new ForbiddenException('Bạn không có quyền truy cập khu vực bàn của chi nhánh khác');
      }
    }

    return zone;
  }

  async create(dto: CreateTableZoneDto, restaurantId: string, caller?: JwtUser): Promise<TableZone> {
    let branchId = dto.branchId;
    if (caller && !caller.isMainBranch && caller.branchId) {
      if (dto.branchId && dto.branchId !== caller.branchId) {
        throw new ForbiddenException('Bạn chỉ có quyền tạo khu vực cho chi nhánh của mình');
      }
      branchId = caller.branchId;
    }

    const existing = await this.zoneModel.findOne({
      name: { $regex: new RegExp(`^${dto.name.trim()}$`, 'i') },
      restaurantId: new Types.ObjectId(restaurantId),
      isDeleted: { $ne: true },
      ...(branchId ? { branchId } : {}),
    });

    if (existing) {
      throw new ConflictException(`Khu vực "${dto.name}" đã tồn tại trong ${branchId ? 'chi nhánh' : 'nhà hàng'}`);
    }

    const zone = new this.zoneModel({
      ...dto,
      branchId,
      restaurantId: new Types.ObjectId(restaurantId),
      isDeleted: false,
    });

    return zone.save();
  }

  async update(id: string, dto: UpdateTableZoneDto, restaurantId: string, caller?: JwtUser): Promise<TableZone> {
    const zone: any = await this.findById(id, restaurantId, caller);

    if (dto.name && dto.name.trim() !== zone.name) {
      const existing = await this.zoneModel.findOne({
        _id: { $ne: new Types.ObjectId(id) },
        name: { $regex: new RegExp(`^${dto.name.trim()}$`, 'i') },
        restaurantId: new Types.ObjectId(restaurantId),
        isDeleted: { $ne: true },
        ...(zone.branchId ? { branchId: zone.branchId } : {}),
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

  async delete(id: string, restaurantId: string, caller?: JwtUser): Promise<{ success: boolean; message: string }> {
    const zone = await this.findById(id, restaurantId, caller);

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
