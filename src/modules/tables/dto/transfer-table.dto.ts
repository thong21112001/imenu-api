import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsArray, ArrayMinSize, IsOptional } from 'class-validator';

export class TransferTableDto {
  @ApiProperty({ description: 'ID bàn nguồn (bàn hiện tại)' })
  @IsNotEmpty({ message: 'Bàn nguồn không được để trống' })
  @IsString()
  fromTableId: string;

  @ApiProperty({ description: 'ID bàn đích (bàn muốn chuyển sang)' })
  @IsNotEmpty({ message: 'Bàn đích không được để trống' })
  @IsString()
  toTableId: string;

  @ApiPropertyOptional({ description: 'Lý do chuyển bàn' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class MergeTablesDto {
  @ApiProperty({ description: 'Danh sách các ID bàn cần gộp (bàn nguồn)', type: [String] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 bàn nguồn để gộp' })
  @IsString({ each: true })
  fromTableIds: string[];

  @ApiProperty({ description: 'ID bàn đích giữ lại nhận đơn gộp' })
  @IsNotEmpty({ message: 'Bàn đích không được để trống' })
  @IsString()
  targetTableId: string;

  @ApiPropertyOptional({ description: 'Ghi chú gộp bàn' })
  @IsOptional()
  @IsString()
  note?: string;
}
