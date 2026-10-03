import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class BillPreviewDto {
  @ApiPropertyOptional({ description: 'Số tiền giảm giá cố định (VNĐ)', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ description: 'Phần trăm giảm giá (0 - 100%)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({ description: 'Phí dịch vụ cố định (VNĐ)', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  serviceFee?: number;

  @ApiPropertyOptional({ description: 'Phần trăm phí dịch vụ (0 - 100%)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  serviceFeePercent?: number;

  @ApiPropertyOptional({ description: 'Tiền thuế VAT cố định (VNĐ)', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  vatAmount?: number;

  @ApiPropertyOptional({ description: 'Phần trăm thuế VAT (0 - 100%)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  vatPercent?: number;
}
