import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginateDto } from '../../../shared/common/dto/paginate.dto';
import { ActivityModule } from '../constants/audit-log.const';

export class QueryActivityLogDto extends PaginateDto {
  @ApiPropertyOptional({ enum: ActivityModule })
  @IsEnum(ActivityModule)
  @IsOptional()
  module?: ActivityModule;
}
