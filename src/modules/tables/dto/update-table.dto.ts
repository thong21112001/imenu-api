import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min, Max, IsEnum } from 'class-validator';
import { TableStatus } from '../entities/table.entity';

export class UpdateTableDto {
  @ApiPropertyOptional({ description: 'Mã bàn' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Tên bàn' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'ID khu vực (Zone ID)' })
  @IsOptional()
  @IsString()
  zoneId?: string;

  @ApiPropertyOptional({ description: 'Sức chứa' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  capacity?: number;

  @ApiPropertyOptional({
    description: 'Trạng thái bàn',
    enum: ['Available', 'Occupied', 'PaymentRequested', 'Reserved', 'Cleaning'],
  })
  @IsOptional()
  @IsEnum(['Available', 'Occupied', 'PaymentRequested', 'Reserved', 'Cleaning'], {
    message: 'Trạng thái bàn không hợp lệ',
  })
  status?: TableStatus;

  @ApiPropertyOptional({ description: 'Số khách thực tế đang ngồi' })
  @IsOptional()
  @IsNumber()
  totalGuests?: number;

  @ApiPropertyOptional({ description: 'Tên WiFi' })
  @IsOptional()
  @IsString()
  wifiSsid?: string;

  @ApiPropertyOptional({ description: 'Mật khẩu WiFi' })
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

export class UpdateTableStatusDto {
  @ApiPropertyOptional({
    description: 'Trạng thái mới của bàn',
    enum: ['Available', 'Occupied', 'PaymentRequested', 'Reserved', 'Cleaning'],
  })
  @IsEnum(['Available', 'Occupied', 'PaymentRequested', 'Reserved', 'Cleaning'], {
    message: 'Trạng thái bàn không hợp lệ',
  })
  status: TableStatus;

  @ApiPropertyOptional({ description: 'Số khách ngồi' })
  @IsOptional()
  @IsNumber()
  totalGuests?: number;
}
