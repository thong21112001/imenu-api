import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional, Min, Max, IsEnum } from 'class-validator';

export class CreateTableDto {
  @ApiProperty({ description: 'Mã bàn (vd: B01, BAN-01)', example: 'B01' })
  @IsNotEmpty({ message: 'Mã bàn không được để trống' })
  @IsString({ message: 'Mã bàn phải là chuỗi ký tự' })
  code: string;

  @ApiProperty({ description: 'Tên hiển thị của bàn (vd: Bàn 01)', example: 'Bàn 01' })
  @IsNotEmpty({ message: 'Tên bàn không được để trống' })
  @IsString({ message: 'Tên bàn phải là chuỗi ký tự' })
  name: string;

  @ApiProperty({ description: 'ID khu vực bàn (Zone ID)' })
  @IsNotEmpty({ message: 'Khu vực bàn không được để trống' })
  @IsString({ message: 'Zone ID phải là chuỗi ký tự' })
  zoneId: string;

  @ApiPropertyOptional({ description: 'Sức chứa số lượng khách', default: 4, example: 4 })
  @IsOptional()
  @IsNumber({}, { message: 'Sức chứa phải là số' })
  @Min(1, { message: 'Sức chứa tối thiểu 1 người' })
  @Max(50, { message: 'Sức chứa tối đa 50 người' })
  capacity?: number;

  @ApiPropertyOptional({ description: 'Chi nhánh áp dụng' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Tên WiFi của quán' })
  @IsOptional()
  @IsString()
  wifiSsid?: string;

  @ApiPropertyOptional({ description: 'Mật khẩu WiFi của quán' })
  @IsOptional()
  @IsString()
  wifiPassword?: string;

  @ApiPropertyOptional({ description: 'Trạng thái mã QR', enum: ['active', 'revoked'] })
  @IsOptional()
  @IsEnum(['active', 'revoked'], { message: 'Trạng thái mã QR không hợp lệ' })
  qrStatus?: 'active' | 'revoked';

  @ApiPropertyOptional({ description: 'Token bảo mật của mã QR' })
  @IsOptional()
  @IsString()
  qrToken?: string;

  @ApiPropertyOptional({ description: 'URL trực tiếp của mã QR' })
  @IsOptional()
  @IsString()
  qrCodeUrl?: string;
}
