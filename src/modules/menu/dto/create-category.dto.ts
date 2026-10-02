import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Món Chính', description: 'Tên danh mục thực đơn' })
  @IsString()
  @IsNotEmpty({ message: 'Tên danh mục không được để trống' })
  name: string;

  @ApiPropertyOptional({ example: 'mon-chinh', description: 'Đường dẫn định danh (slug)' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ example: '🍲', description: 'Biểu tượng danh mục (Emoji hoặc Icon name)' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ example: 1, description: 'Thứ tự hiển thị' })
  @IsNumber()
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({ example: true, description: 'Trạng thái hoạt động' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Danh sách chi nhánh áp dụng (Rỗng = Tất cả)' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  branchIds?: string[];
}
