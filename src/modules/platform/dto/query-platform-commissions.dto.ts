import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryPlatformCommissionsDto {
  @ApiPropertyOptional({ description: 'Lọc theo trạng thái hoa hồng (PENDING, APPROVED, PAID)' })
  @IsOptional()
  @IsString()
  @IsIn(['PENDING', 'APPROVED', 'PAID', 'ALL'])
  status?: string;

  @ApiPropertyOptional({ description: 'Lọc theo NVKD thụ hưởng (salesId)' })
  @IsOptional()
  @IsString()
  salesId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo kỳ đối soát (Ví dụ: 2026-10-PERIOD_1, 2026-10-PERIOD_2)' })
  @IsOptional()
  @IsString()
  payoutPeriod?: string;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm (mã hoa hồng, tên NVKD, referralCode)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Trang hiện tại (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Số lượng bản ghi mỗi trang', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}
