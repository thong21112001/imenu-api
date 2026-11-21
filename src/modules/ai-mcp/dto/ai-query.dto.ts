import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * AiQueryDto
 *
 * Data Transfer Object cho API truy vấn thông minh SuperAdmin AI MCP (Sub-phase 18.2).
 */
export class AiQueryDto {
  @ApiProperty({
    description: 'Câu hỏi hoặc yêu cầu phân tích từ SuperAdmin (tối đa 1000 ký tự)',
    example: 'Tổng quan doanh thu sàn tháng này thế nào?',
    maxLength: 1000,
  })
  @IsString({ message: 'Câu hỏi prompt phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Câu hỏi prompt không được để trống' })
  @MaxLength(1000, { message: 'Câu hỏi prompt không được vượt quá 1000 ký tự' })
  prompt: string;

  @ApiPropertyOptional({
    description:
      'Mã prompt chip định sẵn (VD: REVENUE_OVERVIEW, CHURN_RISK, COMMISSION_AUDIT, UNDERPERFORMING_DIAGNOSE)',
    example: 'REVENUE_OVERVIEW',
  })
  @IsOptional()
  @IsString({ message: 'promptChipId phải là chuỗi ký tự' })
  promptChipId?: string;
}

