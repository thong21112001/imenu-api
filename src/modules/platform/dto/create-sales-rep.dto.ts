import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class PayoutBankAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountName?: string;
}

export class CreateSalesRepDto {
  @ApiProperty({ description: 'Họ và tên NVKD', example: 'Nguyễn Văn Kinh Doanh' })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiProperty({ description: 'Email đăng nhập NVKD', example: 'sales01@imenu.vn' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Số điện thoại liên hệ', example: '0901234567' })
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ApiPropertyOptional({ description: 'Mật khẩu khởi tạo' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'Mã giới thiệu tùy chỉnh' })
  @IsOptional()
  @IsString()
  referralCode?: string;

  @ApiPropertyOptional({ description: 'ID NVKD cấp trên (nếu là sub-sales)' })
  @IsOptional()
  @IsString()
  parentSalesId?: string;

  @ApiPropertyOptional({ description: '% hoa hồng Setup (mặc định 50%)', default: 50 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  setupCommissionRate?: number;

  @ApiPropertyOptional({ description: '% hoa hồng Duy trì (mặc định 20%)', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  renewalCommissionRate?: number;

  @ApiPropertyOptional({ description: 'Thưởng kích hoạt quán chuẩn (VND)', default: 250000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  activationBonusAmount?: number;

  @ApiPropertyOptional({ description: 'Thưởng quản lý nhóm (VND)', default: 250000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  teamBonusAmount?: number;

  @ApiPropertyOptional({ description: 'Tài khoản ngân hàng thụ hưởng' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PayoutBankAccountDto)
  payoutBankAccount?: PayoutBankAccountDto;
}
