import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SelectedOptionDto {
  @ApiProperty({ description: 'ID nhóm tùy chọn' })
  @IsNotEmpty()
  @IsString()
  groupId: string;

  @ApiProperty({ description: 'Tên nhóm tùy chọn' })
  @IsNotEmpty()
  @IsString()
  groupName: string;

  @ApiProperty({ description: 'ID giá trị tùy chọn' })
  @IsNotEmpty()
  @IsString()
  valueId: string;

  @ApiProperty({ description: 'Tên giá trị tùy chọn' })
  @IsNotEmpty()
  @IsString()
  valueName: string;

  @ApiProperty({ description: 'Phụ thu thêm' })
  @IsNumber()
  priceDelta: number;
}

export class CreateOrderItemDto {
  @ApiProperty({ description: 'ID món ăn trong thực đơn' })
  @IsNotEmpty({ message: 'menuItemId không được để trống' })
  @IsString()
  menuItemId: string;

  @ApiProperty({ description: 'Số lượng món', default: 1 })
  @IsNumber()
  @Min(1, { message: 'Số lượng tối thiểu là 1' })
  quantity: number;

  @ApiPropertyOptional({ description: 'Danh sách tùy chọn/Topping đã chọn', type: [SelectedOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedOptionDto)
  selectedOptions?: SelectedOptionDto[];

  @ApiPropertyOptional({ description: 'Ghi chú cho bếp (vd: Không hành, ít cay)' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'ID bàn ăn nhận đơn' })
  @IsNotEmpty({ message: 'tableId không được để trống' })
  @IsString()
  tableId: string;

  @ApiPropertyOptional({ description: 'Nguồn đơn hàng', default: 'STAFF_POS', enum: ['STAFF_POS', 'QR_CUSTOMER'] })
  @IsOptional()
  @IsEnum(['STAFF_POS', 'QR_CUSTOMER'])
  orderSource?: string;

  @ApiPropertyOptional({ description: 'ID chi nhánh áp dụng' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Ghi chú chung của khách' })
  @IsOptional()
  @IsString()
  customerNote?: string;

  @ApiProperty({ description: 'Danh sách các món ăn trong đơn', type: [CreateOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}

export class AddItemsToOrderDto {
  @ApiProperty({ description: 'Danh sách món ăn gọi thêm', type: [CreateOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @ApiPropertyOptional({ description: 'Ghi chú thêm' })
  @IsOptional()
  @IsString()
  note?: string;
}
