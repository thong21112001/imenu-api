import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '../entities/order.entity';

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'Trạng thái đơn hàng',
    enum: [
      'WaitingConfirmation',
      'Confirmed',
      'Preparing',
      'Ready',
      'Served',
      'PaymentRequested',
      'Paid',
      'Cancelled',
    ],
  })
  @IsNotEmpty()
  @IsEnum([
    'WaitingConfirmation',
    'Confirmed',
    'Preparing',
    'Ready',
    'Served',
    'PaymentRequested',
    'Paid',
    'Cancelled',
  ])
  status: OrderStatus;

  @ApiPropertyOptional({ description: 'Lý do thay đổi trạng thái hoặc lý do hủy' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CancelOrderDto {
  @ApiProperty({ description: 'Lý do hủy đơn hàng bắt buộc' })
  @IsNotEmpty({ message: 'Lý do hủy đơn hàng không được để trống' })
  @IsString()
  reason: string;
}

export class CancelOrderItemDto {
  @ApiProperty({ description: 'Lý do hủy món ăn bắt buộc' })
  @IsNotEmpty({ message: 'Lý do hủy món ăn không được để trống' })
  @IsString()
  reason: string;
}

export class ConfirmRoundDto {
  @ApiProperty({ description: 'Số thứ tự đợt gọi món cần duyệt (Round 1, 2...)', default: 1 })
  @IsNotEmpty({ message: 'Số thứ tự đợt gọi không được để trống' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roundNumber: number;
}

export class CancelRoundDto {
  @ApiPropertyOptional({ description: 'Số thứ tự đợt gọi món cần từ chối', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roundNumber?: number;

  @ApiProperty({ description: 'Lý do từ chối đợt gọi món bắt buộc' })
  @IsNotEmpty({ message: 'Lý do từ chối đợt gọi món không được để trống' })
  @IsString()
  reason: string;
}
