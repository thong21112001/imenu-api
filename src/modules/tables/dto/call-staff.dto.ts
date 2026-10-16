import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CallStaffDto {
  @ApiProperty({
    description: 'Lý do gọi nhân viên phục vụ',
    example: 'Xin thêm đá lạnh',
    maxLength: 200,
  })
  @IsString({ message: 'Lý do gọi nhân viên phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Lý do gọi nhân viên không được để trống' })
  @MaxLength(200, { message: 'Lý do gọi nhân viên tối đa 200 ký tự' })
  reason: string;

  @ApiPropertyOptional({
    description: 'Ghi chú thêm từ khách hàng',
    example: 'Gấp giúp bàn 5 nhé',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi ký tự' })
  @MaxLength(500, { message: 'Ghi chú tối đa 500 ký tự' })
  note?: string;

  @ApiPropertyOptional({
    description: 'Mã QR Token của bàn để xác thực bảo mật',
    example: 'k9f3a1b2',
  })
  @IsOptional()
  @IsString({ message: 'QR Token phải là chuỗi ký tự' })
  qrToken?: string;

  @ApiPropertyOptional({
    description: 'Slug nhà hàng để kiểm tra chéo',
    example: 'bep-nha-hoi-an',
  })
  @IsOptional()
  @IsString({ message: 'Restaurant slug phải là chuỗi ký tự' })
  restaurantSlug?: string;
}
