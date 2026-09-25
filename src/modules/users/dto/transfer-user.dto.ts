import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class TransferUserDto {
  @ApiProperty({ example: '64f1a2b3c4d5e6f7a8b9c0d2', description: 'ID chi nhánh đích cần chuyển đến' })
  @IsString()
  @IsNotEmpty({ message: 'ID chi nhánh đích không được để trống' })
  targetBranchId: string;

  @ApiPropertyOptional({ example: 'Điều động hỗ trợ chi nhánh mới', description: 'Lý do điều chuyển' })
  @IsOptional()
  @IsString()
  reason?: string;
}
