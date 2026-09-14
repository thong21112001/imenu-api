import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBranchDto {
  @ApiProperty({ example: 'Chi nhánh Quận 3' })
  @IsString()
  @IsNotEmpty({ message: 'Tên chi nhánh không được để trống' })
  name: string;

  @ApiProperty({ example: '124 Nam Kỳ Khởi Nghĩa, Q.3, TP.HCM' })
  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ chi nhánh không được để trống' })
  address: string;

  @ApiProperty({ example: '0908 654 321' })
  @IsString()
  @IsNotEmpty({ message: 'Hotline chi nhánh không được để trống' })
  phone: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isMainBranch?: boolean;
}

export class UpdateBranchDto {
  @ApiPropertyOptional({ example: 'Chi nhánh Quận 3 (Mới)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '124 Nam Kỳ Khởi Nghĩa, Q.3, TP.HCM' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '0908 654 321' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isMainBranch?: boolean;
}
