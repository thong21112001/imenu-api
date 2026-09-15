import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';

export class RevenueQueryDto {
  @ApiPropertyOptional({ example: '2026-09-01', description: 'Ngày bắt đầu (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-09-15', description: 'Ngày kết thúc (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'all', description: 'ID chi nhánh hoặc "all" để xem toàn bộ chuỗi (chỉ áp dụng cho chi nhánh chính)' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ example: 'day', enum: ['day', 'week', 'month'], default: 'day' })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: 'day' | 'week' | 'month';

  @ApiPropertyOptional({ example: 10, default: 10, description: 'Số lượng món top bán chạy' })
  @IsOptional()
  limit?: number;
}
