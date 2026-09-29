import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsOptional, IsString } from 'class-validator';
import { PaginateDto } from '../../../shared/common/dto/paginate.dto';

export class QueryMenuItemDto extends PaginateDto {
  @ApiPropertyOptional({ description: 'Lọc theo ID danh mục' })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Lọc món theo trạng thái Còn món (true) hoặc Hết món (false)' })
  @IsBooleanString()
  @IsOptional()
  isAvailable?: string;

  @ApiPropertyOptional({ description: 'Lọc món theo tiêu chí Bán chạy (Popular)' })
  @IsBooleanString()
  @IsOptional()
  isPopular?: string;

  @ApiPropertyOptional({ description: 'ID nhà hàng (dành cho Super Admin hoặc Customer Menu)' })
  @IsString()
  @IsOptional()
  restaurantId?: string;
}
