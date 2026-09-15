import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { BranchStatus } from '../entities/branch.schema';

export class CreateBranchDto {
  @ApiProperty({ example: 'Chi nhánh Quận 3' })
  @IsString()
  @IsNotEmpty({ message: 'Tên chi nhánh không được để trống' })
  name: string;

  @ApiProperty({ example: '124 Nam Kỳ Khởi Nghĩa, Q.3, TP.HCM' })
  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ chi nhánh không được để trống' })
  address: string;

  @ApiProperty({ example: '0908 654 321' })
  @IsString()
  @IsNotEmpty({ message: 'Hotline chi nhánh không được để trống' })
  phone: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isMainBranch?: boolean;

  @ApiPropertyOptional({ enum: BranchStatus, default: BranchStatus.ACTIVE })
  @IsOptional()
  @IsEnum(BranchStatus)
  status?: BranchStatus;
}

export class UpdateBranchDto {
  @ApiPropertyOptional({ example: 'Chi nhánh Quận 3 (Mới)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '124 Nam Kỳ Khởi Nghĩa, Q.3, TP.HCM' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '0908 654 321' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isMainBranch?: boolean;

  @ApiPropertyOptional({ enum: BranchStatus })
  @IsOptional()
  @IsEnum(BranchStatus)
  status?: BranchStatus;
}

export class CloseBranchDto {
  @ApiPropertyOptional({ example: 'Sửa chữa mặt bằng và bảo dưỡng thiết bị' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ example: false, description: 'Tự động hủy các đơn chưa hoàn tất nếu có' })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class DeactivateBranchDto {
  @ApiPropertyOptional({ example: 'Ngừng kinh doanh chi nhánh vĩnh viễn' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ example: false, description: 'Tự động xử lý các đơn đang mở' })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
