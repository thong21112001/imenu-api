import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryOrderDto {
  @ApiPropertyOptional({ description: 'ID chi nhánh' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'ID bàn ăn' })
  @IsOptional()
  @IsString()
  tableId?: string;

  @ApiPropertyOptional({ description: 'Trạng thái đơn hàng' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Lọc đơn chưa thanh toán / đã thanh toán' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPaid?: boolean;

  @ApiPropertyOptional({ description: 'Trang hiện tại', default: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Số lượng mỗi trang', default: 20 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number = 20;
}
