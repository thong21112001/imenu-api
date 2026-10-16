import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginateDto } from '../../../shared/common/dto/paginate.dto';
import { ActivityAction, ActivityModule } from '../constants/audit-log.const';

export class QueryActivityLogDto extends PaginateDto {
  @ApiPropertyOptional({ enum: ActivityModule })
  @IsEnum(ActivityModule)
  @IsOptional()
  module?: ActivityModule;

  @ApiPropertyOptional({ enum: ActivityAction })
  @IsEnum(ActivityAction)
  @IsOptional()
  action?: ActivityAction;

  @ApiPropertyOptional({ description: 'ID chi nhánh' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Mã đối tượng mục tiêu (target_id)' })
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiPropertyOptional({ description: 'Từ ngày (ISO string hoặc YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Đến ngày (ISO string hoặc YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  toDate?: string;
}

