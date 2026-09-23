import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiPropertyOptional({ example: 'staff_an' })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({ example: 'staff.an@imenu.vn' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Nguyễn Văn An' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: '0901234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'role_object_id_here' })
  @IsString()
  @IsNotEmpty()
  roleId: string;

  @ApiPropertyOptional({ example: 'restaurant_object_id_here', description: 'Chi danh cho Super Admin tao ho cho nha hang' })
  @IsString()
  @IsOptional()
  restaurantId?: string;

  @ApiPropertyOptional({ example: 'branch_1' })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ example: 'Chi nhánh Quận 1' })
  @IsString()
  @IsOptional()
  branchName?: string;
}
