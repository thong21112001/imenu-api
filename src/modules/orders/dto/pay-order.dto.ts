import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsNumber, Min, IsString } from 'class-validator';
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

  @ApiPropertyOptional({ description: 'Số tiền giảm giá / chiết khấu', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ description: 'Phí dịch vụ', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  serviceFee?: number;

  @ApiPropertyOptional({ description: 'Tiền thuế VAT', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  vatAmount?: number;

  @ApiPropertyOptional({ description: 'Ghi chú thanh toán' })
  @IsOptional()
  @IsString()
  note?: string;
}
