import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ProcessSubscriptionDto {
  @IsNotEmpty({ message: 'Vui lòng cung cấp restaurantId' })
  @IsString()
  restaurantId: string;

  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @IsString()
  planType?: string;

  @IsOptional()
  @IsEnum(['MONTHLY', 'YEARLY'])
  billingCycle?: string;

  @IsOptional()
  @IsEnum(['INITIAL_SETUP', 'RENEWAL', 'UPGRADE', 'SETUP'])
  transactionType?: 'INITIAL_SETUP' | 'RENEWAL' | 'UPGRADE' | 'SETUP';

  @IsOptional()
  @IsNumber()
  @Min(0)
  grossAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsNumber()
  durationMonths?: number;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  netAmount?: number;

  @IsOptional()
  @IsString()
  paymentStatus?: string = 'PAID';
}
