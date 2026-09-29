import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class MenuItemOptionValueDto {
  @ApiProperty({ example: 'opt-val-1' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ example: 'Size Lớn (+10k)' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 10000, description: 'Giá cộng thêm (VND)' })
  @IsNumber()
  @Min(0)
  priceDelta: number;
}

export class MenuItemOptionGroupDto {
  @ApiProperty({ example: 'opt-grp-size' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ example: 'Kích cỡ (Size)' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @ApiPropertyOptional({ example: false, default: false })
  @IsBoolean()
  @IsOptional()
  multiple?: boolean;

  @ApiProperty({ type: [MenuItemOptionValueDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuItemOptionValueDto)
  values: MenuItemOptionValueDto[];
}

export class CreateMenuItemDto {
  @ApiProperty({ example: 'Cơm Chiên Hải Sản Hoàng Gia' })
  @IsString()
  @IsNotEmpty({ message: 'Tên món ăn không được để trống' })
  name: string;

  @ApiPropertyOptional({ example: 'com-chien-hai-san-hoang-gia' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiProperty({ example: '66a123...', description: 'ID danh mục món' })
  @IsString()
  @IsNotEmpty({ message: 'Danh mục món ăn không được để trống' })
  categoryId: string;

  @ApiPropertyOptional({ example: 'Hải sản tươi ngọt xào cùng cơm hạt vàng giòn' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 79000, description: 'Giá bán chính thức (VND)' })
  @IsNumber({}, { message: 'Giá bán phải là số hợp lệ' })
  @Min(0, { message: 'Giá bán không được nhỏ hơn 0' })
  price: number;

  @ApiPropertyOptional({ example: 89000, description: 'Giá gốc trước khi giảm (VND)' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  originalPrice?: number;

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/...' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ example: true, default: true, description: 'Còn món hay Hết món' })
  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @ApiPropertyOptional({ example: false, default: false, description: 'Món bán chạy' })
  @IsBoolean()
  @IsOptional()
  isPopular?: boolean;

  @ApiPropertyOptional({ example: false, default: false, description: 'Món mới ra mắt' })
  @IsBoolean()
  @IsOptional()
  isNewItem?: boolean;

  @ApiPropertyOptional({ type: [MenuItemOptionGroupDto], description: 'Danh sách nhóm tùy chọn (Size, Topping...)' })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => MenuItemOptionGroupDto)
  options?: MenuItemOptionGroupDto[];
}
