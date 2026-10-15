import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class BatchKitchenItemsDto {
  @ApiPropertyOptional({ description: 'Đợt gọi món cụ thể (roundNumber), nếu để trống sẽ áp dụng toàn vé' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  roundNumber?: number;
}
