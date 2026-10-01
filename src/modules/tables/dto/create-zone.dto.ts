import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateTableZoneDto {
  @ApiProperty({ description: 'Tên khu vực (vd: Tầng 1, Sân vườn, VIP)', example: 'Tầng 1' })
  @IsNotEmpty({ message: 'Tên khu vực không được để trống' })
  @IsString({ message: 'Tên khu vực phải là chuỗi' })
  name: string;

  @ApiPropertyOptional({ description: 'Mô tả khu vực' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'ID chi nhánh áp dụng' })
  @IsOptional()
  @IsString()
  branchId?: string;
}

export class UpdateTableZoneDto {
  @ApiPropertyOptional({ description: 'Tên khu vực' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Mô tả khu vực' })
  @IsOptional()
  @IsString()
  description?: string;
}
