import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'nhahang_hoasen' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'chuquan@hoasen.vn' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Nguyễn Văn Chủ Quán' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: '0988888888' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'Nhà hàng Ẩm Thực Hoa Sen' })
  @IsString()
  @IsNotEmpty()
  restaurantName: string;

  @ApiPropertyOptional({ example: '123 Nguyễn Huệ, Quận 1, TP.HCM' })
  @IsString()
  @IsOptional()
  address?: string;
}
