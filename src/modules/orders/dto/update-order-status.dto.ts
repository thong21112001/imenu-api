import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum, IsOptional, IsString } from 'class-validator';
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
