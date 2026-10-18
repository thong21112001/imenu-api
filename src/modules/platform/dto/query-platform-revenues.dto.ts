import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryPlatformRevenuesDto {
  @ApiPropertyOptional({
    description: 'Khoảng thời gian: today | this_week | this_month | last_month | custom',
    example: 'this_month',
  })
  @IsOptional()
  @IsString()
  timeRange?: 'today' | 'this_week' | 'this_month' | 'last_month' | 'custom';

  @ApiPropertyOptional({ description: 'Ngày bắt đầu (ISO Date string)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Ngày kết thúc (ISO Date string)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Drill-down theo một nhà hàng cụ thể' })
  @IsOptional()
  @IsString()
  restaurantId?: string;
}
