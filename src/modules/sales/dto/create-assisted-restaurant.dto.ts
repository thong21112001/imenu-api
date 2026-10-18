import { IsBoolean, IsEmail, IsNotEmpty, IsObject, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AssistedRestaurantInfo {
  @IsNotEmpty({ message: 'Tên nhà hàng không được để trống' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: 'Hotline nhà hàng không được để trống' })
  @IsString()
  phone: string;

  @IsNotEmpty({ message: 'Địa chỉ nhà hàng không được để trống' })
  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  tagline?: string;
}

class AssistedOwnerInfo {
  @IsNotEmpty({ message: 'Họ tên chủ quán không được để trống' })
  @IsString()
  fullName: string;

  @IsNotEmpty({ message: 'Số điện thoại chủ quán không được để trống' })
  @IsString()
  phone: string;

  @IsNotEmpty({ message: 'Email chủ quán không được để trống' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @MinLength(8, { message: 'Mật khẩu phải có tối thiểu 8 ký tự' })
  @IsString()
  password: string;
}

export class CreateAssistedRestaurantDto {
  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => AssistedRestaurantInfo)
  restaurant: AssistedRestaurantInfo;

  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => AssistedOwnerInfo)
  owner: AssistedOwnerInfo;

  @IsOptional()
  @IsBoolean()
  seedDemoTables?: boolean = true;

  @IsOptional()
  @IsBoolean()
  seedDemoMenu?: boolean = true;
}
