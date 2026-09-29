import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MenuItem, MenuItemDocument } from './entities/menu-item.entity';
import { MenuCategory, MenuCategoryDocument } from './entities/menu-category.entity';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { QueryMenuItemDto } from './dto/query-menu-item.dto';
import { generateSlug } from '../../shared/common/utils/slug.util';

@Injectable()
export class MenuItemsService {
  constructor(
    @InjectModel(MenuItem.name)
    private readonly itemModel: Model<MenuItemDocument>,
    @InjectModel(MenuCategory.name)
    private readonly categoryModel: Model<MenuCategoryDocument>,
  ) {}

  /**
   * Lay danh sach mon an co phan trang, tim kiem va loc theo danh muc
   */
  async findAll(restaurantId: string, query: QueryMenuItemDto): Promise<any> {
    if (!restaurantId || !Types.ObjectId.isValid(restaurantId)) {
      return { items: [], total: 0, page: 1, limit: query.limit || 50, totalPages: 0 };
    }

    const restObjId = new Types.ObjectId(restaurantId);
    const filter: any = { restaurantId: restObjId };

    // Loc theo danh muc
    if (query.categoryId && query.categoryId !== 'all') {
      if (Types.ObjectId.isValid(query.categoryId)) {
        filter.category = new Types.ObjectId(query.categoryId);
      }
    }

    // Loc theo trang thai Con/Het
    if (query.isAvailable !== undefined && query.isAvailable !== '') {
      filter.isAvailable = String(query.isAvailable) === 'true';
    }

    // Loc theo mon ban chay
    if (query.isPopular !== undefined && query.isPopular !== '') {
      filter.isPopular = String(query.isPopular) === 'true';
    }

    // Tim kiem theo tu khoa
    if (query.search && query.search.trim()) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ name: searchRegex }, { description: searchRegex }];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 50);
    const skip = (page - 1) * limit;

    const sortOption: any = {};
    if (query.sortBy) {
      sortOption[query.sortBy] = query.sortOrder === 'asc' ? 1 : -1;
    } else {
      // Mac dinh: mon con ban len tren, moi nhat len tren
      sortOption.isAvailable = -1;
      sortOption.createdAt = -1;
    }

    const [items, total] = await Promise.all([
      this.itemModel
        .find(filter)
        .populate('category', 'name slug icon order isActive')
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.itemModel.countDocuments(filter).exec(),
    ]);

    return {
      items: items.map((i) => (i.toJSON ? i.toJSON() : i.toObject())),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Tim chi tiet mon an theo ID
   */
  async findById(id: string, restaurantId?: string): Promise<MenuItemDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID món ăn không hợp lệ');
    }

    const filter: any = { _id: new Types.ObjectId(id) };
    if (restaurantId && Types.ObjectId.isValid(restaurantId)) {
      filter.restaurantId = new Types.ObjectId(restaurantId);
    }

    const item = await this.itemModel
      .findOne(filter)
      .populate('category', 'name slug icon order isActive')
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

    // Kiem tra danh muc co ton tai va thuoc ve nha hang nay khong
    if (!Types.ObjectId.isValid(dto.categoryId)) {
      throw new BadRequestException('ID danh mục không hợp lệ');
    }
    const cat = await this.categoryModel.findOne({
      _id: new Types.ObjectId(dto.categoryId),
      restaurantId: restObjId,
    });
    if (!cat) {
      throw new BadRequestException('Danh mục được chọn không tồn tại hoặc không thuộc nhà hàng này');
    }

    let slug = dto.slug ? generateSlug(dto.slug) : generateSlug(dto.name);
    if (!slug) slug = 'mon-an';

    const existing = await this.itemModel.findOne({ restaurantId: restObjId, slug });
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
    });

    const populated = await created.populate('category', 'name slug icon order isActive');
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

    await item.save();

    const populated = await item.populate('category', 'name slug icon order isActive');
    return populated.toJSON ? populated.toJSON() : populated.toObject();
  }

  /**
   * Bat/Tat nhanh trang thai Con mon / Het mon (Danh cho Thu ngan & Bep KDS)
   */
  async toggleStatus(id: string, restaurantId: string, isAvailable?: boolean): Promise<any> {
    const item = await this.findById(id, restaurantId);

    if (isAvailable !== undefined) {
      item.isAvailable = isAvailable;
    } else {
      item.isAvailable = !item.isAvailable;
    }

    await item.save();

    const populated = await item.populate('category', 'name slug icon order isActive');
    return populated.toJSON ? populated.toJSON() : populated.toObject();
  }

  /**
   * Xoa mon an
   */
  async delete(id: string, restaurantId: string): Promise<{ success: boolean; message: string }> {
    const item = await this.findById(id, restaurantId);
    await this.itemModel.deleteOne({ _id: item._id }).exec();
    return {
      success: true,
      message: `Đã xóa món ăn "${item.name}" thành công`,
    };
  }
}
