import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class ExecuteMcpToolDto {
  @ApiProperty({
    description: 'Tên công cụ MCP cần thực thi (ví dụ: get_platform_revenue_overview)',
    example: 'get_platform_revenue_overview',
  })
  @IsString({ message: 'Tên tool phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tên tool không được để trống' })
  tool: string;

  @ApiPropertyOptional({
    description: 'Tham số đầu vào dưới dạng JSON object tuân theo inputSchema của tool',
    example: { limit: 5 },
  })
  @IsOptional()
  @IsObject({ message: 'Arguments phải là một đối tượng JSON hợp lệ' })
  arguments?: Record<string, any>;
}

