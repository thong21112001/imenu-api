import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MenuItem, MenuItemDocument } from './entities/menu-item.entity';
import { MenuCategory, MenuCategoryDocument } from './entities/menu-category.entity';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { QueryMenuItemDto } from './dto/query-menu-item.dto';
import { generateSlug } from '../../shared/common/utils/slug.util';
import { buildVietnameseRegex } from '../../shared/common/utils/vietnamese-search.util';
import { JwtUser } from '../auth/interface/jwtUser';

@Injectable()
export class MenuItemsService {
  constructor(
    @InjectModel(MenuItem.name)
    private readonly itemModel: Model<MenuItemDocument>,
    @InjectModel(MenuCategory.name)
    private readonly categoryModel: Model<MenuCategoryDocument>,
  ) {}

  /**
   * Lay danh sach mon an co phan trang, tim kiem (Regex tieng Viet) va loc theo chi nhanh
   */
  async findAll(restaurantId: string, query: QueryMenuItemDto, activeBranchId?: string): Promise<any> {
    if (!restaurantId || !Types.ObjectId.isValid(restaurantId)) {
      return { items: [], total: 0, page: 1, limit: query.limit || 50, totalPages: 0 };
    }

    const restObjId = new Types.ObjectId(restaurantId);
    const targetBranchId = query.branchId || activeBranchId;

    // Chi lay mon an chua bi xoa mem (isDeleted !== true)
    const filter: any = {
      restaurantId: restObjId,
      isDeleted: { $ne: true },
    };

    // Loc theo danh muc
    if (query.categoryId && query.categoryId !== 'all') {
      if (Types.ObjectId.isValid(query.categoryId)) {
        filter.category = new Types.ObjectId(query.categoryId);
      }
    }

    // Loc theo mon ban chay
    if (query.isPopular !== undefined && query.isPopular !== '') {
      filter.isPopular = String(query.isPopular) === 'true';
    }

    // Tim kiem theo tu khoa su dung Regex Tieng Viet & Tieng Anh khong dau / co dau
    if (query.search && query.search.trim()) {
      const searchRegex = buildVietnameseRegex(query.search);
      filter.$or = [{ name: searchRegex }, { description: searchRegex }];
    }

    // Loc mon theo chi nhanh (neu mon chi ap dung cho cac chi nhanh cu the)
    if (targetBranchId && targetBranchId !== 'all') {
      const branchFilter = {
        $or: [
          { branchIds: { $size: 0 } },
          { branchIds: { $exists: false } },
          { branchIds: targetBranchId },
        ],
      };

      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, branchFilter];
        delete filter.$or;
      } else {
        filter.$or = branchFilter.$or;
      }
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 50);
    const skip = (page - 1) * limit;

    const sortOption: any = {};
    if (query.sortBy) {
      sortOption[query.sortBy] = query.sortOrder === 'asc' ? 1 : -1;
    } else {
      sortOption.isAvailable = -1;
      sortOption.createdAt = -1;
    }

    const [rawItems, total] = await Promise.all([
      this.itemModel
        .find(filter)
        .populate('category', 'name slug icon order isActive branchIds')
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.itemModel.countDocuments(filter).exec(),
    ]);

    // Tinh toan gia ban va trang thai hieu luc theo chi nhanh (Effective Price & Availability)
    const items = rawItems
      .map((i) => {
        const obj: any = i.toJSON ? i.toJSON() : i.toObject();

        if (targetBranchId && targetBranchId !== 'all') {
          const override = (obj.branchOverrides || []).find((b: any) => b.branchId === targetBranchId);
          obj.effectivePrice = override?.price !== undefined ? override.price : obj.price;
          obj.effectiveOriginalPrice = override?.originalPrice !== undefined ? override.originalPrice : obj.originalPrice;
          obj.effectiveIsAvailable = override?.isAvailable !== undefined ? override.isAvailable : obj.isAvailable;
          obj.branchId = targetBranchId;
        } else {
          obj.effectivePrice = obj.price;
          obj.effectiveOriginalPrice = obj.originalPrice;
          obj.effectiveIsAvailable = obj.isAvailable;
        }

        return obj;
      })
      .filter((obj: any) => {
        // Neu loc theo isAvailable sau khi da tinh effectiveIsAvailable
        if (query.isAvailable !== undefined && query.isAvailable !== '') {
          return String(obj.effectiveIsAvailable) === String(query.isAvailable);
        }
        return true;
      });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Tim chi tiet mon an theo ID (Chua bi xoa)
   */
  async findById(id: string, restaurantId?: string): Promise<MenuItemDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID món ăn không hợp lệ');
    }

    const filter: any = { _id: new Types.ObjectId(id), isDeleted: { $ne: true } };
    if (restaurantId && Types.ObjectId.isValid(restaurantId)) {
      filter.restaurantId = new Types.ObjectId(restaurantId);
    }

    const item = await this.itemModel
      .findOne(filter)
      .populate('category', 'name slug icon order isActive branchIds')
      .exec();

    if (!item) {
      throw new NotFoundException('Không tìm thấy món ăn');
    }

    return item;
  }

  /**
   * Tao mon an moi
   */
  async create(dto: CreateMenuItemDto, restaurantId: string): Promise<any> {
    if (!restaurantId || !Types.ObjectId.isValid(restaurantId)) {
      throw new BadRequestException('ID nhà hàng không hợp lệ');
    }

    const restObjId = new Types.ObjectId(restaurantId);

    // Kiem tra danh muc hop le va chua bi xoa
    if (!Types.ObjectId.isValid(dto.categoryId)) {
      throw new BadRequestException('ID danh mục không hợp lệ');
    }
    const cat = await this.categoryModel.findOne({
      _id: new Types.ObjectId(dto.categoryId),
      restaurantId: restObjId,
      isDeleted: { $ne: true },
    });
    if (!cat) {
      throw new BadRequestException('Danh mục được chọn không tồn tại hoặc không thuộc nhà hàng này');
    }

    let slug = dto.slug ? generateSlug(dto.slug) : generateSlug(dto.name);
    if (!slug) slug = 'mon-an';

    const existing = await this.itemModel.findOne({ restaurantId: restObjId, slug, isDeleted: { $ne: true } });
    if (existing) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    // Chuan hoa cac nhom tuy chon (Option Groups & Values)
    const options = (dto.options || []).map((grp, gIdx) => ({
      id: grp.id || `opt-grp-${gIdx + 1}`,
      name: grp.name.trim(),
      required: Boolean(grp.required),
      multiple: Boolean(grp.multiple),
      values: (grp.values || []).map((v, vIdx) => ({
        id: v.id || `opt-val-${gIdx + 1}-${vIdx + 1}`,
        name: v.name.trim(),
        priceDelta: Number(v.priceDelta) || 0,
      })),
    }));

    // Chuan hoa cac tuy bien gia rieng theo chi nhanh (Branch Overrides)
    const branchOverrides = (dto.branchOverrides || []).map((b) => ({
      branchId: b.branchId,
      price: b.price !== undefined ? Number(b.price) : undefined,
      originalPrice: b.originalPrice !== undefined ? Number(b.originalPrice) : undefined,
      isAvailable: b.isAvailable !== undefined ? Boolean(b.isAvailable) : true,
    }));

    const created = await this.itemModel.create({
      category: cat._id,
      name: dto.name.trim(),
      slug,
      description: dto.description || '',
      price: dto.price,
      originalPrice: dto.originalPrice,
      imageUrl: dto.imageUrl || '',
      isAvailable: dto.isAvailable !== undefined ? dto.isAvailable : true,
      isPopular: Boolean(dto.isPopular),
      isNewItem: Boolean(dto.isNewItem),
      options,
      restaurantId: restObjId,
      branchIds: dto.branchIds || [],
      branchOverrides,
      isDeleted: false,
    });

    const populated = await created.populate('category', 'name slug icon order isActive branchIds');
    return populated.toJSON ? populated.toJSON() : populated.toObject();
  }

  /**
   * Cap nhat mon an
   */
  async update(id: string, dto: UpdateMenuItemDto, restaurantId: string): Promise<any> {
    const item = await this.findById(id, restaurantId);

    if (dto.name) {
      item.name = dto.name.trim();
    }

    if (dto.slug) {
      const newSlug = generateSlug(dto.slug);
      if (newSlug !== item.slug) {
        const duplicate = await this.itemModel.findOne({
          restaurantId: item.restaurantId,
          slug: newSlug,
          _id: { $ne: item._id },
          isDeleted: { $ne: true },
        });
        if (duplicate) {
          throw new ConflictException('Đường dẫn món ăn (slug) đã tồn tại');
        }
        item.slug = newSlug;
      }
    }

    if (dto.categoryId) {
      if (!Types.ObjectId.isValid(dto.categoryId)) {
        throw new BadRequestException('ID danh mục không hợp lệ');
      }
      const cat = await this.categoryModel.findOne({
        _id: new Types.ObjectId(dto.categoryId),
        restaurantId: item.restaurantId,
        isDeleted: { $ne: true },
      });
      if (!cat) {
        throw new BadRequestException('Danh mục được chọn không thuộc nhà hàng này');
      }
      item.category = cat._id as any;
    }

    if (dto.price !== undefined) {
      item.price = dto.price;
    }

    if (dto.originalPrice !== undefined) {
      item.originalPrice = dto.originalPrice;
    }

    if (dto.description !== undefined) {
      item.description = dto.description;
    }

    if (dto.imageUrl !== undefined) {
      item.imageUrl = dto.imageUrl;
    }

    if (dto.isAvailable !== undefined) {
      item.isAvailable = dto.isAvailable;
    }

    if (dto.isPopular !== undefined) {
      item.isPopular = dto.isPopular;
    }

    if (dto.isNewItem !== undefined) {
      item.isNewItem = dto.isNewItem;
    }

    if (dto.options !== undefined) {
      item.options = dto.options.map((grp, gIdx) => ({
        id: grp.id || `opt-grp-${gIdx + 1}`,
        name: grp.name.trim(),
        required: Boolean(grp.required),
        multiple: Boolean(grp.multiple),
        values: (grp.values || []).map((v, vIdx) => ({
          id: v.id || `opt-val-${gIdx + 1}-${vIdx + 1}`,
          name: v.name.trim(),
          priceDelta: Number(v.priceDelta) || 0,
        })),
      })) as any;
    }

    if (dto.branchIds !== undefined) {
      item.branchIds = dto.branchIds;
    }

    if (dto.branchOverrides !== undefined) {
      item.branchOverrides = dto.branchOverrides.map((b) => ({
        branchId: b.branchId,
        price: b.price !== undefined ? Number(b.price) : undefined,
        originalPrice: b.originalPrice !== undefined ? Number(b.originalPrice) : undefined,
        isAvailable: b.isAvailable !== undefined ? Boolean(b.isAvailable) : true,
      })) as any;
    }

    await item.save();

    const populated = await item.populate('category', 'name slug icon order isActive branchIds');
    return populated.toJSON ? populated.toJSON() : populated.toObject();
  }

  /**
   * Bat/Tat nhanh trang thai Con mon / Het mon co phan lap chi nhanh
   */
  async toggleStatus(
    id: string,
    restaurantId: string,
    isAvailable?: boolean,
    caller?: JwtUser,
    branchId?: string,
  ): Promise<any> {
    const item = await this.findById(id, restaurantId);

    // Xac dinh chi nhanh can cap nhat:
    // 1. Neu caller la nhan vien chi nhanh con -> chi cap nhat branchId cua caller do
    // 2. Neu caller la chu quan va truyen branchId -> cap nhat cho branchId do
    // 3. Neu khong truyen branchId va la chu quan truc tiep -> cap nhat toan he thong
    const isSubBranchStaff = caller && !caller.isMainBranch && caller.branchId;
    const targetBranchId = isSubBranchStaff ? caller.branchId : branchId;

    if (targetBranchId && targetBranchId !== 'all') {
      item.branchOverrides = item.branchOverrides || [];
      const bIdx = item.branchOverrides.findIndex((b) => b.branchId === targetBranchId);

      let newStatus: boolean;
      if (isAvailable !== undefined) {
        newStatus = isAvailable;
      } else if (bIdx > -1) {
        newStatus = !item.branchOverrides[bIdx].isAvailable;
      } else {
        newStatus = !item.isAvailable;
      }

      if (bIdx > -1) {
        item.branchOverrides[bIdx].isAvailable = newStatus;
      } else {
        item.branchOverrides.push({
          branchId: targetBranchId,
          price: item.price,
          originalPrice: item.originalPrice,
          isAvailable: newStatus,
        });
      }
    } else {
      // Cap nhat toan he thong
      if (isAvailable !== undefined) {
        item.isAvailable = isAvailable;
      } else {
        item.isAvailable = !item.isAvailable;
      }
    }

    await item.save();

    const populated = await item.populate('category', 'name slug icon order isActive branchIds');
    const resObj = populated.toJSON ? populated.toJSON() : populated.toObject();

    if (targetBranchId && targetBranchId !== 'all') {
      const override = (resObj.branchOverrides || []).find((b: any) => b.branchId === targetBranchId);
      resObj.effectivePrice = override?.price !== undefined ? override.price : resObj.price;
      resObj.effectiveOriginalPrice = override?.originalPrice !== undefined ? override.originalPrice : resObj.originalPrice;
      resObj.effectiveIsAvailable = override?.isAvailable !== undefined ? override.isAvailable : resObj.isAvailable;
      resObj.branchId = targetBranchId;
    }

    return resObj;
  }

  /**
   * Xoa mon an bang co che SOFT DELETE (Bao toan du lieu lich su)
   */
  async delete(id: string, restaurantId: string, caller?: JwtUser): Promise<{ success: boolean; message: string }> {
    const item = await this.findById(id, restaurantId);

    const timestamp = Date.now();
    item.isDeleted = true;
    item.deletedAt = new Date();
    item.isAvailable = false;
    item.slug = `${item.slug}_deleted_${timestamp}`; // Giai phong slug de co the tao lai mon cung ten sau nay

    if (caller?.userId && Types.ObjectId.isValid(caller.userId)) {
      item.deletedBy = new Types.ObjectId(caller.userId);
    }

    await item.save();

    return {
      success: true,
      message: `Đã xóa món ăn "${item.name}" thành công`,
    };
  }
}
