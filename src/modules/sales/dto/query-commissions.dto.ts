import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryCommissionsDto {
  @IsOptional()
  @IsString()
  commissionType?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  payoutPeriod?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
