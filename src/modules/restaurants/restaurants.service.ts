import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Restaurant, RestaurantDocument } from './entities/restaurant.entity';
import { BranchStatus } from './entities/branch.schema';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { generateSlug } from '../../shared/common/utils/slug.util';

@Injectable()
export class RestaurantsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RestaurantsService.name);

  constructor(
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.repairBranchesAndData();
  }

  async repairBranchesAndData(): Promise<void> {
    try {
      const restaurants = await this.restaurantModel.find();
      for (const restaurant of restaurants) {
        let changed = false;
        if (!restaurant.branches || restaurant.branches.length === 0) {
          const mainBranchId = new Types.ObjectId();
          restaurant.branches = [
            {
              _id: mainBranchId,
              name: 'Chi nhánh chính',
              address: restaurant.address || 'Địa chỉ chính',
              phone: restaurant.phone || '0900000000',
              isMainBranch: true,
              status: BranchStatus.ACTIVE,
            } as any,
          ];
          changed = true;
        } else {
          // Kiem tra bat bien: phai co dung 1 chi nhanh chinh
          const mainBranches = restaurant.branches.filter((b: any) => b.isMainBranch);
          if (mainBranches.length === 0) {
            (restaurant.branches[0] as any).isMainBranch = true;
            changed = true;
          } else if (mainBranches.length > 1) {
            let keptFirst = false;
            restaurant.branches.forEach((b: any) => {
              if (b.isMainBranch) {
                if (!keptFirst) {
                  keptFirst = true;
                } else {
                  b.isMainBranch = false;
                  changed = true;
                }
              }
            });
          }

          // Dam bao moi chi nhanh deu co status
          restaurant.branches.forEach((b: any) => {
            if (!b.status) {
              b.status = BranchStatus.ACTIVE;
              changed = true;
            }
          });
        }

        if (changed) {
          await restaurant.save();
          this.logger.log(
            `[Migration] Đã chuẩn hóa chi nhánh chính cho nhà hàng: ${restaurant.name} (${restaurant._id})`,
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(`Lỗi khi kiểm tra dữ liệu chi nhánh tự động: ${err.message}`);
    }
  }

  async findById(id: string): Promise<RestaurantDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID nhà hàng không hợp lệ');
    }
    const restaurant = await this.restaurantModel.findById(id);
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy nhà hàng');
    }
    return restaurant;
  }

  async findBySlug(slug: string): Promise<RestaurantDocument> {
    const restaurant = await this.restaurantModel.findOne({ slug });
    if (!restaurant) {
      throw new NotFoundException(`Không tìm thấy nhà hàng với slug: ${slug}`);
    }
    return restaurant;
  }

  async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = generateSlug(name) || 'nha-hang';
    let slug = baseSlug;
    let counter = 1;

    while (await this.restaurantModel.exists({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  async create(data: Partial<Restaurant>): Promise<RestaurantDocument> {
    if (!data.slug && data.name) {
      data.slug = await this.generateUniqueSlug(data.name);
    }
    const restaurant = new this.restaurantModel(data);
    return restaurant.save();
  }

  async getCurrent(restaurantId: string) {
    const restaurant = await this.findById(restaurantId);
    return {
      id: (restaurant as any)._id.toString(),
      name: restaurant.name,
      slug: restaurant.slug,
      phone: restaurant.phone,
      address: restaurant.address,
      logoUrl: restaurant.logoUrl,
      coverUrl: restaurant.coverUrl,
      tagline: restaurant.tagline,
      openingHours: restaurant.openingHours,
      isOpen: restaurant.isOpen,
      bankAccount: restaurant.bankAccount,
      branches: restaurant.branches,
      plan: restaurant.plan,
    };
  }

  async updateCurrent(
    restaurantId: string,
    updateDto: UpdateRestaurantDto,
    user?: any,
  ) {
    const restaurant = await this.findById(restaurantId);

    // Kiem tra xem co thay doi thong tin bankAccount khong (Audit Requirement)
    if (updateDto.bankAccount) {
      const oldBank = restaurant.bankAccount || ({} as any);
      if (
        oldBank.accountNo !== updateDto.bankAccount.accountNo ||
        oldBank.bankId !== updateDto.bankAccount.bankId
      ) {
        this.logger.log(
          `[AUDIT] Bank account changed for restaurant ${restaurant.name} (${restaurantId}) by user ${user?.userId || user?.id || 'system'}. Old: ${oldBank.bankId}/${oldBank.accountNo} -> New: ${updateDto.bankAccount.bankId}/${updateDto.bankAccount.accountNo}`,
        );
      }
      restaurant.bankAccount = {
        ...restaurant.bankAccount,
        ...updateDto.bankAccount,
      } as any;
    }

    if (updateDto.name !== undefined) restaurant.name = updateDto.name;
    if (updateDto.phone !== undefined) restaurant.phone = updateDto.phone;
    if (updateDto.address !== undefined) restaurant.address = updateDto.address;
    if (updateDto.logoUrl !== undefined) restaurant.logoUrl = updateDto.logoUrl;
    if (updateDto.coverUrl !== undefined) restaurant.coverUrl = updateDto.coverUrl;
    if (updateDto.tagline !== undefined) restaurant.tagline = updateDto.tagline;
    if (updateDto.openingHours !== undefined) restaurant.openingHours = updateDto.openingHours;
    if (updateDto.isOpen !== undefined) restaurant.isOpen = updateDto.isOpen;

    await restaurant.save();

    return this.getCurrent(restaurantId);
  }
}
