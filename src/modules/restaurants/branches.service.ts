import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Restaurant, RestaurantDocument } from './entities/restaurant.entity';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
  ) {}

  async findAll(restaurantId: string) {
    const restaurant = await this.restaurantModel.findById(restaurantId);
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy nhà hàng');
    }
    return restaurant.branches || [];
  }

  async findById(restaurantId: string, branchId: string) {
    const restaurant = await this.restaurantModel.findById(restaurantId);
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy nhà hàng');
    }
    const branch = restaurant.branches.find(
      (b: any) => b._id.toString() === branchId || b.id === branchId,
    );
    if (!branch) {
      throw new NotFoundException('Không tìm thấy chi nhánh');
    }
    return branch;
  }

  async create(restaurantId: string, dto: CreateBranchDto) {
    const restaurant = await this.restaurantModel.findById(restaurantId);
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy nhà hàng');
    }

    // Neu tao branch moi voi isMainBranch = true, bo isMainBranch cac branch khac
    if (dto.isMainBranch) {
      restaurant.branches.forEach((b: any) => {
        b.isMainBranch = false;
      });
    }

    const newBranch: any = {
      _id: new Types.ObjectId(),
      name: dto.name,
      address: dto.address,
      phone: dto.phone,
      isMainBranch: dto.isMainBranch || false,
    };

    restaurant.branches.push(newBranch);
    await restaurant.save();

    return newBranch;
  }

  async update(restaurantId: string, branchId: string, dto: UpdateBranchDto) {
    const restaurant = await this.restaurantModel.findById(restaurantId);
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy nhà hàng');
    }

    const branchIndex = restaurant.branches.findIndex(
      (b: any) => b._id.toString() === branchId || b.id === branchId,
    );
    if (branchIndex === -1) {
      throw new NotFoundException('Không tìm thấy chi nhánh');
    }

    if (dto.isMainBranch) {
      restaurant.branches.forEach((b: any) => {
        b.isMainBranch = false;
      });
    }

    const currentBranch: any = restaurant.branches[branchIndex];
    if (dto.name !== undefined) currentBranch.name = dto.name;
    if (dto.address !== undefined) currentBranch.address = dto.address;
    if (dto.phone !== undefined) currentBranch.phone = dto.phone;
    if (dto.isMainBranch !== undefined) currentBranch.isMainBranch = dto.isMainBranch;

    restaurant.branches[branchIndex] = currentBranch;
    await restaurant.save();

    return currentBranch;
  }

  async delete(restaurantId: string, branchId: string) {
    const restaurant = await this.restaurantModel.findById(restaurantId);
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy nhà hàng');
    }

    if (restaurant.branches.length <= 1) {
      throw new BadRequestException('Không thể xóa chi nhánh duy nhất của nhà hàng');
    }

    const branch = restaurant.branches.find(
      (b: any) => b._id.toString() === branchId || b.id === branchId,
    );
    if (!branch) {
      throw new NotFoundException('Không tìm thấy chi nhánh');
    }

    if ((branch as any).isMainBranch) {
      throw new BadRequestException('Không thể xóa chi nhánh chính. Vui lòng chỉ định chi nhánh chính khác trước khi xóa');
    }

    restaurant.branches = restaurant.branches.filter(
      (b: any) => b._id.toString() !== branchId && b.id !== branchId,
    );

    await restaurant.save();
    return { success: true, message: 'Đã xóa chi nhánh thành công' };
  }
}
