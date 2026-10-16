import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateOrderItemDto } from './create-order.dto';
import { PaymentMethod } from '../entities/order.entity';

export class CustomerCreateOrderDto {
  @ApiProperty({ description: 'Slug định danh nhà hàng (vd: bep-nha)', example: 'bep-nha' })
  @IsNotEmpty({ message: 'restaurantSlug không được để trống' })
  @IsString()
  restaurantSlug: string;

  @ApiProperty({ description: 'Mã bàn ăn (vd: ban-01)', example: 'ban-01' })
  @IsNotEmpty({ message: 'tableCode không được để trống' })
  @IsString()
  tableCode: string;

  @ApiProperty({ description: 'Mã xác thực token của bàn từ mã QR', example: 'qr-token-123' })
  @IsNotEmpty({ message: 'qrToken không được để trống' })
  @IsString()
  qrToken: string;

  @ApiPropertyOptional({ description: 'Ghi chú chung của khách hàng' })
  @IsOptional()
  @IsString()
  customerNote?: string;

  @ApiProperty({ description: 'Danh sách các món ăn trong đơn', type: [CreateOrderItemDto] })
  @IsArray({ message: 'items phải là một mảng' })
  @ArrayNotEmpty({ message: 'Danh sách món ăn không được để trống' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}

export class CustomerAddItemsDto {
  @ApiProperty({ description: 'Slug định danh nhà hàng (vd: bep-nha)', example: 'bep-nha' })
  @IsNotEmpty({ message: 'restaurantSlug không được để trống' })
  @IsString()
  restaurantSlug: string;

  @ApiProperty({ description: 'Mã bàn ăn (vd: ban-01)', example: 'ban-01' })
  @IsNotEmpty({ message: 'tableCode không được để trống' })
  @IsString()
  tableCode: string;

  @ApiProperty({ description: 'Mã xác thực token của bàn từ mã QR', example: 'qr-token-123' })
  @IsNotEmpty({ message: 'qrToken không được để trống' })
  @IsString()
  qrToken: string;

  @ApiPropertyOptional({ description: 'ID đơn hàng (nếu không truyền sẽ tự động lấy đơn đang hoạt động của bàn)' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Ghi chú cho đợt gọi thêm món' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ description: 'Danh sách món ăn gọi thêm', type: [CreateOrderItemDto] })
  @IsArray({ message: 'items phải là một mảng' })
  @ArrayNotEmpty({ message: 'Danh sách món gọi thêm không được để trống' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}

export class CustomerGetActiveOrderDto {
  @ApiProperty({ description: 'Slug định danh nhà hàng (vd: bep-nha)', example: 'bep-nha' })
  @IsNotEmpty({ message: 'restaurantSlug không được để trống' })
  @IsString()
  restaurantSlug: string;

  @ApiProperty({ description: 'Mã bàn ăn (vd: ban-01)', example: 'ban-01' })
  @IsNotEmpty({ message: 'tableCode không được để trống' })
  @IsString()
  tableCode: string;

  @ApiProperty({ description: 'Mã xác thực token của bàn từ mã QR', example: 'qr-token-123' })
  @IsNotEmpty({ message: 'qrToken không được để trống' })
  @IsString()
  qrToken: string;
}

export class RequestPaymentDto {
  @ApiPropertyOptional({
    description: 'Phương thức thanh toán mong muốn',
    enum: ['VietQR', 'Cash', 'Card', 'Transfer'],
    default: 'VietQR',
  })
  @IsOptional()
  @IsEnum(['VietQR', 'Cash', 'Card', 'Transfer'], {
    message: 'paymentMethod phải là VietQR, Cash, Card hoặc Transfer',
  })
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Slug định danh nhà hàng (nếu khách quét QR)' })
  @IsOptional()
  @IsString()
  restaurantSlug?: string;

  @ApiPropertyOptional({ description: 'Mã bàn ăn (nếu khách quét QR)' })
  @IsOptional()
  @IsString()
  tableCode?: string;

  @ApiPropertyOptional({ description: 'Mã xác thực token của bàn từ mã QR' })
  @IsOptional()
  @IsString()
  qrToken?: string;
}

export class CustomerRequestPaymentDto extends RequestPaymentDto {}

