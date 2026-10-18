import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryReferredRestaurantsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  subscriptionStatus?: string;

  @IsOptional()
  @IsString()
  isActivationQualified?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
