import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class PayoutBatchDto {
  @ApiProperty({ description: 'Danh sách ID các khoản hoa hồng cần xử lý' })
  @IsArray()
  @ArrayNotEmpty()
  ledgerIds: string[];

  @ApiProperty({ description: 'Hành động: APPROVE (Duyệt) hoặc PAY (Xác nhận chi trả)', enum: ['APPROVE', 'PAY'] })
  @IsEnum(['APPROVE', 'PAY'])
  action: 'APPROVE' | 'PAY';

  @ApiPropertyOptional({ description: 'Mã tham chiếu chuyển khoản hoặc mã giao dịch ngân hàng' })
  @IsOptional()
  @IsString()
  payoutReference?: string;

  @ApiPropertyOptional({ description: 'Ghi chú đợt đối soát' })
  @IsOptional()
  @IsString()
  note?: string;
}
