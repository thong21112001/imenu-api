import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class ToggleItemStatusDto {
  @ApiPropertyOptional({ example: true, description: 'Trạng thái Còn món (true) hoặc Hết món (false). Nếu bỏ trống sẽ tự động đảo trạng thái hiện tại.' })
  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}
