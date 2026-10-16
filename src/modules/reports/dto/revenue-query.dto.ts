import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

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

  @ApiPropertyOptional({ example: 'daily', enum: ['daily', 'weekly', 'monthly'], description: 'Chu kỳ phân tích doanh thu' })
  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly'])
  period?: 'daily' | 'weekly' | 'monthly';

  @ApiPropertyOptional({ example: 'day', enum: ['day', 'week', 'month'], default: 'day', description: 'Gom nhóm dòng thời gian (ngày, tuần, tháng)' })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: 'day' | 'week' | 'month';

  @ApiPropertyOptional({ example: 10, default: 10, description: 'Số lượng món top bán chạy (1 - 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ example: 'csv', enum: ['csv', 'json'], default: 'csv', description: 'Định dạng xuất dữ liệu' })
  @IsOptional()
  @IsIn(['csv', 'json'])
  format?: 'csv' | 'json';
}
