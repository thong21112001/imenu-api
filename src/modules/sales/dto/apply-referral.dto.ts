import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApplyReferralDto {
  @IsNotEmpty({ message: 'Vui lòng nhập họ và tên' })
  @IsString()
  fullName: string;

  @IsNotEmpty({ message: 'Vui lòng nhập số điện thoại' })
  @IsString()
  phone: string;

  @IsNotEmpty({ message: 'Vui lòng nhập địa chỉ email' })
  @IsEmail({}, { message: 'Địa chỉ email không hợp lệ' })
  email: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  parentReferralCode?: string;
}
