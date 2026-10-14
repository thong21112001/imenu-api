import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class KitchenToggleAvailabilityDto {
  @ApiProperty({ description: 'Trạng thái còn món hay hết món (true: còn món, false: hết món)' })
  @IsBoolean()
  isAvailable: boolean;

  @ApiPropertyOptional({ description: 'Chi nhánh áp dụng (mặc định lấy theo chi nhánh của tài khoản Bếp)' })
  @IsOptional()
  @IsString()
  branchId?: string;
}
