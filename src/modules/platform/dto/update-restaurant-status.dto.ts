import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateRestaurantStatusDto {
  @ApiProperty({ description: 'Trạng thái khóa tạm thời hay hoạt động bình thường' })
  @IsBoolean()
  isSuspended: boolean;

  @ApiPropertyOptional({ description: 'Lý do khóa hoặc mở khóa nhà hàng' })
  @IsOptional()
  @IsString()
  suspendReason?: string;
}
