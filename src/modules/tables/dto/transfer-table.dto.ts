import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsArray,
  ArrayMinSize,
  IsOptional,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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

export class MoveItemSelectionDto {
  @ApiProperty({ description: 'ID món trong danh sách order.items cần chuyển' })
  @IsNotEmpty({ message: 'ID món không được để trống' })
  @IsString()
  itemId: string;

  @ApiPropertyOptional({ description: 'Số lượng muốn chuyển (mặc định chuyển toàn bộ số lượng món)' })
  @IsOptional()
  @IsNumber({}, { message: 'Số lượng phải là số' })
  @Min(1, { message: 'Số lượng chuyển tối thiểu là 1' })
  quantity?: number;
}

export class MoveTableItemsDto {
  @ApiProperty({ description: 'ID bàn nguồn' })
  @IsNotEmpty({ message: 'Bàn nguồn không được để trống' })
  @IsString()
  fromTableId: string;

  @ApiProperty({ description: 'ID bàn đích' })
  @IsNotEmpty({ message: 'Bàn đích không được để trống' })
  @IsString()
  toTableId: string;

  @ApiProperty({ description: 'Danh sách các món cần chuyển', type: [MoveItemSelectionDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 món để chuyển' })
  @ValidateNested({ each: true })
  @Type(() => MoveItemSelectionDto)
  items: MoveItemSelectionDto[];

  @ApiPropertyOptional({ description: 'Lý do chuyển món' })
  @IsOptional()
  @IsString()
  reason?: string;
}

