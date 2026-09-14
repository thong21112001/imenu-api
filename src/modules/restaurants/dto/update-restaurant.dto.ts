import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BankAccountDto {
  @ApiPropertyOptional({ example: 'MB' })
  @IsOptional()
  @IsString()
  bankId?: string;

  @ApiPropertyOptional({ example: 'MBBank' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: '0908123456' })
  @IsOptional()
  @IsString()
  accountNo?: string;

  @ApiPropertyOptional({ example: 'BEP NHA RESTAURANT' })
  @IsOptional()
  @IsString()
  accountName?: string;

  @ApiPropertyOptional({ example: 'compact' })
  @IsOptional()
  @IsString()
  template?: string;
}

export class UpdateRestaurantDto {
  @ApiPropertyOptional({ example: 'Bếp Nhà - Ẩm Thực Việt' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '0908 123 456' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Số 68 Nguyễn Huệ, Q.1, TP.HCM' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'https://example.com/cover.png' })
  @IsOptional()
  @IsString()
  coverUrl?: string;

  @ApiPropertyOptional({ example: 'Hương vị truyền thống, phục vụ hiện đại' })
  @IsOptional()
  @IsString()
  tagline?: string;

  @ApiPropertyOptional({ example: '08:00 - 22:30' })
  @IsOptional()
  @IsString()
  openingHours?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @ApiPropertyOptional({ type: BankAccountDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BankAccountDto)
  bankAccount?: BankAccountDto;
}
