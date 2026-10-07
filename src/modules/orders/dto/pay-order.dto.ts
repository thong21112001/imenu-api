import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsNumber, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../entities/order.entity';

export class PayOrderDto {
  @ApiPropertyOptional({
    description: 'Phương thức thanh toán',
    enum: ['VietQR', 'Cash', 'Card', 'Transfer'],
    default: 'VietQR',
  })
  @IsOptional()
  @IsEnum(['VietQR', 'Cash', 'Card', 'Transfer'])
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Số tiền giảm giá / chiết khấu cố định (VNĐ)', default: 0 })
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

  @ApiPropertyOptional({ description: 'Số tiền khách đưa (chỉ áp dụng cho tiền mặt Cash)', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountReceived?: number;

  @ApiPropertyOptional({ description: 'Số tiền khách đưa - alias tương thích cho amountReceived', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cashGiven?: number;

  @ApiPropertyOptional({ description: 'Ghi chú thanh toán' })
  @IsOptional()
  @IsString()
  note?: string;
}
