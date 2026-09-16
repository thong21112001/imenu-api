import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Restaurant, RestaurantDocument } from './entities/restaurant.entity';
import { BranchStatus } from './entities/branch.schema';
import { CreateBranchDto, UpdateBranchDto, CloseBranchDto, DeactivateBranchDto } from './dto/branch.dto';
import { Order, OrderDocument } from '../orders/entities/order.entity';
import { User, UserDocument } from '../users/entities/user.entity';
import { JwtUser } from '../auth/interface/jwtUser';

@Injectable()
export class BranchesService {
  constructor(
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async findAll(restaurantId: string, caller?: JwtUser) {
    const restaurant = await this.restaurantModel.findById(restaurantId);
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy nhà hàng');
    }

    const branches = restaurant.branches || [];

    // Nếu caller thuộc chi nhánh con và không phải main branch/admin -> Chỉ trả về chi nhánh của họ
    if (caller && !caller.isMainBranch && caller.branchId) {
      return branches.filter(
        (b: any) => b._id.toString() === caller.branchId || b.id === caller.branchId,
      );
    }

    return branches;
  }

  async findById(restaurantId: string, branchId: string, caller?: JwtUser) {
    const restaurant = await this.restaurantModel.findById(restaurantId);
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy nhà hàng');
    }

    // Nếu caller thuộc chi nhánh con và cố tình xem chi nhánh khác -> Chặn
    if (caller && !caller.isMainBranch && caller.branchId && caller.branchId !== branchId) {
      throw new ForbiddenException('Bạn không có quyền truy cập dữ liệu của chi nhánh khác');
    }

    const branch = restaurant.branches.find(
      (b: any) => b._id.toString() === branchId || b.id === branchId,
    );
    if (!branch) {
      throw new NotFoundException('Không tìm thấy chi nhánh');
    }
    return branch;
  }

  async create(restaurantId: string, dto: CreateBranchDto, caller?: JwtUser) {
    if (caller && !caller.isMainBranch) {
      throw new ForbiddenException('Chỉ quản trị viên chi nhánh chính mới có quyền tạo chi nhánh mới');
    }

    const restaurant = await this.restaurantModel.findById(restaurantId);
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy nhà hàng');
    }

    // Nếu tạo branch mới với isMainBranch = true, bỏ isMainBranch các branch khác
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
      status: dto.status || BranchStatus.ACTIVE,
    };

    restaurant.branches.push(newBranch);
    await restaurant.save();

    return newBranch;
  }

  async update(restaurantId: string, branchId: string, dto: UpdateBranchDto, caller?: JwtUser) {
    if (caller && !caller.isMainBranch) {
      throw new ForbiddenException('Chỉ quản trị viên chi nhánh chính mới có quyền cập nhật chi nhánh');
    }

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

    const currentBranch: any = restaurant.branches[branchIndex];

    // Kiểm tra tính bất biến của chi nhánh chính
    if (dto.isMainBranch === false && currentBranch.isMainBranch) {
      const otherMain = restaurant.branches.some(
        (b: any) => (b._id.toString() !== branchId && b.id !== branchId) && b.isMainBranch,
      );
      if (!otherMain) {
        throw new BadRequestException(
          'Nhà hàng phải luôn có ít nhất một chi nhánh chính. Vui lòng chỉ định chi nhánh chính mới trước khi gỡ bỏ chi nhánh chính hiện tại',
        );
      }
    }

    if (dto.isMainBranch === true) {
      restaurant.branches.forEach((b: any) => {
        b.isMainBranch = false;
      });
    }

    if (dto.name !== undefined) currentBranch.name = dto.name;
    if (dto.address !== undefined) currentBranch.address = dto.address;
    if (dto.phone !== undefined) currentBranch.phone = dto.phone;
    if (dto.isMainBranch !== undefined) currentBranch.isMainBranch = dto.isMainBranch;
    if (dto.status !== undefined) currentBranch.status = dto.status;

    restaurant.branches[branchIndex] = currentBranch;
    await restaurant.save();

    return currentBranch;
  }

  async closeBranch(restaurantId: string, branchId: string, dto: CloseBranchDto, caller?: JwtUser) {
    if (caller && !caller.isMainBranch) {
      throw new ForbiddenException('Chỉ quản trị viên chi nhánh chính mới có quyền tạm đóng chi nhánh');
    }

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

    const branch: any = restaurant.branches[branchIndex];

    if (branch.status === BranchStatus.TEMPORARILY_CLOSED) {
      throw new BadRequestException('Chi nhánh này hiện đã ở trạng thái tạm đóng');
    }

    if (branch.status === BranchStatus.INACTIVE) {
      throw new BadRequestException('Chi nhánh này đã ngừng hoạt động vĩnh viễn, không thể chuyển sang tạm đóng');
    }

    // Kiểm tra đơn hàng đang hoạt động chưa thanh toán
    const activeOrderCount = await this.orderModel.countDocuments({
      restaurantId: new Types.ObjectId(restaurantId),
      branchId,
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

    if (activeOrderCount > 0) {
      if (!dto.force) {
        throw new ConflictException(
          `Chi nhánh vẫn còn ${activeOrderCount} đơn hàng đang phục vụ hoặc chưa thanh toán. Vui lòng thanh toán hết hoặc sử dụng tùy chọn hủy cưỡng bức (force=true)`,
        );
      } else {
        // Hủy các đơn đang mở nếu có tùy chọn force = true
        await this.orderModel.updateMany(
          {
            restaurantId: new Types.ObjectId(restaurantId),
            branchId,
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
          },
          {
            $set: {
              status: 'Cancelled',
              customerNote: `Tự động hủy do tạm đóng chi nhánh: ${dto.reason || 'Bảo trì'}`,
            },
          },
        );
      }
    }

    branch.status = BranchStatus.TEMPORARILY_CLOSED;
    branch.closedAt = new Date();
    branch.closedReason = dto.reason || 'Tạm đóng chi nhánh (hết giờ làm việc)';

    // Đồng bộ trạng thái mở/đóng cửa hàng nếu là chi nhánh chính
    if (branch.isMainBranch) {
      restaurant.isOpen = false;
    }

    restaurant.branches[branchIndex] = branch;
    await restaurant.save();

    return branch;
  }

  async reopenBranch(restaurantId: string, branchId: string, caller?: JwtUser) {
    if (caller && !caller.isMainBranch) {
      throw new ForbiddenException('Chỉ quản trị viên chi nhánh chính mới có quyền mở lại chi nhánh');
    }

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

    const branch: any = restaurant.branches[branchIndex];

    if (branch.status !== BranchStatus.TEMPORARILY_CLOSED) {
      throw new BadRequestException('Chỉ có thể mở lại chi nhánh đang ở trạng thái tạm đóng');
    }

    branch.status = BranchStatus.ACTIVE;
    branch.closedReason = '';

    // Đồng bộ trạng thái mở cửa hàng nếu là chi nhánh chính
    if (branch.isMainBranch) {
      restaurant.isOpen = true;
    }

    restaurant.branches[branchIndex] = branch;
    await restaurant.save();

    return branch;
  }

  async deactivateBranch(
    restaurantId: string,
    branchId: string,
    dto: DeactivateBranchDto,
    caller?: JwtUser,
  ) {
    if (caller && !caller.isMainBranch) {
      throw new ForbiddenException('Chỉ quản trị viên chi nhánh chính mới có quyền ngừng hoạt động chi nhánh');
    }

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

    const branch: any = restaurant.branches[branchIndex];

    if (branch.isMainBranch) {
      throw new BadRequestException('Không thể ngừng hoạt động chi nhánh chính của nhà hàng');
    }

    // Kiểm tra đơn hàng đang mở
    const activeOrderCount = await this.orderModel.countDocuments({
      restaurantId: new Types.ObjectId(restaurantId),
      branchId,
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

    if (activeOrderCount > 0) {
      if (!dto.force) {
        throw new ConflictException(
          `Chi nhánh vẫn còn ${activeOrderCount} đơn hàng chưa thanh toán. Vui lòng thanh toán hoặc sử dụng tùy chọn hủy (force=true)`,
        );
      } else {
        await this.orderModel.updateMany(
          {
            restaurantId: new Types.ObjectId(restaurantId),
            branchId,
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
          },
          {
            $set: {
              status: 'Cancelled',
              customerNote: `Hủy do ngừng hoạt động chi nhánh vĩnh viễn: ${dto.reason || ''}`,
            },
          },
        );
      }
    }

    branch.status = BranchStatus.INACTIVE;
    branch.closedAt = new Date();
    branch.closedReason = dto.reason || 'Ngừng hoạt động vĩnh viễn';

    // Tự động tạm khóa quyền hạn các nhân viên thuộc chi nhánh này
    await this.userModel.updateMany(
      {
        restaurantId: new Types.ObjectId(restaurantId),
        branchId,
      },
      {
        $set: { isRoleActive: false },
      },
    );

    restaurant.branches[branchIndex] = branch;
    await restaurant.save();

    return branch;
  }

  async delete(restaurantId: string, branchId: string, caller?: JwtUser) {
    if (caller && !caller.isMainBranch) {
      throw new ForbiddenException('Chỉ quản trị viên chi nhánh chính mới có quyền xóa chi nhánh');
    }

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

    // Kiểm tra xem chi nhánh đã từng phát sinh đơn hàng nào chưa
    const hasOrders = await this.orderModel.exists({
      restaurantId: new Types.ObjectId(restaurantId),
      branchId,
    });

    if (hasOrders) {
      throw new BadRequestException(
        'Chi nhánh đã phát sinh đơn hàng trong quá khứ, không thể xóa vật lý để đảm bảo toàn vẹn dữ liệu kế toán. Vui lòng chuyển sang trạng thái Ngừng hoạt động (INACTIVE)',
      );
    }

    restaurant.branches = restaurant.branches.filter(
      (b: any) => b._id.toString() !== branchId && b.id !== branchId,
    );

    await restaurant.save();
    return { success: true, message: 'Đã xóa chi nhánh thành công' };
  }
}
