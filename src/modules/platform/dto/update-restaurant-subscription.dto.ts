import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateRestaurantSubscriptionDto {
  @ApiProperty({ description: 'Gói cước mới', example: 'Pro' })
  @IsString()
  plan: string;

  @ApiPropertyOptional({ description: 'Chu kỳ thanh toán', example: 'YEARLY' })
  @IsOptional()
  @IsString()
  billingCycle?: string;

  @ApiProperty({ description: 'Loại giao dịch: INITIAL_SETUP hoặc RENEWAL', example: 'INITIAL_SETUP' })
  @IsEnum(['INITIAL_SETUP', 'RENEWAL'])
  transactionType: 'INITIAL_SETUP' | 'RENEWAL';

  @ApiProperty({ description: 'Số tiền thực thu (VND)', example: 4800000 })
  @IsNumber()
  @Min(0)
  netAmount: number;

  @ApiPropertyOptional({ description: 'Thời điểm hết hạn gói cước' })
  @IsOptional()
  planExpiresAt?: string | Date;

  @ApiPropertyOptional({ description: 'Ghi chú giao dịch' })
  @IsOptional()
  @IsString()
  note?: string;
}
