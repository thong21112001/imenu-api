import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { PayoutBankAccountDto } from './create-sales-rep.dto';

export class UpdateSalesRepDto {
  @ApiPropertyOptional({ description: 'Trạng thái tài khoản: ACTIVE hoặc INACTIVE', enum: ['ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';

  @ApiPropertyOptional({ description: 'Mã giới thiệu mới' })
  @IsOptional()
  @IsString()
  referralCode?: string;

  @ApiPropertyOptional({ description: '% hoa hồng Setup' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  setupCommissionRate?: number;

  @ApiPropertyOptional({ description: '% hoa hồng Duy trì' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  renewalCommissionRate?: number;

  @ApiPropertyOptional({ description: 'Thưởng kích hoạt quán chuẩn (VND)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  activationBonusAmount?: number;

  @ApiPropertyOptional({ description: 'Thưởng quản lý nhóm (VND)' })
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
