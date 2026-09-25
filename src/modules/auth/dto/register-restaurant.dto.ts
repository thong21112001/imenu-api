import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RestaurantInfoDto {
  @ApiProperty({ example: 'Bếp Nhà - Ẩm Thực Việt' })
  @IsString()
  @IsNotEmpty({ message: 'Tên nhà hàng không được để trống' })
  name: string;

  @ApiProperty({ example: '0908 123 456' })
  @IsString()
  @IsNotEmpty({ message: 'Hotline nhà hàng không được để trống' })
  phone: string;

  @ApiProperty({ example: 'Số 68 Nguyễn Huệ, Q.1, TP.HCM' })
  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ nhà hàng không được để trống' })
  address: string;
}

export class OwnerInfoDto {
  @ApiProperty({ example: 'Nguyễn Minh An' })
  @IsString()
  @IsNotEmpty({ message: 'Họ tên chủ quán không được để trống' })
  fullName: string;

  @ApiProperty({ example: '0901 234 567' })
  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại chủ quán không được để trống' })
  phone: string;

  @ApiProperty({ example: 'owner@sample.vn' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({ example: 'Demo@123' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có tối thiểu 8 ký tự' })
  password: string;
}

export class RegisterRestaurantDto {
  @ApiProperty({ type: RestaurantInfoDto })
  @ValidateNested()
  @Type(() => RestaurantInfoDto)
  restaurant: RestaurantInfoDto;

  @ApiProperty({ type: OwnerInfoDto })
  @ValidateNested()
  @Type(() => OwnerInfoDto)
  owner: OwnerInfoDto;
}
