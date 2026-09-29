import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MenuCategory, MenuCategoryDocument } from './entities/menu-category.entity';
import { MenuItem, MenuItemDocument } from './entities/menu-item.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { generateSlug } from '../../shared/common/utils/slug.util';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(MenuCategory.name)
    private readonly categoryModel: Model<MenuCategoryDocument>,
    @InjectModel(MenuItem.name)
    private readonly itemModel: Model<MenuItemDocument>,
  ) {}

  /**
   * Lay danh sach tat ca danh muc kem so luong mon an (itemsCount)
   */
  async findAll(restaurantId: string, onlyActive = false): Promise<any[]> {
    if (!restaurantId || !Types.ObjectId.isValid(restaurantId)) {
      return [];
    }

    const restObjId = new Types.ObjectId(restaurantId);
    const filter: any = { restaurantId: restObjId };
    if (onlyActive) {
      filter.isActive = true;
    }

    const categories = await this.categoryModel
      .find(filter)
      .sort({ order: 1, createdAt: 1 })
      .exec();

    // Tinh so luong mon an theo tung danh muc
    const counts = await this.itemModel.aggregate([
      { $match: { restaurantId: restObjId } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);

    const countMap = new Map<string, number>();
    for (const c of counts) {
      if (c._id) {
        countMap.set(c._id.toString(), c.count);
      }
    }

    return categories.map((cat) => {
      const obj: any = cat.toJSON ? cat.toJSON() : cat.toObject();
      obj.itemsCount = countMap.get(cat._id.toString()) || 0;
      return obj;
    });
  }

  /**
   * Tim chi tiet danh muc theo ID
   */
  async findById(id: string, restaurantId?: string): Promise<MenuCategoryDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID danh mục không hợp lệ');
    }

    const filter: any = { _id: new Types.ObjectId(id) };
    if (restaurantId && Types.ObjectId.isValid(restaurantId)) {
      filter.restaurantId = new Types.ObjectId(restaurantId);
    }

    const category = await this.categoryModel.findOne(filter).exec();
    if (!category) {
      throw new NotFoundException('Không tìm thấy danh mục thực đơn');
    }

    return category;
  }

  /**
   * Tao danh muc thuc don moi
   */
  async create(dto: CreateCategoryDto, restaurantId: string): Promise<any> {
    if (!restaurantId || !Types.ObjectId.isValid(restaurantId)) {
      throw new BadRequestException('ID nhà hàng không hợp lệ');
    }

    const restObjId = new Types.ObjectId(restaurantId);
    let slug = dto.slug ? generateSlug(dto.slug) : generateSlug(dto.name);
    if (!slug) slug = 'danh-muc';

    // Kiem tra trung lap slug trong cung mot nha hang
    const existing = await this.categoryModel.findOne({ restaurantId: restObjId, slug });
    if (existing) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    // Tu dong gan thu tu order neu chua truyen
    let order = dto.order;
    if (order === undefined || order === null) {
      const maxOrderCat = await this.categoryModel
        .findOne({ restaurantId: restObjId })
        .sort({ order: -1 })
        .exec();
      order = maxOrderCat && maxOrderCat.order !== undefined ? maxOrderCat.order + 1 : 1;
    }

    const created = await this.categoryModel.create({
      name: dto.name.trim(),
      slug,
      icon: dto.icon || '🍲',
      order,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
      restaurantId: restObjId,
    });

    const resObj: any = created.toJSON ? created.toJSON() : created.toObject();
    resObj.itemsCount = 0;
    return resObj;
  }

  /**
   * Cap nhat danh muc thuc don
   */
  async update(id: string, dto: UpdateCategoryDto, restaurantId: string): Promise<any> {
    const category = await this.findById(id, restaurantId);

    if (dto.name) {
      category.name = dto.name.trim();
    }

    if (dto.slug) {
      const newSlug = generateSlug(dto.slug);
      if (newSlug !== category.slug) {
        const duplicate = await this.categoryModel.findOne({
          restaurantId: category.restaurantId,
          slug: newSlug,
          _id: { $ne: category._id },
        });
        if (duplicate) {
          throw new ConflictException('Đường dẫn danh mục (slug) đã tồn tại');
        }
        category.slug = newSlug;
      }
    }

    if (dto.icon !== undefined) {
      category.icon = dto.icon;
    }

    if (dto.order !== undefined) {
      category.order = dto.order;
    }

    if (dto.isActive !== undefined) {
      category.isActive = dto.isActive;
    }

    await category.save();

    const count = await this.itemModel.countDocuments({
      category: category._id,
      restaurantId: category.restaurantId,
    });

    const resObj: any = category.toJSON ? category.toJSON() : category.toObject();
    resObj.itemsCount = count;
    return resObj;
  }

  /**
   * Xoa danh muc thuc don (Kiem tra rang buoc mon an con ton tai)
   */
  async delete(id: string, restaurantId: string): Promise<{ success: boolean; message: string }> {
    const category = await this.findById(id, restaurantId);

    const itemCount = await this.itemModel.countDocuments({
      category: category._id,
      restaurantId: category.restaurantId,
    });

    if (itemCount > 0) {
      throw new BadRequestException(
        `Không thể xóa danh mục đang có ${itemCount} món ăn. Vui lòng chuyển hoặc xóa các món ăn trước.`,
      );
    }

    await this.categoryModel.deleteOne({ _id: category._id }).exec();
    return {
      success: true,
      message: `Đã xóa danh mục "${category.name}" thành công`,
    };
  }

  /**
   * Tu dong khoi tao danh muc va mon an mau cho nha hang demo
   */
  async seedDefaultMenu(restaurantId: string): Promise<void> {
    if (!restaurantId || !Types.ObjectId.isValid(restaurantId)) return;
    const restObjId = new Types.ObjectId(restaurantId);

    const count = await this.categoryModel.countDocuments({ restaurantId: restObjId });
    if (count > 0) return;

    const defaultCategories = [
      {
        name: 'Món Chính Đặc Sắc',
        slug: 'mon-chinh',
        icon: '🍲',
        order: 1,
        items: [
          {
            name: 'Cơm Chiên Hải Sản Hoàng Gia',
            slug: 'com-chien-hai-san-hoang-gia',
            price: 79000,
            originalPrice: 89000,
            description: 'Hải sản tươi ngọt xào cùng cơm hạt vàng giòn thơm nức mũi',
            imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
            isPopular: true,
            options: [
              {
                id: 'opt-size',
                name: 'Kích cỡ (Size)',
                required: false,
                multiple: false,
                values: [
                  { id: 'opt-size-std', name: 'Tiêu chuẩn', priceDelta: 0 },
                  { id: 'opt-size-l', name: 'Size Lớn', priceDelta: 15000 },
                ],
              },
              {
                id: 'opt-top',
                name: 'Thêm Topping',
                required: false,
                multiple: true,
                values: [
                  { id: 'top-egg', name: 'Trứng ốp la lòng đào', priceDelta: 10000 },
                  { id: 'top-shrimp', name: 'Thêm tôm sú (3 con)', priceDelta: 25000 },
                ],
              },
            ],
          },
          {
            name: 'Bò Lúc Lắc Khoai Tây Chiên',
            slug: 'bo-luc-lac-khoai-tay-chien',
            price: 125000,
            originalPrice: 145000,
            description: 'Thịt thăn bò mềm mọng xào ớt chuông, ăn kèm khoai tây giòn rụm',
            imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
            isPopular: true,
            options: [
              {
                id: 'opt-doneness',
                name: 'Độ chín thịt bò',
                required: true,
                multiple: false,
                values: [
                  { id: 'done-med', name: 'Vừa chín tới (Medium)', priceDelta: 0 },
                  { id: 'done-well', name: 'Chín kỹ (Well-done)', priceDelta: 0 },
                ],
              },
            ],
          },
          {
            name: 'Sườn Nướng Sốt Mật Ong Rừng',
            slug: 'suon-nuong-sot-mat-ong-rung',
            price: 110000,
            description: 'Sườn heo cây tẩm ướp mật ong rừng đậm đà nướng than hoa thơm lừng',
            imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
            isPopular: false,
            options: [],
          },
        ],
      },
      {
        name: 'Món Khai Vị & Ăn Nhẹ',
        slug: 'khai-vi',
        icon: '🥗',
        order: 2,
        items: [
          {
            name: 'Gỏi Ngó Sen Tôm Thịt',
            slug: 'goi-ngo-sen-tom-thit',
            price: 65000,
            description: 'Ngó sen giòn ngọt chua dịu kết hợp tôm sú và thịt ba chỉ xắt mỏng',
            imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80',
            isPopular: true,
            options: [
              {
                id: 'opt-spicy',
                name: 'Độ cay',
                required: false,
                multiple: false,
                values: [
                  { id: 'spicy-mild', name: 'Ít cay', priceDelta: 0 },
                  { id: 'spicy-hot', name: 'Cay vừa', priceDelta: 0 },
                  { id: 'spicy-extra', name: 'Cay nhiều', priceDelta: 0 },
                ],
              },
            ],
          },
          {
            name: 'Chả Giò Hải Sản Sốt Mayonnaise',
            slug: 'cha-gio-hai-san',
            price: 55000,
            description: 'Bánh tráng rế cuốn hải sản giòn tan chấm sốt béo ngậy',
            imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80',
            isPopular: false,
            options: [],
          },
        ],
      },
      {
        name: 'Món Nước & Lẩu',
        slug: 'mon-nuoc',
        icon: '🍜',
        order: 3,
        items: [
          {
            name: 'Phở Bò Tái Nạm Đặc Biệt',
            slug: 'pho-bo-tai-nam-dac-biet',
            price: 68000,
            description: 'Nước dùng hầm xương ống 12 tiếng thơm hương hoa hồi quế thảo',
            imageUrl: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=600&q=80',
            isPopular: true,
            options: [
              {
                id: 'opt-noodles',
                name: 'Yêu cầu thêm',
                required: false,
                multiple: true,
                values: [
                  { id: 'req-egg', name: 'Thêm trứng chần', priceDelta: 8000 },
                  { id: 'req-meat', name: 'Thêm thịt bò', priceDelta: 20000 },
                ],
              },
            ],
          },
        ],
      },
      {
        name: 'Đồ Uống & Trà Trái Cây',
        slug: 'do-uong',
        icon: '🧋',
        order: 4,
        items: [
          {
            name: 'Trà Đào Cam Sả Tươi Mát',
            slug: 'tra-dao-cam-sa',
            price: 39000,
            description: 'Hương thơm sả tươi, vị chua ngọt từ cam vàng và miếng đào giòn',
            imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80',
            isPopular: true,
            options: [
              {
                id: 'opt-sweet',
                name: 'Lượng đường',
                required: false,
                multiple: false,
                values: [
                  { id: 'sw-100', name: '100% đường (Bình thường)', priceDelta: 0 },
                  { id: 'sw-70', name: '70% đường (Ít ngọt)', priceDelta: 0 },
                  { id: 'sw-50', name: '50% đường', priceDelta: 0 },
                  { id: 'sw-0', name: 'Không đường', priceDelta: 0 },
                ],
              },
              {
                id: 'opt-ice',
                name: 'Lượng đá',
                required: false,
                multiple: false,
                values: [
                  { id: 'ice-100', name: '100% đá', priceDelta: 0 },
                  { id: 'ice-50', name: '50% đá', priceDelta: 0 },
                  { id: 'ice-0', name: 'Không đá', priceDelta: 0 },
                ],
              },
              {
                id: 'opt-top-tea',
                name: 'Topping thêm',
                required: false,
                multiple: true,
                values: [
                  { id: 'top-aloe', name: 'Thạch nha đam', priceDelta: 8000 },
                  { id: 'top-boba', name: 'Trân châu trắng giòn', priceDelta: 8000 },
                  { id: 'top-peach', name: 'Thêm 2 miếng đào', priceDelta: 12000 },
                ],
              },
            ],
          },
          {
            name: 'Cà Phê Muối Kem Béo',
            slug: 'ca-phe-muoi',
            price: 35000,
            description: 'Cà phê phin đậm đà hòa quyện cùng lớp kem muối béo mặn thơm ngậy',
            imageUrl: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=80',
            isPopular: true,
            options: [],
          },
        ],
      },
    ];

    for (const catData of defaultCategories) {
      const createdCat = await this.categoryModel.create({
        name: catData.name,
        slug: catData.slug,
        icon: catData.icon,
        order: catData.order,
        isActive: true,
        restaurantId: restObjId,
      });

      for (const itemData of catData.items) {
        await this.itemModel.create({
          category: createdCat._id,
          name: itemData.name,
          slug: itemData.slug,
          price: itemData.price,
          originalPrice: (itemData as any).originalPrice,
          description: itemData.description,
          imageUrl: itemData.imageUrl,
          isAvailable: true,
          isPopular: itemData.isPopular,
          options: itemData.options,
          restaurantId: restObjId,
        });
      }
    }
  }
}
