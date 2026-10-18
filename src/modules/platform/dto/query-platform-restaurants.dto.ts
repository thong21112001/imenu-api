import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryPlatformRestaurantsDto {
  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo tên, slug, phone, email chủ' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Lọc theo gói cước (Basic, Standard, Advanced, Pro)' })
  @IsOptional()
  @IsString()
  plan?: string;

  @ApiPropertyOptional({ description: 'Lọc theo trạng thái thuê bao (TRIAL, ACTIVE_PAID, SUSPENDED)' })
  @IsOptional()
  @IsString()
  subscriptionStatus?: string;

  @ApiPropertyOptional({ description: 'Lọc theo trạng thái khóa: true | false' })
  @IsOptional()
  isSuspended?: string | boolean;

  @ApiPropertyOptional({ description: 'Lọc theo NVKD phụ trách (salesId)' })
  @IsOptional()
  @IsString()
  salesId?: string;

  @ApiPropertyOptional({ description: 'Sắp xếp theo trường: totalGmvRevenue | createdAt | name' })
  @IsOptional()
  @IsString()
  sortBy?: 'totalGmvRevenue' | 'createdAt' | 'name';

  @ApiPropertyOptional({ description: 'Thứ tự sắp xếp: asc | desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: 'Trang hiện tại (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Số lượng bản ghi mỗi trang', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
